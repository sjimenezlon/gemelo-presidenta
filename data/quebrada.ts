// Trazado aproximado de la Quebrada La Presidenta desde el cerro El Volador/Las Palmas
// hasta su desembocadura en el Río Medellín. Coordenadas en EPSG:4326.
// Fuente: digitalización aproximada sobre cartografía POT Medellín + OSM.
// Para producción, reemplazar con shapefile oficial SIATA / AMVA.

import type { FeatureCollection } from "geojson";

export const cauce: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Quebrada La Presidenta", tipo: "cauce_principal" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-75.5495, 6.2012], // nacimiento aprox. Las Palmas
          [-75.5530, 6.2030],
          [-75.5565, 6.2048],
          [-75.5600, 6.2070],
          [-75.5635, 6.2090],
          [-75.5670, 6.2095], // Parque Lleras area
          [-75.5705, 6.2098],
          [-75.5740, 6.2100],
          [-75.5775, 6.2105],
          [-75.5810, 6.2110],
          [-75.5845, 6.2120],
          [-75.5880, 6.2135], // desembocadura Río Medellín
        ],
      },
    },
  ],
};

// Cuenca hidrográfica aproximada (polígono envolvente)
export const cuenca: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Cuenca Quebrada La Presidenta", area_km2: 7.2 },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-75.5490, 6.1970],
            [-75.5420, 6.2020],
            [-75.5440, 6.2095],
            [-75.5520, 6.2150],
            [-75.5700, 6.2165],
            [-75.5880, 6.2155],
            [-75.5900, 6.2095],
            [-75.5820, 6.2045],
            [-75.5700, 6.2020],
            [-75.5600, 6.1985],
            [-75.5490, 6.1970],
          ],
        ],
      },
    },
  ],
};

export const landmarks = [
  { name: "Parque Lleras", coord: [-75.5682, 6.2086], type: "hotspot" },
  { name: "Parque La Presidenta", coord: [-75.5665, 6.2075], type: "parque" },
  { name: "Desembocadura Río Medellín", coord: [-75.5880, 6.2135], type: "desembocadura" },
  { name: "Nacimiento (Las Palmas)", coord: [-75.5495, 6.2012], type: "nacimiento" },
  { name: "Estación SIATA 201", coord: [-75.5700, 6.2092], type: "siata" },
];
