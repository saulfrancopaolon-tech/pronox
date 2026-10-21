const { getEvents } = require('../lib/espn');
module.exports = async (req, res) => {
  try {
    const date = String(req.query.date || '').replace(/-/g, '');
    if (!/^\d{8}$/.test(date)) return res.status(400).json({ error: 'Fecha inválida' });
    const events = await getEvents(req.query.sport || 'all', date);
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.json({ updated: new Date().toISOString(), events });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
