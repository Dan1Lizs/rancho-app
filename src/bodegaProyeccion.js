import {
  fechaHistorialISO,
  reconstruirBodega,
  rutaNetaBodega,
  saldoCalculadoBodega,
  saldoInicialBodegaEnFecha,
} from "./historial.js";

const numero = valor => {
  const n = Number(String(valor ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const redondear = valor => Number(numero(valor).toFixed(1));

function sincronizarProduccionGuardada(movimientos, registros) {
  const produccionPorFecha = new Map();
  for (const registro of Array.isArray(registros) ? registros : []) {
    const fecha = fechaHistorialISO(registro.fecha);
    if (!fecha) continue;
    produccionPorFecha.set(fecha, (produccionPorFecha.get(fecha) || 0) + numero(registro.cartones));
  }

  const movimientosPorFecha = new Map();
  for (const movimiento of Array.isArray(movimientos) ? movimientos : []) {
    if (movimiento.movimientoSoloTiquetes) continue;
    const fecha = fechaHistorialISO(movimiento.fecha);
    if (!fecha) continue;
    const lista = movimientosPorFecha.get(fecha) || [];
    lista.push(movimiento);
    movimientosPorFecha.set(fecha, lista);
  }

  const fechasControl = [...produccionPorFecha.keys()].sort();
  const desde = fechasControl.find(fecha => {
    const delDia = movimientosPorFecha.get(fecha) || [];
    return delDia.length !== 1
      || Math.abs(numero(delDia[0]?.producido) - redondear(produccionPorFecha.get(fecha))) >= 0.05;
  });
  if (!desde) return { movimientos: Array.isArray(movimientos) ? movimientos : [], desde: null, duplicado: null };

  const fechaDuplicada = [...movimientosPorFecha.entries()]
    .filter(([fecha, lista]) => fecha >= desde && lista.length > 1)
    .map(([fecha]) => fecha)
    .sort()[0];
  if (fechaDuplicada) return { movimientos: Array.isArray(movimientos) ? movimientos : [], desde, duplicado: fechaDuplicada };

  const fechasConMovimiento = new Set(movimientosPorFecha.keys());
  const sincronizados = (Array.isArray(movimientos) ? movimientos : []).map(movimiento => {
    const fecha = fechaHistorialISO(movimiento.fecha);
    if (movimiento.movimientoSoloTiquetes || !fecha || fecha < desde || !produccionPorFecha.has(fecha)) return movimiento;
    return { ...movimiento, producido: redondear(produccionPorFecha.get(fecha)) };
  });

  for (const [fecha, producido] of produccionPorFecha) {
    if (fecha < desde || producido <= 0 || fechasConMovimiento.has(fecha)) continue;
    const [anio, mes, dia] = fecha.split("-");
    sincronizados.push({
      id: `bodega-${fecha}`,
      fecha: `${dia}/${mes}/${anio}`,
      producido: redondear(producido), comprado: 0, vendGranja: 0, destruido: 0,
      regalado: 0, repartos: [], rutaNeta: 0, movimientoTiquetes: 0,
      generadoDesdeControlDiario: true,
    });
  }
  return { movimientos: sincronizados, desde, duplicado: null };
}

// Proyecta los saldos únicamente para lectura; no modifica ni escribe registros.
export function reconstruirBodegaSoloLectura(movimientos = [], registros = [], inicialCart, apertura, movimientosTiquetes = []) {
  const base = reconstruirBodega(movimientos, inicialCart, apertura, movimientosTiquetes);
  const sincronizados = sincronizarProduccionGuardada(movimientos, registros);
  if (!sincronizados.desde || sincronizados.duplicado) return base;

  const recalculados = reconstruirBodega(sincronizados.movimientos, inicialCart, apertura, movimientosTiquetes);
  const ascendentes = [...recalculados].sort((a, b) =>
    fechaHistorialISO(a.fecha).localeCompare(fechaHistorialISO(b.fecha)) || String(a.id || "").localeCompare(String(b.id || "")));
  const previo = ascendentes.filter(m => fechaHistorialISO(m.fecha) < sincronizados.desde).at(-1);
  let saldo = previo
    ? numero(previo.saldoFinal)
    : saldoInicialBodegaEnFecha(ascendentes, inicialCart, apertura, sincronizados.desde);

  return ascendentes.map(movimiento => {
    if (fechaHistorialISO(movimiento.fecha) < sincronizados.desde) return movimiento;
    const ruta = Array.isArray(movimiento.repartos)
      ? rutaNetaBodega(movimiento.repartos)
      : numero(movimiento.rutaNeta);
    const calculado = saldoCalculadoBodega({
      saldoBase: saldo ?? numero(inicialCart),
      producido: movimiento.producido,
      comprado: movimiento.comprado,
      rutaNeta: ruta,
      vendGranja: movimiento.vendGranja,
      destruido: movimiento.destruido,
      regalado: movimiento.regalado,
      ajusteHistorico: 0,
      movimientoTiquetes: movimiento.movimientoTiquetes,
    });
    const tieneConteoFisico = movimiento.ajusteConteo != null;
    const saldoFinal = tieneConteoFisico ? numero(movimiento.ajusteConteo) : calculado;
    saldo = saldoFinal;
    return {
      ...movimiento,
      rutaNeta: redondear(ruta),
      saldoFinal,
      ajusteHistoricoImplicito: 0,
      difAjuste: tieneConteoFisico ? redondear(saldoFinal - calculado) : null,
    };
  }).reverse();
}
