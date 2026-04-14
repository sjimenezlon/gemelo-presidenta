"use client";
import { useEffect, useState } from "react";
import { useTwin } from "./store";
import { IDF, type ScenarioKey } from "@/lib/flood";

type CriticalItem = {
  name: string;
  kind: string;
  hand: number;
  lon: number;
  lat: number;
};

export default function DecisionPanel({
  critical,
  onFly,
}: {
  critical: CriticalItem[];
  onFly: (lon: number, lat: number) => void;
}) {
  const twin = useTwin();
  const [tab, setTab] = useState<"expuestos" | "escenarios" | "acciones">("expuestos");

  const exposed = critical
    .filter((c) => c.hand <= twin.floodLevel)
    .sort((a, b) => a.hand - b.hand);

  return (
    <aside className="pointer-events-auto absolute left-4 top-20 z-20 w-80 rounded-2xl bg-ink/85 backdrop-blur-md ring-1 ring-white/10">
      <div className="flex border-b border-white/10 text-[11px] font-medium">
        {(["expuestos", "escenarios", "acciones"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 px-3 py-2 uppercase tracking-wider transition ${
              tab === k ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:bg-white/5"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="max-h-[50vh] overflow-y-auto p-3 text-[11px]">
        {tab === "expuestos" && (
          <div>
            <div className="mb-2 text-slate-400">
              {exposed.length} equipamientos críticos con HAND ≤ {twin.floodLevel.toFixed(1)} m.
              Clic para hacer zoom.
            </div>
            {exposed.length === 0 && (
              <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-300 ring-1 ring-emerald-400/30">
                ✓ Ningún equipamiento crítico expuesto al nivel actual.
              </div>
            )}
            <ul className="space-y-1">
              {exposed.slice(0, 40).map((c, i) => (
                <li key={i}>
                  <button
                    onClick={() => onFly(c.lon, c.lat)}
                    className="flex w-full items-start justify-between gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-left ring-1 ring-white/10 hover:bg-red-500/10 hover:ring-red-400/40"
                  >
                    <div className="flex-1 truncate">
                      <div className="truncate text-slate-200">
                        {c.name || <em className="text-slate-500">sin nombre</em>}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-500">
                        {c.kind}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold text-red-400">
                        {c.hand.toFixed(1)}m
                      </div>
                      <div className="text-[9px] text-slate-500">HAND</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {tab === "escenarios" && <ScenarioMatrix meta={twin.meta} />}
        {tab === "acciones" && <Actions />}
      </div>
    </aside>
  );
}

function ScenarioMatrix({ meta }: { meta: any }) {
  if (!meta?.affected_by_level) return <div className="text-slate-500">Cargando…</div>;
  const keys: ScenarioKey[] = ["tr2", "tr5", "tr10", "tr25", "tr50", "tr100", "cc2050"];
  return (
    <div>
      <div className="mb-2 text-slate-400">
        Impacto comparado por periodo de retorno (matriz precomputada).
      </div>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-white/10 text-slate-400">
            <th className="py-1 text-left font-normal">Escenario</th>
            <th className="py-1 text-right font-normal">H (m)</th>
            <th className="py-1 text-right font-normal">Edif.</th>
            <th className="py-1 text-right font-normal">Críticos</th>
            <th className="py-1 text-right font-normal">Pérdida (MM COP)</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const s = IDF[k];
            const lk = nearestKey(s.H, meta.affected_by_level);
            const ed = meta.affected_by_level[lk] || 0;
            const cr = meta.critical_by_level?.[lk] || 0;
            const loss = meta.loss_by_level_cop?.[lk] || 0;
            return (
              <tr key={k} className="border-b border-white/5">
                <td className="py-1.5 font-semibold text-cyan-200">{s.label}</td>
                <td className="py-1.5 text-right font-mono text-slate-300">{s.H.toFixed(1)}</td>
                <td className="py-1.5 text-right font-mono text-red-300">{ed}</td>
                <td className="py-1.5 text-right font-mono text-amber-300">{cr}</td>
                <td className="py-1.5 text-right font-mono text-orange-300">
                  {(loss / 1e9).toFixed(0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[9px] text-slate-500">
        Pérdida estimada con curva HAZUS (15%d + 8%d²) × precio referencial El Poblado 6.5M COP/m².
      </p>
    </div>
  );
}

function nearestKey(target: number, dict: Record<string, number>): string {
  const keys = Object.keys(dict).map(Number).sort((a, b) => a - b);
  let best = keys[0];
  let bd = Math.abs(target - best);
  for (const k of keys) {
    const d = Math.abs(target - k);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best.toFixed(1);
}

function Actions() {
  const twin = useTwin();
  const level = twin.floodLevel;
  const items =
    level < 1
      ? [
          {
            t: "Mantenimiento preventivo",
            d: "Limpieza trimestral de rejillas y cámaras del tramo cubierto. Inspección de estructuras de captación en Parque La Presidenta.",
          },
          {
            t: "Monitoreo SIATA",
            d: "Verificar calibración de la estación de nivel 201. Conservar umbrales de alerta actuales (≥ 40 cm).",
          },
          {
            t: "Campañas vecinales",
            d: "Sensibilización en edificios con HAND ≤ 0.5 m. Puntos de encuentro definidos en POT.",
          },
        ]
      : level < 2
      ? [
          {
            t: "Alerta temprana amarilla",
            d: "Activar protocolo DAGRD. Notificación a administraciones de los ~551 edificios expuestos a H=1 m.",
          },
          {
            t: "Restricción vehicular",
            d: "Cierre preventivo de puentes con HAND ≤ 1 m. Desvíos por vía paralela.",
          },
          {
            t: "Refuerzo drenaje",
            d: "Despeje emergente de obstrucciones en el tramo crítico entre Lleras y el Parque. Personal EPM en sitio.",
          },
          {
            t: "Evacuación preventiva",
            d: "Niveles bajos (piso 0-1) de edificios con HAND ≤ 0.8 m. Hospitales y clínicas en lista roja a priorizar.",
          },
        ]
      : level < 3
      ? [
          {
            t: "Alerta naranja — DAGRD",
            d: "Activación de comité municipal de emergencia. Movilización de equipos de rescate acuático.",
          },
          {
            t: "Evacuación obligatoria",
            d: "Primer piso en todo el corredor expuesto (TR 25–50). Traslado de pacientes ambulatorios de clínicas expuestas.",
          },
          {
            t: "Cierre total de puentes",
            d: "Los 42–48 puentes con HAND ≤ 2 m quedan cerrados. Rutas alternas hacia Avenida El Poblado.",
          },
          {
            t: "Albergues temporales",
            d: "Habilitación en colegios sobre cota 1600 m.s.n.m. (fuera de llanura de inundación).",
          },
        ]
      : [
          {
            t: "Alerta roja — evento extremo",
            d: "TR ≥ 100 o escenario CC2050. Coordinación AMVA + Alcaldía + SIATA. Evacuación total en franja ≤ 400 m del cauce.",
          },
          {
            t: "Corte de servicios",
            d: "Energía en edificios con HAND ≤ 3 m para evitar electrocución. Cierre de válvulas de gas.",
          },
          {
            t: "Rescate y logística",
            d: "Despliegue de brigadas DAGRD + Bomberos + Defensa Civil. Helicóptero en disponibilidad.",
          },
          {
            t: "Activación emergencia sanitaria",
            d: "Pérdida proyectada > 2 billones COP. Solicitud de recursos nacionales UNGRD.",
          },
        ];
  return (
    <div className="space-y-2">
      <div className="text-slate-400">
        Acciones sugeridas para el escenario actual (H = {level.toFixed(1)} m).
      </div>
      {items.map((it, i) => (
        <div key={i} className="rounded-lg bg-white/5 p-2 ring-1 ring-white/10">
          <div className="mb-1 font-semibold text-cyan-200">{it.t}</div>
          <div className="leading-snug text-slate-300">{it.d}</div>
        </div>
      ))}
      <p className="mt-2 text-[9px] leading-snug text-slate-500">
        Acciones referenciales basadas en protocolos DAGRD Medellín y Ley 1523/2012 de gestión
        del riesgo. Adaptar al Plan Municipal de Gestión del Riesgo vigente.
      </p>
    </div>
  );
}
