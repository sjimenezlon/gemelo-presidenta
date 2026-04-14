import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gemelo Digital — Quebrada La Presidenta",
  description:
    "Gemelo digital GeoAI de la Quebrada La Presidenta (El Poblado, Medellín) — simulación de inundación, SIATA en tiempo real y análisis de riesgo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
