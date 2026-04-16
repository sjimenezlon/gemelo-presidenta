"use client";
import { useEffect, useMemo, useState } from "react";
import { IDF, type ScenarioKey } from "@/lib/flood";

type Critical = {
  name: string;
  kind: string;
  hand: number;
  dist: number;
  cauce_id?: string;
  lon: number;
  lat: number;
};

export default function ReportView() {
  const [meta, setMeta] = useState<any>(null);
  const [critical, setCritical] = useState<Critical[]>([]);
  const [ready, setReady] = useState(false);
  const [generatedAt] = useState(() => new Date());

  useEffect(() => {
    Promise.all([
      fetch("/data/meta.json").then((r) => r.json()),
      fetch("/data/critical.geojson").then((r) => r.json()),
    ])
      .then(([m, c]) => {
        setMeta(m);
        setCritical(
          (c.features || []).map((f: any) => ({
            name: f.properties?.name || "",
            kind: f.properties?.kind || "",
            hand: f.properties?.hand ?? 999,
            dist: f.properties?.dist_grid_m ?? 999,
            cauce_id: f.properties?.cauce_id,
            lon: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          })),
        );
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  const exposedAtTR100 = useMemo(
    () =>
      critical
        .filter((c) => c.hand <= IDF.tr100.H && c.dist < 300)
        .sort((a, b) => a.hand - b.hand),
    [critical],
  );

  const scenarioRows: ScenarioKey[] = [
    "tr2",
    "tr5",
    "tr10",
    "tr25",
    "tr50",
    "tr100",
    "cc2050",
  ];

  const fmtCop = (n: number) =>
    n >= 1e12 ? `${(n / 1e12).toFixed(2)} B` : n >= 1e9 ? `${(n / 1e9).toFixed(0)} mil M` : `${(n / 1e6).toFixed(0)} M`;

  const nearestKey = (target: number, dict: Record<string, number>) => {
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
  };

  if (!ready) return null;

  const fecha = generatedAt.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="report-root min-h-screen px-[5%] py-8 md:px-[10%]">
      {/* Print bar */}
      <div className="no-print sticky top-0 z-50 mb-6 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <div>
          <strong>Reporte ejecutivo</strong> · Usa <kbd className="rounded border border-slate-300 bg-white px-1">⌘/Ctrl + P</kbd> para exportar a PDF.
        </div>
        <div className="flex gap-2">
          <a
            href="/"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
          >
            ← Volver al mapa
          </a>
          <button
            onClick={() => window.print()}
            className="rounded-md bg-sky-600 px-3 py-1.5 font-medium text-white hover:bg-sky-700"
          >
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="mb-6 border-b-2 border-sky-700 pb-4">
        <div className="muted text-xs uppercase tracking-widest">
          Gemelo Digital GeoAI · DENSURBAM · Urbam EAFIT
        </div>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          Evaluación de riesgo por inundación
        </h1>
        <h2 className="text-xl font-semibold text-sky-700">
          Quebradas La Presidenta + Volcana-Los Balsos · El Poblado / Campus EAFIT · Medellín
        </h2>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>Reporte generado: <strong className="text-slate-700">{fecha}</strong></span>
          <span>Snapshot del modelo: <strong className="text-slate-700">{meta?.snapshot_date || "2026-04-14"}</strong></span>
        </div>
      </header>

      {/* 1. Resumen ejecutivo */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold accent">
          1. Resumen ejecutivo
        </h2>
        <p className="mb-3 text-sm leading-relaxed text-slate-700">
          Este reporte presenta los resultados de la modelación de riesgo por inundación
          fluvial <strong>multi-cauce</strong> para las quebradas <strong>La Presidenta</strong> y{" "}
          <strong>Volcana-Los Balsos</strong> (El Poblado / Campus EAFIT), construida con
          el método <strong>HAND (Height Above Nearest Drainage)</strong> sobre un modelo
          digital de elevación de ~10 m, cartografía OpenStreetMap 2026-04 y datos de
          población Kontur 2023-11. Cada edificio y celda del área de estudio se asigna
          al drenaje más cercano (propiedad <code>cauce_id</code>) y su HAND se calcula
          relativo a ese cauce. El modelo evalúa siete escenarios de lluvia extrema
          (TR 2 a TR 100 y cambio climático 2050) y cuantifica exposición de edificaciones,
          equipamientos críticos, puentes y población.
        </p>

        <div className="mb-4 grid grid-cols-5 gap-2">
          <Kpi label="Cauces" value="2" sub="Presidenta + Volcana-Los Balsos" />
          <Kpi
            label="Valor expuesto"
            value={`${((meta?.total_value_cop || 0) / 1e12).toFixed(1)} B COP`}
            sub="Total edificado área estudio"
          />
          <Kpi label="Edificios" value={meta?.buildings_total?.toLocaleString("es-CO") ?? "—"} sub="OSM abr-2026" />
          <Kpi
            label="Críticos"
            value={meta?.critical_total ?? "—"}
            sub="Equipamientos OSM"
          />
          <Kpi
            label="Puentes"
            value={meta?.bridges_total ?? "—"}
            sub="OSM bridges"
          />
        </div>

        <div className="rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm">
          <div className="mb-2 font-semibold text-sky-900">Hallazgos principales (totales ambos cauces)</div>
          <ul className="list-inside list-disc space-y-1 text-slate-700">
            <li>
              Bajo un escenario <strong>TR 100 (lluvia 130 mm/h, calado 2.9 m)</strong>,
              se estiman <strong>{meta?.total?.affected_by_level?.["3.0"] || "?"} edificios</strong>{" "}
              y <strong>{meta?.total?.critical_by_level?.["3.0"] || "?"} equipamientos críticos</strong>{" "}
              expuestos entre ambos cauces.
            </li>
            <li>
              Pérdida económica estimada para TR 100:{" "}
              <strong>{fmtCop(meta?.total?.loss_by_level_cop?.["3.0"] || 0)} COP</strong>{" "}
              (incertidumbre ±30%). Curva HAZUS × precio mezclado{" "}
              {(meta?.price_per_m2_cop || 6500000).toLocaleString("es-CO")} COP/m².
            </li>
            <li>
              Bajo cambio climático <strong>CC 2050 (+20% intensidad, H=3.6 m)</strong>, la
              exposición aumenta a <strong>{meta?.total?.affected_by_level?.["3.5"] || "?"} edificios</strong>{" "}
              y pérdida de <strong>{fmtCop(meta?.total?.loss_by_level_cop?.["3.5"] || 0)} COP</strong>.
            </li>
            <li>
              Desglose por cauce a TR 100:{" "}
              <strong>La Presidenta {meta?.cauces?.presidenta?.affected_by_level?.["3.0"] || "—"} edif.</strong>{" "}
              / <strong>Volcana-Los Balsos {meta?.cauces?.volcana?.affected_by_level?.["3.0"] || "—"} edif.</strong>
            </li>
            <li>
              <strong>{exposedAtTR100.length} equipamientos críticos identificados por nombre</strong>{" "}
              se encuentran en zona de inundación TR 100 combinado (ver Sección 3).
            </li>
          </ul>
        </div>
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
          <strong>Verificabilidad.</strong> Todas las cifras se derivan de OSM 2026-04 +
          DEM Terrarium z14 + Kontur 2023 + curvas IDF POMCA AMVA.
          El modelo asume lluvia regional simultánea — cada celda se inunda según su HAND al
          drenaje más cercano.
        </div>
      </section>

      {/* 2. Escenarios — totales */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold accent">
          2. Escenarios por periodo de retorno — impacto combinado
        </h2>
        <p className="mb-2 text-xs text-slate-600">
          Curvas IDF referenciales del POMCA AMVA. Para cada escenario, los valores
          corresponden a la suma de edificios, críticos y pérdida en ambos cauces
          (evento de lluvia regional simultáneo). Parámetros Presidenta: A=7.2 km², S=0.065,
          b=6 m, n=0.035. Parámetros Volcana-Los Balsos: A=5.5 km², S=0.055, b=5 m, n=0.040.
        </p>
        <table>
          <thead>
            <tr>
              <th>Escenario</th>
              <th className="num">Lluvia mm/h</th>
              <th className="num">Calado H (m)</th>
              <th className="num">Edificios</th>
              <th className="num">Críticos</th>
              <th className="num">Pob.</th>
              <th className="num">Pérdida COP</th>
            </tr>
          </thead>
          <tbody>
            {scenarioRows.map((k) => {
              const s = IDF[k];
              const lk = nearestKey(s.H, meta?.total?.affected_by_level || {});
              const ed = meta?.total?.affected_by_level?.[lk] || 0;
              const cr = meta?.total?.critical_by_level?.[lk] || 0;
              const pp = meta?.total?.population_by_level?.[lk] || 0;
              const ls = meta?.total?.loss_by_level_cop?.[lk] || 0;
              return (
                <tr key={k}>
                  <td className="font-semibold text-sky-700">{s.label}</td>
                  <td className="num">{s.mmh}</td>
                  <td className="num">{s.H.toFixed(1)}</td>
                  <td className="num">{ed}</td>
                  <td className="num">{cr}</td>
                  <td className="num">{pp.toLocaleString("es-CO")}</td>
                  <td className="num">{fmtCop(ls)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3 className="mt-4 mb-2 text-sm font-semibold text-slate-800">
          2.1 Desglose por cauce (TR 100, H=2.9 m)
        </h3>
        <table>
          <thead>
            <tr>
              <th>Cauce</th>
              <th className="num">Edificios</th>
              <th className="num">Críticos</th>
              <th className="num">Pob.</th>
              <th className="num">Pérdida COP</th>
            </tr>
          </thead>
          <tbody>
            {(["presidenta", "volcana"] as const).map((cid) => {
              const c = meta?.cauces?.[cid];
              if (!c) return null;
              return (
                <tr key={cid}>
                  <td className="font-semibold text-sky-700">{c.display_name}</td>
                  <td className="num">{c.affected_by_level?.["3.0"] || 0}</td>
                  <td className="num">{c.critical_by_level?.["3.0"] || 0}</td>
                  <td className="num">{(c.population_by_level?.["3.0"] || 0).toLocaleString("es-CO")}</td>
                  <td className="num">{fmtCop(c.loss_by_level_cop?.["3.0"] || 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* 3. Equipamientos críticos expuestos */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold accent">
          3. Equipamientos críticos en zona de inundación (referencia TR 100)
        </h2>
        <p className="mb-2 text-xs text-slate-600">
          Listado priorizado por HAND creciente (menor HAND ⇒ mayor exposición). Coordenadas
          en EPSG:4326.
        </p>
        {exposedAtTR100.length === 0 ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            ✓ Ningún equipamiento crítico con nombre en zona de inundación bajo TR 100.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Cauce</th>
                <th className="num">HAND (m)</th>
                <th className="num">Lon</th>
                <th className="num">Lat</th>
              </tr>
            </thead>
            <tbody>
              {exposedAtTR100.slice(0, 40).map((c, i) => (
                <tr key={i}>
                  <td className="text-slate-500">{i + 1}</td>
                  <td className="font-medium text-slate-800">
                    {c.name || <em className="text-slate-400">sin nombre OSM</em>}
                  </td>
                  <td>{c.kind}</td>
                  <td className="text-[10px] uppercase text-slate-500">{c.cauce_id || "—"}</td>
                  <td className="num font-semibold text-red-600">{c.hand.toFixed(2)}</td>
                  <td className="num muted">{c.lon.toFixed(5)}</td>
                  <td className="num muted">{c.lat.toFixed(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 4. Protocolo de respuesta */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold accent">
          4. Protocolo sugerido de respuesta
        </h2>
        <p className="mb-3 text-xs text-slate-600">
          Protocolo referencial basado en DAGRD Medellín y Ley 1523/2012 de gestión del
          riesgo. Debe armonizarse con el Plan Municipal de Gestión del Riesgo vigente.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <ProtocolCard
            color="green"
            title="Verde — operación normal (H < 1 m · TR ≤ 5)"
            items={[
              "Mantenimiento trimestral de rejillas y cámaras del tramo cubierto en ambos cauces",
              "Inspección de estructuras en Parque La Presidenta y tramo Campus EAFIT (Volcana-Los Balsos)",
              "Verificación de calibración de estaciones SIATA de nivel en ambas quebradas",
              "Campañas de sensibilización vecinal en HAND ≤ 0.5 m",
            ]}
          />
          <ProtocolCard
            color="yellow"
            title="Amarillo — alerta preventiva (1 m ≤ H < 2 m · TR 5–25)"
            items={[
              "Notificación a administraciones de edificios expuestos",
              "Cierre preventivo de puentes con HAND ≤ 1 m",
              "Despliegue de personal EPM para despeje de drenajes",
              "Evacuación preventiva de primer piso en HAND ≤ 0.8 m",
              "Lista roja para hospitales y clínicas en zona expuesta",
            ]}
          />
          <ProtocolCard
            color="orange"
            title="Naranja — alerta intensa (2 m ≤ H < 3 m · TR 25–50)"
            items={[
              "Activación Comité Municipal de Emergencia (CMGRD)",
              "Movilización de equipos de rescate acuático",
              "Evacuación obligatoria de primer piso en todo el corredor",
              "Traslado de pacientes ambulatorios de clínicas expuestas",
              "Cierre total de puentes con HAND ≤ 2 m",
              "Apertura de albergues en colegios sobre 1600 m.s.n.m.",
            ]}
          />
          <ProtocolCard
            color="red"
            title="Roja — emergencia extrema (H ≥ 3 m · TR ≥ 100)"
            items={[
              "Coordinación AMVA + Alcaldía + SIATA + UNGRD",
              "Evacuación total en franja ≤ 400 m del cauce",
              "Corte de energía en edificios con HAND ≤ 3 m",
              "Cierre de válvulas de gas en zona crítica",
              "Despliegue Bomberos + Defensa Civil + helicóptero",
              "Solicitud de recursos nacionales si pérdida > 2 billones COP",
            ]}
          />
        </div>
      </section>

      <div className="page-break" />

      {/* 5. Metodología */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold accent">5. Metodología</h2>
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            <strong>Modelo HAND</strong> (Height Above Nearest Drainage): para cada celda
            del área de estudio se calcula la diferencia en metros entre su elevación y la
            elevación de su punto más cercano sobre el cauce. Una celda se considera
            inundada bajo un escenario de calado H si su HAND es menor o igual a H.
          </p>
          <p className="text-xs italic text-slate-500">
            Ref: Rennó C.D. et al. (2008) <em>HAND, a new terrain descriptor using
            SRTM-DEM</em>; Nobre A.D. et al. (2011) <em>Height Above the Nearest Drainage</em>.
            Remote Sensing of Environment.
          </p>
          <p>
            El DEM se construyó a partir de tiles Mapzen Terrarium z14 (~{meta?.dem_resolution_m_approx || 10} m/px).
            Los cauces se obtuvieron de OpenStreetMap con{" "}
            <strong>{meta?.cauces?.presidenta?.cauce_points || "—"} puntos</strong> en La Presidenta
            (elev {meta?.cauces?.presidenta?.cauce_elev_min?.toFixed?.(0) || "—"}–{meta?.cauces?.presidenta?.cauce_elev_max?.toFixed?.(0) || "—"} m.s.n.m.) y{" "}
            <strong>{meta?.cauces?.volcana?.cauce_points || "—"} puntos</strong> en Volcana-Los Balsos
            (elev {meta?.cauces?.volcana?.cauce_elev_min?.toFixed?.(0) || "—"}–{meta?.cauces?.volcana?.cauce_elev_max?.toFixed?.(0) || "—"} m.s.n.m.).
            El grid de HAND contiene {meta?.grid_points || "—"} puntos dentro de la potencial llanura
            de inundación (radio 350 m al drenaje más cercano).
          </p>
          <p>
            Las curvas de daño siguen una forma HAZUS simplificada:{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">ratio(d) = min(0.95, 0.15·d + 0.08·d²)</code>,
            donde d es la profundidad dentro del edificio. El valor por metro cuadrado
            utilizado es un precio mezclado El Poblado / EAFIT 2026 (residencial + comercial + oficinas):{" "}
            <strong>{(meta?.price_per_m2_cop || 6500000).toLocaleString("es-CO")} COP/m²</strong>.
            Los pisos provienen del atributo <code>building:levels</code> de OSM cuando existe; en
            caso contrario se asume 1 piso. El valor total edificado del área es de aproximadamente{" "}
            <strong>{((meta?.total_value_cop || 0) / 1e12).toFixed(1)} billones COP</strong>.
          </p>
          <p>
            <strong>Asignación multi-cauce.</strong> Cada edificio y celda del grid queda etiquetada
            con la propiedad <code>cauce_id</code> según el drenaje más cercano (Presidenta o Volcana-Los Balsos).
            El HAND de ese edificio se calcula relativo a ese cauce. Esto es consistente con la
            definición original HAND (altura sobre el drenaje <em>más cercano</em>) y evita doble-conteo.
          </p>
          <p>
            <strong>Población.</strong> La base son los hexágonos H3 resolución 8 de Kontur
            (2023-11, ~460 m). Cada hex se asigna al cauce más cercano y su población se considera
            expuesta si el HAND del hex ≤ nivel.
          </p>
        </div>
      </section>

      {/* 6. Fuentes de datos */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold accent">6. Fuentes de datos</h2>
        <table>
          <thead>
            <tr>
              <th>Capa</th>
              <th>Fuente</th>
              <th>Año / versión</th>
              <th>Licencia</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>DEM (topografía)</td><td>Mapzen Terrarium via AWS Open Data</td><td>2022 (composite)</td><td>CC0 / ODbL</td></tr>
            <tr><td>Cauce La Presidenta</td><td>OpenStreetMap (Overpass API)</td><td>abril 2026</td><td>ODbL</td></tr>
            <tr><td>Cauce Volcana-Los Balsos</td><td>OpenStreetMap (Overpass API)</td><td>abril 2026</td><td>ODbL</td></tr>
            <tr><td>Río Medellín</td><td>OpenStreetMap</td><td>abril 2026</td><td>ODbL</td></tr>
            <tr><td>Edificaciones ({meta?.buildings_total?.toLocaleString("es-CO") || "6.679"})</td><td>OpenStreetMap</td><td>abril 2026</td><td>ODbL</td></tr>
            <tr><td>Equip. críticos ({meta?.critical_total || 133})</td><td>OpenStreetMap amenities</td><td>abril 2026</td><td>ODbL</td></tr>
            <tr><td>Puentes/túneles ({meta?.bridges_total || 92})</td><td>OpenStreetMap bridges</td><td>abril 2026</td><td>ODbL</td></tr>
            <tr><td>Población (H3 hex escalado)</td><td>Kontur × DANE 2024</td><td>2023-11 / 2024</td><td>CC BY 4.0</td></tr>
            <tr><td>Población oficial Comuna 14</td><td>DANE proyección censal 2024</td><td>2024</td><td>Pública</td></tr>
            <tr><td>Comuna 14 boundary</td><td>OpenStreetMap relation</td><td>abril 2026</td><td>ODbL</td></tr>
            <tr><td>Límite municipal</td><td>GADM v4.1</td><td>2022</td><td>GADM non-commercial</td></tr>
            <tr><td>Lluvia histórica</td><td>Open-Meteo ERA5 reanalysis</td><td>2020–2026</td><td>CC BY 4.0</td></tr>
            <tr><td>Cobertura suelo</td><td>ESA WorldCover 10m</td><td>2021</td><td>CC BY 4.0</td></tr>
            <tr><td>Imagen óptica</td><td>Sentinel-2 cloudless EOX</td><td>2023</td><td>CC BY 4.0 S-hub</td></tr>
            <tr><td>Curvas IDF</td><td>POMCA Río Aburrá (AMVA) — valores referenciales</td><td>vigente</td><td>Pública</td></tr>
            <tr><td>Curvas de daño</td><td>HAZUS simplified</td><td>FEMA</td><td>Pública</td></tr>
            <tr><td>Morfometría Volcana</td><td>Wikipedia Q. La Volcana + Urbam EAFIT Plan Maestro "Laboratorio Vivo"</td><td>2024–2026</td><td>CC BY-SA</td></tr>
          </tbody>
        </table>
        <p className="mt-2 text-[10px] leading-snug text-slate-500">
          Datos morfométricos Volcana verificados: longitud ~5 km, nacimiento Alto Las Palmas
          ~2500 m.s.n.m., desembocadura Río Medellín ~1500 m.s.n.m. Los Balsos identificado
          como tributario principal (confluencia antes de EAFIT). Tramo bajo campus EAFIT
          canalizado en box culvert. Fuente: es.wikipedia.org/wiki/Quebrada_La_Volcana,
          Urbam EAFIT (proyecto "Quebrada Volcana — Laboratorio Vivo para cultura y medio
          ambiente", 100+ estudiantes involucrados), Vivir en El Poblado.
        </p>
      </section>

      {/* 7. Limitaciones */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold accent">7. Limitaciones y trabajos futuros</h2>
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            <strong>Resolución del DEM.</strong> El DEM Terrarium (~10 m) es adecuado para
            planificación estratégica pero insuficiente para diseño hidráulico de obras. Para
            precisión ingenieril se requiere LiDAR AMVA 1 m.
          </p>
          <p>
            <strong>Modelo hidráulico.</strong> El HAND es un modelo planar que sobreestima
            inundación en cauces estrechos y la subestima en confluencias. Para análisis
            detallado se recomienda correr HEC-RAS 2D o LISFLOOD-FP sobre el LiDAR.
          </p>
          <p>
            <strong>Curvas IDF.</strong> Los valores utilizados son referenciales del POMCA
            AMVA. Para calibración local se recomienda usar series de precipitación SIATA
            (estaciones Olaya Herrera, Nutibara, La Palma) con ajuste Gumbel.
          </p>
          <p>
            <strong>Resolución de la población.</strong> Kontur H3 res 8 tiene celdas de
            ~460 m, por lo que la población afectada se estima en bloques. Para mayor
            precisión se requiere catastro de Medellín con habitantes por edificio.
          </p>
          <p>
            <strong>Curvas de daño.</strong> HAZUS está calibrada para edificaciones
            norteamericanas. Requiere ajuste por tipología colombiana (adobe, mampostería no
            confinada, concreto reforzado).
          </p>
          <p>
            <strong>Uso recomendado.</strong> Este gemelo es apto para <strong>planificación
            estratégica, priorización de intervenciones y comunicación con stakeholders</strong>.
            NO es apto para diseño hidráulico de canalizaciones ni como base única para
            decisiones de evacuación en tiempo real.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-8 border-t-2 border-slate-200 pt-4 text-center text-xs text-slate-500">
        <div>
          Gemelo Digital GeoAI · Quebradas La Presidenta + Volcana-Los Balsos · DENSURBAM · Urbam EAFIT
        </div>
        <div className="mt-1">
          Generado con Next.js + MapLibre + HAND multi-cauce ·{" "}
          <a href="https://gemelo-presidenta.vercel.app" className="underline">
            gemelo-presidenta.vercel.app
          </a>
        </div>
      </footer>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="text-[9px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-bold text-sky-700">{value}</div>
      <div className="text-[9px] text-slate-400">{sub}</div>
    </div>
  );
}

function ProtocolCard({
  color,
  title,
  items,
}: {
  color: "green" | "yellow" | "orange" | "red";
  title: string;
  items: string[];
}) {
  const bgs = {
    green: "border-emerald-200 bg-emerald-50",
    yellow: "border-amber-200 bg-amber-50",
    orange: "border-orange-200 bg-orange-50",
    red: "border-red-200 bg-red-50",
  };
  const titles = {
    green: "text-emerald-800",
    yellow: "text-amber-800",
    orange: "text-orange-800",
    red: "text-red-800",
  };
  return (
    <div className={`rounded-lg border p-3 ${bgs[color]}`}>
      <div className={`mb-1 text-xs font-bold uppercase ${titles[color]}`}>{title}</div>
      <ul className="list-inside list-disc space-y-0.5 text-[11px] text-slate-700">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
