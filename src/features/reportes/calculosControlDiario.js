import { numeroCartones } from "../bodega/tiquetesDevolucion.js";

export function sumarCartonesProduccion(valores = []) {
  const suma = (Array.isArray(valores) ? valores : []).reduce((total, item) => {
    const valor = item && typeof item === "object" ? item.cartones : item;
    const cartones = numeroCartones(valor ?? 0);
    return total + (Number.isFinite(cartones) ? cartones : 0);
  }, 0);
  return Math.round((suma + Number.EPSILON) * 100) / 100;
}

export function entradaProducidaReporte(registrosDia, movimientoBodega, produccionPorGalpon) {
  return registrosDia?.length
    ? sumarCartonesProduccion(produccionPorGalpon)
    : (movimientoBodega?.producido ?? "");
}
