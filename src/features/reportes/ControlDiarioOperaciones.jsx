import React from "react";
import { calcularSaldoPlantaCategoria } from "../../inventarioFormulas.js";
import { rutaNetaBodega, saldoInicialBodegaEnFecha } from "../../historial.js";
import { loteExistiaEnFecha } from "../../etapaProductiva.js";
import { presentacionRutaNeta } from "../../bodegaResumen.js";
import { cartonesUsoEnRuta } from "../bodega/tiquetesDevolucion.js";
import { ajustarMovimientosTiquetesReporte, claveRepartidorReporte, entradaProducidaReporte, resumenDevolucionesRutaReporte, saldoBodegaReporte, sumarCartonesProduccion } from "./calculosControlDiario.js";
import "./control-diario-operaciones.css";

const numero = (valor, decimales = 2) => {
  if (valor === "" || valor == null) return "";
  const cantidad = Number(String(valor).trim().replace(",", "."));
  if (!Number.isFinite(cantidad)) return "";
  return new Intl.NumberFormat("es-CR", { maximumFractionDigits: decimales }).format(cantidad);
};

const isoDe = (fecha) => {
  const valor = String(fecha || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const partes = valor.split("/");
  return partes.length === 3 ? `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}` : "";
};

const fechaCorta = (fecha) => {
  const iso = isoDe(fecha);
  return iso ? iso.split("-").reverse().join("/") : "";
};

const tieneDato = (valor) => valor !== "" && valor != null;
const numeroSeguro = (valor) => {
  const cantidad = Number(String(valor ?? "").trim().replace(",", "."));
  return Number.isFinite(cantidad) ? cantidad : 0;
};

function Cuadricula({ columnas, filas, encabezado = true, className = "" }) {
  return (
    <table className={`op-table ${className}`}>
      {encabezado && <thead><tr>{columnas.map((col, i) => <th key={`${col}-${i}`}>{col}</th>)}</tr></thead>}
      <tbody>{filas.map((fila, i) => <tr key={i}>{fila.map((celda, j) => <td key={j}>{celda ?? ""}</td>)}</tr>)}</tbody>
    </table>
  );
}

function TituloSeccion({ children }) {
  return <div className="op-section-title">{children}</div>;
}

export function ControlDiarioOperaciones({
  fecha,
  lotes = [],
  registros = [],
  bodegaMovs = [],
  bodegaCfg = {},
  plantaMovs = [],
  plantaCfg = {},
  usoPorFormula = {},
  facturas = [],
  medicaciones = [],
  fumigaciones = [],
  bitacora = [],
  trabajos = [],
  logoSrc = "",
  mostrarNombre = (nombre) => nombre || "",
}) {
  const fechaISO = isoDe(fecha);
  const fechaDMY = fechaCorta(fechaISO);
  const lotePorId = new Map(lotes.map((l) => [String(l.id), l]));
  const registrosValidos = registros.filter(registro => {
    const lote = lotePorId.get(String(registro.lote));
    return !lote || loteExistiaEnFecha(lote, registro.fecha);
  });
  const registrosDia = registrosValidos.filter((r) => isoDe(r.fecha) === fechaISO);
  const galponDe = (registro) => Number(lotePorId.get(String(registro.lote))?.galpon || registro.galpon || 0);
  const fechasDespues = (registro) => isoDe(registro.fecha) > fechaISO;

  const produccion = [1, 2, 3, 4].map((galpon) => {
    const regs = registrosDia.filter((r) => galponDe(r) === galpon);
    const lotesDelGalpon = regs.map((r) => lotePorId.get(String(r.lote))).filter(Boolean);
    const lote = lotesDelGalpon[0] || lotes
      .filter((l) => Number(l.galpon) === galpon && l.nac && loteExistiaEnFecha(l, fechaISO))
      .sort((a, b) => String(b.nac).localeCompare(String(a.nac)))[0];
    let tiquetes = regs.flatMap((r) => (r.tiquetes || [])
      .filter((t) => t && (t.num || tieneDato(t.cartones) || tieneDato(t.peso)))
      .map((t) => ({ numero: t.num || "", cartones: t.cartones ?? "", peso: t.peso ?? "" })));
    if (!tiquetes.length) {
      tiquetes = regs.filter((r) => Number(r.cartones || 0) || Number(r.pesoKg || 0))
        .map((r) => ({ numero: "", cartones: r.cartones ?? "", peso: r.pesoKg ?? "" }));
    }
    const cartones = sumarCartonesProduccion(regs.map((r) => r.cartones));
    const peso = regs.reduce((s, r) => s + numeroSeguro(r.pesoKg), 0);
    const ticketRows = tiquetes.slice(0, tiquetes.length > 7 ? 6 : 7).map((t) => [t.numero, numero(t.cartones), numero(t.peso)]);
    if (tiquetes.length > 7) {
      const restantes = tiquetes.slice(6);
      ticketRows.push([
        `+${restantes.length} tiquetes`,
        `${numero(restantes.reduce((s, t) => s + numeroSeguro(t.cartones), 0))} cartones`,
        `${numero(restantes.reduce((s, t) => s + numeroSeguro(t.peso), 0))} kg`,
      ]);
    }
    while (ticketRows.length < 7) ticketRows.push(["", "", ""]);
    const semanas = lote?.nac && fechaISO && fechaISO >= lote.nac
      ? Math.floor((Date.parse(`${fechaISO}T00:00:00Z`) - Date.parse(`${lote.nac}T00:00:00Z`)) / (7 * 86400000))
      : "";
    const muertas = regs.reduce((s, r) => s + numeroSeguro(r.muertas), 0);
    const quebradosHuevos = regs.reduce((s, r) => s + numeroSeguro(r.quebrados), 0);
    const alimento = regs.reduce((s, r) => s + numeroSeguro(r.alimentoKg ?? (numeroSeguro(r.alimento6am) + numeroSeguro(r.alimento1pm))), 0);
    const observacionesAlimento = [...new Set(regs.map((r) => r.obsAlimento).filter(Boolean))].join("; ");
    const lotesEnFecha = lotes.filter((l) => Number(l.galpon) === galpon
      && l.nac && l.nac <= fechaISO
      && (!l.cerradoFecha || isoDe(l.cerradoFecha) >= fechaISO));
    const lotesParaSaldo = lotesDelGalpon.length ? lotesDelGalpon : lotesEnFecha;
    const saldoAves = lotesParaSaldo.length ? lotesParaSaldo.reduce((s, l) => {
      const bajasPosteriores = registrosValidos.filter((r) => String(r.lote) === String(l.id) && fechasDespues(r))
        .reduce((total, r) => total + numeroSeguro(r.muertas), 0);
      return s + numeroSeguro(l.aves) + bajasPosteriores;
    }, 0) : "";
    return { galpon, regs, lote, tiquetes: ticketRows, cartones, peso, semanas, muertas, quebradosCartones: quebradosHuevos / 30, alimento, observacionesAlimento, saldoAves };
  });

  const movimientoBodega = bodegaMovs.filter((m) => isoDe(m.fecha) === fechaISO)[0] || null;
  const aperturaBodega = isoDe(bodegaCfg.inicialFecha);
  const saldoInicialBodega = saldoInicialBodegaEnFecha(bodegaMovs, bodegaCfg.inicialCart, aperturaBodega, fechaISO) ?? "";
  const entradasBodega = entradaProducidaReporte(registrosDia, movimientoBodega, produccion);
  const repartosBase = movimientoBodega?.repartos?.length
    ? movimientoBodega.repartos
    : (bodegaCfg.repartidores?.length ? bodegaCfg.repartidores : ["Andrés", "Bryan"]).map((nombre) => ({ nombre }));
  const resumenDevolucionesInicial = resumenDevolucionesRutaReporte({
    movimientosBodega: bodegaMovs,
    fecha: fechaISO,
    movimientoId: movimientoBodega?.id,
    repartos: repartosBase,
  });
  const nombresDevolucionHoy = Object.entries(resumenDevolucionesInicial.nombresPorRepartidor)
    .filter(([clave]) => !repartosBase.some((r) => claveRepartidorReporte(r.nombre) === clave))
    .map(([, nombre]) => nombre);
  const repartos = [...repartosBase, ...nombresDevolucionHoy.map((nombre) => ({ nombre }))];
  const resumenDevoluciones = resumenDevolucionesRutaReporte({
    movimientosBodega: bodegaMovs,
    fecha: fechaISO,
    movimientoId: movimientoBodega?.id,
    repartos,
  });
  const detalleRutas = resumenDevoluciones.detalleRutas;
  const buenosLegadosHoy = (movimientoBodega?.repartos || []).reduce((total, r) => total + numeroSeguro(r.devBueno), 0);
  const hayDevolucionesLegadas = (movimientoBodega?.repartos || []).some((r) => numeroSeguro(r.devBueno) > 0 || numeroSeguro(r.devMalo) > 0);
  const buenosRecibidosHoy = buenosLegadosHoy + resumenDevoluciones.buenosExplicitosHoy;
  const malosVinculadosHoy = detalleRutas.reduce((total, detalle) => total + detalle.malosVinculados, 0);
  const rutaNetaLegada = movimientoBodega?.repartos ? rutaNetaBodega(movimientoBodega.repartos) : numeroSeguro(movimientoBodega?.rutaNeta);
  // Los buenos legados se separan como entrada para que el reporte no los oculte dentro del neto.
  // Los malos se muestran como información de quebrados y no afectan el saldo.
  const salidaRutaHoy = movimientoBodega?.repartos
    ? rutaNetaLegada + buenosLegadosHoy
    : rutaNetaLegada;
  const ajustesTiquetesReporte = ajustarMovimientosTiquetesReporte({
    movimientoTiquetes: movimientoBodega?.movimientoTiquetes,
    buenosLegadosHoy,
    buenosExplicitosHoy: resumenDevoluciones.buenosExplicitosHoy,
    movimientoTiquetesYaIncluyeBuenosExplicitos: Boolean(movimientoBodega),
  });
  const movimientoParaSaldo = movimientoBodega || ajustesTiquetesReporte.movimientoParaSaldo
    ? { ...(movimientoBodega || {}), movimientoTiquetes: ajustesTiquetesReporte.movimientoParaSaldo }
    : null;
  const saldoBodega = saldoBodegaReporte(saldoInicialBodega, entradasBodega, movimientoParaSaldo, salidaRutaHoy);
  const hayDatosRutas = Boolean(movimientoBodega?.repartos?.length || buenosRecibidosHoy || malosVinculadosHoy);
  const otrosMovimientosTiquetes = ajustesTiquetesReporte.otrosMovimientos;

  const fumigacionesDia = fumigaciones.filter((f) => isoDe(f.fecha) === fechaISO);
  const medicacionesDia = medicaciones.filter((m) => isoDe(m.fecha) === fechaISO);
  const trabajosPorGalpon = [1, 2, 3, 4].map((galpon) => {
    const regs = registrosDia.filter((r) => galponDe(r) === galpon);
    return trabajos.map((_, i) => regs.some((r) => Boolean(r.trabajos?.[i])));
  });

  const movimientosPlanta = plantaMovs.map((m) => ({
    ...m,
    tipo: m.tipo || "bache",
    categoria: m.categoria || usoPorFormula[m.formula] || "Aves",
  }));
  const diaAnteriorISO = fechaISO
    ? new Date(Date.parse(fechaISO + "T00:00:00Z") - 86400000).toISOString().slice(0, 10)
    : "";
  const saldoPlanta = (categoria, hastaInclusive) => calcularSaldoPlantaCategoria({
    categoria,
    fechaHasta: hastaInclusive ? fechaISO : diaAnteriorISO,
    movimientos: movimientosPlanta,
    registros: registrosValidos,
    saldoInicial: categoria === "Aves" ? plantaCfg.inicialAves : plantaCfg.inicialGanado,
    fechaApertura: plantaCfg.inicialFecha,
    usoPorFormula,
  });
  const inventarioPlanta = ["Aves", "Ganado"].map((categoria) => {
    const apertura = saldoPlanta(categoria, false);
    const cierre = saldoPlanta(categoria, true);
    const deHoy = movimientosPlanta.filter((m) => m.categoria === categoria && isoDe(m.fecha) === fechaISO);
    const baches = deHoy.filter((m) => m.tipo === "bache").reduce((s, m) => s + numeroSeguro(m.kg), 0);
    const alimento = categoria === "Aves" ? registrosDia.reduce((s, r) => s + numeroSeguro(r.alimentoKg ?? (numeroSeguro(r.alimento6am) + numeroSeguro(r.alimento1pm))), 0) : 0;
    const servido = categoria === "Ganado" ? deHoy.filter((m) => m.tipo === "servido").reduce((s, m) => s + numeroSeguro(m.kg), 0) : 0;
    const ajusteNeto = apertura == null || cierre == null ? 0 : cierre - (apertura + baches - alimento - servido);
    return {
      producto: `Concentrado ${categoria.toLowerCase()}`,
      apertura: apertura == null ? "" : apertura,
      entradas: apertura == null ? "" : baches + Math.max(0, ajusteNeto),
      salidas: apertura == null ? "" : alimento + servido + Math.max(0, -ajusteNeto),
      cierre: cierre == null ? "" : cierre,
    };
  });
  const bachesDia = movimientosPlanta.filter((m) => m.tipo === "bache" && isoDe(m.fecha) === fechaISO);
  const facturasDia = facturas.filter((f) => isoDe(f.fecha) === fechaISO);
  const bitacoraDia = bitacora.filter((b) => !b.eliminada && isoDe(b.fecha) === fechaISO);
  const bachesImpresos = bachesDia.length > 5
    ? [...bachesDia.slice(0, 4), { resumen: `+${bachesDia.length - 4} baches adicionales; consulte el historial de Planta` }]
    : bachesDia;
  const facturasImpresas = facturasDia.length > 5
    ? [...facturasDia.slice(0, 4), { resumen: `+${facturasDia.length - 4} facturas adicionales; consulte el historial de Planta` }]
    : facturasDia;
  const bitacoraImpresa = bitacoraDia.length > 11
    ? [...bitacoraDia.slice(0, 10), { texto: `+${bitacoraDia.length - 10} novedades adicionales; consulte la Bitácora` }]
    : bitacoraDia;
  const responsables = [...new Set([
    ...registrosDia.map((r) => r.por),
    movimientoBodega?.responsable,
    movimientoBodega?.por,
    movimientoBodega?.cierreVerificado?.responsable,
    ...movimientosPlanta.filter((m) => isoDe(m.fecha) === fechaISO).flatMap((m) => [m.responsable, m.por]),
    ...fumigacionesDia.map((f) => f.por),
    ...medicacionesDia.map((m) => m.por),
    ...facturasDia.map((f) => f.recibidoPor || f.por),
  ].filter(Boolean).map((nombre) => mostrarNombre(nombre)))];

  const filasRutas = [
    ["Salida de tiquetes normales", ...repartos.map((r) => hayDatosRutas ? numero(r.salida) : "")],
    ["Tiquetes devueltos reutilizados (+)", ...repartos.map((r) => hayDatosRutas ? numero(cartonesUsoEnRuta(r)) : "")],
    ["Salida total asignada a ruta", ...repartos.map((r) => hayDatosRutas ? numero(numeroSeguro(r.salida) + cartonesUsoEnRuta(r)) : "")],
    ["Huevo devuelto bueno (recibido hoy, +)", ...repartos.map((r, indice) => {
      return hayDatosRutas ? numero(numeroSeguro(r.devBueno) + (detalleRutas[indice]?.buenosExplicitos || 0)) : "";
    })],
    ["Huevo devuelto malo (solo informativo; no afecta saldo)", ...repartos.map((r, indice) => {
      return hayDatosRutas ? numero(numeroSeguro(r.devMalo) + (detalleRutas[indice]?.malosVinculados || 0)) : "";
    })],
    ["Impacto de la ruta en inventario (=)", ...repartos.map((r, indice) => {
      if (!hayDatosRutas) return "";
      const neto = rutaNetaBodega([r]) - (detalleRutas[indice]?.buenosExplicitos || 0);
      const impacto = presentacionRutaNeta(neto);
      return `${impacto.signo}${numero(impacto.cantidad)}`;
    })],
  ];
  const movimientoTiquetesResidual = otrosMovimientosTiquetes;
  const filasInventarioBodega = [
    ["Saldo de huevo en bodega (=)", numero(saldoInicialBodega)],
    ["(+) Entrada de huevo comprado", numero(movimientoBodega?.comprado)],
    ["(+) Entrada de huevo producido", numero(entradasBodega)],
    ["(-) Salida por rutas", numero(salidaRutaHoy)],
    ["(+) Entrada por devolución buena recibida hoy", numero(buenosRecibidosHoy)],
    ["(-) Salida de huevo vendido en granja", numero(movimientoBodega?.vendGranja)],
    ["(-) Huevo destruido o quebrado", numero(movimientoBodega?.destruido)],
    ["(-) Huevo regalado / salida gratis", numero(movimientoBodega?.regalado)],
    ...(Math.abs(movimientoTiquetesResidual) > 0.000001 ? [["(+/−) Otros movimientos de tiquetes", `${movimientoTiquetesResidual > 0 ? "+" : "−"}${numero(Math.abs(movimientoTiquetesResidual))}`]] : []),
    ...(Number(movimientoBodega?.ajusteHistoricoImplicito || 0) ? [["(+/−) Reconciliación histórica conservada", `${Number(movimientoBodega.ajusteHistoricoImplicito) > 0 ? "+" : "−"}${numero(Math.abs(Number(movimientoBodega.ajusteHistoricoImplicito)))}`]] : []),
    ...(saldoBodega.ajusteConteo ? [["(+/−) Diferencia por conteo físico", `${saldoBodega.ajusteConteo > 0 ? "+" : "−"}${numero(Math.abs(saldoBodega.ajusteConteo))}`]] : []),
    ["SALDO FINAL EN BODEGA (=)", numero(saldoBodega.saldoFinal)],
  ];

  return (
    <div className="control-operaciones-print">
      <section className="op-page">
        <header className="op-header">
          <div className="op-brand">
            {logoSrc && <img className="op-logo" src={logoSrc} alt="Logo de Rancho El Soñado" />}
          <div><div className="op-company">GRANJA AVÍCOLA RANCHO EL SOÑADO LIMITADA</div><div className="op-document-title">Control Diario de Operaciones</div></div>
          </div>
          <div className="op-header-meta">
            <span><b>Completado por:</b> {responsables.join(", ")}</span>
            <span><b>Fecha del reporte:</b> {fechaDMY}</span>
          </div>
          <div className="op-header-note">* Edad calculada a la fecha del control</div>
        </header>

        <TituloSeccion>1. PRODUCCIÓN DIARIA POR GALLINERO</TituloSeccion>
        <div className="op-houses-grid">
          {produccion.map((g) => <div className="op-house" key={g.galpon}>
            <div className="op-house-title">GALLINERO #{g.galpon}</div>
            <div className="op-house-age">Nacimiento: {fechaCorta(g.lote?.nac) || "________"} <span>Edad: {g.semanas !== "" ? `${g.semanas} sem*` : "________"}</span></div>
            <Cuadricula className="op-ticket-table" columnas={["Tiquete #", "Cant.", "Peso"]} filas={g.tiquetes} />
            <div className="op-house-total"><b>TOTAL</b><b>{numero(g.cartones)} cart · {numero(g.peso)} kg</b></div>
          </div>)}
        </div>

        <div className="op-columns op-inventory-routes">
          <div><TituloSeccion>2. INVENTARIO DE HUEVO EN BODEGA</TituloSeccion>
            <Cuadricula className="op-compact" columnas={["Concepto", "Cartones"]} filas={filasInventarioBodega} />
          </div>
          <div><TituloSeccion>3. SALIDA DIARIA DE HUEVO</TituloSeccion>
            <Cuadricula className="op-compact" columnas={["Concepto", ...repartos.map((r) => r.nombre || "Ruta")]} filas={filasRutas} />
            <div className="op-route-total">
              Entrada por devolución buena recibida hoy (+): <b>{numero(buenosRecibidosHoy)} cartones</b>
              {hayDevolucionesLegadas && <small className="op-route-note">Las devoluciones buenas suman al inventario al recibirse. Los cartones malos se conservan como registro informativo y no alteran el saldo.</small>}
            </div>
          </div>
        </div>

        <div><TituloSeccion>4. HUEVO QUEBRADO POR GALLINERO (cartones equivalentes)</TituloSeccion>
          <Cuadricula className="op-compact op-breakage" columnas={["Gall. #1", "Gall. #2", "Gall. #3", "Gall. #4", "TOTAL"]} filas={[[...produccion.map((g) => numero(g.quebradosCartones)), numero(produccion.reduce((s, g) => s + g.quebradosCartones, 0))]]} />
        </div>

        <div className="op-columns op-health-feed">
          <div><TituloSeccion>5. FUMIGACIÓN DIARIA</TituloSeccion>
            <Cuadricula className="op-compact" columnas={["Gallinero", "Producto", "Dosis", "Hora"]} filas={[1, 2, 3, 4].map((galpon) => {
              const items = fumigacionesDia.filter((f) => Number(f.galpon) === galpon);
              return [`Gallinero #${galpon}`, items.map((f) => f.producto).filter(Boolean).join(" / "), items.map((f) => f.dosis).filter(Boolean).join(" / "), items.map((f) => f.hora).filter(Boolean).join(" / ")];
            })} />
          </div>
          <div><TituloSeccion>6. CONTROL DIARIO DE CONSUMO DE ALIMENTO</TituloSeccion>
            <Cuadricula className="op-compact" columnas={["Gallinero", "Cantidad (kg)", "Observaciones"]} filas={produccion.map((g) => [`Gallinero #${g.galpon}`, numero(g.alimento), g.observacionesAlimento])} />
          </div>
        </div>
      </section>

      <section className="op-page">
        <header className="op-page-heading"><span>GRANJA AVÍCOLA RANCHO EL SOÑADO LIMITADA</span><b>Control Diario de Operaciones</b><span>{fechaDMY}</span></header>
        <div className="op-columns op-medical">
          <div><TituloSeccion>7. CONTROL DIARIO DE GALLINAS MUERTAS</TituloSeccion>
            <Cuadricula className="op-compact" columnas={["Gallinero", "Cantidad", "Saldo final del día"]} filas={[
              ...produccion.map((g) => [`Gallinero #${g.galpon}`, numero(g.muertas), numero(g.saldoAves)]),
              ["TOTAL MUERTAS", numero(produccion.reduce((s, g) => s + g.muertas, 0)), ""],
            ]} />
          </div>
          <div><TituloSeccion>8. CONTROL DE MEDICAMENTOS Y VITAMINAS</TituloSeccion>
            <Cuadricula className="op-compact" columnas={["Gallinero", "Medicamento / vitamina", "Dosis"]} filas={[1, 2, 3, 4].map((galpon) => {
              const items = medicacionesDia.filter((m) => Number(m.galpon) === galpon);
              return [`Gallinero #${galpon}`, items.map((m) => `${m.tipo === "Vitamina" ? "Vitamina" : "Medicamento"}: ${m.producto || ""}`).filter(Boolean).join(" / "), items.map((m) => m.dosis).filter(Boolean).join(" / ")];
            })} />
          </div>
        </div>

        <div className="op-tasks"><TituloSeccion>9. CONTROL DE TRABAJOS DIARIOS EN GRANJA</TituloSeccion>
          <Cuadricula className="op-compact op-task-table" columnas={["Actividad realizada", "Gallinero #1", "Gallinero #2", "Gallinero #3", "Gallinero #4"]} filas={trabajos.map((t, i) => [t, ...[0, 1, 2, 3].map((idx) => trabajosPorGalpon[idx][i] ? "✓" : "")])} />
        </div>
      </section>

      <section className="op-page">
        <header className="op-page-heading"><span>GRANJA AVÍCOLA RANCHO EL SOÑADO LIMITADA</span><b>Control Diario de Operaciones</b><span>{fechaDMY}</span></header>
        <TituloSeccion>CONTROL DE PLANTA DE CONCENTRADO</TituloSeccion>
        <div className="op-columns op-plant">
          <div><TituloSeccion>A. INVENTARIO DE CONCENTRADO (KG)</TituloSeccion>
            <Cuadricula className="op-compact" columnas={["Ingrediente / producto", "Saldo inicial", "Entrada", "Salida", "Saldo final"]} filas={inventarioPlanta.map((r) => [r.producto, numero(r.apertura), numero(r.entradas), numero(r.salidas), numero(r.cierre)])} />
          </div>
          <div><TituloSeccion>B. BACHES PRODUCIDOS</TituloSeccion>
            <Cuadricula className="op-compact" columnas={["Hora", "Producto", "Cantidad (kg)"]} filas={(bachesImpresos.length ? bachesImpresos : [{}]).map((m) => m.resumen ? ["", m.resumen, ""] : [m.hora || "", m.formula || "", numero(m.kg)])} />
          </div>
        </div>

        <div className="op-invoices"><TituloSeccion>C. CONTROL DE PRODUCTOS Y FACTURAS RECIBIDAS</TituloSeccion>
          <Cuadricula className="op-compact" columnas={["Proveedor", "Producto", "Factura #", "Cantidad", "Monto ₡", "Recibido por"]} filas={(facturasImpresas.length ? facturasImpresas : [{}]).map((f) => f.resumen ? ["", f.resumen, "", "", "", ""] : [f.proveedor || "", f.producto || "", f.numero || f.factura || "", f.cantidad || f.kg || "", tieneDato(f.monto) ? `₡ ${numero(f.monto)}` : "", mostrarNombre(f.recibidoPor || f.por || "")])} />
        </div>

        <div className="op-bitacora"><TituloSeccion>BITÁCORA DE NOVEDADES</TituloSeccion>
          {bitacoraImpresa.length ? bitacoraImpresa.map((nota, i) => <div className="op-note" key={`${nota.id || i}-${i}`}><span>{nota.texto}</span><small>{nota.resumen ? "" : mostrarNombre(nota.por)}</small></div>) : null}
          {Array.from({ length: Math.max(0, 11 - bitacoraImpresa.length) }, (_, i) => <div className="op-note op-empty-note" key={`linea-${i}`}>&nbsp;</div>)}
        </div>
      </section>
    </div>
  );
}

