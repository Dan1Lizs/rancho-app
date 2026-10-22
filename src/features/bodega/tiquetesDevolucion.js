export function claveTiquete(valor) {
  return String(valor ?? "").trim().toLocaleLowerCase("es");
}

export function numeroCartones(valor) {
  const numero = Number(String(valor ?? "").trim().replace(",", "."));
  return Number.isFinite(numero) ? numero : NaN;
}

export function esCantidadMediaCarton(valor) {
  const numero = numeroCartones(valor);
  return Number.isFinite(numero) && Math.abs(numero * 2 - Math.round(numero * 2)) < 0.000001;
}

export function formatoCartones(valor, defecto = "—") {
  const numero = numeroCartones(valor);
  if (valor == null || valor === "" || !Number.isFinite(numero)) return defecto;
  const medio = Math.round((numero + Number.EPSILON) * 2) / 2;
  if (Math.abs(numero - medio) < 0.000001) return String(medio);
  return (Math.round((numero + Number.EPSILON) * 100) / 100).toString();
}

export function fechaISODeTiquete(fecha) {
  const valor = String(fecha ?? "").trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(valor);
  return dmy ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` : "";
}

export function idOperacionTiquete() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, caracter => {
    const aleatorio = Math.floor(Math.random() * 16);
    return (caracter === "x" ? aleatorio : (aleatorio & 0x3) | 0x8).toString(16);
  });
}

export function impactoTiquetesEnFecha(movimientos = [], fecha, operacionesExcluidas = []) {
  const claveFecha = fechaISODeTiquete(fecha);
  const excluidas = new Set((operacionesExcluidas || []).map(String));
  return (Array.isArray(movimientos) ? movimientos : []).reduce((total, movimiento) => {
    const fechaMovimiento = fechaISODeTiquete(movimiento.fecha);
    if (fechaMovimiento !== claveFecha || excluidas.has(String(movimiento.operacion_id ?? movimiento.operacionId ?? ""))) return total;
    return total + Number(movimiento.cartones_delta ?? movimiento.cartonesDelta ?? 0);
  }, 0);
}

export function cartonesUsoEnRuta(reparto) {
  return (Array.isArray(reparto?.tiquetesDevueltos) ? reparto.tiquetesDevueltos : [])
    .reduce((total, uso) => total + numeroCartones(uso.cartones || 0), 0);
}

export function cartonesUsadosTiquete(tiquete, movimientos = []) {
  const id = String(tiquete?.id ?? "");
  return (Array.isArray(movimientos) ? movimientos : []).reduce((total, movimiento) => {
    if (String(movimiento.tiquete_id ?? movimiento.tiqueteId ?? "") !== id || movimiento.tipo !== "uso") return total;
    return total + Math.abs(Number(movimiento.cartones_delta ?? movimiento.cartonesDelta ?? 0));
  }, 0);
}

export function buscarTiqueteDevuelto(tiquetes = [], numero) {
  const clave = claveTiquete(numero);
  if (!clave) return null;
  return (Array.isArray(tiquetes) ? tiquetes : []).find(t => claveTiquete(t.numero) === clave) || null;
}

export function validarUsoTiquete({ tiquetes = [], numero, cartones }) {
  const tiquete = buscarTiqueteDevuelto(tiquetes, numero);
  if (!tiquete) return { ok: false, motivo: "no-encontrado", tiquete: null, disponible: 0 };
  const disponible = Number(tiquete.saldo_cartones ?? tiquete.saldoCartones ?? 0);
  const cantidad = numeroCartones(cartones);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { ok: false, motivo: "cantidad-invalida", tiquete, disponible };
  }
  if (!esCantidadMediaCarton(cantidad)) {
    return { ok: false, motivo: "cantidad-invalida", tiquete, disponible };
  }
  if (cantidad > disponible + 0.000001) {
    return { ok: false, motivo: "saldo-insuficiente", tiquete, disponible };
  }
  return { ok: true, motivo: "", tiquete, disponible };
}

// El saldo de la tabla refleja usos confirmados. Si una ruta ya se guardó pero
// la llamada RPC quedó pendiente, reservamos esos cartones para que otra ruta
// no pueda volver a seleccionarlos mientras se reintenta la sincronización.
export function saldoDisponibleTiquete(tiquete, movimientosTiquetes = [], movimientosBodega = [], excluirMovimientoId = "") {
  const id = String(tiquete?.id ?? "");
  const usosConfirmados = new Set((Array.isArray(movimientosTiquetes) ? movimientosTiquetes : [])
    .filter(movimiento => movimiento.tipo === "uso")
    .map(movimiento => String(movimiento.operacion_id ?? movimiento.operacionId ?? movimiento.id ?? "")));
  const pendientes = (Array.isArray(movimientosBodega) ? movimientosBodega : [])
    .filter(movimiento => String(movimiento.id ?? "") !== String(excluirMovimientoId ?? ""))
    .flatMap(movimiento => (movimiento.repartos || []).flatMap(reparto => reparto.tiquetesDevueltos || []))
    .filter(uso => String(uso.tiqueteId ?? uso.tiquete_id ?? "") === id
      && !usosConfirmados.has(String(uso.operacionId ?? uso.operacion_id ?? "")));
  const reservado = pendientes.reduce((total, uso) => {
    const cantidad = numeroCartones(uso.cartones);
    return total + (Number.isFinite(cantidad) ? Math.max(0, cantidad) : 0);
  }, 0);
  const saldo = numeroCartones(tiquete?.saldo_cartones ?? tiquete?.saldoCartones);
  return Number.isFinite(saldo) ? Math.max(0, saldo - reservado) : 0;
}

export function idRepartoBodega(movimientoId, reparto, indice = 0) {
  return String(reparto?.id || `legacy:${movimientoId || "sin-movimiento"}:${indice}`);
}

export function asociarUsosDeTiquetesARepartos(movimientoId, repartos = [], movimientos = []) {
  const movimiento = String(movimientoId ?? "");
  return (Array.isArray(repartos) ? repartos : []).map((reparto, indice) => {
    const rutaId = idRepartoBodega(movimiento, reparto, indice);
    const usos = (Array.isArray(movimientos) ? movimientos : [])
      .filter(item => item.tipo === "uso"
        && String(item.ruta_mov_id ?? item.rutaMovId ?? "") === movimiento
        && String(item.ruta_id ?? item.rutaId ?? "") === rutaId)
      .map(item => ({
        operacionId: String(item.operacion_id ?? item.operacionId ?? item.id ?? ""),
        tiqueteId: String(item.tiquete_id ?? item.tiqueteId ?? ""),
        numero: String(item.numero || ""),
        cartones: Math.abs(numeroCartones(item.cartones_delta ?? item.cartonesDelta ?? 0)),
        fecha: item.fecha,
      }));
    if (!usos.length) return reparto;
    const unicos = new Map((Array.isArray(reparto.tiquetesDevueltos) ? reparto.tiquetesDevueltos : [])
      .map(uso => [String(uso.operacionId ?? uso.operacion_id ?? ""), uso]));
    usos.forEach(uso => unicos.set(uso.operacionId, uso));
    return { ...reparto, id: rutaId, tiquetesDevueltos: [...unicos.values()] };
  });
}

export function rutasBodegaParaTiquetes(movimientos = []) {
  const rutas = [];
  for (const movimiento of Array.isArray(movimientos) ? movimientos : []) {
    const fecha = fechaISODeTiquete(movimiento.fecha);
    (movimiento.repartos || []).forEach((reparto, indice) => {
      const tieneSalida = Number(reparto.salida || 0) > 0 || (reparto.tiquetesDet || []).length > 0
        || cartonesUsoEnRuta(reparto) > 0;
      if (!fecha || !tieneSalida) return;
      rutas.push({
        movimientoId: String(movimiento.id ?? ""),
        rutaId: idRepartoBodega(movimiento.id, reparto, indice),
        fecha,
        repartidor: String(reparto.nombre || "Repartidor"),
        salidaBase: Number(reparto.salida || 0),
        salida: Number(reparto.salida || 0) + cartonesUsoEnRuta(reparto),
        cartonesReutilizados: cartonesUsoEnRuta(reparto),
      });
    });
  }
  return rutas;
}

export function ultimasRutasElegibles(rutas = [], fechaSeleccionada, limite = 4) {
  const corte = fechaISODeTiquete(fechaSeleccionada);
  if (!corte) return [];
  return (Array.isArray(rutas) ? rutas : [])
    .filter(ruta => {
      const fecha = fechaISODeTiquete(ruta.fecha);
      return fecha && fecha <= corte;
    })
    .sort((a, b) => fechaISODeTiquete(b.fecha).localeCompare(fechaISODeTiquete(a.fecha))
      || String(a.repartidor || "").localeCompare(String(b.repartidor || ""), "es"))
    .slice(0, Math.max(0, Number(limite) || 0));
}
