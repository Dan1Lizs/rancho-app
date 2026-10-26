import { numeroCartones } from "../bodega/tiquetesDevolucion.js";
import { devolucionesIntegradasPorRuta, rutaNetaBodega } from "../../historial.js";

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

export function salidaEfectivaRepartoReporte(reparto = {}, detalle = {}) {
  return rutaNetaBodega([reparto]) - cartonesReporte(reparto.devMalo)
    - cartonesReporte(detalle.buenosIntegrados) - cartonesReporte(detalle.malosIntegrados);
}

export function salidaEfectivaReporte(repartos, detalleRutas = [], rutaNetaGuardada = 0) {
  if (!Array.isArray(repartos)) return cartonesReporte(rutaNetaGuardada);
  return repartos.reduce((total, reparto, indice) =>
    total + salidaEfectivaRepartoReporte(reparto, detalleRutas[indice] || {}), 0);
}

const cartonesReporte = (valor) => {
  const cantidad = numeroCartones(valor ?? 0);
  return Number.isFinite(cantidad) ? cantidad : 0;
};

export function ajustarMovimientosTiquetesReporte({
  movimientoTiquetes = 0,
  buenosExplicitosHoy = 0,
  impactoMalosIncluidoEnMovimiento = 0,
  movimientoTiquetesYaIncluyeBuenosExplicitos = false,
} = {}) {
  const buenos = cartonesReporte(buenosExplicitosHoy);
  // En el reporte los retornos buenos ya rebajan la salida efectiva de su ruta.
  // Si el saldo diario antiguo también los guardó como entrada, se quitan de
  // "otros movimientos" para no sumarlos por segunda vez.
  const buenosIncluidosEnMovimiento = movimientoTiquetesYaIncluyeBuenosExplicitos ? buenos : 0;
  const malosIncluidosEnMovimiento = cartonesReporte(impactoMalosIncluidoEnMovimiento);
  const movimiento = cartonesReporte(movimientoTiquetes);
  const residual = movimiento - buenosIncluidosEnMovimiento - malosIncluidosEnMovimiento;

  return {
    movimientoParaSaldo: residual,
    otrosMovimientos: residual,
  };
}

const claveRutaReporte = (movimientoId, rutaId) => `${String(movimientoId ?? "")}::${String(rutaId ?? "")}`;

export function resumenDevolucionesRutaReporte({ movimientosBodega = [], movimientosTiquetes = [], fecha, movimientoId = "", repartos = [] } = {}) {
  const fechaSeleccionada = fechaReporteISO(fecha);
  const movimientos = Array.isArray(movimientosBodega) ? movimientosBodega : [];
  const devolucionesSinTiquete = movimientos.flatMap(movimiento =>
    Array.isArray(movimiento?.devolucionesSinTiquete) ? movimiento.devolucionesSinTiquete : []);
  const movimientosTiquetesLista = Array.isArray(movimientosTiquetes) ? movimientosTiquetes : [];
  const nombresPorRuta = new Map();

  for (const movimiento of movimientos) {
    (movimiento.repartos || []).forEach((reparto, indice) => {
      const rutaId = String(reparto?.id || `legacy:${movimiento?.id || "sin-movimiento"}:${indice}`);
      nombresPorRuta.set(claveRutaReporte(movimiento.id, rutaId), reparto.nombre || "");
    });
  }

  const buenosPorRepartidor = {};
  const buenosIntegradosPorRepartidor = {};
  const nombresPorRepartidor = {};
  const malosPorRuta = {};
  // El nuevo criterio se aplica al interpretar los reportes, incluso a
  // devoluciones históricas. Solo son copias para el cálculo: los registros
  // guardados conservan sus valores y sus marcas originales.
  const movimientosDeDevolucionParaReporte = movimientosTiquetesLista.map(movimiento => {
    const tipo = String(movimiento.tipo || "");
    const informativo = cartonesReporte(movimiento.cartones_informativos ?? movimiento.cartonesInformativos);
    const correccionBuenaVinculada = tipo === "correccion" && informativo === 0
      && Boolean(movimiento.tiquete_id ?? movimiento.tiqueteId)
      && Boolean(movimiento.ruta_mov_id ?? movimiento.rutaMovId)
      && Boolean(movimiento.ruta_id ?? movimiento.rutaId);
    const aplicaReglaEnReporte = movimiento.regla_salida_neta === true || movimiento.reglaSalidaNeta === true
      || tipo === "devolucion" || tipo === "devolucion_mala"
      || (tipo === "correccion" && informativo !== 0) || correccionBuenaVinculada;
    return aplicaReglaEnReporte ? { ...movimiento, regla_salida_neta: true } : movimiento;
  });
  const devolucionesIntegradas = devolucionesIntegradasPorRuta(
    devolucionesSinTiquete.map(devolucion => ({ ...devolucion, reglaSalidaNeta: true })),
    movimientosDeDevolucionParaReporte,
  );
  let buenosExplicitosHoy = 0;
  let buenosRecibidosHoy = 0;
  let malosRecibidosHoy = 0;
  let correccionMalaImpactoHoy = 0;
  let impactoMalosIncluidoEnMovimiento = 0;
  const agregarBuenoVisible = (nombre, buenos, integrado = false) => {
    if (!buenos) return;
    const nombreVisible = String(nombre || "Ruta de origen").trim();
    const claveNombre = claveRepartidorReporte(nombreVisible);
    buenosPorRepartidor[claveNombre] = (buenosPorRepartidor[claveNombre] || 0) + buenos;
    if (integrado) buenosIntegradosPorRepartidor[claveNombre] = (buenosIntegradosPorRepartidor[claveNombre] || 0) + buenos;
    nombresPorRepartidor[claveNombre] = nombresPorRepartidor[claveNombre] || nombreVisible;
  };
  for (const movimiento of movimientos) {
    for (const devolucion of Array.isArray(movimiento?.devolucionesSinTiquete) ? movimiento.devolucionesSinTiquete : []) {
      const rutaMovId = String(devolucion.rutaMovId ?? devolucion.ruta_mov_id ?? "");
      const rutaId = String(devolucion.rutaId ?? devolucion.ruta_id ?? "");
      const claveRuta = claveRutaReporte(rutaMovId, rutaId);
      const nombre = nombresPorRuta.get(claveRuta) || devolucion.repartidor || "";
      const fechaRecepcion = fechaReporteISO(devolucion.fechaRecepcion || movimiento.fecha);
      const buenos = cartonesReporte(devolucion.cartonesBuenos ?? devolucion.cartones_buenos);
      const malos = cartonesReporte(devolucion.cartonesMalos ?? devolucion.cartones_malos);
      const reglaGuardada = devolucion.reglaSalidaNeta === true || devolucion.regla_salida_neta === true;

      if (fechaRecepcion === fechaSeleccionada) {
        agregarBuenoVisible(nombre, buenos, true);
        buenosRecibidosHoy += buenos;
        // Los registros antiguos sumaron los buenos al saldo diario. Se guarda
        // este importe para quitarlo del residual al presentar el reporte.
        if (!reglaGuardada) buenosExplicitosHoy += buenos;
        malosRecibidosHoy += malos;
        if (reglaGuardada) impactoMalosIncluidoEnMovimiento -= malos;
      }
      if (rutaMovId && rutaId && malos) {
        malosPorRuta[claveRuta] = (malosPorRuta[claveRuta] || 0) + malos;
      }
    }
  }
  for (const movimiento of movimientosTiquetesLista) {
    const reglaGuardada = movimiento.regla_salida_neta === true || movimiento.reglaSalidaNeta === true;
    const tipo = String(movimiento.tipo || "");
    const fechaMovimiento = fechaReporteISO(movimiento.fecha);
    const rutaMovId = String(movimiento.ruta_mov_id ?? movimiento.rutaMovId ?? "");
    const rutaId = String(movimiento.ruta_id ?? movimiento.rutaId ?? "");
    const claveRuta = claveRutaReporte(rutaMovId, rutaId);
    const nombre = nombresPorRuta.get(claveRuta) || movimiento.repartidor || "";
    const delta = cartonesReporte(movimiento.cartones_delta ?? movimiento.cartonesDelta);
    const informativo = cartonesReporte(movimiento.cartones_informativos ?? movimiento.cartonesInformativos);
    const correccionBuenaVinculada = tipo === "correccion" && informativo === 0
      && Boolean(movimiento.tiquete_id ?? movimiento.tiqueteId) && Boolean(rutaMovId) && Boolean(rutaId);
    if (tipo === "devolucion" && fechaMovimiento === fechaSeleccionada) {
      agregarBuenoVisible(nombre, delta, true);
      buenosRecibidosHoy += delta;
      if (!reglaGuardada) buenosExplicitosHoy += delta;
    }
    if (tipo === "devolucion_mala" && fechaMovimiento === fechaSeleccionada) {
      malosRecibidosHoy += informativo || Math.abs(delta);
      if (reglaGuardada) impactoMalosIncluidoEnMovimiento += delta;
    }
    if (correccionBuenaVinculada && fechaMovimiento === fechaSeleccionada) {
      agregarBuenoVisible(nombre, delta, true);
      if (!reglaGuardada) buenosExplicitosHoy += delta;
    }
    if (tipo === "correccion" && informativo !== 0 && fechaMovimiento === fechaSeleccionada) {
      const impactoMala = reglaGuardada ? delta : -informativo;
      correccionMalaImpactoHoy += impactoMala;
      if (reglaGuardada) impactoMalosIncluidoEnMovimiento += delta;
    }
    if ((tipo === "devolucion_mala" || (tipo === "correccion" && informativo !== 0)) && rutaMovId && rutaId) {
      const malos = tipo === "devolucion_mala" ? (informativo || Math.abs(delta)) : informativo;
      malosPorRuta[claveRuta] = (malosPorRuta[claveRuta] || 0) + malos;
    }
  }

  const detalleRutas = (Array.isArray(repartos) ? repartos : []).map((reparto, indice) => {
    const rutaId = String(reparto?.id || `legacy:${movimientoId || "sin-movimiento"}:${indice}`);
    const claveNombre = claveRepartidorReporte(reparto?.nombre);
    const claveRutaActual = claveRutaReporte(movimientoId, rutaId);
    const integrada = devolucionesIntegradas.get(claveRutaActual) || { buenos: 0, malos: 0 };
    return {
      buenosExplicitos: (buenosPorRepartidor[claveNombre] || 0) - (buenosIntegradosPorRepartidor[claveNombre] || 0),
      malosVinculados: malosPorRuta[claveRutaActual] || 0,
      buenosIntegrados: integrada.buenos,
      malosIntegrados: integrada.malos,
    };
  });

  return {
    buenosPorRepartidor, buenosIntegradosPorRepartidor, nombresPorRepartidor, buenosExplicitosHoy, buenosRecibidosHoy, malosPorRuta, detalleRutas,
    malosRecibidosHoy, correccionMalaImpactoHoy,
    impactoMalosSeparado: -malosRecibidosHoy + correccionMalaImpactoHoy,
    impactoMalosIncluidoEnMovimiento,
  };
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

export function saldoBodegaReporte(saldoInicial, producido, movimientoBodega, rutaNeta, impactoMalosSeparado = 0) {
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
    + cantidad(movimientoBodega?.ajusteHistoricoImplicito) + cantidad(impactoMalosSeparado));
  const conteo = movimientoBodega?.ajusteConteo;
  const tieneConteo = conteo != null && conteo !== "" && Number.isFinite(numeroCartones(conteo));
  const saldoContado = tieneConteo ? numeroCartones(conteo) : null;
  return {
    saldoProyectado,
    saldoFinal: saldoContado ?? saldoProyectado,
    ajusteConteo: saldoContado == null ? null : redondear(saldoContado - saldoProyectado),
  };
}

