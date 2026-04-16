"use client";
import { useEffect, useState } from "react";

type Station = {
  id: string;
  name: string;
  rainMmh: number;
  levelCm: number;
  status: "ok" | "alerta" | "critico";
};

// Simulación local. Para datos reales, enchufar a la API pública de SIATA:
//   https://siata.gov.co/siata_nuevo/index.php/niveles-monitoreados
// o al portal de datos abiertos. Debe proxearse desde /api/siata para CORS.
type CauceId = "presidenta" | "volcana" | null;
const MOCK: (Station & { cauce: CauceId })[] = [
  { id: "201", name: "La Presidenta — Lleras", rainMmh: 2.1, levelCm: 34, status: "ok", cauce: "presidenta" },
  { id: "198", name: "La Presidenta — Parque", rainMmh: 1.8, levelCm: 29, status: "ok", cauce: "presidenta" },
  { id: "V01", name: "Volcana — Los Balsos alto", rainMmh: 2.3, levelCm: 22, status: "ok", cauce: "volcana" },
  { id: "V02", name: "Volcana — Campus EAFIT", rainMmh: 1.9, levelCm: 31, status: "ok", cauce: "volcana" },
  { id: "PN2", name: "Nutibara (pluv.)", rainMmh: 3.4, levelCm: 0, status: "ok", cauce: null },
];

export default function SiataPanel() {
  const [stations, setStations] = useState<(Station & { cauce: CauceId })[]>(MOCK);
  const [updated, setUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const tick = () => {
      setStations((prev) =>
        prev.map((s) => {
          const rain = Math.max(0, s.rainMmh + (Math.random() - 0.45) * 1.5);
          const level = Math.max(5, s.levelCm + (Math.random() - 0.5) * 4);
          const status: Station["status"] = level > 60 ? "critico" : level > 40 ? "alerta" : "ok";
          return { ...s, rainMmh: +rain.toFixed(1), levelCm: Math.round(level), status };
        }),
      );
      setUpdated(new Date());
    };
    const i = setInterval(tick, 4000);
    return () => clearInterval(i);
  }, []);

  return (
    <section className="rounded-2xl bg-ink/85 p-4 backdrop-blur-md ring-1 ring-white/10">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-cyan-300">
          SIATA · Tiempo real
        </h2>
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          LIVE
        </span>
      </div>
      <ul className="space-y-1.5">
        {stations.map((s) => (
          <li key={s.id} className="flex items-center justify-between text-xs">
            <span className="truncate text-slate-300">{s.name}</span>
            <span className="flex gap-2 font-mono">
              <span className="text-slate-400">{s.rainMmh} mm/h</span>
              <span
                className={
                  s.status === "critico"
                    ? "text-red-400"
                    : s.status === "alerta"
                    ? "text-amber-400"
                    : "text-cyan-300"
                }
              >
                {s.levelCm} cm
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-slate-500">
        Datos simulados. Conectar a api.siata.gov.co vía /api/siata proxy.
        Actualizado {updated.toLocaleTimeString("es-CO")}
      </p>
    </section>
  );
}
