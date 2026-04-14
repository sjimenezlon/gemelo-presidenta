"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ControlPanel from "./ControlPanel";
import Legend from "./Legend";
import KpiBar from "./KpiBar";
import DecisionPanel from "./DecisionPanel";
import { useTwin } from "./store";
import { countAffectedBuildings, countAffectedPoints } from "@/lib/flood";
import type { Map as MlMap } from "maplibre-gl";

const DigitalTwinMap = dynamic(() => import("./DigitalTwinMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-cyan-300">
      Cargando gemelo digital…
    </div>
  ),
});

export default function AppShell() {
  const twin = useTwin();
  const mapRef = useRef<MlMap | null>(null);
  const [data, setData] = useState<any>(null);
  const [stats, setStats] = useState({ buildings: 0, critical: 0, bridges: 0, loss: 0 });

  useEffect(() => {
    Promise.all([
      fetch("/data/buildings.geojson").then((r) => r.json()),
      fetch("/data/critical.geojson").then((r) => r.json()),
      fetch("/data/bridges.geojson").then((r) => r.json()),
    ]).then(([b, c, br]) => setData({ b, c, br }));
  }, []);

  useEffect(() => {
    if (!data) return;
    let loss = 0;
    let bCount = 0;
    for (const f of data.b.features) {
      const p: any = f.properties || {};
      if (p.hand == null) continue;
      if (p.dist_cauce_m != null && p.dist_cauce_m > 400) continue;
      if (p.hand <= twin.floodLevel) {
        bCount++;
        const depth = twin.floodLevel - p.hand;
        const ratio = Math.min(0.95, Math.max(0, 0.15 * depth + 0.08 * depth * depth));
        loss += (p.value_cop || 0) * ratio;
      }
    }
    setStats({
      buildings: bCount,
      critical: countAffectedPoints(data.c, twin.floodLevel, 300),
      bridges: countAffectedPoints(data.br, twin.floodLevel, 300),
      loss,
    });
  }, [twin.floodLevel, data]);

  const criticalList =
    data?.c?.features?.map((f: any) => ({
      name: f.properties?.name || "",
      kind: f.properties?.kind || "",
      hand: f.properties?.hand ?? 999,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    })) || [];

  const flyTo = (lon: number, lat: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [lon, lat], zoom: 17, pitch: 65, duration: 1500 });
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <DigitalTwinMap mapRef={mapRef} />
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 p-4">
        <div className="pointer-events-auto inline-block rounded-xl bg-ink/80 px-4 py-2 backdrop-blur-md ring-1 ring-white/10">
          <div className="text-xs uppercase tracking-widest text-cyan-300/80">
            Gemelo Digital GeoAI
          </div>
          <h1 className="text-lg font-semibold">
            Quebrada La Presidenta · El Poblado, Medellín
          </h1>
        </div>
      </header>
      <KpiBar {...stats} />
      <DecisionPanel critical={criticalList} onFly={flyTo} />
      <ControlPanel stats={stats} />
      <Legend />
    </main>
  );
}
