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

export function saldoBodegaReporte(saldoInicial, producido, movimientoBodega, rutaNeta) {
  const guardado = movimientoBodega?.saldoFinal ?? "";
  const inicio = numeroCartones(saldoInicial);
  if (saldoInicial === "" || saldoInicial == null || !Number.isFinite(inicio)) {
    return { saldoProyectado: null, saldoFinal: guardado, ajusteConteo: null };
  }
  const cantidad = valor => {
    const numero = numeroCartones(valor ?? 0);
    return Number.isFinite(numero) ? numero : 0;
  };
  const redondear = valor => Math.round((valor + Number.EPSILON) * 100) / 100;
  const saldoProyectado = redondear(inicio + cantidad(producido) + cantidad(movimientoBodega?.comprado)
    - cantidad(rutaNeta) - cantidad(movimientoBodega?.vendGranja) - cantidad(movimientoBodega?.destruido)
    - cantidad(movimientoBodega?.regalado) + cantidad(movimientoBodega?.movimientoTiquetes)
    + cantidad(movimientoBodega?.ajusteHistoricoImplicito));
  const conteo = movimientoBodega?.ajusteConteo;
  const tieneConteo = conteo != null && conteo !== "" && Number.isFinite(numeroCartones(conteo));
  const saldoContado = tieneConteo ? numeroCartones(conteo) : null;
  return {
    saldoProyectado,
    saldoFinal: saldoContado ?? saldoProyectado,
    ajusteConteo: saldoContado == null ? null : redondear(saldoContado - saldoProyectado),
  };
}
