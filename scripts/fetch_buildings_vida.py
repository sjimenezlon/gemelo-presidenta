#!/usr/bin/env python3
"""
Fetch de edificaciones del dataset combinado VIDA (Google Open Buildings v3
+ Microsoft Global ML Building Footprints + OSM), filtrado al bbox del gemelo
y merged con el buildings.geojson existente (que ya trae OSM enriquecido).

Deduplica por overlap espacial: si un polígono VIDA se traslapa con un OSM,
se descarta (OSM preserva levels/name/etc). El resto se agrega como nuevos
features con propiedades source, confidence, area, y se aplica heurística
de pisos por área.

Requiere:
  pip install pyogrio geopandas shapely

Fuente VIDA: https://source.coop/vida/google-microsoft-osm-open-buildings
GOB license: CC BY 4.0 · MSFT: ODbL · combinado: ODbL / CC BY 4.0
"""

import json
import math
import time
from pathlib import Path

import pyogrio
from shapely.geometry import shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"

BBOX = (-75.590, 6.180, -75.520, 6.220)  # (west, south, east, north)
VIDA_URL = (
    "/vsicurl/https://data.source.coop/vida/"
    "google-microsoft-osm-open-buildings/flatgeobuf/by_country/country_iso=COL/COL.fgb"
)
MIN_CONFIDENCE = 0.65  # Google v3 threshold típico


def heuristic_levels(area_m2: float) -> int:
    if area_m2 < 80:
        return 2
    if area_m2 < 250:
        return 4
    if area_m2 < 600:
        return 8
    return 12


def polygon_area_m2(ring, lat0):
    mx = 111000 * math.cos(math.radians(lat0))
    my = 111000
    s = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][0] * mx, ring[i][1] * my
        x2, y2 = ring[i + 1][0] * mx, ring[i + 1][1] * my
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def main():
    out = DATA / "buildings.geojson"
    print(f"→ Loading existing OSM buildings from {out}")
    osm = json.load(open(out))
    osm_feats = osm["features"]
    print(f"  {len(osm_feats)} features")

    print(f"→ Fetching VIDA buildings inside {BBOX} (remote FGB)...")
    t = time.time()
    vida = pyogrio.read_dataframe(VIDA_URL, bbox=BBOX)
    print(f"  {len(vida)} features in {time.time()-t:.1f}s")
    vida = vida[vida["confidence"] >= MIN_CONFIDENCE]
    print(f"  {len(vida)} after confidence filter (>= {MIN_CONFIDENCE})")

    # Build OSM spatial index
    osm_shapes = [shape(f["geometry"]) for f in osm_feats]
    tree = STRtree(osm_shapes)

    new_feats = []
    for i, row in vida.iterrows():
        g = row["geometry"]
        c = g.centroid
        hits = tree.query(c.buffer(0.00008))
        matched = False
        for h in hits:
            if osm_shapes[h].contains(c) or osm_shapes[h].intersects(g):
                matched = True
                break
        if matched:
            continue
        ring = list(g.exterior.coords)
        lat0 = sum(p[1] for p in ring) / len(ring)
        area = polygon_area_m2(ring, lat0)
        new_feats.append({
            "type": "Feature",
            "properties": {
                "id": int(row["s2_id"]) if row.get("s2_id") is not None else f"vida_{i}",
                "source": row["bf_source"],
                "confidence": round(float(row["confidence"]), 3),
                "area_m2": round(area, 1),
                "levels": heuristic_levels(area),
            },
            "geometry": {"type": "Polygon", "coordinates": [list(ring)]},
        })
        if i % 5000 == 0:
            print(f"  processed {i}/{len(vida)} · new: {len(new_feats)}")

    merged = {
        "type": "FeatureCollection",
        "features": osm_feats + new_feats,
    }
    with open(out, "w") as f:
        json.dump(merged, f)
    print(f"  merged: OSM={len(osm_feats)} + VIDA new={len(new_feats)} = {len(merged['features'])}")


if __name__ == "__main__":
    main()
