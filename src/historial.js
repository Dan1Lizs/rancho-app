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
  const { id, fecha, producido, comprado, vendGranja, destruido, regalado, repartos, devolucionesSinTiquete, rutaNeta, movimientoTiquetes, obs, saldoFinal, ajusteConteo, difAjuste, cierreVerificado, versionSaldoBodega, ajusteHistoricoImplicito } = m;
  return { id, fecha, producido, comprado, vendGranja, destruido, regalado, repartos, devolucionesSinTiquete, rutaNeta, movimientoTiquetes, obs, saldoFinal, ajusteConteo, difAjuste, cierreVerificado, versionSaldoBodega, ajusteHistoricoImplicito };
}

export function elegirMovimientoBodega(actuales, fechaISO, id = null) {
  const delDia = actuales.filter(m => fechaHistorialISO(m.fecha) === fechaISO);
  const elegido = id != null ? delDia.find(m => String(m.id) === String(id)) : delDia[0];
  return { delDia, elegido, id: elegido?.id ?? `bodega-${fechaISO}` };
}

export function movimientoBodegaParaReporte(movs, id = null) {
  return id == null ? movs[0] : movs.find(m => String(m.id) === String(id));
}

export function movimientoBodegaDeFecha(movs, fechaISO, id = null) {
  const delDia = movs.filter(m => fechaHistorialISO(m.fecha) === fechaISO);
  return (id == null ? null : delDia.find(m => String(m.id) === String(id))) || delDia[0];
}

const numeroBodega = (valor) => {
  const numero = Number(String(valor ?? "").trim().replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
};
const redondearBodega = (valor) => Number(numeroBodega(valor).toFixed(1));
const idRutaBodega = (movimiento, reparto, indice) => String(reparto?.id || `legacy:${movimiento?.id || "sin-movimiento"}:${indice}`);
const claveRutaBodega = (movimientoId, rutaId) => `${String(movimientoId ?? "")}::${String(rutaId ?? "")}`;
const cartonesUsadosDeRuta = reparto => (Array.isArray(reparto?.tiquetesDevueltos) ? reparto.tiquetesDevueltos : [])
  .reduce((total, uso) => total + numeroBodega(uso.cartones), 0);

function asociarUsosDeTiquetes(movimientos, movimientosTiquetes) {
  const rutas = new Map();
  for (const movimiento of movimientos) {
    (movimiento.repartos || []).forEach((reparto, indice) => {
      rutas.set(claveRutaBodega(movimiento.id, idRutaBodega(movimiento, reparto, indice)), {
        movimiento, reparto, indice,
      });
    });
  }

  const porRuta = new Map();
  const operacionesAsociadas = new Set();
  for (const uso of Array.isArray(movimientosTiquetes) ? movimientosTiquetes : []) {
    if (uso.tipo !== "uso") continue;
    const clave = claveRutaBodega(uso.ruta_mov_id, uso.ruta_id);
    if (!rutas.has(clave)) continue;
    const lista = porRuta.get(clave) || [];
    lista.push({
      operacionId: String(uso.operacion_id ?? uso.operacionId ?? uso.id ?? ""),
      tiqueteId: String(uso.tiquete_id ?? uso.tiqueteId ?? ""),
      numero: String(uso.numero || ""),
      cartones: Math.abs(numeroBodega(uso.cartones_delta ?? uso.cartonesDelta)),
      fecha: uso.fecha,
    });
    porRuta.set(clave, lista);
    operacionesAsociadas.add(String(uso.operacion_id ?? uso.operacionId ?? uso.id ?? ""));
  }

  const resultado = movimientos.map(movimiento => ({
    ...movimiento,
    ...(Array.isArray(movimiento.repartos) ? { repartos: movimiento.repartos.map((reparto, indice) => {
      const clave = claveRutaBodega(movimiento.id, idRutaBodega(movimiento, reparto, indice));
      const previos = Array.isArray(reparto.tiquetesDevueltos) ? reparto.tiquetesDevueltos : [];
      const combinados = new Map(previos.map(uso => [String(uso.operacionId ?? uso.operacion_id ?? ""), uso]));
      for (const uso of porRuta.get(clave) || []) combinados.set(uso.operacionId, uso);
      return { ...reparto, tiquetesDevueltos: [...combinados.values()] };
    }) } : {}),
  }));

  return { movimientos: resultado, operacionesAsociadas };
}

export function rutaNetaBodega(repartos = []) {
  return (Array.isArray(repartos) ? repartos : []).reduce((suma, reparto) =>
    suma + numeroBodega(reparto.salida) + cartonesUsadosDeRuta(reparto)
      - numeroBodega(reparto.devBueno) + numeroBodega(reparto.devMalo), 0);
}

function rutaNetaAnterior(repartos, rutaNetaGuardada) {
  if (!Array.isArray(repartos)) return numeroBodega(rutaNetaGuardada);
  return repartos.reduce((suma, reparto) =>
    suma + numeroBodega(reparto.salida) + cartonesUsadosDeRuta(reparto)
      - numeroBodega(reparto.devBueno) - numeroBodega(reparto.devMalo), 0);
}

function cambioDiarioBodega(movimiento, rutaNeta) {
  return numeroBodega(movimiento.producido) + numeroBodega(movimiento.comprado) - rutaNeta
    - numeroBodega(movimiento.vendGranja) - numeroBodega(movimiento.destruido) - numeroBodega(movimiento.regalado)
    + numeroBodega(movimiento.movimientoTiquetes);
}

export function devolucionesSinTiqueteDeMovimiento(movimientos = []) {
  return (Array.isArray(movimientos) ? movimientos : []).flatMap(movimiento =>
    (Array.isArray(movimiento?.devolucionesSinTiquete) ? movimiento.devolucionesSinTiquete : [])
      .map(devolucion => ({ ...devolucion, fechaRecepcion: fechaHistorialISO(devolucion.fechaRecepcion || movimiento.fecha) }))
  );
}

export function cartonesMalosSinTiqueteEnRuta(devoluciones = [], movimientoId, rutaId) {
  return (Array.isArray(devoluciones) ? devoluciones : []).reduce((total, devolucion) => {
    const coincide = String(devolucion.rutaMovId ?? devolucion.ruta_mov_id ?? "") === String(movimientoId ?? "")
      && String(devolucion.rutaId ?? devolucion.ruta_id ?? "") === String(rutaId ?? "");
    return total + (coincide ? numeroBodega(devolucion.cartonesMalos ?? devolucion.cartones_malos) : 0);
  }, 0);
}

export function reconstruirBodega(movs, inicialCart, apertura, movimientosTiquetes = []) {
  const aperturaISO = fechaHistorialISO(apertura);
  const impactoPorFecha = new Map();
  const fechasConEventos = new Set();
  const originales = Array.isArray(movs) ? movs : [];
  const { movimientos: movimientosConUsos, operacionesAsociadas } = asociarUsosDeTiquetes(originales, movimientosTiquetes);
  const devolucionesSinTiquete = devolucionesSinTiqueteDeMovimiento(originales);
  const malasPorRuta = new Map();
  for (const devolucion of devolucionesSinTiquete) {
    const movimientoId = String(devolucion.rutaMovId ?? devolucion.ruta_mov_id ?? "");
    const rutaId = String(devolucion.rutaId ?? devolucion.ruta_id ?? "");
    if (!movimientoId || !rutaId) continue;
    const clave = claveRutaBodega(movimientoId, rutaId);
    malasPorRuta.set(clave, (malasPorRuta.get(clave) || 0) + numeroBodega(devolucion.cartonesMalos ?? devolucion.cartones_malos));
    const fechaRecepcion = fechaHistorialISO(devolucion.fechaRecepcion);
    const buenos = numeroBodega(devolucion.cartonesBuenos ?? devolucion.cartones_buenos);
    if (fechaRecepcion && buenos !== 0 && (!aperturaISO || fechaRecepcion >= aperturaISO)) {
      fechasConEventos.add(fechaRecepcion);
      impactoPorFecha.set(fechaRecepcion, (impactoPorFecha.get(fechaRecepcion) || 0) + buenos);
    }
  }
  for (const movimiento of Array.isArray(movimientosTiquetes) ? movimientosTiquetes : []) {
    const fecha = fechaHistorialISO(movimiento.fecha);
    const delta = Number(movimiento.cartones_delta ?? movimiento.cartonesDelta ?? 0);
    if (!fecha || !Number.isFinite(delta) || (aperturaISO && fecha < aperturaISO)) continue;
    fechasConEventos.add(fecha);
    const operacion = String(movimiento.operacion_id ?? movimiento.operacionId ?? movimiento.id ?? "");
    if (operacionesAsociadas.has(operacion)) continue;
    impactoPorFecha.set(fecha, (impactoPorFecha.get(fecha) || 0) + delta);
  }

  const porDia = new Set(movimientosConUsos.map(m => fechaHistorialISO(m.fecha)));
  const filasSinBodega = [...impactoPorFecha.entries()]
    .filter(([fecha, impacto]) => impacto !== 0 && !porDia.has(fecha))
    .map(([fecha, impacto]) => {
      const [anio, mes, dia] = fecha.split("-");
      return {
        id: `bodega-${fecha}`,
        fecha: `${dia}/${mes}/${anio}`,
        producido: 0,
        comprado: 0,
        vendGranja: 0,
        destruido: 0,
        regalado: 0,
        repartos: [],
        rutaNeta: 0,
        movimientoTiquetes: impacto,
        movimientoSoloTiquetes: true,
      };
    });

  const ordenados = [...movimientosConUsos, ...filasSinBodega].map(movimiento => {
    const fecha = fechaHistorialISO(movimiento.fecha);
    return {
      ...movimiento,
      movimientoTiquetes: fechasConEventos.has(fecha)
        ? redondearBodega(impactoPorFecha.get(fecha) || 0)
        : numeroBodega(movimiento.movimientoTiquetes),
    };
  }).sort((a, b) =>
    fechaHistorialISO(a.fecha).localeCompare(fechaHistorialISO(b.fecha)) || String(a.id || "").localeCompare(String(b.id || "")));
  if (!ordenados.length) return [];

  const primeraFecha = fechaHistorialISO(ordenados[0].fecha);
  const anclarPrimerCierre = Boolean(aperturaISO && primeraFecha && primeraFecha < aperturaISO);
  const saldoInicial = numeroBodega(inicialCart);
  const primerSaldoGuardado = ordenados[0].ajusteConteo != null
    ? numeroBodega(ordenados[0].ajusteConteo)
    : (ordenados[0].saldoFinal != null ? numeroBodega(ordenados[0].saldoFinal) : saldoInicial);
  let saldo = anclarPrimerCierre ? primerSaldoGuardado : saldoInicial;
  let saldoAnteriorGuardado = anclarPrimerCierre ? primerSaldoGuardado : saldoInicial;

  const reconstruidos = ordenados.map((movimiento, indice) => {
    const tieneDetalleRutas = Array.isArray(movimiento.repartos);
    const rutaCorrecta = tieneDetalleRutas
      ? rutaNetaBodega(movimiento.repartos)
      : numeroBodega(movimiento.rutaNeta);
    const impactoMalasRuta = (movimiento.repartos || []).reduce((total, reparto, indice) =>
      total + (malasPorRuta.get(claveRutaBodega(movimiento.id, idRutaBodega(movimiento, reparto, indice))) || 0), 0);
    const rutaCorrectaConMalas = rutaCorrecta + impactoMalasRuta;
    // El anclaje histórico se calcula con la lógica original; si incorporáramos
    // aquí la devolución nueva, el ajuste implícito podría neutralizar su efecto.
    const rutaAnterior = rutaNetaAnterior(movimiento.repartos, movimiento.rutaNeta);
    const deltaAnterior = cambioDiarioBodega(movimiento, rutaAnterior);
    const saldoProyectadoAnterior = saldoAnteriorGuardado + deltaAnterior;
    const conteoFisico = movimiento.ajusteConteo != null ? numeroBodega(movimiento.ajusteConteo) : null;
    const saldoGuardado = conteoFisico ?? (movimiento.saldoFinal != null ? numeroBodega(movimiento.saldoFinal) : null);
    const versionNueva = Number(movimiento.versionSaldoBodega) >= 2;
    const primeraAnclada = indice === 0 && anclarPrimerCierre;

    if (primeraAnclada) {
      const saldoFinal = saldoGuardado ?? saldoInicial;
      saldo = saldoFinal;
      saldoAnteriorGuardado = saldoGuardado ?? saldoFinal;
      return {
        ...movimiento,
        rutaNeta: redondearBodega(rutaCorrectaConMalas),
        versionSaldoBodega: 2,
        ajusteHistoricoImplicito: versionNueva ? numeroBodega(movimiento.ajusteHistoricoImplicito) : 0,
        saldoFinal,
      };
    }

    const ajusteHistoricoImplicito = versionNueva
      ? numeroBodega(movimiento.ajusteHistoricoImplicito)
      : (conteoFisico != null || saldoGuardado == null
        ? 0
        : redondearBodega(saldoGuardado - saldoProyectadoAnterior));
    const ajusteHistorico = Math.abs(ajusteHistoricoImplicito) < 0.05 ? 0 : ajusteHistoricoImplicito;
    const saldoCalculado = saldo + cambioDiarioBodega(movimiento, rutaCorrectaConMalas) + ajusteHistorico;
    const saldoFinal = conteoFisico ?? redondearBodega(saldoCalculado);

    saldo = saldoFinal;
    saldoAnteriorGuardado = saldoGuardado ?? redondearBodega(saldoProyectadoAnterior);

    return {
      ...movimiento,
      rutaNeta: redondearBodega(rutaCorrectaConMalas),
      versionSaldoBodega: 2,
      ajusteHistoricoImplicito: ajusteHistorico,
      saldoFinal,
      difAjuste: conteoFisico != null ? redondearBodega(conteoFisico - saldoCalculado) : null,
    };
  });

  return reconstruidos.reverse();
}
