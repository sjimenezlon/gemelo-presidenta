"use client";
import { useEffect, useRef } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildStyle, INITIAL_VIEW } from "./mapStyle";
import { cauce, cuenca, landmarks } from "@/data/quebrada";
import { useTwin } from "./store";
import { buildFloodPolygon } from "@/lib/flood";

export default function DigitalTwinMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const twin = useTwin();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(twin.basemap),
      center: [INITIAL_VIEW.longitude, INITIAL_VIEW.latitude],
      zoom: INITIAL_VIEW.zoom,
      pitch: INITIAL_VIEW.pitch,
      bearing: INITIAL_VIEW.bearing,
      maxPitch: 75,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    const installLayers = () => {
      if (map.getSource("cuenca")) return;
      map.addSource("cuenca", { type: "geojson", data: cuenca });
      map.addLayer({
        id: "cuenca-fill",
        type: "fill",
        source: "cuenca",
        paint: { "fill-color": "#22d3ee", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "cuenca-line",
        type: "line",
        source: "cuenca",
        paint: { "line-color": "#22d3ee", "line-width": 1.5, "line-dasharray": [2, 2] },
      });

      map.addSource("cauce", { type: "geojson", data: cauce });
      map.addLayer({
        id: "cauce-glow",
        type: "line",
        source: "cauce",
        paint: { "line-color": "#0ea5e9", "line-width": 8, "line-blur": 6, "line-opacity": 0.6 },
      });
      map.addLayer({
        id: "cauce-line",
        type: "line",
        source: "cauce",
        paint: { "line-color": "#7dd3fc", "line-width": 3 },
      });

      map.addSource("flood", {
        type: "geojson",
        data: buildFloodPolygon(0.8),
      });
      map.addLayer(
        {
          id: "flood-fill",
          type: "fill",
          source: "flood",
          paint: {
            "fill-color": "#60a5fa",
            "fill-opacity": 0.45,
          },
        },
        "cauce-glow",
      );
      map.addLayer(
        {
          id: "flood-outline",
          type: "line",
          source: "flood",
          paint: { "line-color": "#93c5fd", "line-width": 1.2 },
        },
        "cauce-glow",
      );

      // 3D buildings desde OSM (si el basemap los tuviera) — usamos capa procedural
      // Markers
      if ((installLayers as any)._markersDone) return;
      (installLayers as any)._markersDone = true;
      landmarks.forEach((l) => {
        const el = document.createElement("div");
        el.className = "twin-marker";
        el.style.cssText = `
          width:14px;height:14px;border-radius:50%;
          background:${l.type === "siata" ? "#f59e0b" : l.type === "nacimiento" ? "#10b981" : "#22d3ee"};
          border:2px solid #0b1120;box-shadow:0 0 12px currentColor;color:#22d3ee;`;
        new maplibregl.Marker({ element: el })
          .setLngLat(l.coord as [number, number])
          .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(`<strong>${l.name}</strong><br/><small>${l.type}</small>`))
          .addTo(map);
      });
    };
    map.on("load", installLayers);
    map.on("style.load", installLayers);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Reactivity: flood level + toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("flood") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(buildFloodPolygon(twin.floodLevel) as any);
    if (map.getLayer("cuenca-fill"))
      map.setLayoutProperty("cuenca-fill", "visibility", twin.showCuenca ? "visible" : "none");
    if (map.getLayer("cuenca-line"))
      map.setLayoutProperty("cuenca-line", "visibility", twin.showCuenca ? "visible" : "none");
  }, [twin.floodLevel, twin.showCuenca]);

  // Basemap switching
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(buildStyle(twin.basemap));
  }, [twin.basemap]);

  // Overlay visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const setVis = (id: string, v: boolean) => {
      if (map.getLayer(id))
        map.setLayoutProperty(id, "visibility", v ? "visible" : "none");
    };
    setVis("overlay-hot", twin.overlays.hot);
    setVis("overlay-nasa-precip", twin.overlays.nasa_precip);
    setVis("overlay-esri-hillshade", twin.overlays.esri_hillshade);
  }, [twin.overlays, twin.basemap]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
