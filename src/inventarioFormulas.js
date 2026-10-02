import { fechaHistorialISO } from "./historial.js";

const posterior = (item, conteo) => {
  if (item.registradoEl) return item.registradoEl > conteo.registradoEl;
  const fecha = fechaHistorialISO(item.fecha);
  const base = fechaHistorialISO(conteo.fecha);
  return fecha > base;
};

export function deltaConteoFormula(total, saldos, formula, real, formulas) {
  const anterior = saldos?.[formula] ?? null;
  if (anterior != null) return +(real - anterior).toFixed(2);
  const sinDistribuir = total - Object.values(saldos || {}).reduce((s, n) => s + Number(n || 0), 0);
  const otrasSinContar = formulas.filter(n => n !== formula && saldos?.[n] == null).length;
  return +(otrasSinContar ? Math.max(0, real - Math.max(0, sinDistribuir)) : real - sinDistribuir).toFixed(2);
}

// El último conteo de la categoría fija el saldo de cada fórmula. Después
// entran los baches y se restan los servidos realmente registrados.
export function saldosFormulasDesdeConteo(categoria, formulas, movimientos, registros) {
  const conteos = movimientos.filter(m => m.tipo === "ajuste" && m.categoria === categoria && m.conteosFormula && m.registradoEl)
    .sort((a, b) => fechaHistorialISO(b.fecha).localeCompare(fechaHistorialISO(a.fecha)) || b.registradoEl.localeCompare(a.registradoEl));
  if (!conteos.length) return null;
  return Object.fromEntries(formulas.map(formula => {
    const conteo = conteos.find(m => Object.hasOwn(m.conteosFormula, formula));
    if (!conteo) return [formula, null];
    let saldo = Number(conteo.conteosFormula[formula] || 0);
    for (const m of movimientos) {
      if (!posterior(m, conteo) || m.formula !== formula || m.categoria !== categoria) continue;
      if (m.tipo === "bache") saldo += Number(m.kg || 0);
      if (m.tipo === "servido") saldo -= Number(m.kg || 0);
    }
    if (categoria === "Aves") for (const r of registros) {
      if (r.formulaConcentrado === formula && posterior(r, conteo)) saldo -= Number(r.alimentoKg || 0);
    }
    return [formula, +saldo.toFixed(2)];
  }));
}
const numeroSeguro = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;

function saldoAbsolutoAjuste(movimiento) {
  const conteos = movimiento?.conteosFormula;
  if (conteos && typeof conteos === "object" && !Array.isArray(conteos)) {
    const valores = Object.values(conteos)
      .filter(valor => valor != null && valor !== "")
      .map(Number)
      .filter(valor => Number.isFinite(valor) && valor >= 0);
    if (valores.length) return valores.reduce((total, valor) => total + valor, 0);
  }
  if (movimiento?.saldoReal == null || movimiento.saldoReal === "") return null;
  const saldoReal = Number(movimiento.saldoReal);
  return Number.isFinite(saldoReal) && saldoReal >= 0 ? saldoReal : null;
}

function despuesDelConteo(item, conteo) {
  const fechaItem = fechaHistorialISO(item?.fecha);
  const fechaConteo = fechaHistorialISO(conteo?.fecha);
  if (fechaItem !== fechaConteo) return fechaItem > fechaConteo;
  if (item?.registradoEl && conteo?.registradoEl) return item.registradoEl > conteo.registradoEl;
  // Without a reliable timestamp, a same-day event is treated as before the closing count.
  return false;
}

function categoriaDe(movimiento, usoPorFormula) {
  return movimiento?.categoria || usoPorFormula?.[movimiento?.formula] || "Aves";
}

/**
 * Rebuilds a plant category balance as of a given date.
 *
 * A valid physical count replaces the previous balance. After that, all
 * category movements apply, regardless of formula-label changes. Before the
 * first count, use the configured opening; if its date is unset, start at the
 * first plant batch so earlier daily feed is not deducted from this ledger.
 */
export function calcularSaldoPlantaCategoria({
  categoria,
  fechaHasta,
  movimientos = [],
  registros = [],
  saldoInicial = 0,
  fechaApertura = "",
  usoPorFormula = {},
}) {
  const hasta = fechaHistorialISO(fechaHasta);
  if (!hasta) return null;

  const movimientosCategoria = movimientos
    .map(movimiento => ({
      ...movimiento,
      tipo: movimiento.tipo || "bache",
      categoria: categoriaDe(movimiento, usoPorFormula),
    }))
    .filter(movimiento => movimiento.categoria === categoria && fechaHistorialISO(movimiento.fecha));

  const conteos = movimientosCategoria
    .filter(movimiento => movimiento.tipo === "ajuste" && fechaHistorialISO(movimiento.fecha) <= hasta)
    .map(movimiento => ({ movimiento, saldo: saldoAbsolutoAjuste(movimiento) }))
    .filter(conteo => conteo.saldo != null)
    .sort((a, b) => fechaHistorialISO(a.movimiento.fecha).localeCompare(fechaHistorialISO(b.movimiento.fecha))
      || String(a.movimiento.registradoEl || "").localeCompare(String(b.movimiento.registradoEl || "")));

  const conteo = conteos.at(-1);
  if (conteo) {
    const base = conteo.movimiento;
    let saldo = conteo.saldo;
    movimientosCategoria.forEach(movimiento => {
      const fecha = fechaHistorialISO(movimiento.fecha);
      if (fecha > hasta || !despuesDelConteo(movimiento, base)) return;
      if (movimiento.tipo === "bache") saldo += numeroSeguro(movimiento.kg);
      if (movimiento.tipo === "servido") saldo -= numeroSeguro(movimiento.kg);
    });
    if (categoria === "Aves") registros.forEach(registro => {
      const fecha = fechaHistorialISO(registro.fecha);
      if (fecha > fechaHistorialISO(base.fecha) && fecha <= hasta) {
        saldo -= numeroSeguro(registro.alimentoKg ?? (numeroSeguro(registro.alimento6am) + numeroSeguro(registro.alimento1pm)));
      }
    });
    return +saldo.toFixed(2);
  }

  const aperturaConfigurada = fechaHistorialISO(fechaApertura);
  const primerBache = movimientosCategoria
    .filter(movimiento => movimiento.tipo === "bache")
    .map(movimiento => fechaHistorialISO(movimiento.fecha))
    .sort()[0] || "";
  const apertura = aperturaConfigurada || primerBache;
  if (!apertura || hasta < apertura) return null;

  let saldo = numeroSeguro(saldoInicial);
  movimientosCategoria.forEach(movimiento => {
    const fecha = fechaHistorialISO(movimiento.fecha);
    if (fecha < apertura || fecha > hasta) return;
    if (movimiento.tipo === "bache") saldo += numeroSeguro(movimiento.kg);
    if (movimiento.tipo === "servido") saldo -= numeroSeguro(movimiento.kg);
    // A physical count is absolute; never add its delta as another batch.
  });
  if (categoria === "Aves") registros.forEach(registro => {
    const fecha = fechaHistorialISO(registro.fecha);
    if (fecha >= apertura && fecha <= hasta) {
      saldo -= numeroSeguro(registro.alimentoKg ?? (numeroSeguro(registro.alimento6am) + numeroSeguro(registro.alimento1pm)));
    }
  });
  return +saldo.toFixed(2);
}
