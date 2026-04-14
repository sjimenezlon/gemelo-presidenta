import dynamic from "next/dynamic";

const ReportView = dynamic(() => import("@/components/ReportView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-white text-slate-600">
      Generando reporte ejecutivo…
    </div>
  ),
});

export const metadata = {
  title: "Reporte ejecutivo · Gemelo Digital Quebrada La Presidenta",
};

export default function ReporteePage() {
  return <ReportView />;
}
