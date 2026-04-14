"use client";
import { twinStore, useTwin, type OverlayId } from "./store";
import { estimateAffected } from "@/lib/flood";
import SiataPanel from "./SiataPanel";
import { BASEMAPS, type BasemapId } from "./mapStyle";

const OVERLAYS: { id: OverlayId; label: string; hint: string }[] = [
  { id: "hot", label: "OSM Humanitario", hint: "Contexto urbano denso (edificios, calles)" },
  { id: "nasa_precip", label: "NASA IMERG precipitación", hint: "Lluvia global GPM ~10km" },
  { id: "esri_hillshade", label: "Hillshade Esri", hint: "Sombreado global de alta resolución" },
];

const scenarios = [
  { id: "actual", label: "Actual", level: 0.4, desc: "Caudal base, época seca" },
  { id: "tr25", label: "TR 25", level: 1.6, desc: "Lluvia intensa, retorno 25 años" },
  { id: "tr100", label: "TR 100", level: 2.8, desc: "Evento extremo, retorno 100 años" },
  { id: "cc2050", label: "CC 2050", level: 3.6, desc: "Escenario cambio climático RCP8.5" },
] as const;

export default function ControlPanel() {
  const twin = useTwin();
  const stats = estimateAffected(twin.floodLevel);

  return (
    <aside className="pointer-events-auto absolute right-4 top-24 z-20 w-80 space-y-3 text-sm">
      <section className="rounded-2xl bg-ink/85 p-4 backdrop-blur-md ring-1 ring-white/10">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-cyan-300">
          Simulación hidráulica
        </h2>
        <p className="mb-3 text-[11px] text-slate-400">
          Nivel del agua sobre el cauce (modelo planar 1D)
        </p>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-2xl font-semibold text-cyan-200">
            {twin.floodLevel.toFixed(1)} m
          </span>
          <span className="text-[11px] text-slate-400">0 – 5 m</span>
        </div>
        <input
          type="range"
          min={0}
          max={5}
          step={0.1}
          value={twin.floodLevel}
          onChange={(e) => twinStore.set({ floodLevel: +e.target.value })}
          className="w-full accent-cyan-400"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => twinStore.set({ scenario: s.id, floodLevel: s.level })}
              className={`rounded-lg px-2 py-1.5 text-xs ring-1 transition ${
                twin.scenario === s.id
                  ? "bg-cyan-500/20 text-cyan-200 ring-cyan-400/60"
                  : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"
              }`}
              title={s.desc}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-ink/85 p-4 backdrop-blur-md ring-1 ring-white/10">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">
          Análisis de riesgo
        </h2>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Área (km²)" value={stats.areaKm2.toFixed(3)} />
          <Stat label="Población" value={stats.population.toLocaleString("es-CO")} />
          <Stat label="Edificios" value={stats.buildings.toLocaleString("es-CO")} />
        </dl>
        <p className="mt-2 text-[10px] leading-snug text-slate-500">
          Estimación basada en densidad poblacional El Poblado (~8.500 hab/km²).
          Para precisión usar catastro Medellín y DEM LiDAR AMVA.
        </p>
      </section>

      <section className="rounded-2xl bg-ink/85 p-4 backdrop-blur-md ring-1 ring-white/10">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">
          Basemap
        </h2>
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
            <button
              key={id}
              onClick={() => twinStore.set({ basemap: id })}
              className={`rounded-lg px-2 py-1.5 text-[11px] ring-1 transition ${
                twin.basemap === id
                  ? "bg-cyan-500/20 text-cyan-200 ring-cyan-400/60"
                  : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"
              }`}
            >
              {BASEMAPS[id].label}
            </button>
          ))}
        </div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">
          Overlays temáticos
        </h2>
        {OVERLAYS.map((o) => (
          <Toggle
            key={o.id}
            label={o.label}
            value={twin.overlays[o.id]}
            onChange={(v) =>
              twinStore.set({ overlays: { ...twin.overlays, [o.id]: v } })
            }
          />
        ))}
        <h2 className="mb-2 mt-3 text-xs font-semibold uppercase tracking-widest text-cyan-300">
          Capas vectoriales
        </h2>
        <Toggle label="Cuenca hidrográfica" value={twin.showCuenca} onChange={(v) => twinStore.set({ showCuenca: v })} />
        <Toggle label="Estaciones SIATA" value={twin.showSiata} onChange={(v) => twinStore.set({ showSiata: v })} />
        <Toggle label="Edificaciones" value={twin.showBuildings} onChange={(v) => twinStore.set({ showBuildings: v })} />
      </section>

      <SiataPanel />
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-2 ring-1 ring-white/10">
      <div className="text-sm font-semibold text-cyan-200">{value}</div>
      <div className="text-[10px] uppercase text-slate-400">{label}</div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mb-1 flex cursor-pointer items-center justify-between">
      <span className="text-slate-300">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`h-5 w-9 rounded-full transition ${value ? "bg-cyan-500" : "bg-slate-700"}`}
      >
        <span className={`block h-4 w-4 translate-y-[2px] rounded-full bg-white transition ${value ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
      </button>
    </label>
  );
}
