"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildStyle, INITIAL_VIEW } from "./mapStyle";
import { useTwin, twinStore } from "./store";
import { floodFromHand } from "@/lib/flood";
import type { FeatureCollection } from "geojson";

export default function DigitalTwinMap({
  mapRef: externalRef,
}: {
  mapRef?: React.MutableRefObject<MlMap | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const handGridRef = useRef<FeatureCollection | null>(null);
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
    if (externalRef) externalRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    let markersDone = false;
    let installing = false;

    const installLayers = async () => {
      if (installing || map.getSource("rio")) return;
      installing = true;
      try {
        const [presidenta, rio, buildings, handGrid, meta, critical, bridges, kontur, boundary] =
          await Promise.all([
            fetch("/data/presidenta.geojson").then((r) => r.json()),
            fetch("/data/rio_medellin.geojson").then((r) => r.json()),
            fetch("/data/buildings.geojson").then((r) => r.json()),
            fetch("/data/hand_grid.geojson").then((r) => r.json()),
            fetch("/data/meta.json").then((r) => r.json()),
            fetch("/data/critical.geojson").then((r) => r.json()),
            fetch("/data/bridges.geojson").then((r) => r.json()),
            fetch("/data/kontur_pop.geojson").then((r) => r.json()),
            fetch("/data/medellin_boundary.geojson").then((r) => r.json()).catch(() => null),
          ]);
        handGridRef.current = handGrid;
        twinStore.set({ buildingsTotal: buildings.features.length, meta });

        map.addSource("rio", { type: "geojson", data: rio });
        map.addLayer({
          id: "rio-glow",
          type: "line",
          source: "rio",
          paint: { "line-color": "#0369a1", "line-width": 10, "line-blur": 8, "line-opacity": 0.5 },
        });
        map.addLayer({
          id: "rio-line",
          type: "line",
          source: "rio",
          paint: { "line-color": "#38bdf8", "line-width": 3 },
        });

        map.addSource("presidenta", { type: "geojson", data: presidenta });
        map.addLayer({
          id: "presidenta-glow",
          type: "line",
          source: "presidenta",
          paint: { "line-color": "#22d3ee", "line-width": 7, "line-blur": 5, "line-opacity": 0.7 },
        });
        map.addLayer({
          id: "presidenta-line",
          type: "line",
          source: "presidenta",
          paint: {
            "line-color": "#a5f3fc",
            "line-width": ["case", ["==", ["get", "cubierta"], true], 2, 3.5],
          },
        });

        // Edificaciones 3D reales con color por HAND
        map.addSource("buildings", { type: "geojson", data: buildings });
        map.addLayer({
          id: "buildings-3d",
          type: "fill-extrusion",
          source: "buildings",
          paint: {
            "fill-extrusion-color": [
              "case",
              ["!", ["has", "hand"]],
              "#475569",
              ["<=", ["get", "hand"], twin.floodLevel],
              "#ef4444",
              ["<=", ["get", "hand"], twin.floodLevel + 1],
              "#f59e0b",
              "#64748b",
            ],
            "fill-extrusion-height": [
              "case",
              ["has", "est_levels"],
              ["*", ["to-number", ["get", "est_levels"]], 3.2],
              9,
            ],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.85,
          },
        });

        // Flood extent precomputado por HAND
        const flood = floodFromHand(handGrid, twin.floodLevel);
        map.addSource("flood", { type: "geojson", data: flood as any });
        map.addLayer(
          {
            id: "flood-fill",
            type: "fill",
            source: "flood",
            paint: { "fill-color": "#38bdf8", "fill-opacity": 0.45 },
          },
          "presidenta-glow",
        );
        map.addLayer(
          {
            id: "flood-outline",
            type: "line",
            source: "flood",
            paint: { "line-color": "#bae6fd", "line-width": 1.2 },
          },
          "presidenta-glow",
        );

        // Puentes / túneles
        map.addSource("bridges", { type: "geojson", data: bridges });
        map.addLayer({
          id: "bridges-line",
          type: "line",
          source: "bridges",
          paint: {
            "line-color": [
              "case",
              ["<=", ["get", "hand"], twin.floodLevel],
              "#ef4444",
              "#fb923c",
            ],
            "line-width": 3,
          },
        });

        // Infraestructura crítica (puntos)
        map.addSource("critical", { type: "geojson", data: critical });
        map.addLayer({
          id: "critical-pt",
          type: "circle",
          source: "critical",
          paint: {
            "circle-radius": 6,
            "circle-color": [
              "case",
              ["<=", ["get", "hand"], twin.floodLevel],
              "#ef4444",
              "#fbbf24",
            ],
            "circle-stroke-color": "#0b1120",
            "circle-stroke-width": 2,
          },
        });
        map.on("click", "critical-pt", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p: any = f.properties || {};
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(
              `<strong>${p.kind}</strong> ${p.name ? "· " + p.name : ""}<br/>
               HAND: <b>${p.hand} m</b> sobre cauce<br/>
               ${p.hand <= twin.floodLevel ? "⚠️ EXPUESTO" : "✅ Sobre el nivel actual"}`,
            )
            .addTo(map);
        });

        // Popup edificios
        map.on("click", "buildings-3d", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p: any = f.properties || {};
          const val = p.value_cop ? `${Math.round(p.value_cop / 1e6).toLocaleString("es-CO")} M COP` : "—";
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(
              `<strong>Edificación OSM #${p.id}</strong><br/>
               Elevación: ${p.elev ?? "?"} m · HAND <b>${p.hand ?? "?"} m</b><br/>
               Área: ${p.area_m2 ?? "?"} m² · Pisos: ${p.est_levels ?? "?"}${p.levels ? " (OSM)" : " (est.)"}<br/>
               GFA: ${p.gfa_m2 ?? "?"} m² · Valor: ${val}`,
            )
            .addTo(map);
        });
        map.on("mouseenter", "buildings-3d", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "buildings-3d", () => (map.getCanvas().style.cursor = ""));

        if (!markersDone) {
          markersDone = true;
          // Buscar el extremo oriental (aguas arriba — mayor elevación) y occidental
          // (aguas abajo — último punto trazado en OSM antes del canal cubierto)
          const all: number[][] = [];
          presidenta.features.forEach((f: any) =>
            f.geometry.coordinates.forEach((c: number[]) => all.push(c)),
          );
          let east = all[0], west = all[0];
          for (const c of all) {
            if (c[0] > east[0]) east = c;
            if (c[0] < west[0]) west = c;
          }
          const mk = (lng: number, lat: number, color: string, label: string, sub: string) => {
            const el = document.createElement("div");
            el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #0b1120;box-shadow:0 0 12px ${color};`;
            new maplibregl.Marker({ element: el })
              .setLngLat([lng, lat])
              .setPopup(
                new maplibregl.Popup({ offset: 12 }).setHTML(
                  `<strong>${label}</strong><br/><small>${sub}</small>`,
                ),
              )
              .addTo(map);
          };
          if (east)
            mk(east[0], east[1], "#10b981", "Nacimiento · Las Palmas", "Tramo aguas arriba (OSM)");
          if (west)
            mk(west[0], west[1], "#f59e0b", "Límite OSM aguas abajo", "El canal cubierto continúa ~1 km hasta el Río Medellín");
        }
      } catch (err: any) {
        console.error("installLayers error", err);
        setError(String(err?.message || err));
      } finally {
        installing = false;
      }
    };

    map.on("error", (e: any) => console.error("maplibre error", e?.error || e));
    map.on("load", installLayers);
    map.on("style.load", installLayers);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Reactividad: flood level
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !handGridRef.current) return;
    const src = map.getSource("flood") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(floodFromHand(handGridRef.current, twin.floodLevel) as any);
    if (map.getLayer("buildings-3d")) {
      map.setPaintProperty("buildings-3d", "fill-extrusion-color", [
        "case",
        ["!", ["has", "hand"]],
        "#475569",
        ["<=", ["get", "hand"], twin.floodLevel],
        "#ef4444",
        ["<=", ["get", "hand"], twin.floodLevel + 1],
        "#f59e0b",
        "#64748b",
      ]);
      map.setLayoutProperty("buildings-3d", "visibility", twin.showBuildings ? "visible" : "none");
    }
    if (map.getLayer("critical-pt")) {
      map.setPaintProperty("critical-pt", "circle-color", [
        "case",
        ["<=", ["get", "hand"], twin.floodLevel],
        "#ef4444",
        "#fbbf24",
      ]);
    }
    if (map.getLayer("bridges-line")) {
      map.setPaintProperty("bridges-line", "line-color", [
        "case",
        ["<=", ["get", "hand"], twin.floodLevel],
        "#ef4444",
        "#fb923c",
      ]);
    }
    if (map.getLayer("kontur-pt")) {
      map.setPaintProperty("kontur-pt", "circle-color", [
        "case",
        ["<=", ["get", "hand"], twin.floodLevel],
        "#ef4444",
        "#a855f7",
      ]);
      map.setLayoutProperty(
        "kontur-pt",
        "visibility",
        twin.showKontur ? "visible" : "none",
      );
    }
  }, [twin.floodLevel, twin.showBuildings, twin.showKontur]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const setVis = (id: string, v: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v ? "visible" : "none");
    };
    setVis("overlay-hot", twin.overlays.hot);
    setVis("overlay-nasa-precip", twin.overlays.nasa_precip);
    setVis("overlay-esri-hillshade", twin.overlays.esri_hillshade);
    setVis("overlay-worldcover", twin.overlays.worldcover);
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
