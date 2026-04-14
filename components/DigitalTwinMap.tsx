"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildStyle, INITIAL_VIEW } from "./mapStyle";
import { useTwin } from "./store";

export default function DigitalTwinMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const lastBasemap = useRef<string>("");
  const twin = useTwin();
  const [error, setError] = useState<string | null>(null);

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
    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.ScaleControl({ unit: "metric" }),
      "bottom-left",
    );

    let markersDone = false;

    const installLayers = async () => {
      try {
      if (map.getSource("presidenta")) return;

      const [presidenta, rio, buildings] = await Promise.all([
        fetch("/data/presidenta.geojson").then((r) => r.json()),
        fetch("/data/rio_medellin.geojson").then((r) => r.json()),
        fetch("/data/buildings.geojson").then((r) => r.json()),
      ]);

      // Río Medellín (contexto)
      map.addSource("rio", { type: "geojson", data: rio });
      map.addLayer({
        id: "rio-glow",
        type: "line",
        source: "rio",
        paint: {
          "line-color": "#0369a1",
          "line-width": 10,
          "line-blur": 8,
          "line-opacity": 0.5,
        },
      });
      map.addLayer({
        id: "rio-line",
        type: "line",
        source: "rio",
        paint: { "line-color": "#38bdf8", "line-width": 3 },
      });

      // Quebrada La Presidenta (datos reales OSM)
      map.addSource("presidenta", { type: "geojson", data: presidenta });
      map.addLayer({
        id: "presidenta-glow",
        type: "line",
        source: "presidenta",
        paint: {
          "line-color": "#22d3ee",
          "line-width": 7,
          "line-blur": 5,
          "line-opacity": 0.7,
        },
      });
      map.addLayer({
        id: "presidenta-line",
        type: "line",
        source: "presidenta",
        paint: {
          "line-color": "#a5f3fc",
          "line-width": [
            "case",
            ["==", ["get", "cubierta"], true],
            2,
            3.5,
          ],
          "line-dasharray": [
            "case",
            ["==", ["get", "cubierta"], true],
            ["literal", [2, 2]],
            ["literal", [1, 0]],
          ] as any,
        },
      });

      // Cuenca aprox. (computed buffer alrededor del cauce)
      const allCoords: number[][] = [];
      presidenta.features.forEach((f: any) =>
        f.geometry.coordinates.forEach((c: number[]) => allCoords.push(c)),
      );

      // Edificaciones 3D (OSM) con altura estimada
      map.addSource("buildings", { type: "geojson", data: buildings });
      map.addLayer({
        id: "buildings-3d",
        type: "fill-extrusion",
        source: "buildings",
        paint: {
          "fill-extrusion-color": [
            "case",
            ["has", "levels"],
            "#64748b",
            "#475569",
          ],
          "fill-extrusion-height": [
            "case",
            ["has", "levels"],
            ["*", ["to-number", ["get", "levels"]], 3.2],
            8,
          ],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.75,
        },
      });

      // Flood: buffer dinámico alrededor del cauce real
      const { buildFloodPolygon } = await import("@/lib/flood");
      map.addSource("flood", {
        type: "geojson",
        data: buildFloodPolygon(twin.floodLevel, presidenta) as any,
      });
      map.addLayer(
        {
          id: "flood-fill",
          type: "fill",
          source: "flood",
          paint: { "fill-color": "#60a5fa", "fill-opacity": 0.45 },
        },
        "presidenta-glow",
      );
      map.addLayer(
        {
          id: "flood-outline",
          type: "line",
          source: "flood",
          paint: { "line-color": "#bfdbfe", "line-width": 1.2 },
        },
        "presidenta-glow",
      );

      // Popup al clicar el cauce
      map.on("click", "presidenta-line", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p: any = f.properties || {};
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>${p.name || "Quebrada La Presidenta"}</strong><br/>
             <small>OSM way #${p.id}${p.cubierta === "true" || p.cubierta === true ? " · cubierta" : ""}</small>`,
          )
          .addTo(map);
      });
      map.on("mouseenter", "presidenta-line", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "presidenta-line", () => {
        map.getCanvas().style.cursor = "";
      });

      if (!markersDone) {
        markersDone = true;
        const nac = allCoords[0];
        const des = allCoords[allCoords.length - 1];
        const mk = (lng: number, lat: number, color: string, label: string) => {
          const el = document.createElement("div");
          el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #0b1120;box-shadow:0 0 12px ${color};`;
          new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(`<strong>${label}</strong>`))
            .addTo(map);
        };
        if (nac) mk(nac[0], nac[1], "#10b981", "Nacimiento (aguas arriba)");
        if (des) mk(des[0], des[1], "#f59e0b", "Desembocadura en Río Medellín");
      }
      } catch (err: any) {
        console.error("installLayers error", err);
        setError(String(err?.message || err));
      }
    };
    map.on("error", (e: any) => {
      console.error("maplibre error", e?.error || e);
    });

    map.on("load", installLayers);
    map.on("style.load", installLayers);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Flood level + cuenca toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    (async () => {
      const src = map.getSource("flood") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      const presidenta = await fetch("/data/presidenta.geojson").then((r) =>
        r.json(),
      );
      const { buildFloodPolygon } = await import("@/lib/flood");
      src.setData(buildFloodPolygon(twin.floodLevel, presidenta) as any);
    })();
    if (map.getLayer("buildings-3d"))
      map.setLayoutProperty(
        "buildings-3d",
        "visibility",
        twin.showBuildings ? "visible" : "none",
      );
  }, [twin.floodLevel, twin.showBuildings]);

  // Basemap switching — solo si cambia
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lastBasemap.current === twin.basemap) return;
    if (lastBasemap.current === "") {
      lastBasemap.current = twin.basemap;
      return;
    }
    lastBasemap.current = twin.basemap;
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

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />
      {error && (
        <div className="absolute left-4 bottom-4 z-30 max-w-sm rounded-lg bg-red-900/80 px-3 py-2 text-xs text-red-100 ring-1 ring-red-400/40">
          Error cargando capas: {error}
        </div>
      )}
    </>
  );
}
