# Gemelo Digital GeoAI — Quebradas La Presidenta + Volcana-Los Balsos

Gemelo digital interactivo multi-cauce de las **Quebradas La Presidenta** y **Volcana-Los Balsos** (El Poblado / Campus EAFIT, Medellín) construido con **Next.js 14 + MapLibre GL + deck.gl**, terreno 3D, simulación HAND multi-cauce y filtro por quebrada.

## Características

- Mapa 3D con hillshade sobre DEM Terrarium (AWS Open Data, gratuito)
- Cauce y cuenca hidrográfica de la quebrada
- **Simulación de inundación 1D**: slider de nivel (0–5 m) + escenarios TR25, TR100, CC2050
- **Análisis de riesgo**: área inundada, población y edificios expuestos
- **SIATA en vivo**: panel de estaciones (actualmente simulado, listo para conectar a API real)

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Mapa | MapLibre GL + deck.gl |
| DEM / Terreno | Mapzen Terrarium tiles (AWS) |
| Basemap | CARTO Dark (OpenStreetMap) |
| Hidrología | Turf.js (buffer planar) |
| Estilos | Tailwind CSS |
| Deploy | Vercel |

## Desarrollo

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>.

## Roadmap

- [ ] Reemplazar buffer planar por raster de inundación precomputado (HEC-RAS / LISFLOOD-FP)
- [ ] DEM LiDAR AMVA 1m vía tiles
- [ ] Extrusión 3D de edificaciones OSM/Catastro Medellín
- [ ] Proxy real a API SIATA (`/api/siata`)
- [ ] Integración con Catastro Medellín para avalúo expuesto
- [ ] Modelo ML de predicción de nivel 1h usando lluvia acumulada

## Créditos

DENSURBAM · Urbam EAFIT. Datos DEM © Mapzen/AWS, basemap © CARTO/OpenStreetMap.
