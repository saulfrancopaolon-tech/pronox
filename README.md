# PronoX

App web (instalable en Android) con picks, probabilidades, combinadas y soñadoras para fútbol, NBA, MLB, NFL y NHL. Marcadores en vivo cada 30 s.

## Estructura (package.json debe quedar en la raíz del repo)
- public/index.html: la app
- api/events.js: partidos, marcadores y probabilidades (ESPN, sin llave)
- api/deep.js: análisis a fondo de fútbol (API-Football, requiere llave)
- lib/: modelos y conectores

## Llave para el análisis a fondo (opcional)
1. Crea cuenta gratis en dashboard.api-football.com y copia tu API key.
2. En Vercel: Project > Settings > Environment Variables > nombre `API_FOOTBALL_KEY`, valor tu llave > Save.
3. Deployments > menú de los tres puntos del último > Redeploy.
Cada análisis a fondo gasta unas 8 consultas; el plan gratis permite 100 al día (unos 12 análisis). Los resultados se guardan 30 minutos para ahorrar cuota.

## Probar en tu PC
`npx vercel dev` y abre http://localhost:3000
