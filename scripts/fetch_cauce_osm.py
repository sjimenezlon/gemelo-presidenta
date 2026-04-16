#!/usr/bin/env python3
"""
Fetch de cauces desde OpenStreetMap via Overpass API.

Produce `/public/data/<cauce_id>.geojson` con una FeatureCollection de
LineStrings (uno por segmento OSM), cada feature etiquetada con:
  - cauce_id: identificador interno (p.ej. "volcana", "presidenta")
  - name:     nombre OSM del waterway
  - id:       OSM way id (útil para trazabilidad)
  - cubierta: heurística booleana (tunnel=* o layer<0)

El script es idempotente — sobrescribe el archivo de salida en cada corrida.
"""

import json
import sys
import ssl
import urllib.request
from pathlib import Path

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
DATA.mkdir(parents=True, exist_ok=True)

OVERPASS = "https://overpass.kumi.systems/api/interpreter"

# Cada entrada: (cauce_id, regex_name, bbox (south, west, north, east))
# El bbox se usa solo para la query Overpass.
CAUCES = [
    {
        "cauce_id": "volcana",
        "name_regex": "Volcana",
        "bbox": (6.180, -75.600, 6.220, -75.520),
        "display_name": "Quebrada Volcana-Los Balsos",
    },
    # Presidenta ya está descargada; se puede re-fetch si quieres normalizar.
    # {
    #     "cauce_id": "presidenta",
    #     "name_regex": "Presidenta",
    #     "bbox": (6.195, -75.590, 6.220, -75.540),
    #     "display_name": "Quebrada La Presidenta",
    # },
]


def overpass_query(name_regex: str, bbox: tuple) -> dict:
    s, w, n, e = bbox
    q = f"""[out:json][timeout:30];
(
  way[waterway][name~"{name_regex}",i]({s},{w},{n},{e});
);
out geom;"""
    data = urllib.parse.urlencode({"data": q}).encode()
    req = urllib.request.Request(OVERPASS, data=data, headers={"User-Agent": "gemelo-quebradas/1.0"})
    with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
        return json.loads(r.read())


def is_cubierta(tags: dict) -> bool:
    if tags.get("tunnel") and tags["tunnel"] not in ("no",):
        return True
    try:
        if int(tags.get("layer", 0)) < 0:
            return True
    except Exception:
        pass
    if tags.get("covered") == "yes":
        return True
    return False


def elements_to_fc(elements: list, cauce_id: str, display_name: str) -> dict:
    feats = []
    for el in elements:
        if el.get("type") != "way":
            continue
        geom = el.get("geometry") or []
        if len(geom) < 2:
            continue
        coords = [[p["lon"], p["lat"]] for p in geom]
        tags = el.get("tags", {})
        feats.append({
            "type": "Feature",
            "properties": {
                "cauce_id": cauce_id,
                "name": tags.get("name") or display_name,
                "id": el["id"],
                "cubierta": is_cubierta(tags),
            },
            "geometry": {"type": "LineString", "coordinates": coords},
        })
    return {"type": "FeatureCollection", "features": feats}


def main():
    import urllib.parse  # noqa (imported inside overpass_query otherwise)

    for spec in CAUCES:
        cid = spec["cauce_id"]
        print(f"→ Fetching {cid} ({spec['name_regex']}) bbox={spec['bbox']}")
        result = overpass_query(spec["name_regex"], spec["bbox"])
        elements = result.get("elements", [])
        print(f"  {len(elements)} way elements")
        fc = elements_to_fc(elements, cid, spec["display_name"])
        out = DATA / f"{cid}.geojson"
        with open(out, "w") as f:
            json.dump(fc, f)
        print(f"  wrote {out} ({len(fc['features'])} features)")


if __name__ == "__main__":
    import urllib.parse
    main()
