#!/usr/bin/env python3
"""
Preprocesamiento GeoAI — Gemelo Digital Quebradas La Presidenta + Volcana-Los Balsos.

1. Descarga tiles DEM Mapzen Terrarium (AWS Open Data) a zoom 14
2. Decodifica elevaciones (encoding terrarium)
3. Muestrea elevaciones a lo largo de los cauces reales (OSM), manteniendo cauce_id por punto
4. Calcula HAND (Height Above Nearest Drainage) relativo al cauce más cercano para:
    - Una malla regular (~8 mil puntos) usada por turf.isobands
    - El centroide de cada edificio OSM
   Cada edificio / celda queda etiquetado con el cauce_id al que se asigna.
5. Re-etiqueta critical.geojson, bridges.geojson y kontur_pop.geojson
   con cauce_id + hand (relativo al cauce más cercano)
6. Guarda GeoJSONs listos para consumo en /public/data/ y meta.json con stats por cauce

El modelo HAND es el estándar INPE/CEMADEN para susceptibilidad fluvial:
una celda se inunda cuando (elev_celda − elev_cauce_nn) ≤ nivel_agua.
"""

import json, math, os, sys, urllib.request, io, ssl
from pathlib import Path
import numpy as np
from PIL import Image

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
DATA.mkdir(parents=True, exist_ok=True)

# bbox expandido: cubre La Presidenta (norte) + Volcana-Los Balsos (centro/sur)
# incluye Campus EAFIT y se extiende al sur hasta el nacimiento de Volcana.
BBOX = (-75.590, 6.180, -75.520, 6.220)  # (west, south, east, north)
ZOOM = 14  # ~10 m/pixel en latitud 6°
TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

# Orden importa: el índice define el cauce_id para cada punto
CAUCES = [
    {"id": "presidenta", "file": "presidenta.geojson", "display": "Quebrada La Presidenta"},
    {"id": "volcana",    "file": "volcana.geojson",    "display": "Quebrada Volcana-Los Balsos"},
]

PRECIO_M2_COP = 6_500_000  # El Poblado / EAFIT sector, 2026 referencial


def lon2tile(lon, z):
    return (lon + 180.0) / 360.0 * (1 << z)


def lat2tile(lat, z):
    rad = math.radians(lat)
    return (1 - math.log(math.tan(rad) + 1 / math.cos(rad)) / math.pi) / 2 * (1 << z)


def tile2lon(x, z):
    return x / (1 << z) * 360.0 - 180.0


def tile2lat(y, z):
    n = math.pi - 2 * math.pi * y / (1 << z)
    return math.degrees(math.atan(math.sinh(n)))


def download_dem(bbox, zoom):
    w, s, e, n = bbox
    x0 = int(math.floor(lon2tile(w, zoom)))
    x1 = int(math.floor(lon2tile(e, zoom)))
    y0 = int(math.floor(lat2tile(n, zoom)))
    y1 = int(math.floor(lat2tile(s, zoom)))
    cols = x1 - x0 + 1
    rows = y1 - y0 + 1
    print(f"DEM tiles zoom={zoom}: {cols}×{rows} = {cols*rows} tiles")

    mosaic = np.zeros((rows * 256, cols * 256), dtype=np.float32)
    for ix, tx in enumerate(range(x0, x1 + 1)):
        for iy, ty in enumerate(range(y0, y1 + 1)):
            url = TILE_URL.format(z=zoom, x=tx, y=ty)
            req = urllib.request.Request(url, headers={"User-Agent": "gemelo-quebradas/1.0"})
            with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
                img = Image.open(io.BytesIO(r.read())).convert("RGB")
            arr = np.asarray(img, dtype=np.float32)
            elev = arr[..., 0] * 256 + arr[..., 1] + arr[..., 2] / 256 - 32768
            mosaic[iy * 256 : (iy + 1) * 256, ix * 256 : (ix + 1) * 256] = elev

    north = tile2lat(y0, zoom)
    south = tile2lat(y1 + 1, zoom)
    west = tile2lon(x0, zoom)
    east = tile2lon(x1 + 1, zoom)
    return mosaic, (west, south, east, north)


def sample_elev(dem, bbox, lon, lat):
    w, s, e, n = bbox
    h, wd = dem.shape
    px = (lon - w) / (e - w) * wd
    py = (n - lat) / (n - s) * h
    ix, iy = int(px), int(py)
    if 0 <= ix < wd and 0 <= iy < h:
        return float(dem[iy, ix])
    return None


def sample_cauces(dem, dem_bbox, cauces_config, step_m=15):
    """Muestrea elevación cada ~step_m a lo largo de cada cauce.
    Retorna array (N, 4): (lon, lat, elev, cauce_idx)."""
    rows = []
    for idx, spec in enumerate(cauces_config):
        path = DATA / spec["file"]
        fc = json.load(open(path))
        count = 0
        for f in fc["features"]:
            coords = f["geometry"]["coordinates"]
            for i in range(len(coords) - 1):
                a, b = coords[i], coords[i + 1]
                dlon, dlat = b[0] - a[0], b[1] - a[1]
                dist_m = math.hypot(dlon * 111000 * math.cos(math.radians(a[1])), dlat * 111000)
                steps = max(1, int(dist_m / step_m))
                for k in range(steps):
                    t = k / steps
                    lon = a[0] + dlon * t
                    lat = a[1] + dlat * t
                    e = sample_elev(dem, dem_bbox, lon, lat)
                    if e is not None:
                        rows.append((lon, lat, e, idx))
                        count += 1
        print(f"  {spec['id']}: {count} puntos sampleados")
    return np.array(rows, dtype=np.float64)


def nearest_cauce(cauce_pts, lon, lat):
    """Devuelve (elev_cauce_nn, dist_m, cauce_idx) al drenaje más cercano."""
    dlon = (cauce_pts[:, 0] - lon) * math.cos(math.radians(lat))
    dlat = cauce_pts[:, 1] - lat
    d2 = dlon * dlon + dlat * dlat
    k = int(np.argmin(d2))
    return float(cauce_pts[k, 2]), float(math.sqrt(d2[k]) * 111000), int(cauce_pts[k, 3])


def centroid(coords):
    cx = sum(c[0] for c in coords) / len(coords)
    cy = sum(c[1] for c in coords) / len(coords)
    return cx, cy


def polygon_area_m2(ring, lat0):
    mx = 111000 * math.cos(math.radians(lat0))
    my = 111000
    s = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][0] * mx, ring[i][1] * my
        x2, y2 = ring[i + 1][0] * mx, ring[i + 1][1] * my
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def damage_ratio(depth):
    return min(0.95, max(0.0, 0.15 * depth + 0.08 * depth * depth))


def tag_points_fc(path, dem, dem_bbox, cauce_pts, cauce_ids, max_dist=400):
    """Re-etiqueta un FeatureCollection de puntos con hand, dist_grid_m, cauce_id."""
    if not path.exists():
        return None
    fc = json.load(open(path))
    by_level = {}
    for feat in fc["features"]:
        g = feat["geometry"]
        if g["type"] != "Point":
            continue
        lon, lat = g["coordinates"][0], g["coordinates"][1]
        e = sample_elev(dem, dem_bbox, lon, lat)
        if e is None:
            feat["properties"]["hand"] = None
            continue
        ce, dist, cidx = nearest_cauce(cauce_pts, lon, lat)
        hand = max(0.0, e - ce)
        feat["properties"]["hand"] = round(hand, 2)
        feat["properties"]["dist_grid_m"] = round(dist, 1)
        feat["properties"]["cauce_id"] = cauce_ids[cidx]
    json.dump(fc, open(path, "w"))
    return fc


def main():
    cauce_ids = [c["id"] for c in CAUCES]
    buildings_fc = json.load(open(DATA / "buildings.geojson"))

    print("Downloading DEM…")
    dem, dem_bbox = download_dem(BBOX, ZOOM)
    print(f"DEM shape={dem.shape} range={dem.min():.0f}..{dem.max():.0f} m")

    print("Sampling cauces…")
    cauce_pts = sample_cauces(dem, dem_bbox, CAUCES, step_m=15)
    print(f"  total {len(cauce_pts)} puntos, elev {cauce_pts[:,2].min():.0f}..{cauce_pts[:,2].max():.0f} m")

    # --- Building HAND (multi-cauce) ---
    print("Computing HAND per building…")
    levels = [round(l, 1) for l in np.arange(0.5, 5.1, 0.5)]
    # Stats per cauce
    stats = {cid: {
        "affected_by_level": {l: 0 for l in levels},
        "area_by_level": {l: 0.0 for l in levels},
        "loss_by_level": {l: 0.0 for l in levels},
    } for cid in cauce_ids}

    for feat in buildings_fc["features"]:
        g = feat["geometry"]
        if g["type"] != "Polygon":
            feat["properties"]["hand"] = None
            continue
        ring = g["coordinates"][0]
        cx, cy = centroid(ring)
        e = sample_elev(dem, dem_bbox, cx, cy)
        if e is None:
            feat["properties"]["hand"] = None
            continue
        ce, dist, cidx = nearest_cauce(cauce_pts, cx, cy)
        hand = max(0.0, e - ce)
        area = polygon_area_m2(ring, cy)
        lv_raw = feat["properties"].get("levels")
        try:
            lv = max(1, int(float(lv_raw))) if lv_raw else 1
        except Exception:
            lv = 1
        gfa = area * lv
        value_cop = gfa * PRECIO_M2_COP

        feat["properties"]["hand"] = round(hand, 2)
        feat["properties"]["dist_cauce_m"] = round(dist, 1)
        feat["properties"]["elev"] = round(e, 1)
        feat["properties"]["area_m2"] = round(area, 1)
        feat["properties"]["est_levels"] = lv
        feat["properties"]["gfa_m2"] = round(gfa, 1)
        feat["properties"]["value_cop"] = int(value_cop)
        feat["properties"]["cauce_id"] = cauce_ids[cidx]

        if dist < 400:
            cid = cauce_ids[cidx]
            s = stats[cid]
            for l in levels:
                if hand <= l:
                    s["affected_by_level"][l] += 1
                    s["area_by_level"][l] += area
                    depth = max(0.0, l - hand)
                    s["loss_by_level"][l] += value_cop * damage_ratio(depth)

    json.dump(buildings_fc, open(DATA / "buildings.geojson", "w"))
    for cid in cauce_ids:
        total_lvl5 = stats[cid]["affected_by_level"][5.0]
        print(f"  {cid}: afectados@5m={total_lvl5}  loss@5m≈{stats[cid]['loss_by_level'][5.0]/1e9:.1f} mil M COP")

    # --- HAND grid (multi-cauce) ---
    print("Building HAND grid…")
    w, s, e, n = BBOX
    nx, ny = 180, 130
    pts_feats = []
    lons = np.linspace(w, e, nx)
    lats = np.linspace(s, n, ny)
    for lat in lats:
        for lon in lons:
            el = sample_elev(dem, dem_bbox, lon, lat)
            if el is None:
                continue
            ce, dist, cidx = nearest_cauce(cauce_pts, lon, lat)
            if dist > 350:
                continue
            hand = max(0.0, el - ce)
            pts_feats.append({
                "type": "Feature",
                "properties": {
                    "hand": round(hand, 2),
                    "cauce_id": cauce_ids[cidx],
                },
                "geometry": {"type": "Point", "coordinates": [float(lon), float(lat)]},
            })
    grid = {"type": "FeatureCollection", "features": pts_feats}
    json.dump(grid, open(DATA / "hand_grid.geojson", "w"))
    print(f"  grid points: {len(pts_feats)}")

    # --- Re-tag critical, bridges, kontur_pop ---
    print("Tagging critical/bridges/kontur with cauce_id…")
    tag_points_fc(DATA / "critical.geojson", dem, dem_bbox, cauce_pts, cauce_ids)
    tag_points_fc(DATA / "bridges.geojson", dem, dem_bbox, cauce_pts, cauce_ids)
    tag_points_fc(DATA / "kontur_pop.geojson", dem, dem_bbox, cauce_pts, cauce_ids)

    # --- Count critical/bridges by level/cauce ---
    def count_by_cauce_level(fc_path, max_dist=300):
        try:
            fc = json.load(open(fc_path))
        except Exception:
            return {cid: {str(l): 0 for l in levels} for cid in cauce_ids}
        out = {cid: {str(l): 0 for l in levels} for cid in cauce_ids}
        for f in fc["features"]:
            p = f.get("properties", {})
            h = p.get("hand")
            d = p.get("dist_grid_m", 999)
            cid = p.get("cauce_id")
            if h is None or d is None or d > max_dist or cid not in out:
                continue
            for l in levels:
                if h <= l:
                    out[cid][str(l)] += 1
        return out

    critical_by = count_by_cauce_level(DATA / "critical.geojson")
    bridges_by = count_by_cauce_level(DATA / "bridges.geojson")
    print(f"  critical@5m: {[(cid, critical_by[cid]['5.0']) for cid in cauce_ids]}")
    print(f"  bridges@5m: {[(cid, bridges_by[cid]['5.0']) for cid in cauce_ids]}")

    # --- Population by level per cauce (from kontur hexes) ---
    def population_by_cauce_level(fc_path, max_dist=300):
        try:
            fc = json.load(open(fc_path))
        except Exception:
            return {cid: {str(l): 0 for l in levels} for cid in cauce_ids}
        out = {cid: {str(l): 0 for l in levels} for cid in cauce_ids}
        for f in fc["features"]:
            p = f.get("properties", {})
            h = p.get("hand")
            d = p.get("dist_grid_m", 999)
            cid = p.get("cauce_id")
            pop = p.get("pop") or 0
            if h is None or d is None or d > max_dist or cid not in out:
                continue
            for l in levels:
                if h <= l:
                    out[cid][str(l)] += int(pop)
        return out

    population_by = population_by_cauce_level(DATA / "kontur_pop.geojson")

    # --- Cauce elevation stats per cauce ---
    cauces_meta = {}
    for idx, spec in enumerate(CAUCES):
        mask = cauce_pts[:, 3] == idx
        pts = cauce_pts[mask]
        cauces_meta[spec["id"]] = {
            "display_name": spec["display"],
            "cauce_points": int(len(pts)),
            "cauce_elev_min": float(pts[:, 2].min()) if len(pts) else None,
            "cauce_elev_max": float(pts[:, 2].max()) if len(pts) else None,
            "affected_by_level": {str(k): v for k, v in stats[spec["id"]]["affected_by_level"].items()},
            "area_affected_by_level_m2": {str(k): round(v, 0) for k, v in stats[spec["id"]]["area_by_level"].items()},
            "loss_by_level_cop": {str(k): int(v) for k, v in stats[spec["id"]]["loss_by_level"].items()},
            "critical_by_level": critical_by[spec["id"]],
            "bridges_by_level": bridges_by[spec["id"]],
            "population_by_level": population_by[spec["id"]],
        }

    # --- Totales agregados (suma de todos los cauces) ---
    def sum_by_level(field: str) -> dict:
        out = {str(l): 0 for l in levels}
        for cid in cauce_ids:
            for l in levels:
                out[str(l)] += cauces_meta[cid][field][str(l)]
        return out

    total_meta = {
        "affected_by_level": sum_by_level("affected_by_level"),
        "loss_by_level_cop": sum_by_level("loss_by_level_cop"),
        "critical_by_level": sum_by_level("critical_by_level"),
        "bridges_by_level": sum_by_level("bridges_by_level"),
        "population_by_level": sum_by_level("population_by_level"),
    }

    # --- Totales de features (count) ---
    def count_fc(path):
        try:
            return len(json.load(open(path))["features"])
        except Exception:
            return 0

    critical_total = count_fc(DATA / "critical.geojson")
    bridges_total = count_fc(DATA / "bridges.geojson")

    # Total valor edificado (suma value_cop sobre todos los edificios con valor)
    total_value_cop = sum(
        (f["properties"].get("value_cop") or 0) for f in buildings_fc["features"]
    )

    meta = {
        "bbox": list(BBOX),
        "snapshot_date": "2026-04-16",
        "dem_source": "Mapzen Terrarium via AWS Open Data",
        "dem_zoom": ZOOM,
        "dem_resolution_m_approx": round(
            40075000 * math.cos(math.radians((BBOX[1] + BBOX[3]) / 2)) / (256 * (1 << ZOOM)), 1
        ),
        "grid_points": len(pts_feats),
        "buildings_total": len(buildings_fc["features"]),
        "critical_total": critical_total,
        "bridges_total": bridges_total,
        "total_value_cop": int(total_value_cop),
        "price_per_m2_cop": PRECIO_M2_COP,
        "damage_curve": "HAZUS-like: ratio = min(0.95, 0.15d + 0.08d²)",
        "model": "HAND (Height Above Nearest Drainage), multi-cauce",
        "method_ref": "Rennó et al. 2008; Nobre et al. 2011",
        "era5_max_day_mm": 58.4,
        "era5_max_hour_mmh": 15.8,
        "rainfall_source": "Open-Meteo ERA5 2020-2026",
        "cauces": cauces_meta,
        "total": total_meta,
    }
    json.dump(meta, open(DATA / "meta.json", "w"), indent=2)
    print("Done. Wrote buildings.geojson, hand_grid.geojson, meta.json,"
          " y re-tagged critical/bridges/kontur_pop.")


if __name__ == "__main__":
    main()
