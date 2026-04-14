import { buffer, featureCollection, combine } from "@turf/turf";
import type { FeatureCollection } from "geojson";

/**
 * Modelo simplificado de inundación: buffer alrededor del cauce real (OSM)
 * escalando ancho con nivel del agua. Planar flood aproximado útil para
 * visualización. Para producción: reemplazar con raster HEC-RAS/LISFLOOD-FP.
 */
export function buildFloodPolygon(
  level: number,
  cauceFC: FeatureCollection,
): FeatureCollection {
  const width = Math.max(5, 8 * level + 7 * level * level);
  const feats = cauceFC.features
    .map((f) => buffer(f as any, width / 1000, { units: "kilometers" }))
    .filter(Boolean) as any[];
  return featureCollection(feats);
}

export function estimateAffected(level: number) {
  // Heurística para el panel de riesgo. Longitud cauce ≈ 5.0 km (OSM).
  const width = Math.max(5, 8 * level + 7 * level * level);
  const areaKm2 = (width * 5000) / 1_000_000;
  const population = Math.round(areaKm2 * 8500);
  const buildings = Math.round(areaKm2 * 420);
  return { areaKm2: +areaKm2.toFixed(3), population, buildings };
}
