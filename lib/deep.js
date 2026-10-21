const { af } = require('./api');
const { analyze } = require('./model');
const { weather } = require('./weather');

const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const ok = r => (r && r.status === 'fulfilled' ? r.value : null);
const pts = s => { s = (s || '').slice(-6); if (!s) return null; let p = 0; for (const c of s) p += c === 'W' ? 3 : c === 'D' ? 1 : 0; return p * 6 / s.length; };
const gl = (t, side, kind) => {
  const s = num(t && t.league && t.league.goals && t.league.goals[kind] && t.league.goals[kind].average && t.league.goals[kind].average[side]);
  const l = num(t && t.last_5 && t.last_5.goals && t.last_5.goals[kind] && t.last_5.goals[kind].average);
  return s != null && l != null ? 0.6 * s + 0.4 * l : (s != null ? s : l);
};
function parseOdds(x) {
  const o = {}; const b = x && x.data[0] && x.data[0].bookmakers && x.data[0].bookmakers[0];
  if (!b) return { book: null, odds: o };
  for (const bet of b.bets) for (const v of bet.values) {
    const val = String(v.value), q = parseFloat(v.odd);
    if (bet.id === 1) { const k = { Home: '1', Draw: 'X', Away: '2' }[val]; if (k) o[k] = q; }
    else if (bet.id === 12) { const k = { 'Home/Draw': '1X', 'Draw/Away': 'X2', 'Home/Away': '12' }[val]; if (k) o[k] = q; }
    else if (bet.id === 5) { const m = val.match(/^(Over|Under) (\d\.\d)$/); if (m) o[(m[1] === 'Over' ? 'O' : 'U') + m[2]] = q; }
    else if (bet.id === 8) o[val === 'Yes' ? 'BY' : 'BN'] = q;
  }
  return { book: b.name, odds: o };
}

async function analyzeFixture(id) {
  {
    const f = (await af('/fixtures?id=' + id)).data[0];
    if (!f) throw new Error('Partido no encontrado');
    const H = f.teams.home, A = f.teams.away, L = f.league, kick = f.fixture.date;

    const r = await Promise.allSettled([
      af('/predictions?fixture=' + id), af('/injuries?fixture=' + id), af('/odds?fixture=' + id),
      af(`/fixtures?team=${H.id}&last=1`), af(`/fixtures?team=${A.id}&last=1`),
      af(`/standings?league=${L.id}&season=${L.season}`),
      weather(f.fixture.venue && f.fixture.venue.city, kick)
    ]);
    const pred = ok(r[0]) && ok(r[0]).data[0];
    const inj = (ok(r[1]) && ok(r[1]).data) || [];
    const oddsInfo = parseOdds(ok(r[2]));
    const wx = r[6].status === 'fulfilled' ? r[6].value : null;
    const left = ok(r[0]) ? ok(r[0]).left : null;

    const restOf = x => { const d = ok(x) && ok(x).data[0]; return d ? Math.max(0, Math.round((new Date(kick) - new Date(d.fixture.date)) / 864e5)) : null; };
    const table = ok(r[5]) && ok(r[5]).data[0] && ok(r[5]).data[0].league.standings && ok(r[5]).data[0].league.standings[0];
    const motOf = tid => {
      if (!table) return null;
      const row = table.find(x => x.team.id === tid); if (!row) return null;
      const n = table.length, edge = Math.max(3, Math.round(n * 0.15));
      return (row.rank <= edge || row.rank > n - edge) ? 4 : 3;
    };
    const injOf = tid => inj.filter(x => x.team.id === tid);

    const th = pred && pred.teams.home, ta = pred && pred.teams.away;
    const built = (t, side, team, restRes) => {
      const missing = [];
      const g = (v, k, d) => { if (v == null) { missing.push(k); return d; } return v; };
      const players = injOf(team.id);
      return {
        t: {
          xg: g(gl(t, side, 'for'), 'goles a favor', 1.35),
          xga: g(gl(t, side, 'against'), 'goles en contra', 1.35),
          form: g(pts(t && t.league && t.league.form), 'forma', 9),
          abs: Math.min(10, players.length * 1.2),
          rest: g(restOf(restRes), 'descanso', 5),
          mot: g(motOf(team.id), 'motivación', 3),
          ppda: 11
        }, missing, players: players.slice(0, 8).map(x => `${x.player.name} (${x.player.reason || x.player.type})`)
      };
    };
    const hb = built(th, 'home', H, r[3]), ab = built(ta, 'away', A, r[4]);

    let h2h = null, tr = 1;
    if (pred && pred.h2h && pred.h2h.length) {
      const hs = pred.h2h; let hw = 0, d = 0, aw = 0, goals = 0;
      hs.forEach(x => {
        const gh = x.goals.home, ga = x.goals.away; goals += gh + ga;
        const homeIsH = x.teams.home.id === H.id;
        if (gh === ga) d++; else if ((gh > ga) === homeIsH) hw++; else aw++;
      });
      h2h = { n: hs.length, hw, d, aw, avgGoals: +(goals / hs.length).toFixed(2) };
      if (h2h.avgGoals >= 3.2) tr = 1.04; else if (h2h.avgGoals <= 2) tr = 0.96;
    }

    const lg = [gl(th, 'home', 'for'), gl(th, 'home', 'against'), gl(ta, 'away', 'for'), gl(ta, 'away', 'against')].filter(v => v != null);
    const avg = lg.length ? Math.min(2, Math.max(1, lg.reduce((a, b) => a + b, 0) / lg.length)) : 1.35;
    const ctx = { avg, home: 1, wx: wx ? wx.factor : 1, tr, hn: H.name, an: A.name };
    const out = analyze(hb.t, ab.t, ctx);

    const missing = [...hb.missing.map(x => 'local: ' + x), ...ab.missing.map(x => 'visitante: ' + x)];
    if (!pred) missing.push('predicciones de la API');
    if (!wx) missing.push('clima');
    const quality = Math.max(0, Math.round((1 - missing.length / 14) * 100));

    return ({
      fixture: { id: f.fixture.id, time: kick, league: L.name, country: L.country, home: H.name, away: A.name, venue: f.fixture.venue && f.fixture.venue.name },
      inputs: { home: hb.t, away: ab.t, ctx },
      lambdas: { home: +out.lh.toFixed(2), away: +out.la.toFixed(2) },
      markets: out.markets, odds: oddsInfo.odds, book: oddsInfo.book,
      injuries: { home: hb.players, away: ab.players },
      weather: wx, h2h, missing, quality, left,
      apiPrediction: pred ? { advice: pred.predictions.advice, percent: pred.predictions.percent, under_over: pred.predictions.under_over } : null
    });
  }
}

// ---- Buscar el partido de ESPN dentro de API-Football por nombre ----
const STOP = new Set(['fc','cf','club','de','the','sc','ac','afc','cd','ud','sv','fk','as','us','real','sporting','deportivo','atletico']);
const toks = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
const sim = (a, b) => {
  const A = toks(a), B = toks(b); if (!A.length || !B.length) return 0;
  const hit = A.filter(w => B.some(v => v === w || (w.length > 3 && v.length > 3 && (v.startsWith(w.slice(0, 4)) || w.startsWith(v.slice(0, 4)))))).length;
  return hit / Math.max(A.length, B.length);
};
async function findAndAnalyze(home, away, startIso) {
  const day = new Date(startIso).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const { data } = await af(`/fixtures?date=${day}&timezone=America/Mexico_City`);
  let best = null, bs = 0;
  for (const f of data) {
    const sc = sim(home, f.teams.home.name) + sim(away, f.teams.away.name);
    if (sc > bs) { bs = sc; best = f; }
  }
  if (!best || bs < 0.9) throw new Error('No encontré este partido en API-Football (liga no incluida en tu plan o nombres distintos).');
  return analyzeFixture(best.fixture.id);
}
module.exports = { analyzeFixture, findAndAnalyze };
