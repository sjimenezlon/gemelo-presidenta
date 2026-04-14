import type { StyleSpecification } from "maplibre-gl";

// Dark basemap + MapTiler-free terrain via AWS Terrarium tiles.
// 100% gratuito, sin API key. Usa OpenFreeMap (Liberty) como raster base opcional.
export const mapStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap · © CARTO",
    },
    labels: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
    },
    terrain: {
      type: "raster-dem",
      tiles: [
        "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      encoding: "terrarium",
      maxzoom: 15,
      attribution: "Terrain © Mapzen / AWS Open Data",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0b1120" } },
    { id: "osm", type: "raster", source: "osm" },
    {
      id: "hillshade",
      type: "hillshade",
      source: "terrain",
      paint: {
        "hillshade-exaggeration": 0.6,
        "hillshade-shadow-color": "#000814",
        "hillshade-highlight-color": "#22d3ee",
      },
    },
    { id: "labels", type: "raster", source: "labels" },
  ],
  terrain: { source: "terrain", exaggeration: 1.4 },
  sky: {
    "sky-color": "#0b1120",
    "horizon-color": "#1e293b",
    "fog-color": "#0b1120",
    "fog-ground-blend": 0.5,
  } as any,
};

export const INITIAL_VIEW = {
  longitude: -75.5669,
  latitude: 6.2086,
  zoom: 14.2,
  pitch: 60,
  bearing: -25,
};
