import { isobands, featureCollection } from "@turf/turf";
import type { FeatureCollection } from "geojson";

/**
 * Modelo HAND (Height Above Nearest Drainage) — Rennó et al. 2008, Nobre et al. 2011.
 * Una celda se inunda cuando (elev_celda − elev_cauce_más_cercano) ≤ nivel_agua.
 *
 * El grid HAND se precomputa offline en scripts/build_hand.py a partir del DEM real
 * (Mapzen Terrarium z14, ~10 m/px) y del cauce OSM real.
 *
 * En runtime, turf.isobands dibuja la mancha de inundación a partir del grid.
 */
export function floodFromHand(
  handGrid: FeatureCollection,
  level: number,
): FeatureCollection {
  if (!handGrid || !handGrid.features?.length) return featureCollection([]);
  try {
    const breaks = [0, Math.max(0.01, level)];
    const bands = isobands(handGrid as any, breaks, { zProperty: "hand" });
    return bands as any;
  } catch {
    return featureCollection([]);
  }
}

/**
 * Cruce real: cuántos edificios OSM tienen HAND ≤ nivel (y están a <400 m del cauce).
 * Las alturas HAND se precomputan por edificio en build_hand.py.
 */
export function countAffectedBuildings(
  buildingsFC: FeatureCollection,
  level: number,
) {
  let count = 0;
  for (const f of buildingsFC.features) {
    const p: any = f.properties || {};
    if (p.hand == null) continue;
    if (p.dist_cauce_m != null && p.dist_cauce_m > 400) continue;
    if (p.hand <= level) count++;
  }
  return { count };
}

export function countAffectedPoints(
  fc: FeatureCollection,
  level: number,
  maxDistM = 300,
): number {
  let n = 0;
  for (const f of fc.features) {
    const p: any = f.properties || {};
    if (p.hand == null) continue;
    if (p.dist_grid_m != null && p.dist_grid_m > maxDistM) continue;
    if (p.hand <= level) n++;
  }
  return n;
}

/**
 * Curvas IDF para Medellín / Valle de Aburrá — valores referenciales POMCA AMVA.
 * Mapea periodo de retorno a lluvia max 1h, caudal pico rational y profundidad
 * aproximada usando Manning en canal rectangular de La Presidenta.
 *
 * Parámetros de La Presidenta (estimados desde OSM + DEM):
 *  - Área cuenca A ≈ 7.2 km²
 *  - Coef. escorrentía urbano C ≈ 0.75
 *  - Ancho canal promedio b ≈ 6 m
 *  - Pendiente media S ≈ 0.065 (1490→2596 m en 5 km)
 *  - Manning n ≈ 0.035 (cauce natural con vegetación y estructuras)
 */
export type ScenarioKey = "tr2" | "tr5" | "tr10" | "tr25" | "tr50" | "tr100" | "cc2050";

export const IDF: Record<ScenarioKey, { label: string; mmh: number; H: number; Q: number }> = {
  tr2: { label: "TR 2", mmh: 45, H: 0.45, Q: 67 },
  tr5: { label: "TR 5", mmh: 65, H: 0.8, Q: 98 },
  tr10: { label: "TR 10", mmh: 80, H: 1.1, Q: 120 },
  tr25: { label: "TR 25", mmh: 95, H: 1.6, Q: 143 },
  tr50: { label: "TR 50", mmh: 110, H: 2.2, Q: 165 },
  tr100: { label: "TR 100", mmh: 130, H: 2.9, Q: 195 },
  cc2050: { label: "CC 2050 (+20%)", mmh: 156, H: 3.6, Q: 234 },
};
