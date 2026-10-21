// Análisis profundo NBA / NFL / NHL / MLB con fuentes públicas: ESPN (récords, bajas, calendario), MLB Stats API (lanzadores), Open-Meteo (clima)
const { weather } = require('./weather');
const { sim } = require('./names');
const ESPN = 'https://site.api.espn.com/apis/';
const CFG = {
  nba: { path: 'basketball/nba', lg: 114, home: 2.5, sdM: 12, sdT: 18, unit: 'puntos', tl: 6, tt: 5, sp: [1.5, 3.5, 5.5, 7.5, 9.5], b2b: 1.5 },
  nfl: { path: 'football/nfl', lg: 22.5, home: 2, sdM: 13.5, sdT: 13, unit: 'puntos', tl: 3, tt: 3, sp: [1.5, 3.5, 6.5, 9.5, 13.5], b2b: 0 },
  nhl: { path: 'hockey/nhl', lg: 3.1, home: 0.15, sdM: 2.3, sdT: 2.4, unit: 'goles', tl: 1, tt: 1, sp: [1.5], b2b: 0.15 },
  mlb: { path: 'baseball/mlb', lg: 4.5, home: 0.2, sdM: 4.4, sdT: 4.3, unit: 'carreras', tl: 1, tt: 1, sp: [1.5], b2b: 0 }
};
const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
const zinv = p => { let lo = -6, hi = 6; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
const pois = (l, k) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
const overP = (L, lam) => { let c = 0; for (let k = 0; k <= Math.floor(L); k++) c += pois(lam, k); return Math.max(0, 1 - c); };
const j = async u => { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); };
const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };

async function standings(path) {
  const out = {};
  (function walk(n) {
    (n.children || []).forEach(walk);
    ((n.standings && n.standings.entries) || []).forEach(x => { const st = {}; (x.stats || []).forEach(s => (st[s.name] = s.value)); out[x.team.id] = { name: x.team.displayName, st }; });
  })(await j(ESPN + 'v2/sports/' + path + '/standings'));
  return out;
}
function rate(row, cfg) {
  if (!row) return null; const st = row.st;
  const gp = st.gamesPlayed || ((st.wins || 0) + (st.losses || 0) + (st.otLosses || 0) + (st.ties || 0));
  const pf = st.avgPointsFor != null ? num(st.avgPointsFor) : (gp ? num(st.pointsFor) / gp : null);
  const pa = st.avgPointsAgainst != null ? num(st.avgPointsAgainst) : (gp ? num(st.pointsAgainst) / gp : null);
  if (pf == null || pa == null || !gp || gp < 3) return null;
  return { pf, pa, gp };
}
async function injuries(path, ids) {
  const o = {}; ids.forEach(i => (o[i] = []));
  const d = await j(ESPN + 'site/v2/sports/' + path + '/injuries');
  (d.injuries || []).forEach(t => { if (o[t.id]) o[t.id] = (t.injuries || []).map(x => ({ name: x.athlete && x.athlete.displayName, status: x.status })); });
  return o;
}
async function lastGameHours(path, tid, startIso) {
  const d = await j(ESPN + 'site/v2/sports/' + path + '/teams/' + tid + '/schedule');
  const t0 = new Date(startIso).getTime(); let best = null;
  (d.events || []).forEach(e => { const t = new Date(e.date).getTime(); const done = e.competitions && e.competitions[0] && e.competitions[0].status && e.competitions[0].status.type.completed; if (done && t < t0 && (!best || t > best)) best = t; });
  return best ? (t0 - best) / 36e5 : null;
}
const ipNum = s => { const [a, b] = String(s || '0').split('.'); return (+a || 0) + (+b || 0) / 3; };
async function pitchers(home, away, startIso) {
  const day = new Date(startIso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const s = await j(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${day}&hydrate=probablePitcher,team`);
  const games = (s.dates && s.dates[0] && s.dates[0].games) || []; let best = null, bs = 0;
  games.forEach(g => { const sc = sim(home, g.teams.home.team.name) + sim(away, g.teams.away.team.name); if (sc > bs) { bs = sc; best = g; } });
  if (!best || bs < 0.9) return null;
  const one = async side => {
    const p = best.teams[side].probablePitcher; if (!p) return null;
    const d = await j(`https://statsapi.mlb.com/api/v1/people/${p.id}?hydrate=stats(group=[pitching],type=[season])`);
    const st = d.people && d.people[0] && d.people[0].stats && d.people[0].stats[0] && d.people[0].stats[0].splits && d.people[0].stats[0].splits[0] && d.people[0].stats[0].splits[0].stat;
    if (!st) return { id: p.id, name: p.fullName };
    const gs = +st.gamesStarted || 0;
    return { id: p.id, name: p.fullName, era: num(st.era), whip: num(st.whip), gs, kps: gs ? +st.strikeOuts / gs : null, ips: gs ? ipNum(st.inningsPitched) / gs : null };
  };
  const [h, a] = await Promise.allSettled([one('home'), one('away')]);
  return { home: h.status === 'fulfilled' ? h.value : null, away: a.status === 'fulfilled' ? a.value : null };
}
const ladder = (c, step, n) => { const b = Math.floor(c) + 0.5; const o = []; for (let k = -n; k <= n; k++) o.push(+(b + k * step).toFixed(1)); return o; };

async function analyze2(q) {
  const sport = q.sport, cfg = CFG[sport]; if (!cfg) throw new Error('Deporte sin análisis profundo');
  const used = ['ESPN (récords y calendario)'], missing = [];
  const r = await Promise.allSettled([
    standings(cfg.path), injuries(cfg.path, [q.hid, q.aid]),
    ['nba', 'nhl'].includes(sport) ? lastGameHours(cfg.path, q.hid, q.start) : null, ['nba', 'nhl'].includes(sport) ? lastGameHours(cfg.path, q.aid, q.start) : null,
    sport === 'mlb' ? pitchers(q.home, q.away, q.start) : null,
    q.indoor === '1' ? null : weather(q.city, q.start)
  ]);
  const ok = x => (x.status === 'fulfilled' ? x.value : null);
  const S = ok(r[0]) || {}, I = ok(r[1]), rh = ok(r[2]), ra = ok(r[3]), P = ok(r[4]), W = ok(r[5]);
  const H = rate(S[q.hid], cfg) || (missing.push('récord local'), { pf: cfg.lg, pa: cfg.lg, gp: 0 });
  const A = rate(S[q.aid], cfg) || (missing.push('récord visita'), { pf: cfg.lg, pa: cfg.lg, gp: 0 });
  let mh = (H.pf + A.pa) / 2 + cfg.home / 2, ma = (A.pf + H.pa) / 2 - cfg.home / 2;
  const notes = [];
  const out = x => x.filter(p => /^out$/i.test(p.status || '')).length + 0.5 * x.filter(p => /doubtful/i.test(p.status || '')).length;
  const oh = I ? out(I[q.hid]) : 0, oa = I ? out(I[q.aid]) : 0;
  if (I) { used.push('ESPN (bajas)'); mh *= 1 - Math.min(0.05, 0.006 * oh); ma *= 1 - Math.min(0.05, 0.006 * oa); } else missing.push('bajas');
  if (cfg.b2b) {
    if (rh != null && rh < 30) { mh -= cfg.b2b; notes.push('Local juega en back-to-back'); }
    if (ra != null && ra < 30) { ma -= cfg.b2b; notes.push('Visita juega en back-to-back'); }
    if (rh == null || ra == null) missing.push('descanso');
  }
  if (sport === 'mlb') {
    if (P) {
      used.push('MLB Stats API (lanzadores)');
      const f = p => (p && p.era != null && p.gs >= 3 ? 1 + 0.3 * (p.era / 4.2 - 1) : 1);
      ma *= Math.max(0.85, Math.min(1.15, f(P.home))); mh *= Math.max(0.85, Math.min(1.15, f(P.away)));
    } else missing.push('lanzadores probables');
  }
  let wf = 1; if (W && (sport === 'mlb' || sport === 'nfl')) { used.push('Open-Meteo (clima)'); wf = W.factor; mh *= wf; ma *= wf; } else if (q.indoor !== '1' && ['mlb', 'nfl'].includes(sport)) missing.push('clima');
  let T = mh + ma, M = mh - ma;
  const line = num(q.line), pml = num(q.pml);
  if (line) { T = 0.5 * T + 0.5 * line; used.push('Línea de total del mercado'); }
  if (pml && q.src === 'mercado') { M = 0.5 * M + 0.5 * cfg.sdM * zinv(Math.min(0.97, Math.max(0.03, pml))); used.push('Momio de ganador sin margen'); }
  mh = (T + M) / 2; ma = (T - M) / 2;
  const sdTeam = Math.sqrt((cfg.sdT ** 2 + cfg.sdM ** 2) / 4);
  const mk = [], add = (k, g, n, p) => mk.push({ k, g, n, p });
  ladder(T, cfg.tl, 3).forEach(L => { const p = 1 - Phi((L - T) / cfg.sdT); add('to:O:' + L, 'total', `Más de ${L} ${cfg.unit}`, p); add('to:U:' + L, 'total', `Menos de ${L} ${cfg.unit}`, 1 - p); });
  cfg.sp.forEach(s => { const pm = 1 - Phi((s - M) / cfg.sdM), pn = 1 - Phi((-s - M) / cfg.sdM);
    add('sp:H-:' + s, 'spread', `${q.home} -${s}`, pm); add('sp:A+:' + s, 'spread', `${q.away} +${s}`, 1 - pm);
    add('sp:H+:' + s, 'spread', `${q.home} +${s}`, pn); add('sp:A-:' + s, 'spread', `${q.away} -${s}`, 1 - pn); });
  [['H', q.home, mh], ['A', q.away, ma]].forEach(([s, n, mu]) => ladder(mu, cfg.tt, 2).forEach(L => { const p = 1 - Phi((L - mu) / sdTeam); add(`tt:${s}:O:${L}`, 'team' + s, `${n} más de ${L}`, p); add(`tt:${s}:U:${L}`, 'team' + s, `${n} menos de ${L}`, 1 - p); }));
  const pitch = [];
  if (P) [['home', P.home], ['away', P.away]].forEach(([s, p]) => { if (p && p.kps != null && p.gs >= 2) { [3.5, 4.5, 5.5, 6.5, 7.5].forEach(L => add(`pk:${p.id}:${L}`, 'props', `${p.name} más de ${L} ponches`, overP(L, p.kps))); } if (p) pitch.push({ side: s, ...p }); });
  const total = 8, quality = Math.max(0, Math.round((1 - missing.length / total) * 100));
  return { sport, unit: cfg.unit, expected: { home: +mh.toFixed(2), away: +ma.toFixed(2), total: +T.toFixed(2), margin: +M.toFixed(2) }, ml: { h: Phi(M / cfg.sdM) },
    inputs: { home: { pf: +H.pf.toFixed(2), pa: +H.pa.toFixed(2), gp: H.gp, out: oh }, away: { pf: +A.pf.toFixed(2), pa: +A.pa.toFixed(2), gp: A.gp, out: oa } },
    injuries: I ? { home: (I[q.hid] || []).slice(0, 8), away: (I[q.aid] || []).slice(0, 8) } : null, rest: { home: rh, away: ra }, notes, weather: W, pitchers: pitch,
    markets: mk, sources: used, missing, quality };
}
module.exports = { analyze2 };
