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
  const { id, fecha, producido, comprado, vendGranja, destruido, regalado, repartos, rutaNeta, obs, saldoFinal, ajusteConteo, difAjuste, cierreVerificado, versionSaldoBodega, ajusteHistoricoImplicito } = m;
  return { id, fecha, producido, comprado, vendGranja, destruido, regalado, repartos, rutaNeta, obs, saldoFinal, ajusteConteo, difAjuste, cierreVerificado, versionSaldoBodega, ajusteHistoricoImplicito };
}

export function elegirMovimientoBodega(actuales, fechaISO, id = null) {
  const delDia = actuales.filter(m => fechaHistorialISO(m.fecha) === fechaISO);
  const elegido = id != null ? delDia.find(m => String(m.id) === String(id)) : delDia[0];
  return { delDia, elegido, id: elegido?.id ?? `bodega-${fechaISO}` };
}

export function movimientoBodegaParaReporte(movs, id = null) {
  return id == null ? movs[0] : movs.find(m => String(m.id) === String(id));
}

const numeroBodega = (valor) => Number.isFinite(Number(valor)) ? Number(valor) : 0;
const redondearBodega = (valor) => Number(numeroBodega(valor).toFixed(1));

export function rutaNetaBodega(repartos = []) {
  return (Array.isArray(repartos) ? repartos : []).reduce((suma, reparto) =>
    suma + numeroBodega(reparto.salida) - numeroBodega(reparto.devBueno) + numeroBodega(reparto.devMalo), 0);
}

function rutaNetaAnterior(repartos, rutaNetaGuardada) {
  if (!Array.isArray(repartos)) return numeroBodega(rutaNetaGuardada);
  return repartos.reduce((suma, reparto) =>
    suma + numeroBodega(reparto.salida) - numeroBodega(reparto.devBueno) - numeroBodega(reparto.devMalo), 0);
}

function cambioDiarioBodega(movimiento, rutaNeta) {
  return numeroBodega(movimiento.producido) + numeroBodega(movimiento.comprado) - rutaNeta
    - numeroBodega(movimiento.vendGranja) - numeroBodega(movimiento.destruido) - numeroBodega(movimiento.regalado);
}

export function reconstruirBodega(movs, inicialCart, apertura) {
  const ordenados = [...movs].sort((a, b) =>
    fechaHistorialISO(a.fecha).localeCompare(fechaHistorialISO(b.fecha)) || String(a.id || "").localeCompare(String(b.id || "")));
  if (!ordenados.length) return [];

  const aperturaISO = fechaHistorialISO(apertura);
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
        rutaNeta: redondearBodega(rutaCorrecta),
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
    const saldoCalculado = saldo + cambioDiarioBodega(movimiento, rutaCorrecta) + ajusteHistorico;
    const saldoFinal = conteoFisico ?? redondearBodega(saldoCalculado);

    saldo = saldoFinal;
    saldoAnteriorGuardado = saldoGuardado ?? redondearBodega(saldoProyectadoAnterior);

    return {
      ...movimiento,
      rutaNeta: redondearBodega(rutaCorrecta),
      versionSaldoBodega: 2,
      ajusteHistoricoImplicito: ajusteHistorico,
      saldoFinal,
      difAjuste: conteoFisico != null ? redondearBodega(conteoFisico - saldoCalculado) : null,
    };
  });

  return reconstruidos.reverse();
}
