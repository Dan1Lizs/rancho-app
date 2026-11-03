import {
  fechaHistorialISO,
  reconstruirBodega,
  rutaNetaBodegaConDevoluciones,
  devolucionesSinTiqueteDeMovimiento,
  saldoCalculadoBodega,
  saldoInicialBodegaEnFecha,
} from "./historial.js";

const numero = valor => {
  const n = Number(String(valor ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const redondear = valor => Number(numero(valor).toFixed(1));

function sincronizarProduccionGuardada(movimientos, registros, fechaDesde = null) {
  const limiteISO = fechaHistorialISO(fechaDesde);
  if (!limiteISO) return { movimientos: Array.isArray(movimientos) ? movimientos : [], desde: null, duplicado: null };
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

  const fechasControl = [...produccionPorFecha.keys()]
    .filter(fecha => !limiteISO || fecha >= limiteISO)
    .sort();
  const primerDesajuste = fechasControl.find(fecha => {
    const delDia = movimientosPorFecha.get(fecha) || [];
    return delDia.length !== 1
      || Math.abs(numero(delDia[0]?.producido) - redondear(produccionPorFecha.get(fecha))) >= 0.05;
  });
  const desde = primerDesajuste || limiteISO;
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
      generadoDesdeControlDiario: true, versionSaldoBodega: 2, ajusteHistoricoImplicito: 0,
    });
  }
  return { movimientos: sincronizados, desde, duplicado: null };
}

// Reconstruye una sola cadena a partir de movimientos de Bodega y producción
// guardada. Los movimientos faltantes se generan con ID determinístico, por lo
// que pueden persistirse sin duplicarse y el siguiente guardado parte del mismo
// saldo que la pantalla y los reportes.
export function reconciliarBodegaConProduccion(movimientos = [], registros = [], inicialCart, apertura, movimientosTiquetes = [], fechaDesde = null) {
  const base = reconstruirBodega(movimientos, inicialCart, apertura, movimientosTiquetes);
  const sincronizados = sincronizarProduccionGuardada(movimientos, registros, fechaDesde);
  if (!sincronizados.desde) return { movimientos: base, desde: null, duplicado: null, generados: [] };
  if (sincronizados.duplicado) return { movimientos: base, desde: sincronizados.desde, duplicado: sincronizados.duplicado, generados: [] };

  const recalculados = reconstruirBodega(sincronizados.movimientos, inicialCart, apertura, movimientosTiquetes);
  const ascendentes = [...recalculados].sort((a, b) =>
    fechaHistorialISO(a.fecha).localeCompare(fechaHistorialISO(b.fecha)) || String(a.id || "").localeCompare(String(b.id || "")));
  const filasOriginales = (Array.isArray(movimientos) ? movimientos : [])
    .filter(m => !m.movimientoSoloTiquetes && fechaHistorialISO(m.fecha))
    .sort((a, b) => fechaHistorialISO(a.fecha).localeCompare(fechaHistorialISO(b.fecha)));
  const previoOriginal = filasOriginales.filter(m => fechaHistorialISO(m.fecha) < sincronizados.desde).at(-1);
  const fechaPrevioOriginal = fechaHistorialISO(previoOriginal?.fecha);
  let saldo = previoOriginal
    ? numero(previoOriginal.saldoFinal)
    : saldoInicialBodegaEnFecha(filasOriginales, inicialCart, apertura, sincronizados.desde);
  // Los eventos de tiquetes que no tienen movimiento diario propio son sintéticos.
  // Súmalos al ancla solo si ocurrieron después de la última fila persistida y
  // antes del tramo que se está reconciliando.
  saldo = ascendentes
    .filter(m => m.movimientoSoloTiquetes
      && fechaHistorialISO(m.fecha) < sincronizados.desde
      && (!fechaPrevioOriginal || fechaHistorialISO(m.fecha) > fechaPrevioOriginal))
    .reduce((total, m) => total + numero(m.movimientoTiquetes), saldo);
  const originalesPorId = new Map(filasOriginales.map(m => [String(m.id), m]));

  const movimientosAscendentes = ascendentes.map(movimiento => {
    if (fechaHistorialISO(movimiento.fecha) < sincronizados.desde) {
      return originalesPorId.get(String(movimiento.id)) || movimiento;
    }
    // reconstruirBodega ya aplica las devoluciones buenas y malas vinculadas
    // a la ruta. Recalcular desde repartos aquí volvía a la salida bruta y
    // descartaba esa integración (639.5 en vez de 568 en el caso del 02/11).
    const ruta = numero(movimiento.rutaNeta);
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
      versionSaldoBodega: 2,
      saldoFinal,
      ajusteHistoricoImplicito: 0,
      difAjuste: tieneConteoFisico ? redondear(saldoFinal - calculado) : null,
    };
  });
  const movimientosProyectados = movimientosAscendentes.reverse();
  const idsOriginales = new Set((Array.isArray(movimientos) ? movimientos : []).map(m => String(m.id)));
  const generados = movimientosProyectados.filter(movimiento =>
    movimiento.generadoDesdeControlDiario && !idsOriginales.has(String(movimiento.id)));
  return { movimientos: movimientosProyectados, desde: sincronizados.desde, duplicado: null, generados };
}

export function validarCadenaBodega(movimientos = [], tolerancia = 0.05, movimientosTiquetes = [], fechaDesde = null, saldoInicial = null) {
  const ordenados = [...(Array.isArray(movimientos) ? movimientos : [])]
    .filter(m => !m.movimientoSoloTiquetes)
    .filter(m => fechaHistorialISO(m.fecha))
    .sort((a, b) => fechaHistorialISO(a.fecha).localeCompare(fechaHistorialISO(b.fecha)) || String(a.id || "").localeCompare(String(b.id || "")));
  const limiteISO = fechaHistorialISO(fechaDesde);
  const tramo = limiteISO ? ordenados.filter(m => fechaHistorialISO(m.fecha) >= limiteISO) : ordenados;
  const fechas = new Set();
  for (const movimiento of tramo) {
    const fecha = fechaHistorialISO(movimiento.fecha);
    if (fechas.has(fecha)) return { ok: false, fecha, motivo: "duplicado" };
    fechas.add(fecha);
  }
  const devoluciones = devolucionesSinTiqueteDeMovimiento(ordenados);
  for (const movimiento of tramo) {
    if (!Array.isArray(movimiento.repartos)) continue;
    const esperado = rutaNetaBodegaConDevoluciones(movimiento.repartos, movimiento.id, devoluciones, movimientosTiquetes);
    const actual = numero(movimiento.rutaNeta);
    if (Math.abs(esperado - actual) >= tolerancia) {
      return { ok: false, fecha: fechaHistorialISO(movimiento.fecha), motivo: "ruta", esperado, actual };
    }
  }
  if (!tramo.length) return { ok: true };

  const indiceInicio = limiteISO
    ? ordenados.findIndex(m => fechaHistorialISO(m.fecha) >= limiteISO)
    : Math.min(1, ordenados.length);
  if (indiceInicio < 0) return { ok: true };
  let saldoAnterior = indiceInicio > 0
    ? numero(ordenados[indiceInicio - 1].saldoFinal)
    : (saldoInicial == null ? null : numero(saldoInicial));
  for (let indice = Math.max(0, indiceInicio); indice < ordenados.length; indice += 1) {
    const movimiento = ordenados[indice];
    if (saldoAnterior == null) {
      saldoAnterior = numero(movimiento.saldoFinal);
      continue;
    }
    const calculado = saldoCalculadoBodega({
      saldoBase: saldoAnterior,
      producido: movimiento.producido,
      comprado: movimiento.comprado,
      rutaNeta: movimiento.rutaNeta,
      vendGranja: movimiento.vendGranja,
      destruido: movimiento.destruido,
      regalado: movimiento.regalado,
      ajusteHistorico: movimiento.ajusteHistoricoImplicito,
      movimientoTiquetes: movimiento.movimientoTiquetes,
    });
    const tieneConteo = movimiento.ajusteConteo != null && movimiento.ajusteConteo !== "";
    const esperado = tieneConteo ? numero(movimiento.ajusteConteo) : calculado;
    const actual = numero(movimiento.saldoFinal);
    if (Math.abs(esperado - actual) >= tolerancia) {
      return { ok: false, fecha: fechaHistorialISO(movimiento.fecha), esperado, actual, saldoAnterior };
    }
    saldoAnterior = actual;
  }
  return { ok: true };
}

// Proyección de solo lectura para cualquier consulta. El mismo reconciliador
// se usa al guardar para evitar que la vista y la persistencia diverjan.
export function reconstruirBodegaSoloLectura(movimientos = [], registros = [], inicialCart, apertura, movimientosTiquetes = [], fechaDesde = null) {
  return reconciliarBodegaConProduccion(movimientos, registros, inicialCart, apertura, movimientosTiquetes, fechaDesde).movimientos;
}
