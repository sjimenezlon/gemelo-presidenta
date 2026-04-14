import type { StyleSpecification, RasterSourceSpecification } from "maplibre-gl";

export type BasemapId = "dark" | "satellite" | "topo" | "voyager";

export const BASEMAPS: Record<
  BasemapId,
  { label: string; source: RasterSourceSpecification; dark: boolean }
> = {
  dark: {
    label: "Dark (CARTO)",
    dark: true,
    source: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OSM · © CARTO",
    },
  },
  satellite: {
    label: "Satelital (ESRI)",
    dark: true,
    source: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
  },
  topo: {
    label: "Topográfico (OpenTopoMap)",
    dark: false,
    source: {
      type: "raster",
      tiles: [
        "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution: "© OpenTopoMap (CC-BY-SA) · SRTM",
    },
  },
  voyager: {
    label: "Claro (Voyager)",
    dark: false,
    source: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OSM · © CARTO",
    },
  },
};

export function buildStyle(basemap: BasemapId): StyleSpecification {
  const bm = BASEMAPS[basemap];
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      basemap: bm.source,
      terrain: {
        type: "raster-dem",
        tiles: [
          "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        encoding: "terrarium",
        maxzoom: 15,
        attribution: "Terrain © Mapzen / AWS Open Data",
      } as any,
      // Overlay: Humanitarian OSM (contexto urbano)
      hot: {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© OSM Humanitarian",
      },
      // Overlay: NASA GIBS — precipitación IMERG global (capa WMTS EPSG:3857)
      nasa_precip: {
        type: "raster",
        tiles: [
          "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",
        ],
        tileSize: 256,
        maxzoom: 9,
        attribution: "NASA GIBS · GPM IMERG",
      },
      // Overlay: Esri World Hillshade (sombra vectorial global)
      esri_hillshade: {
        type: "raster",
        tiles: [
          "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "Hillshade © Esri",
      },
      // Overlay: Etiquetas (para satélite)
      esri_labels: {
        type: "raster",
        tiles: [
          "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0b1120" } },
      { id: "basemap", type: "raster", source: "basemap" },
      {
        id: "overlay-hillshade-terrain",
        type: "hillshade",
        source: "terrain",
        layout: { visibility: "visible" },
        paint: {
          "hillshade-exaggeration": 0.55,
          "hillshade-shadow-color": "#000814",
          "hillshade-highlight-color": bm.dark ? "#22d3ee" : "#ffffff",
        },
      },
      {
        id: "overlay-esri-hillshade",
        type: "raster",
        source: "esri_hillshade",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.35 },
      },
      {
        id: "overlay-hot",
        type: "raster",
        source: "hot",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.55 },
      },
      {
        id: "overlay-nasa-precip",
        type: "raster",
        source: "nasa_precip",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.6 },
      },
      {
        id: "overlay-esri-labels",
        type: "raster",
        source: "esri_labels",
        layout: { visibility: basemap === "satellite" ? "visible" : "none" },
        paint: { "raster-opacity": 0.9 },
      },
    ],
    terrain: { source: "terrain", exaggeration: 1.4 },
    sky: {
      "sky-color": "#0b1120",
      "horizon-color": "#1e293b",
      "fog-color": "#0b1120",
      "fog-ground-blend": 0.5,
    } as any,
  };
}

export const INITIAL_VIEW = {
  longitude: -75.5669,
  latitude: 6.2086,
  zoom: 14.2,
  pitch: 60,
  bearing: -25,
};
