
// /public/js/auth.js - 認証機能
(function () {
  const cfg = {
    apiKey: "AIzaSyBbFaRwIiYw61X5yKXhvt1nGw-MRSgagLo",
    authDomain: "mystlide.firebaseapp.com",
  };

  function log(...a){ console.log('[auth]', ...a); }

  async function init() {
    if (!firebase?.apps?.length) firebase.initializeApp(cfg);
    const auth = firebase.auth();
    auth.useDeviceLanguage();
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    const redirectTo = (window.__afterLoginRedirect && !String(window.__afterLoginRedirect).startsWith('/login'))
      ? window.__afterLoginRedirect : '/home2';

    // 1回だけリダイレクトを許すフラグ
    const RD_KEY = 'auth.didRedirect';

    // 既にFirebase的にログイン済みでサーバークッキー未発行なら発行して遷移
    if (auth.currentUser && !document.cookie.includes('__session=')) {
      await issueSessionAndGo(auth.currentUser, redirectTo);
      return;
    }

    // リダイレクト復帰の結果を一度だけ処理
    try {
      const rr = await auth.getRedirectResult();
      if (rr && rr.user) {
        sessionStorage.removeItem(RD_KEY);
        await issueSessionAndGo(rr.user, redirectTo);
        return;
      }
    } catch (e) {
      console.warn('[auth] redirect result err', e);
      sessionStorage.removeItem(RD_KEY);
    }

    const btn = document.getElementById('loginBtn');
    if (!btn) { console.warn('[auth] #loginBtn not found'); return; }

    let inFlight = false;
    btn.addEventListener('click', async () => {
      if (inFlight) return;
      inFlight = true; btn.disabled = true;
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const res = await auth.signInWithPopup(provider);
        await issueSessionAndGo(res.user, redirectTo);
      } catch (e) {
        const popupCodes = [
          'auth/popup-blocked',
          'auth/cancelled-popup-request',
          'auth/popup-closed-by-user'
        ];
        if (popupCodes.includes(e.code) && !sessionStorage.getItem(RD_KEY)) {
          sessionStorage.setItem(RD_KEY, '1');
          await auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
          return;
        }
        console.error('[auth] popup error', e);
        alert('ログインできなかった…もう一度試してね。');
      } finally {
        inFlight = false; btn.disabled = false;
      }
    });

    async function issueSessionAndGo(user, to) {
      if (!document.cookie.includes('__session=')) {
        const idToken = await user.getIdToken(true);
        const r = await fetch('/api/sessionLogin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) throw new Error(j?.msg || ('status ' + r.status));
      }
      location.href = to;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


