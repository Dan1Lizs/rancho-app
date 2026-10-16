import { fechaHistorialISO } from "./historial.js";

export const TIPOS_MOVIMIENTO_COMPRADO = new Set(["compra_comprado", "ajuste_comprado"]);

export function esConsumoAlimentoComprado(registro) {
  return registro?.origenAlimento === "comprado" || Boolean(registro?.productoCompradoId);
}
export function convertirAkg(cantidad, unidad, kgPorUnidad = 1) {
  const valor = Number(String(cantidad ?? "").replace(",", "."));
  const factor = String(unidad || "").toLowerCase() === "kg" ? 1 : Number(kgPorUnidad);
  if (!Number.isFinite(valor) || valor < 0 || !Number.isFinite(factor) || factor <= 0) return null;
  return +(valor * factor).toFixed(2);
}

function movimientosInventarioComprado(productoId, movimientos, registros) {
  const id = String(productoId);
  const eventos = [];
  for (const movimiento of movimientos || []) {
    if (String(movimiento?.productoCompradoId ?? "") !== id) continue;
    if (!TIPOS_MOVIMIENTO_COMPRADO.has(movimiento.tipo)) continue;
    const fecha = fechaHistorialISO(movimiento.fecha);
    if (!fecha) continue;
    const kg = Number(movimiento.kg || 0);
    if (!Number.isFinite(kg)) continue;
    eventos.push({
      fecha,
      registradoEl: movimiento.registradoEl || "",
      prioridad: movimiento.tipo === "compra_comprado" ? 0 : 2,
      kg: movimiento.tipo === "compra_comprado" ? Math.abs(kg) : kg,
    });
  }
  for (const registro of registros || []) {
    if (!esConsumoAlimentoComprado(registro) || String(registro.productoCompradoId ?? "") !== id) continue;
    const fecha = fechaHistorialISO(registro.fecha);
    if (!fecha) continue;
    const kg = Number(registro.alimentoKg ?? (Number(registro.alimento6am || 0) + Number(registro.alimento1pm || 0)));
    if (!Number.isFinite(kg) || kg <= 0) continue;
    eventos.push({ fecha, registradoEl: registro.registradoEl || "", prioridad: 1, kg: -kg });
  }
  return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha)
    || (a.registradoEl && b.registradoEl ? a.registradoEl.localeCompare(b.registradoEl) : a.prioridad - b.prioridad));
}

/** Rebuilds the purchased-food balance in canonical kilograms through a date. */
export function calcularSaldoAlimentoComprado(productoId, fechaHasta, movimientos = [], registros = []) {
  if (productoId == null || productoId === "") return 0;
  const hasta = fechaHistorialISO(fechaHasta);
  if (!hasta) return 0;
  return +movimientosInventarioComprado(productoId, movimientos, registros)
    .filter(evento => evento.fecha <= hasta)
    .reduce((saldo, evento) => saldo + evento.kg, 0)
    .toFixed(2);
}

/** Calculates availability before an edited daily record is replaced. */
export function disponibilidadAlimentoComprado({ productoId, fecha, movimientos = [], registros = [], reemplazar = [] }) {
  const claves = new Set(reemplazar.map(r => `${r.fecha}|${r.lote}`));
  const base = registros.filter(r => !claves.has(`${r.fecha}|${r.lote}`));
  return calcularSaldoAlimentoComprado(productoId, fecha, movimientos, base);
}
