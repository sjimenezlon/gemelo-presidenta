"use client";
export default function Legend() {
  const rows: { color: string; label: string; shape?: "sq" | "circle" | "line" }[] = [
    { color: "#ef4444", label: "HAND ≤ nivel (expuesto)" },
    { color: "#f59e0b", label: "Zona de riesgo marginal (+1 m)" },
    { color: "#64748b", label: "Edificación segura" },
    { color: "#a5f3fc", label: "Quebrada La Presidenta", shape: "line" },
    { color: "#38bdf8", label: "Río Medellín", shape: "line" },
    { color: "#60a5fa", label: "Mancha de inundación (HAND)", shape: "sq" },
    { color: "#fbbf24", label: "Equipamiento crítico", shape: "circle" },
    { color: "#fb923c", label: "Puentes / túneles", shape: "line" },
    { color: "#a855f7", label: "Hex. población Kontur", shape: "circle" },
  ];
  return (
    <div className="pointer-events-auto absolute left-4 bottom-16 z-20 w-60 rounded-xl bg-ink/85 p-3 text-[11px] backdrop-blur-md ring-1 ring-white/10">
      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">
        Leyenda
      </div>
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="inline-block"
              style={{
                width: r.shape === "line" ? 18 : 12,
                height: r.shape === "line" ? 3 : 12,
                borderRadius: r.shape === "circle" ? 9999 : 3,
                background: r.color,
                boxShadow: `0 0 8px ${r.color}`,
              }}
            />
            <span className="text-slate-300">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
