#!/usr/bin/env python3
"""
Preprocesamiento GeoAI — Gemelo Digital Quebrada La Presidenta.

1. Descarga tiles DEM Mapzen Terrarium (AWS Open Data) a zoom 14
2. Decodifica elevaciones (encoding terrarium)
3. Muestrea elevaciones a lo largo del cauce real (OSM)
4. Calcula HAND (Height Above Nearest Drainage) para:
    - Una malla regular (4 mil puntos) usada por turf.isobands
    - El centroide de cada edificio OSM
5. Guarda GeoJSONs listos para consumo en /public/data/

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

# bbox El Poblado / La Presidenta — alineado a los datos OSM descargados
BBOX = (-75.585, 6.195, -75.525, 6.220)  # (west, south, east, north)
ZOOM = 14  # ~10 m/pixel en latitud 6°
TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"


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
            req = urllib.request.Request(url, headers={"User-Agent": "gemelo-presidenta"})
            with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
                img = Image.open(io.BytesIO(r.read())).convert("RGB")
            arr = np.asarray(img, dtype=np.float32)
            elev = arr[..., 0] * 256 + arr[..., 1] + arr[..., 2] / 256 - 32768
            mosaic[iy * 256 : (iy + 1) * 256, ix * 256 : (ix + 1) * 256] = elev
            print(f"  tile {tx},{ty} elev={elev.min():.0f}..{elev.max():.0f} m")

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


def sample_cauce(dem, bbox, cauce_fc, step_m=15):
    """Muestrea elevación cada ~15 m a lo largo de cada segmento del cauce."""
    pts = []
    for f in cauce_fc["features"]:
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
                e = sample_elev(dem, bbox, lon, lat)
                if e is not None:
                    pts.append((lon, lat, e))
    return np.array(pts)  # (N, 3)


def nearest_cauce_elev(cauce_pts, lon, lat):
    dlon = (cauce_pts[:, 0] - lon) * math.cos(math.radians(lat))
    dlat = cauce_pts[:, 1] - lat
    d2 = dlon * dlon + dlat * dlat
    idx = int(np.argmin(d2))
    return float(cauce_pts[idx, 2]), float(math.sqrt(d2[idx]) * 111000)


def centroid(coords):
    cx = sum(c[0] for c in coords) / len(coords)
    cy = sum(c[1] for c in coords) / len(coords)
    return cx, cy


def polygon_area_m2(ring, lat0):
    # Shoelace en coordenadas locales aproximadas (metros)
    mx = 111000 * math.cos(math.radians(lat0))
    my = 111000
    s = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][0] * mx, ring[i][1] * my
        x2, y2 = ring[i + 1][0] * mx, ring[i + 1][1] * my
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def main():
    cauce_fc = json.load(open(DATA / "presidenta.geojson"))
    buildings_fc = json.load(open(DATA / "buildings.geojson"))

    print("Downloading DEM…")
    dem, dem_bbox = download_dem(BBOX, ZOOM)
    print(f"DEM shape={dem.shape} range={dem.min():.0f}..{dem.max():.0f} m")

    print("Sampling cauce elevations…")
    cauce_pts = sample_cauce(dem, dem_bbox, cauce_fc, step_m=15)
    print(f"  {len(cauce_pts)} cauce points, elev {cauce_pts[:,2].min():.0f}..{cauce_pts[:,2].max():.0f} m")

    # --- Building HAND ---
    print("Computing HAND per building…")
    levels = [round(l, 1) for l in np.arange(0.5, 5.1, 0.5)]
    affected_by_level = {l: 0 for l in levels}
    area_by_level = {l: 0.0 for l in levels}
    loss_by_level = {l: 0.0 for l in levels}

    # Depth-damage curve (HAZUS-like residencial + comercial)
    def damage_ratio(depth):
        return min(0.95, max(0.0, 0.15 * depth + 0.08 * depth * depth))

    PRECIO_M2_COP = 6_500_000  # El Poblado 2026 referencial

    for feat in buildings_fc["features"]:
        ring = feat["geometry"]["coordinates"][0]
        cx, cy = centroid(ring)
        e = sample_elev(dem, dem_bbox, cx, cy)
        if e is None:
            feat["properties"]["hand"] = None
            continue
        ce, dist = nearest_cauce_elev(cauce_pts, cx, cy)
        hand = max(0.0, e - ce)
        area = polygon_area_m2(ring, cy)
        levels_bldg = 1
        try:
            levels_bldg = max(1, int(float(feat["properties"].get("levels", 1) or 1)))
        except Exception:
            levels_bldg = 1
        gfa = area * levels_bldg
        value_cop = gfa * PRECIO_M2_COP

        feat["properties"]["hand"] = round(hand, 2)
        feat["properties"]["dist_cauce_m"] = round(dist, 1)
        feat["properties"]["elev"] = round(e, 1)
        feat["properties"]["area_m2"] = round(area, 1)
        feat["properties"]["gfa_m2"] = round(gfa, 1)
        feat["properties"]["value_cop"] = int(value_cop)
        for l in levels:
            if hand <= l and dist < 400:
                affected_by_level[l] += 1
                area_by_level[l] += area
                depth_in_bldg = max(0.0, l - hand)
                dmg = damage_ratio(depth_in_bldg)
                loss_by_level[l] += value_cop * dmg

    json.dump(buildings_fc, open(DATA / "buildings.geojson", "w"))
    print(f"  buildings expuestos por nivel: {affected_by_level}")
    print(f"  pérdida COP estimada por nivel: {[(k, round(v/1e9,2)) for k,v in loss_by_level.items()]} (miles de millones)")

    # --- HAND grid for turf.isobands ---
    print("Building HAND grid…")
    w, s, e, n = BBOX
    nx, ny = 140, 80
    pts_feats = []
    lons = np.linspace(w, e, nx)
    lats = np.linspace(s, n, ny)
    for lat in lats:
        for lon in lons:
            el = sample_elev(dem, dem_bbox, lon, lat)
            if el is None:
                continue
            ce, dist = nearest_cauce_elev(cauce_pts, lon, lat)
            if dist > 350:  # fuera de la llanura de inundación potencial
                continue
            hand = max(0.0, el - ce)
            pts_feats.append(
                {
                    "type": "Feature",
                    "properties": {"hand": round(hand, 2)},
                    "geometry": {"type": "Point", "coordinates": [float(lon), float(lat)]},
                }
            )
    grid = {"type": "FeatureCollection", "features": pts_feats}
    json.dump(grid, open(DATA / "hand_grid.geojson", "w"))
    print(f"  grid points: {len(pts_feats)}")

    # --- Critical + bridges per level (from existing precomputed files) ---
    def count_points_by_level(fc_path):
        try:
            fc = json.load(open(fc_path))
        except Exception:
            return {}
        out = {l: 0 for l in levels}
        for f in fc["features"]:
            p = f.get("properties", {})
            h = p.get("hand")
            d = p.get("dist_grid_m", 0)
            if h is None or d is None or d > 300:
                continue
            for l in levels:
                if h <= l:
                    out[l] += 1
        return out

    critical_by_level = count_points_by_level(DATA / "critical.geojson")
    bridges_by_level = count_points_by_level(DATA / "bridges.geojson")
    print(f"  critical expuestos: {critical_by_level}")
    print(f"  bridges expuestos: {bridges_by_level}")

    # --- Metadata ---
    meta = {
        "bbox": list(BBOX),
        "snapshot_date": "2026-04-14",
        "dem_source": "Mapzen Terrarium via AWS Open Data",
        "dem_zoom": ZOOM,
        "dem_resolution_m_approx": round(
            40075000 * math.cos(math.radians((s + n) / 2)) / (256 * (1 << ZOOM)), 1
        ),
        "cauce_points": int(len(cauce_pts)),
        "cauce_elev_min": float(cauce_pts[:, 2].min()),
        "cauce_elev_max": float(cauce_pts[:, 2].max()),
        "grid_points": len(pts_feats),
        "buildings_total": len(buildings_fc["features"]),
        "affected_by_level": {str(k): v for k, v in affected_by_level.items()},
        "area_affected_by_level_m2": {str(k): round(v, 0) for k, v in area_by_level.items()},
        "loss_by_level_cop": {str(k): int(v) for k, v in loss_by_level.items()},
        "critical_by_level": {str(k): v for k, v in critical_by_level.items()},
        "bridges_by_level": {str(k): v for k, v in bridges_by_level.items()},
        "price_per_m2_cop": PRECIO_M2_COP,
        "damage_curve": "HAZUS-like: ratio = min(0.95, 0.15d + 0.08d²)",
        "model": "HAND (Height Above Nearest Drainage)",
        "method_ref": "Rennó et al. 2008; Nobre et al. 2011",
        "era5_max_day_mm": 58.4,
        "era5_max_hour_mmh": 15.8,
        "rainfall_source": "Open-Meteo ERA5 2020-2026",
    }
    json.dump(meta, open(DATA / "meta.json", "w"), indent=2)
    print("Done. Wrote buildings.geojson, hand_grid.geojson, meta.json")


if __name__ == "__main__":
    main()
