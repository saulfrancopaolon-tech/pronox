const pois = (l, k) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
function adj(t) {
  const f = 1 + (t.form - 9) / 9 * 0.08;
  const m = 1 + (t.mot - 3) * 0.025;
  const r = t.rest < 4 ? 0.97 : 1;
  const p = Math.max(0.9, Math.min(1.1, 1 + (12 - t.ppda) * 0.004));
  return f * m * r * p;
}
function analyze(h, a, c) {
  let lh = (h.xg + a.xga) / 2 * adj(h) * (1 - h.abs * 0.01) * (1 + a.abs * 0.006) * (c.home ? 1.1 : 1) * c.wx * c.tr;
  let la = (a.xg + h.xga) / 2 * adj(a) * (1 - a.abs * 0.01) * (1 + h.abs * 0.006) * (c.home ? 0.92 : 1) * c.wx * c.tr;
  const sc = c.avg / 1.35; lh *= sc; la *= sc;
  let H = 0, D = 0, A = 0, o15 = 0, o25 = 0, o35 = 0, bt = 0, best = ['0-0', 0];
  for (let i = 0; i <= 9; i++) for (let j = 0; j <= 9; j++) {
    const p = pois(lh, i) * pois(la, j);
    if (i > j) H += p; else if (i === j) D += p; else A += p;
    if (i + j > 1) o15 += p; if (i + j > 2) o25 += p; if (i + j > 3) o35 += p;
    if (i && j) bt += p;
    if (p > best[1]) best = [i + '-' + j, p];
  }
  const m = (k, n, p) => ({ k, n, p });
  return { lh, la, markets: [
    m('1', 'Gana ' + c.hn, H), m('X', 'Empate', D), m('2', 'Gana ' + c.an, A),
    m('1X', c.hn + ' o empate', H + D), m('X2', c.an + ' o empate', D + A), m('12', 'Sin empate', H + A),
    m('DNB1', 'Empate anula: ' + c.hn, H / (H + A)), m('DNB2', 'Empate anula: ' + c.an, A / (H + A)),
    m('O1.5', 'Más de 1.5 goles', o15), m('U1.5', 'Menos de 1.5 goles', 1 - o15),
    m('O2.5', 'Más de 2.5 goles', o25), m('U2.5', 'Menos de 2.5 goles', 1 - o25),
    m('O3.5', 'Más de 3.5 goles', o35), m('U3.5', 'Menos de 3.5 goles', 1 - o35),
    m('BY', 'Ambos anotan: Sí', bt), m('BN', 'Ambos anotan: No', 1 - bt),
    m('CS', 'Marcador más probable ' + best[0], best[1])
  ] };
}
module.exports = { analyze };
