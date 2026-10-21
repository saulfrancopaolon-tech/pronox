const { af } = require('./lib/api');
module.exports = async (req, res) => {
  try {
    const d = req.query.date || new Date().toISOString().slice(0, 10);
    const { data, left } = await af(`/fixtures?date=${d}&timezone=America/Mexico_City`);
    const fixtures = data.filter(f => ['NS', 'TBD'].includes(f.fixture.status.short)).map(f => ({
      id: f.fixture.id, time: f.fixture.date, league: f.league.name, country: f.league.country,
      home: f.teams.home.name, away: f.teams.away.name
    })).sort((a, b) => a.time.localeCompare(b.time));
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.json({ date: d, left, fixtures });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
