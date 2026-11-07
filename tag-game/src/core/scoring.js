// スコア集計・順位。スコア = 鬼でなかった時間（秒）。同点は同順位。
export function ranking(entities) {
  const rows = entities.map((e) => ({ id: e.id, safeTime: e.safeTime, isIt: e.isIt }));
  rows.sort((a, b) => b.safeTime - a.safeTime);
  return rows.map((r) => ({ ...r, rank: 1 + rows.filter((o) => o.safeTime > r.safeTime).length }));
}
