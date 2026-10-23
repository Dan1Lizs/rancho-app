import { numeroCartones } from "../bodega/tiquetesDevolucion.js";

const fechaReporteISO = (fecha) => {
  const valor = String(fecha || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const partes = valor.split("/");
  return partes.length === 3
    ? `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`
    : "";
};

export function claveRepartidorReporte(nombre) {
  return String(nombre || "").trim().toLocaleLowerCase("es");
}

const cartonesReporte = (valor) => {
  const cantidad = numeroCartones(valor ?? 0);
  return Number.isFinite(cantidad) ? cantidad : 0;
};

export function ajustarMovimientosTiquetesReporte({
  movimientoTiquetes = 0,
  buenosLegadosHoy = 0,
  buenosExplicitosHoy = 0,
  movimientoTiquetesYaIncluyeBuenosExplicitos = false,
} = {}) {
  const buenos = cartonesReporte(buenosExplicitosHoy);
  // Las devoluciones buenas explícitas también se reflejan en movimientoTiquetes
  // cuando existe un movimiento diario reconstruido/guardado. Restarlas por
  // fecha de apertura hacía que las fechas históricas las contaran dos veces.
  const buenosIncluidosEnMovimiento = movimientoTiquetesYaIncluyeBuenosExplicitos ? buenos : 0;
  const movimiento = cartonesReporte(movimientoTiquetes);

  return {
    movimientoParaSaldo: movimiento + cartonesReporte(buenosLegadosHoy)
      + buenos - buenosIncluidosEnMovimiento,
    otrosMovimientos: movimiento - buenosIncluidosEnMovimiento,
  };
}

const claveRutaReporte = (movimientoId, rutaId) => `${String(movimientoId ?? "")}::${String(rutaId ?? "")}`;

export function resumenDevolucionesRutaReporte({ movimientosBodega = [], fecha, movimientoId = "", repartos = [] } = {}) {
  const fechaSeleccionada = fechaReporteISO(fecha);
  const movimientos = Array.isArray(movimientosBodega) ? movimientosBodega : [];
  const nombresPorRuta = new Map();

  for (const movimiento of movimientos) {
    (movimiento.repartos || []).forEach((reparto, indice) => {
      const rutaId = String(reparto?.id || `legacy:${movimiento?.id || "sin-movimiento"}:${indice}`);
      nombresPorRuta.set(claveRutaReporte(movimiento.id, rutaId), reparto.nombre || "");
    });
  }

  const buenosPorRepartidor = {};
  const nombresPorRepartidor = {};
  const malosPorRuta = {};
  let buenosExplicitosHoy = 0;
  for (const movimiento of movimientos) {
    for (const devolucion of Array.isArray(movimiento?.devolucionesSinTiquete) ? movimiento.devolucionesSinTiquete : []) {
      const rutaMovId = String(devolucion.rutaMovId ?? devolucion.ruta_mov_id ?? "");
      const rutaId = String(devolucion.rutaId ?? devolucion.ruta_id ?? "");
      const claveRuta = claveRutaReporte(rutaMovId, rutaId);
      const nombre = nombresPorRuta.get(claveRuta) || devolucion.repartidor || "";
      const fechaRecepcion = fechaReporteISO(devolucion.fechaRecepcion || movimiento.fecha);
      const buenos = cartonesReporte(devolucion.cartonesBuenos ?? devolucion.cartones_buenos);
      const malos = cartonesReporte(devolucion.cartonesMalos ?? devolucion.cartones_malos);

      if (fechaRecepcion === fechaSeleccionada && buenos) {
        const nombreVisible = String(nombre || "Ruta de origen").trim();
        const claveNombre = claveRepartidorReporte(nombreVisible);
        buenosPorRepartidor[claveNombre] = (buenosPorRepartidor[claveNombre] || 0) + buenos;
        nombresPorRepartidor[claveNombre] = nombresPorRepartidor[claveNombre] || nombreVisible;
        buenosExplicitosHoy += buenos;
      }
      if (rutaMovId && rutaId && malos) {
        malosPorRuta[claveRuta] = (malosPorRuta[claveRuta] || 0) + malos;
      }
    }
  }

  const detalleRutas = (Array.isArray(repartos) ? repartos : []).map((reparto, indice) => {
    const rutaId = String(reparto?.id || `legacy:${movimientoId || "sin-movimiento"}:${indice}`);
    const claveNombre = claveRepartidorReporte(reparto?.nombre);
    const claveRutaActual = claveRutaReporte(movimientoId, rutaId);
    return {
      buenosExplicitos: buenosPorRepartidor[claveNombre] || 0,
      malosVinculados: malosPorRuta[claveRutaActual] || 0,
    };
  });

  return { buenosPorRepartidor, nombresPorRepartidor, buenosExplicitosHoy, malosPorRuta, detalleRutas };
}

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

