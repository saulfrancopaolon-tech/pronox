// Datos: ESPN (marcadores, momios, récords). API pública no oficial, sin llave.
const SPORTS = {
  soccer: { paths: ['soccer/mex.1', 'soccer/eng.1', 'soccer/esp.1', 'soccer/ita.1', 'soccer/ger.1', 'soccer/fra.1', 'soccer/usa.1', 'soccer/uefa.champions', 'soccer/uefa.europa', 'soccer/conmebol.libertadores'] },
  nba: { paths: ['basketball/nba'] }, mlb: { paths: ['baseball/mlb'] },
  nfl: { paths: ['football/nfl'] }, nhl: { paths: ['hockey/nhl'] }
};
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/';
const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const mlv = s => { if (s == null) return null; s = String(s).trim(); if (/^even$/i.test(s)) return 100; return num(s); };
const dec = ml => (ml > 0 ? 1 + ml / 100 : 1 + 100 / -ml);
const devig = arr => { const imp = arr.map(m => 1 / dec(m)); const s = imp.reduce((a, b) => a + b, 0); return imp.map(x => x / s); };
const g = f => { try { return f(); } catch (e) { return null; } };
const pois = (l, k) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };

function readOdds(c) {
  const o = c.odds && c.odds[0]; if (!o) return null;
  const home = mlv(g(() => o.homeTeamOdds.moneyLine) ?? g(() => o.moneyline.home.close.odds));
  const away = mlv(g(() => o.awayTeamOdds.moneyLine) ?? g(() => o.moneyline.away.close.odds));
  const draw = mlv(g(() => o.drawOdds.moneyLine) ?? g(() => o.moneyline.draw.close.odds));
  let total = num(o.overUnder);
  if (total == null) total = num(String(g(() => o.total.over.close.line) || '').replace(/[^\d.]/g, ''));
  return { book: (o.provider && o.provider.name) || 'Mercado', home, away, draw, total };
}
const rec = s => { const n = (s || '').match(/\d+/g); if (!n) return null; const x = n.map(Number); return x.length === 2 ? { w: x[0], d: 0, l: x[1] } : { w: x[0], d: x[1], l: x[2] }; };
const wp = r => { if (!r) return 0.5; const gms = r.w + r.d + r.l; return gms ? (r.w + 0.5 * r.d) / gms : 0.5; };
const log5 = (a, b) => (a * (1 - b)) / (a * (1 - b) + b * (1 - a) || 1);

function grid(lh, la) {
  let H = 0, D = 0, A = 0, o15 = 0, o25 = 0, o35 = 0, bt = 0;
  for (let i = 0; i <= 9; i++) for (let j = 0; j <= 9; j++) {
    const p = pois(lh, i) * pois(la, j);
    if (i > j) H += p; else if (i === j) D += p; else A += p;
    if (i + j > 1) o15 += p; if (i + j > 2) o25 += p; if (i + j > 3) o35 += p; if (i && j) bt += p;
  }
  return { H, D, A, o15, o25, o35, bt };
}
function soccerMarkets(hn, an, od, hr, ar) {
  let pH, pD, pA, src = 'mercado';
  if (od && od.home != null && od.away != null && od.draw != null) [pH, pD, pA] = devig([od.home, od.draw, od.away]);
  else {
    src = 'récords'; pD = 0.26; const b = log5(wp(hr), wp(ar)) * 1.12; const p = Math.min(0.9, b);
    pH = (1 - pD) * p; pA = (1 - pD) * (1 - p);
  }
  const T = (od && od.total != null ? od.total + 0.15 : 2.6);
  let best = null, bd = 9;
  for (let s = 0.05; s <= 0.95; s += 0.01) { const r = grid(T * s, T * (1 - s)); const d = Math.abs((r.H - r.A) - (pH - pA)); if (d < bd) { bd = d; best = r; } }
  const m = (k, n, p, o) => ({ k, n, p, odds: o ? +dec(o).toFixed(2) : null });
  const x = best;
  return { src, probs: { h: pH, d: pD, a: pA }, markets: [
    m('1', 'Gana ' + hn, pH, od && od.home), m('X', 'Empate', pD, od && od.draw), m('2', 'Gana ' + an, pA, od && od.away),
    m('1X', hn + ' o empate', pH + pD), m('X2', an + ' o empate', pD + pA), m('12', 'Sin empate', pH + pA),
    m('DNB1', 'Empate anula: ' + hn, pH / (pH + pA)), m('DNB2', 'Empate anula: ' + an, pA / (pH + pA)),
    m('O1.5', 'Más de 1.5 goles', x.o15), m('U1.5', 'Menos de 1.5 goles', 1 - x.o15),
    m('O2.5', 'Más de 2.5 goles', x.o25), m('U2.5', 'Menos de 2.5 goles', 1 - x.o25),
    m('O3.5', 'Más de 3.5 goles', x.o35), m('U3.5', 'Menos de 3.5 goles', 1 - x.o35),
    m('BY', 'Ambos anotan: Sí', x.bt), m('BN', 'Ambos anotan: No', 1 - x.bt)
  ] };
}
const EDGE = { nba: 1.3, nfl: 1.25, nhl: 1.12, mlb: 1.1 };
function twoWayMarkets(sport, hn, an, od, hr, ar) {
  let pH, src = 'mercado';
  if (od && od.home != null && od.away != null) pH = devig([od.home, od.away])[0];
  else { src = 'récords'; const a = wp(hr), b = wp(ar); const q = log5(a, b); const o = (q / (1 - q)) * EDGE[sport]; pH = o / (1 + o); }
  return { src, probs: { h: pH, a: 1 - pH }, markets: [
    { k: '1', n: 'Gana ' + hn, p: pH, odds: od && od.home != null ? +dec(od.home).toFixed(2) : null },
    { k: '2', n: 'Gana ' + an, p: 1 - pH, odds: od && od.away != null ? +dec(od.away).toFixed(2) : null }
  ] };
}

function norm(ev, sport, league) {
  const c = ev.competitions && ev.competitions[0]; if (!c) return null;
  const h = c.competitors.find(x => x.homeAway === 'home'), a = c.competitors.find(x => x.homeAway === 'away');
  if (!h || !a) return null;
  const st = ev.status.type, od = readOdds(c);
  const hr = rec(g(() => h.records[0].summary)), ar = rec(g(() => a.records[0].summary));
  const side = x => ({ name: x.team.displayName, abbr: x.team.abbreviation, logo: x.team.logo, score: num(x.score), record: g(() => x.records[0].summary) || '' });
  const hs = side(h), as = side(a);
  const mk = sport === 'soccer' ? soccerMarkets(hs.name, as.name, od, hr, ar) : twoWayMarkets(sport, hs.name, as.name, od, hr, ar);
  return {
    id: ev.id, sport, league, start: ev.date, state: st.state, detail: st.shortDetail, clock: ev.status.displayClock,
    period: ev.status.period, home: hs, away: as, venue: g(() => c.venue.fullName), book: od && od.book, line: od && od.total,
    probSource: mk.src, probs: mk.probs, markets: mk.markets
  };
}
async function fetchPath(sport, path, date) {
  const r = await fetch(`${BASE}${path}/scoreboard?dates=${date}&limit=100`);
  if (!r.ok) return [];
  const j = await r.json();
  const lg = g(() => j.leagues[0].abbreviation) || g(() => j.leagues[0].name) || path;
  return (j.events || []).map(e => norm(e, sport, lg)).filter(Boolean);
}
async function getEvents(sport, date) {
  const keys = sport === 'all' || !SPORTS[sport] ? Object.keys(SPORTS) : [sport];
  const jobs = []; keys.forEach(k => SPORTS[k].paths.forEach(p => jobs.push(fetchPath(k, p, date))));
  const res = await Promise.allSettled(jobs);
  return res.flatMap(r => (r.status === 'fulfilled' ? r.value : [])).sort((x, y) => x.start.localeCompare(y.start));
}
module.exports = { getEvents };
