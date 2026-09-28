export const PERIODOS_HISTORIAL = [
  ["30", "Últimos 30 días"], ["90", "Últimos 90 días"],
  ["mes", "Este mes"], ["365", "Último año"], ["todo", "Todo el historial"],
];

export function fechaHistorialISO(fecha) {
  const s = String(fecha || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

export function filtrarHistorial(items, periodo, hoy = new Date()) {
  if (periodo === "todo") return items;
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (periodo === "mes") inicio.setDate(1);
  else inicio.setDate(inicio.getDate() - (Number(periodo) || 30) + 1);
  const desde = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-${String(inicio.getDate()).padStart(2, "0")}`;
  return items.filter(item => {
    const fecha = fechaHistorialISO(item.fecha);
    return fecha && fecha >= desde && fecha <= hoyISO;
  });
}

export function snapshotBodega(m) {
  const { id, fecha, producido, comprado, vendGranja, destruido, regalado, repartos, rutaNeta, obs, saldoFinal, ajusteConteo, difAjuste } = m;
  return { id, fecha, producido, comprado, vendGranja, destruido, regalado, repartos, rutaNeta, obs, saldoFinal, ajusteConteo, difAjuste };
}

export function elegirMovimientoBodega(actuales, fechaISO, id = null) {
  const delDia = actuales.filter(m => fechaHistorialISO(m.fecha) === fechaISO);
  const elegido = id != null ? delDia.find(m => String(m.id) === String(id)) : delDia[0];
  return { delDia, elegido, id: elegido?.id ?? `bodega-${fechaISO}` };
}

export function movimientoBodegaParaReporte(movs, id = null) {
  return id == null ? movs[0] : movs.find(m => String(m.id) === String(id));
}

export function reconstruirBodega(movs, inicialCart, apertura) {
  const ordenados = [...movs].sort((a, b) => fechaHistorialISO(a.fecha).localeCompare(fechaHistorialISO(b.fecha)));
  let saldo = Number(inicialCart || 0);
  return ordenados.map(m => {
    if (apertura && fechaHistorialISO(m.fecha) < apertura) return m;
    const calculado = saldo + Number(m.producido || 0) + Number(m.comprado || 0)
      - Number(m.rutaNeta || 0) - Number(m.vendGranja || 0) - Number(m.destruido || 0) - Number(m.regalado || 0);
    const final = m.ajusteConteo != null ? Number(m.ajusteConteo) : +calculado.toFixed(1);
    saldo = final;
    return { ...m, saldoFinal: final, difAjuste: m.ajusteConteo != null ? +(Number(m.ajusteConteo) - calculado).toFixed(1) : null };
  }).reverse();
}
