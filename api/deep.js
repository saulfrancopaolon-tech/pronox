const { findAndAnalyze } = require('../lib/deep');
module.exports = async (req, res) => {
  try {
    const { home, away, start } = req.query;
    if (!home || !away || !start) return res.status(400).json({ error: 'Faltan datos del partido' });
    const out = await findAndAnalyze(home, away, start);
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.json(out);
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
