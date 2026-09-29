const tieneValor = (valor) => valor !== "" && valor !== null && valor !== undefined;

export function evaluarEstadoCaptura({ lote, registro, captura = {} }) {
  const cartones = (captura.tiquetes || []).reduce((total, tiquete) => total + Number(tiquete.cartones || 0), 0);
  const alimento = Number(captura.alimento6am || 0) + Number(captura.alimento1pm || 0);
  const chequeoBorrador = Object.values(captura.chequeo || {}).some(tieneValor);
  const chequeoGuardado = Object.values(registro?.chequeo || {}).some(tieneValor);

  const produccion = registro ? "guardado" : cartones > 0 ? "borrador" : "pendiente";
  const alimentacion = registro && Number(registro.alimentoKg || 0) > 0
    ? "guardado"
    : alimento > 0 ? "borrador" : "pendiente";
  const mortalidad = registro && tieneValor(registro.muertas)
    ? "guardado"
    : tieneValor(captura.muertas) ? "borrador" : "pendiente";
  const agua = registro && (tieneValor(registro.aguaL) || chequeoGuardado)
    ? "guardado"
    : (tieneValor(captura.aguaL) || chequeoBorrador) ? "borrador" : "pendiente";

  const estados = [produccion, alimentacion, mortalidad, agua];
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
  return (lotes || []).map((lote) => evaluarEstadoCaptura({
    lote,
    registro: (registros || []).find((item) => item.fecha === fecha && item.lote === lote.id),
    captura: capturas?.[lote.id] || {},
  }));
}
