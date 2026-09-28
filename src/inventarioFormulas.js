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
