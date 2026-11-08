// 治療院の体験談（/clinic/:id に載せるランナーの投稿）
// Render のディスクはデプロイのたびに消えるので、本文も写真も Firestore に置く。
// 写真は Storage のバケットがまだ無いため、ブラウザで縮めた JPEG を1枚ずつ別ドキュメントに入れる（1件1MiBまで）。
//   clinicPosts/{postId}               投稿本体
//   clinicPosts/{postId}/helpful/{uid} 「参考になった」を押した人（1人1回）
//   clinicPostPhotos/{photoId}         写真のバイト列
const { db, admin } = require('../firebase/admin');

const POSTS = 'clinicPosts';
const PHOTOS = 'clinicPostPhotos';

// 選択肢（絞り込みに使うので自由入力にしない。細かいことは injuryNote に書いてもらう）
const INJURIES = [
  'シンスプリント', '足底腱膜炎', 'ランナー膝（腸脛靭帯炎）', '鵞足炎', '膝蓋腱炎（ジャンパー膝）',
  'アキレス腱の痛み', '疲労骨折', 'ふくらはぎの肉離れ・張り', '太もも裏の肉離れ', '足首のねんざ',
  '股関節の痛み', '腰の痛み', 'その他',
];
const PERIODS = ['1週間以内', '1か月以内', '3か月以内', '半年以内', '半年以上', 'まだ通っている'];
const OUTCOMES = ['痛みなく走れるようになった', 'だいぶ良くなった', '少し良くなった', '変わらなかった', 'まだ分からない'];

const LIMITS = { nickname: 30, injuryNote: 60, treatment: 400, body: 2000, photos: 4, photoBytes: 900 * 1024 };
const MAX_POSTS_PER_DAY = 5;

const toDate = t => (t && t.toDate ? t.toDate() : null);

function shape(doc) {
  const d = doc.data();
  return {
    id: doc.id, clinicId: d.clinicId, uid: d.uid, nickname: d.nickname || 'ランナー',
    injury: d.injury, injuryNote: d.injuryNote || '', treatment: d.treatment || '',
    period: d.period, outcome: d.outcome, body: d.body || '',
    photoIds: d.photoIds || [], helpfulCount: d.helpfulCount || 0, hidden: d.hidden === true,
    createdAt: toDate(d.createdAt),
  };
}

// 院ごとの投稿。複合インデックスを作らずに済むよう、並べ替えはここでする
async function listByClinic(clinicId, { includeHidden = false } = {}) {
  const snap = await db.collection(POSTS).where('clinicId', '==', clinicId).limit(500).get();
  return snap.docs.map(shape)
    .filter(p => includeHidden || !p.hidden)
    .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
}

// そのユーザーが押した「参考になった」の postId
async function helpfulBy(uid, postIds) {
  if (!uid || !postIds.length) return new Set();
  const refs = postIds.map(id => db.collection(POSTS).doc(id).collection('helpful').doc(uid));
  const snaps = await db.getAll(...refs);
  return new Set(snaps.filter(s => s.exists).map(s => s.ref.parent.parent.id));
}

async function countRecentByUser(uid) {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const snap = await db.collection(POSTS).where('uid', '==', uid).limit(200).get();
  return snap.docs.filter(d => (toDate(d.get('createdAt'))?.getTime() || 0) > since).length;
}

// JPEG の APP1（Exif。撮影場所が入っていることがある）を落とす
function stripJpegExif(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const out = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xda) { out.push(buf.subarray(i)); return Buffer.concat(out); } // 画像データの始まり
    const len = buf.readUInt16BE(i + 2);
    if (marker !== 0xe1) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null;
}

async function createPost({ clinicId, user, fields, photos }) {
  const postRef = db.collection(POSTS).doc();
  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();
  const photoIds = photos.map(data => {
    const ref = db.collection(PHOTOS).doc();
    batch.set(ref, { postId: postRef.id, clinicId, uid: user.uid, type: 'image/jpeg', data, createdAt: now });
    return ref.id;
  });
  batch.set(postRef, {
    clinicId, uid: user.uid, email: user.email || null, ...fields,
    photoIds, helpfulCount: 0, hidden: false, createdAt: now,
  });
  await batch.commit();
  return postRef.id;
}

async function getPost(postId) {
  const s = await db.collection(POSTS).doc(postId).get();
  return s.exists ? shape(s) : null;
}

async function getPhoto(photoId) {
  const s = await db.collection(PHOTOS).doc(photoId).get();
  if (!s.exists) return null;
  const d = s.data();
  return { postId: d.postId, type: d.type || 'image/jpeg', data: Buffer.from(d.data) };
}

// 押していなければ +1、押していれば取り消す。押したあとの状態と件数を返す
async function toggleHelpful(postId, uid) {
  const postRef = db.collection(POSTS).doc(postId);
  const markRef = postRef.collection('helpful').doc(uid);
  return db.runTransaction(async tx => {
    const [post, mark] = await Promise.all([tx.get(postRef), tx.get(markRef)]);
    if (!post.exists || post.get('hidden') === true) return null;
    const count = post.get('helpfulCount') || 0;
    if (mark.exists) {
      tx.delete(markRef);
      tx.update(postRef, { helpfulCount: Math.max(0, count - 1) });
      return { on: false, count: Math.max(0, count - 1) };
    }
    tx.set(markRef, { createdAt: admin.firestore.Timestamp.now() });
    tx.update(postRef, { helpfulCount: count + 1 });
    return { on: true, count: count + 1 };
  });
}

async function setHidden(postId, hidden, by) {
  await db.collection(POSTS).doc(postId).update({
    hidden, moderatedBy: by || null, moderatedAt: admin.firestore.Timestamp.now(),
  });
}

async function deletePost(post) {
  const batch = db.batch();
  post.photoIds.forEach(id => batch.delete(db.collection(PHOTOS).doc(id)));
  const marks = await db.collection(POSTS).doc(post.id).collection('helpful').listDocuments();
  marks.forEach(ref => batch.delete(ref));
  batch.delete(db.collection(POSTS).doc(post.id));
  await batch.commit();
}

module.exports = {
  INJURIES, PERIODS, OUTCOMES, LIMITS, MAX_POSTS_PER_DAY,
  listByClinic, helpfulBy, countRecentByUser, stripJpegExif,
  createPost, getPost, getPhoto, toggleHelpful, setHidden, deletePost,
};
