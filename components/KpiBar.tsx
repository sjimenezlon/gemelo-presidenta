"use client";
import { useTwin } from "./store";
import { IDF } from "@/lib/flood";

export default function KpiBar({
  buildings,
  critical,
  bridges,
  loss,
}: {
  buildings: number;
  critical: number;
  bridges: number;
  loss: number;
}) {
  const twin = useTwin();
  const scenarioKey = Object.keys(IDF).find(
    (k) => Math.abs((IDF as any)[k].H - twin.floodLevel) < 0.05,
  );
  const scenarioLabel = scenarioKey ? (IDF as any)[scenarioKey].label : `H=${twin.floodLevel.toFixed(1)}m`;
  const fmt = (n: number) => n.toLocaleString("es-CO");
  const fmtCop = (n: number) =>
    n >= 1e12
      ? `${(n / 1e12).toFixed(2)} B`
      : n >= 1e9
      ? `${(n / 1e9).toFixed(1)} MM`
      : n >= 1e6
      ? `${(n / 1e6).toFixed(0)} M`
      : fmt(n);

  return (
    <div className="pointer-events-auto absolute left-1/2 top-20 z-20 flex -translate-x-1/2 gap-2 rounded-2xl bg-ink/85 px-3 py-2 backdrop-blur-md ring-1 ring-white/10">
      <Kpi label="Escenario" value={scenarioLabel} accent="cyan" />
      <Sep />
      <Kpi label="Edificios expuestos" value={fmt(buildings)} accent="red" />
      <Sep />
      <Kpi label="Equip. críticos" value={fmt(critical)} accent="amber" />
      <Sep />
      <Kpi label="Puentes" value={fmt(bridges)} accent="orange" />
      <Sep />
      <Kpi label="Pérdida COP" value={fmtCop(loss)} accent="red" />
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent: string }) {
  const color =
    accent === "red"
      ? "text-red-400"
      : accent === "amber"
      ? "text-amber-300"
      : accent === "orange"
      ? "text-orange-300"
      : "text-cyan-200";
  return (
    <div className="min-w-[88px] px-2 text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}
function Sep() {
  return <div className="w-px bg-white/10" />;
}
