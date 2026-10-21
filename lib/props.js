// Props de fútbol: tiros, goles, tarjetas y córners (modelo de Poisson sobre promedios de API-Football)
const pois = (l, k) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
const over = (L, lam) => { let c = 0; for (let k = 0; k <= Math.floor(L); k++) c += pois(lam, k); return Math.max(0, 1 - c); };
const sum = (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0);
const val = r => (r && r.status === 'fulfilled' ? r.value.data : null);

function agg(pages) {
  const m = new Map();
  pages.forEach(r => (val(r) || []).forEach(x => {
    const st = x.statistics || [];
    m.set(x.player.id, {
      id: x.player.id, name: x.player.name, photo: x.player.photo, pos: (st[0] && st[0].games && st[0].games.position) || '',
      apps: sum(st, s => s.games && s.games.appearences), min: sum(st, s => s.games && s.games.minutes),
      shots: sum(st, s => s.shots && s.shots.total), sot: sum(st, s => s.shots && s.shots.on),
      goals: sum(st, s => s.goals && s.goals.total), yel: sum(st, s => s.cards && s.cards.yellow)
    });
  }));
  return [...m.values()];
}
function players(list, injIds, lam) {
  const f = Math.pow(Math.min(1.3, Math.max(0.75, lam / 1.35)), 0.8);
  const calc = list.filter(p => p.apps >= 3 && p.min / p.apps >= 35 && !injIds.has(p.id) && p.pos !== 'Goalkeeper').map(p => {
    const am = Math.min(90, p.min / p.apps);
    const ls = p.shots / p.min * am * f, lo = p.sot / p.min * am * f, lg = p.goals / p.min * am * f, lc = p.yel / p.apps;
    return { name: p.name, photo: p.photo, pos: p.pos, mins: Math.round(am), shots: { l: +ls.toFixed(2), p05: over(0.5, ls), p15: over(1.5, ls) },
      sot: { p05: over(0.5, lo) }, goal: { p: 1 - Math.exp(-lg) }, card: { p: 1 - Math.exp(-lc) } };
  });
  return { shooters: calc.slice().sort((a, b) => b.shots.l - a.shots.l).slice(0, 5), carders: calc.slice().sort((a, b) => b.card.p - a.card.p).slice(0, 5) };
}
function yellowsPerGame(r) {
  let o = val(r); o = Array.isArray(o) ? o[0] : o;
  if (!o || !o.cards) return null;
  const t = sum(Object.values(o.cards.yellow || {}), v => v.total) + sum(Object.values(o.cards.red || {}), v => v.total);
  const pl = o.fixtures && o.fixtures.played && o.fixtures.played.total;
  return pl ? t / pl : null;
}
const lines = (arr, lam) => arr.map(L => ({ L, p: over(L, lam) }));

// r[7..12]: jugadores local (2 págs), visita (2 págs), estadísticas de equipo local y visita
function buildProps({ r, inj, lh, la }) {
  const hp = agg([r[7], r[8]]), ap = agg([r[9], r[10]]);
  // ids de lesionados por equipo: se resuelven por jugador, sin importar el lado
  const all = new Set(inj.map(x => x.player.id));
  const hy = yellowsPerGame(r[11]), ay = yellowsPerGame(r[12]);
  const lamCards = (hy != null ? hy : 1.9) + (ay != null ? ay : 1.9);
  const lamCorners = 9.8 * (1 + 0.25 * ((lh + la) / 2.7 - 1)), sh = 0.4 * 0.5 + 0.6 * lh / (lh + la);
  return {
    players: { home: hp.length ? players(hp, all, lh) : null, away: ap.length ? players(ap, all, la) : null },
    cards: { lambda: +lamCards.toFixed(2), total: lines([2.5, 3.5, 4.5, 5.5], lamCards), home: lines([1.5, 2.5], hy != null ? hy : 1.9), away: lines([1.5, 2.5], ay != null ? ay : 1.9), measured: hy != null && ay != null },
    corners: { lambda: +lamCorners.toFixed(1), total: lines([8.5, 9.5, 10.5, 11.5], lamCorners), home: lines([3.5, 4.5, 5.5], lamCorners * sh), away: lines([3.5, 4.5, 5.5], lamCorners * (1 - sh)),
      note: 'Estimado: la API no entrega promedios de córners; se parte del promedio de liga y se ajusta por goles esperados.' }
  };
}
module.exports = { buildProps };
