const B = 'https://v3.football.api-sports.io';
async function af(path) {
  if (!process.env.API_FOOTBALL_KEY) throw new Error('Falta la variable API_FOOTBALL_KEY en Vercel');
  const r = await fetch(B + path, { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY } });
  const j = await r.json();
  const e = j.errors;
  if (e && !Array.isArray(e) && Object.keys(e).length) throw new Error(JSON.stringify(e));
  return { data: j.response || [], left: r.headers.get('x-ratelimit-requests-remaining') };
}
module.exports = { af };
