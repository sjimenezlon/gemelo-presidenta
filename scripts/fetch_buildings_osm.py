#!/usr/bin/env python3
"""
Extiende /public/data/buildings.geojson con edificios del strip sur faltante
(cuenca de la Quebrada Volcana-Los Balsos, entre lat 6.180 y 6.195).

- Query Overpass: way[building] en el strip sur
- Convierte a GeoJSON Polygon
- Preserva tags OSM relevantes (building, levels, height, name, amenity)
- Mergea con el archivo existente deduplicando por OSM id

Después de este script hay que correr build_hand.py para recomputar HAND.
"""

import json
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"

OVERPASS = "https://overpass.kumi.systems/api/interpreter"

# Strip sur: bajamos el sur del bbox original (6.195) hasta 6.180 para cubrir
# la cuenca de Volcana. West/East se mantienen alineados con el bbox original.
STRIP = (6.180, -75.590, 6.196, -75.520)  # (south, west, north, east)

KEEP_TAGS = {"building", "building:levels", "levels", "height",
             "name", "amenity", "shop", "office", "tourism"}


def overpass_buildings(bbox):
    s, w, n, e = bbox
    q = f"""[out:json][timeout:120];
(
  way[building]({s},{w},{n},{e});
);
out geom tags;"""
    data = urllib.parse.urlencode({"data": q}).encode()
    req = urllib.request.Request(OVERPASS, data=data,
                                 headers={"User-Agent": "gemelo-quebradas/1.0"})
    with urllib.request.urlopen(req, timeout=180, context=SSL_CTX) as r:
        return json.loads(r.read())


def way_to_feature(el):
    geom = el.get("geometry") or []
    if len(geom) < 4:
        return None
    coords = [[p["lon"], p["lat"]] for p in geom]
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    tags = el.get("tags", {})
    # Tomar levels desde varias keys
    levels = tags.get("building:levels") or tags.get("levels")
    try:
        lv = int(float(levels)) if levels else None
    except Exception:
        lv = None
    props = {"id": el["id"]}
    if lv is not None:
        props["levels"] = lv
    for k in KEEP_TAGS:
        if k in tags and k not in ("levels", "building:levels"):
            props[k] = tags[k]
    return {
        "type": "Feature",
        "properties": props,
        "geometry": {"type": "Polygon", "coordinates": [coords]},
    }


def main():
    print(f"→ Fetching buildings en strip sur {STRIP}")
    result = overpass_buildings(STRIP)
    elements = result.get("elements", [])
    print(f"  {len(elements)} way elements")

    new_feats = []
    for el in elements:
        if el.get("type") != "way":
            continue
        feat = way_to_feature(el)
        if feat:
            new_feats.append(feat)
    print(f"  converted {len(new_feats)} polygons")

    # Merge con existente
    out = DATA / "buildings.geojson"
    if out.exists():
        existing = json.load(open(out))
        existing_ids = {f["properties"].get("id") for f in existing["features"]}
        add = [f for f in new_feats if f["properties"].get("id") not in existing_ids]
        merged = {
            "type": "FeatureCollection",
            "features": existing["features"] + add,
        }
        print(f"  merged: {len(existing['features'])} existing + {len(add)} new = {len(merged['features'])}")
    else:
        merged = {"type": "FeatureCollection", "features": new_feats}

    with open(out, "w") as f:
        json.dump(merged, f)
    print(f"  wrote {out}")


if __name__ == "__main__":
    main()
