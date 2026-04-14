import dynamic from "next/dynamic";
import ControlPanel from "@/components/ControlPanel";

const DigitalTwinMap = dynamic(() => import("@/components/DigitalTwinMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-cyan-300">
      Cargando gemelo digital…
    </div>
  ),
});

export default function Page() {
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <DigitalTwinMap />
      <ControlPanel />
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex justify-between p-4">
        <div className="pointer-events-auto rounded-xl bg-ink/80 px-4 py-2 backdrop-blur-md ring-1 ring-white/10">
          <div className="text-xs uppercase tracking-widest text-cyan-300/80">
            Gemelo Digital GeoAI
          </div>
          <h1 className="text-lg font-semibold">
            Quebrada La Presidenta · El Poblado, Medellín
          </h1>
        </div>
      </header>
    </main>
  );
}
