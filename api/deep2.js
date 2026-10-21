const { analyze2 } = require('../lib/deep2');
module.exports = async (req, res) => {
  try {
    const q = req.query;
    if (!q.sport || !q.hid || !q.aid || !q.start) return res.status(400).json({ error: 'Faltan datos del partido' });
    const out = await analyze2(q);
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.json(out);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
