import { loteEnLevante, loteExistiaEnFecha } from "../../etapaProductiva.js";

const tieneValor = (valor) => valor !== "" && valor !== null && valor !== undefined;

export function capturaTieneDatosOperativos(captura = {}, tieneProduccion = false) {
  const hayChequeo = Object.values(captura.chequeo || {}).some(tieneValor);
  const hayTrabajo = Object.values(captura.trabajos || {}).some(Boolean);
  const hayTratamiento = ["meds", "vits", "fums"].some(tipo =>
    (captura[tipo] || []).some(item => String(item?.producto || "").trim()),
  );
  return Boolean(tieneProduccion
    || tieneValor(captura.quebrados)
    || tieneValor(captura.muertas)
    || tieneValor(captura.alimento6am)
    || tieneValor(captura.alimento1pm)
    || tieneValor(captura.aguaL)
    || String(captura.dx || "").trim()
    || String(captura.obsAlimento || "").trim()
    || hayChequeo
    || hayTrabajo
    || hayTratamiento);
}

export function evaluarEstadoCaptura({ lote, registro, captura = {}, fecha }) {
  if (!loteExistiaEnFecha(lote, fecha)) {
    return { lote, prod: "no_aplica", alim: "no_aplica", mort: "no_aplica", agua: "no_aplica", completo: true, parcial: false, regGuardado: null };
  }
  const cartones = (captura.tiquetes || []).reduce((total, tiquete) => total + Number(tiquete.cartones || 0), 0);
  const alimento = Number(captura.alimento6am || 0) + Number(captura.alimento1pm || 0);
  const chequeoBorrador = Object.values(captura.chequeo || {}).some(tieneValor);
  const chequeoGuardado = Object.values(registro?.chequeo || {}).some(tieneValor);

  const produccionAplica = !loteEnLevante(lote, fecha);
  const produccion = !produccionAplica ? "no_aplica" : registro ? "guardado" : cartones > 0 ? "borrador" : "pendiente";
  const alimentacion = registro && Number(registro.alimentoKg || 0) > 0
    ? "guardado"
    : alimento > 0 ? "borrador" : "pendiente";
  const mortalidad = registro && tieneValor(registro.muertas)
    ? "guardado"
    : tieneValor(captura.muertas) ? "borrador" : "pendiente";
  const agua = registro && (tieneValor(registro.aguaL) || chequeoGuardado)
    ? "guardado"
    : (tieneValor(captura.aguaL) || chequeoBorrador) ? "borrador" : "pendiente";

  const estados = [produccion, alimentacion, mortalidad, agua].filter(estado => estado !== "no_aplica");
  return {
    lote,
    prod: produccion,
    alim: alimentacion,
    mort: mortalidad,
    agua,
    completo: estados.every((estado) => estado === "guardado"),
    parcial: estados.some((estado) => estado !== "pendiente") && !estados.every((estado) => estado === "guardado"),
    regGuardado: registro || null,
  };
}

export function estadosCapturaDelDia({ lotes, registros, capturas, fecha }) {
  return (lotes || []).filter(lote => loteExistiaEnFecha(lote, fecha)).map((lote) => evaluarEstadoCaptura({
    lote,
    registro: (registros || []).find((item) => item.fecha === fecha && item.lote === lote.id),
    captura: capturas?.[lote.id] || {},
    fecha,
  }));
}
