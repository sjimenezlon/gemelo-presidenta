import { buffer, lineString, featureCollection } from "@turf/turf";
import type { FeatureCollection } from "geojson";
import { cauce } from "@/data/quebrada";

/**
 * Modelo simplificado de inundación: genera un buffer alrededor del cauce
 * cuyo ancho escala con el nivel del agua (metros sobre cauce).
 *
 * Esta es una aproximación 1D tipo "planar flood" útil para visualización.
 * Para producción, reemplazar con raster precomputado desde HEC-RAS o
 * LISFLOOD-FP sobre un DEM LiDAR del AMVA.
 *
 *  nivel (m) → ancho aproximado de mancha (m)
 *  0.5       → 15
 *  1.0       → 30
 *  2.0       → 65
 *  3.0       → 110
 *  5.0       → 200
 */
export function buildFloodPolygon(level: number): FeatureCollection {
  const width = Math.max(5, 8 * level + 7 * level * level); // metros
  const line = cauce.features[0];
  if (!line) return featureCollection([]);
  const buf = buffer(line as any, width / 1000, { units: "kilometers" });
  return featureCollection(buf ? [buf as any] : []);
}

export function estimateAffected(level: number) {
  // Heurística simple para el panel de riesgo.
  // Densidad El Poblado ~8.500 hab/km². Longitud cauce ~4.3 km.
  const width = Math.max(5, 8 * level + 7 * level * level);
  const areaKm2 = (width * 4300) / 1_000_000;
  const population = Math.round(areaKm2 * 8500);
  const buildings = Math.round(areaKm2 * 420);
  return { areaKm2: +areaKm2.toFixed(3), population, buildings };
}
