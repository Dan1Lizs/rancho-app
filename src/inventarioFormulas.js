import { fechaHistorialISO } from "./historial.js";

const posterior = (item, conteo) => {
  if (item.registradoEl) return item.registradoEl > conteo.registradoEl;
  const fecha = fechaHistorialISO(item.fecha);
  const base = fechaHistorialISO(conteo.fecha);
  return fecha > base;
};

// El último conteo de la categoría fija el saldo de cada fórmula. Después
// entran los baches y se restan los servidos realmente registrados.
export function saldosFormulasDesdeConteo(categoria, formulas, movimientos, registros) {
  const conteos = movimientos.filter(m => m.tipo === "ajuste" && m.categoria === categoria && m.conteosFormula && m.registradoEl)
    .sort((a, b) => fechaHistorialISO(b.fecha).localeCompare(fechaHistorialISO(a.fecha)) || b.registradoEl.localeCompare(a.registradoEl));
  const conteo = conteos[0];
  if (!conteo) return null;
  return Object.fromEntries(formulas.map(formula => {
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
