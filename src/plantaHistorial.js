import { fechaHistorialISO } from "./historial.js";

export const filtroPlantaInicial = () => ({ texto: "", tipo: "", categoria: "", formula: "", desde: "", hasta: "" });

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
