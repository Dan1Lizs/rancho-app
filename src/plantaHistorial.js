import { fechaHistorialISO } from "./historial.js";

export const filtroPlantaInicial = () => ({ texto: "", tipo: "", categoria: "", formula: "", desde: "", hasta: "" });

export function movimientosConFechaFutura(movimientos = [], fechaCorte = new Date()) {
  const corte = fechaCorte instanceof Date
    ? `${fechaCorte.getFullYear()}-${String(fechaCorte.getMonth() + 1).padStart(2, "0")}-${String(fechaCorte.getDate()).padStart(2, "0")}`
    : fechaHistorialISO(fechaCorte);
  if (!corte) return [];
  return movimientos.filter(movimiento => {
    const fecha = fechaHistorialISO(movimiento?.fecha);
    return Boolean(fecha && fecha > corte);
  });
}

export function filtrarMovimientosPlanta(movimientos, filtro) {
  const q = (filtro.texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return movimientos.filter(m => {
    const fecha = fechaHistorialISO(m.fecha);
    const texto = [m.formula, m.detalle, m.numBache, m.numNucleo, m.responsable, m.por]
      .join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return (!q || texto.includes(q)) && (!filtro.tipo || m.tipo === filtro.tipo) &&
      (!filtro.categoria || m.categoria === filtro.categoria) &&
      (!filtro.formula || m.formula === filtro.formula) &&
      (!filtro.desde || fecha >= filtro.desde) && (!filtro.hasta || fecha <= filtro.hasta);
  });
}
