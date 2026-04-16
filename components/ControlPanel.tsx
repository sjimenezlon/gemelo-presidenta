"use client";
import { twinStore, useTwin, type OverlayId, type CauceFilter } from "./store";
import { IDF, idfForCauce, type ScenarioKey } from "@/lib/flood";
import { BASEMAPS, type BasemapId } from "./mapStyle";

const OVERLAYS: { id: OverlayId; label: string }[] = [
  { id: "hot", label: "OSM Humanitario" },
  { id: "nasa_precip", label: "NASA IMERG precipitación" },
  { id: "esri_hillshade", label: "Hillshade Esri" },
  { id: "worldcover", label: "ESA WorldCover 2021 (10m)" },
];

const CAUCE_OPTS: { id: CauceFilter; label: string; color: string }[] = [
  { id: "presidenta", label: "La Presidenta", color: "text-cyan-200 ring-cyan-400/60 bg-cyan-500/20" },
  { id: "volcana", label: "Volcana-Los Balsos", color: "text-amber-200 ring-amber-400/60 bg-amber-500/20" },
  { id: "both", label: "Ambas", color: "text-slate-100 ring-white/40 bg-white/10" },
];

export default function ControlPanel({
  stats,
}: {
  stats: { buildings: number; critical: number; bridges: number; loss: number; population: number };
}) {
  const twin = useTwin();

  const scenarioList: ScenarioKey[] = ["tr2", "tr5", "tr10", "tr25", "tr50", "tr100", "cc2050"];
  const activeCauce = twin.cauceFilter === "volcana" ? "volcana" : "presidenta";
  const idf = idfForCauce(activeCauce);
  const active = scenarioList.find((k) => Math.abs(idf[k].H - twin.floodLevel) < 0.05);

  return (
    <aside className="pointer-events-auto absolute right-4 top-20 z-20 max-h-[calc(100vh-6rem)] w-[22rem] space-y-3 overflow-y-auto pr-1 text-sm">
      <section className="rounded-2xl bg-ink/85 p-4 backdrop-blur-md ring-1 ring-white/10">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">
          Quebrada activa
        </h2>
        <div className="grid grid-cols-3 gap-1">
          {CAUCE_OPTS.map((o) => (
            <button
              key={o.id}
              onClick={() => twinStore.set({ cauceFilter: o.id })}
              className={`rounded-lg px-1 py-1.5 text-[10px] font-medium ring-1 transition ${
                twin.cauceFilter === o.id
                  ? o.color
                  : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-snug text-slate-500">
          El slider de nivel y la mancha de inundación aplican a ambos cauces
          (evento de lluvia regional). El filtro solo afecta KPIs y resaltado.
        </p>
      </section>

      <section className="rounded-2xl bg-ink/85 p-4 backdrop-blur-md ring-1 ring-white/10">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-cyan-300">
          Modelo HAND · Inundación fluvial
        </h2>
        <p className="mb-3 text-[11px] text-slate-400">
          Height Above Nearest Drainage sobre DEM Mapzen Terrarium (~10 m). Una
          celda se inunda si HAND ≤ nivel.
        </p>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-3xl font-semibold text-cyan-200">
            {twin.floodLevel.toFixed(1)}<span className="text-lg"> m</span>
          </span>
          <span className="text-[11px] text-slate-400">Nivel sobre cauce</span>
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
        <div className="mt-3 grid grid-cols-4 gap-1">
          {scenarioList.map((k) => {
            const s = idf[k];
            return (
              <button
                key={k}
                onClick={() => twinStore.set({ scenario: k, floodLevel: s.H })}
                className={`rounded-lg px-1.5 py-1.5 text-[10px] font-medium ring-1 transition ${
                  active === k
                    ? "bg-cyan-500/20 text-cyan-200 ring-cyan-400/60"
                    : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"
                }`}
                title={`${s.mmh} mm/h — Q≈${s.Q} m³/s — H≈${s.H} m`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {active && (
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-cyan-500/10 p-2 text-center ring-1 ring-cyan-400/30">
            <Mini label="Lluvia" value={`${idf[active].mmh} mm/h`} />
            <Mini label="Caudal Q" value={`${idf[active].Q} m³/s`} />
            <Mini label="Calado H" value={`${idf[active].H} m`} />
          </div>
        )}
        <p className="mt-2 text-[10px] text-slate-500">
          IDF: {activeCauce === "volcana"
            ? "Volcana-Los Balsos (A≈4.0 km² · L≈5 km · nace 2500→ desemboca 1500 m.s.n.m.)"
            : "La Presidenta (A≈7.2 km² · S=6.5%)"}.
          {twin.cauceFilter === "both" && " Con filtro 'Ambas' se muestra Presidenta por defecto."}
        </p>
      </section>

      <section className="rounded-2xl bg-ink/85 p-4 backdrop-blur-md ring-1 ring-white/10">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">
          Pérdida económica estimada
        </h2>
        <div className="mb-1 text-2xl font-bold text-orange-300">
          {stats.loss >= 1e12
            ? `${(stats.loss / 1e12).toFixed(2)} billones`
            : stats.loss >= 1e9
            ? `${(stats.loss / 1e9).toFixed(0)} mil millones`
            : `${(stats.loss / 1e6).toFixed(0)} millones`}
          <span className="text-sm text-slate-400"> COP</span>
        </div>
        <p className="text-[10px] leading-snug text-slate-500">
          Curva daño-profundidad HAZUS: ratio = min(0.95, 0.15·d + 0.08·d²).
          Valor referencial El Poblado: 6.500.000 COP/m². Incluye {stats.buildings.toLocaleString("es-CO")} edificios
          × área × pisos × daño.
        </p>
      </section>

      {twin.meta?.era5_max_day_mm && (
        <section className="rounded-2xl bg-ink/85 p-4 backdrop-blur-md ring-1 ring-white/10">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            Eventos extremos recientes (ERA5)
          </h2>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between"><span className="text-slate-300">Max diario 2020–2026</span><span className="font-mono text-cyan-200">{twin.meta.era5_max_day_mm} mm</span></div>
            <div className="flex justify-between"><span className="text-slate-300">Max horario 2023–2026</span><span className="font-mono text-cyan-200">{twin.meta.era5_max_hour_mmh} mm/h</span></div>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Fuente: Open-Meteo ERA5 (9 km). Subestima picos convectivos; usar solo
            como referencia temporal de eventos.
          </p>
        </section>
      )}

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
          Overlays
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
          Capas
        </h2>
        <Toggle label="Edificaciones 3D" value={twin.showBuildings} onChange={(v) => twinStore.set({ showBuildings: v })} />
        <Toggle label="Población Kontur (hex H3)" value={twin.showKontur} onChange={(v) => twinStore.set({ showKontur: v })} />
      </section>

      {twin.meta && (
        <section className="rounded-2xl bg-ink/85 p-3 text-[10px] leading-relaxed text-slate-400 ring-1 ring-white/10">
          <div className="mb-1 text-cyan-300/80">Fuentes del modelo</div>
          DEM: {twin.meta.dem_source} · z{twin.meta.dem_zoom} (~{twin.meta.dem_resolution_m_approx} m/px)<br/>
          Cauce: {twin.meta.cauce_points} pts · {twin.meta.cauce_elev_min?.toFixed?.(0)}–{twin.meta.cauce_elev_max?.toFixed?.(0)} m<br/>
          Modelo: {twin.meta.model}<br/>
          Ref: {twin.meta.method_ref}
        </section>
      )}
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
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-cyan-200">{value}</div>
      <div className="text-[9px] uppercase text-slate-400">{label}</div>
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
