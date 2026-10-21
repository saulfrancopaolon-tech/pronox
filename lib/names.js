const STOP = new Set(['fc','cf','club','de','the','sc','ac','afc','cd','ud','sv','fk','as','us']);
const toks = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
const sim = (a, b) => {
  const A = toks(a), B = toks(b); if (!A.length || !B.length) return 0;
  const hit = A.filter(w => B.some(v => v === w || (w.length > 3 && v.length > 3 && (v.startsWith(w.slice(0, 4)) || w.startsWith(v.slice(0, 4)))))).length;
  return hit / Math.max(A.length, B.length);
};
module.exports = { sim };
