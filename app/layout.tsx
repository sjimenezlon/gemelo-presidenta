import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gemelo Digital — Quebradas La Presidenta + Volcana-Los Balsos",
  description:
    "Gemelo digital GeoAI de las Quebradas La Presidenta y Volcana-Los Balsos (El Poblado / Campus EAFIT, Medellín) — modelo HAND multi-cauce, simulación de inundación y análisis de riesgo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
