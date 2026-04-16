import { isobands, featureCollection } from "@turf/turf";
import type { FeatureCollection } from "geojson";
import type { CauceFilter, CauceId } from "@/components/store";

/**
 * Modelo HAND (Height Above Nearest Drainage) — Rennó et al. 2008, Nobre et al. 2011.
 * Una celda se inunda cuando (elev_celda − elev_cauce_más_cercano) ≤ nivel_agua.
 *
 * El grid HAND se precomputa offline en scripts/build_hand.py a partir del DEM real
 * (Mapzen Terrarium z14, ~10 m/px) y de los cauces OSM reales (Presidenta + Volcana-Los Balsos).
 * Cada celda/edificio queda etiquetado con `cauce_id` (drenaje más cercano).
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

function matchCauce(p: any, filter?: CauceFilter): boolean {
  if (!filter || filter === "both") return true;
  if (p?.cauce_id == null) return true;
  return p.cauce_id === filter;
}

/**
 * Cruce real: cuántos edificios OSM tienen HAND ≤ nivel (y están a <400 m del cauce).
 * Las alturas HAND se precomputan por edificio en build_hand.py.
 */
export function countAffectedBuildings(
  buildingsFC: FeatureCollection,
  level: number,
  filter?: CauceFilter,
) {
  let count = 0;
  for (const f of buildingsFC.features) {
    const p: any = f.properties || {};
    if (p.hand == null) continue;
    if (p.dist_cauce_m != null && p.dist_cauce_m > 400) continue;
    if (!matchCauce(p, filter)) continue;
    if (p.hand <= level) count++;
  }
  return { count };
}

export function countAffectedPoints(
  fc: FeatureCollection,
  level: number,
  maxDistM = 300,
  filter?: CauceFilter,
): number {
  let n = 0;
  for (const f of fc.features) {
    const p: any = f.properties || {};
    if (p.hand == null) continue;
    if (p.dist_grid_m != null && p.dist_grid_m > maxDistM) continue;
    if (!matchCauce(p, filter)) continue;
    if (p.hand <= level) n++;
  }
  return n;
}

/**
 * Curvas IDF por cauce — valores referenciales POMCA AMVA + Manning en canal rectangular.
 * Mapea periodo de retorno a lluvia max 1h, caudal pico rational y profundidad.
 *
 * La Presidenta: A ≈ 7.2 km², S ≈ 0.065, b ≈ 6 m, n ≈ 0.035
 * Volcana-Los Balsos: A ≈ 5.5 km², S ≈ 0.055, b ≈ 5 m, n ≈ 0.040
 *   (cuenca menor, pendiente ligeramente menor, cauce más angosto ⇒ calados similares a caudales menores)
 */
export type ScenarioKey = "tr2" | "tr5" | "tr10" | "tr25" | "tr50" | "tr100" | "cc2050";
export type IdfTable = Record<ScenarioKey, { label: string; mmh: number; H: number; Q: number }>;

export const IDF: IdfTable = {
  tr2: { label: "TR 2", mmh: 45, H: 0.45, Q: 67 },
  tr5: { label: "TR 5", mmh: 65, H: 0.8, Q: 98 },
  tr10: { label: "TR 10", mmh: 80, H: 1.1, Q: 120 },
  tr25: { label: "TR 25", mmh: 95, H: 1.6, Q: 143 },
  tr50: { label: "TR 50", mmh: 110, H: 2.2, Q: 165 },
  tr100: { label: "TR 100", mmh: 130, H: 2.9, Q: 195 },
  cc2050: { label: "CC 2050 (+20%)", mmh: 156, H: 3.6, Q: 234 },
};

export const IDF_VOLCANA: IdfTable = {
  tr2: { label: "TR 2", mmh: 45, H: 0.4, Q: 51 },
  tr5: { label: "TR 5", mmh: 65, H: 0.75, Q: 75 },
  tr10: { label: "TR 10", mmh: 80, H: 1.05, Q: 92 },
  tr25: { label: "TR 25", mmh: 95, H: 1.55, Q: 109 },
  tr50: { label: "TR 50", mmh: 110, H: 2.1, Q: 126 },
  tr100: { label: "TR 100", mmh: 130, H: 2.8, Q: 149 },
  cc2050: { label: "CC 2050 (+20%)", mmh: 156, H: 3.5, Q: 179 },
};

export function idfForCauce(cauce: CauceId): IdfTable {
  return cauce === "volcana" ? IDF_VOLCANA : IDF;
}
