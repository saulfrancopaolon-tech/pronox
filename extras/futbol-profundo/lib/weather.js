// Open-Meteo: gratis y sin llave
async function weather(city, iso) {
  if (!city) return null;
  try {
    const g = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(city))).json();
    const l = g.results && g.results[0];
    if (!l) return null;
    const day = new Date(iso).toISOString().slice(0, 10);
    const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${l.latitude}&longitude=${l.longitude}&hourly=temperature_2m,precipitation,wind_speed_10m&start_date=${day}&end_date=${day}&timezone=UTC`)).json();
    const h = new Date(iso).getUTCHours();
    const temp = w.hourly.temperature_2m[h], rain = w.hourly.precipitation[h], wind = w.hourly.wind_speed_10m[h];
    let factor = 1; const tags = [];
    if (rain >= 1) { factor *= 0.97; tags.push('lluvia'); }
    if (wind >= 35) { factor *= 0.95; tags.push('viento fuerte'); }
    if (temp >= 32) { factor *= 0.96; tags.push('calor'); }
    return { city, temp, rain, wind, factor, tags };
  } catch (e) { return null; }
}
module.exports = { weather };
