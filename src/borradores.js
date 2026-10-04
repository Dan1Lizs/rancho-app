const texto = valor => String(valor ?? "").trim();
const camposMovimiento = ["comprado", "vendGranja", "destruido", "regalado"];
const pasosVacios = { salidas: false, devoluciones: false, conteo: false };

export function inventarioMPTieneDatos(items = {}) {
  return Object.values(items || {}).some(item =>
    [item?.sacos, item?.kg].some(valor => texto(valor) !== "")
  );
}

export function valoresFormularioBodega({
  movBodega = {}, repartos = [], obsInv = "", ajusteBodega = "", pasosBodega = pasosVacios,
} = {}) {
  return {
    movBodega: Object.fromEntries(camposMovimiento.map(campo => [campo, texto(movBodega?.[campo])])),
    repartos: (repartos || []).map(reparto => ({
      nombre: texto(reparto?.nombre),
      tiq: texto(reparto?.tiq),
      tiquetesDet: (reparto?.tiquetesDet || []).map(tiquete => ({
        num: texto(tiquete?.num), cartones: texto(tiquete?.cartones), peso: texto(tiquete?.peso),
      })),
      salida: texto(reparto?.salida),
      devBueno: texto(reparto?.devBueno),
      devMalo: texto(reparto?.devMalo),
    })),
    obsInv: texto(obsInv),
    ajusteBodega: texto(ajusteBodega),
    pasosBodega: Object.fromEntries(Object.keys(pasosVacios).map(paso => [paso, Boolean(pasosBodega?.[paso])])),
  };
}

export function formularioBodegaDesdeMovimiento(movimiento, repartidores = [], pasosBodega = pasosVacios) {
  const nombres = repartidores?.length ? repartidores : ["Andrés", "Bryan"];
  const repartosBase = movimiento?.repartos?.length
    ? movimiento.repartos
    : nombres.map(nombre => ({ nombre, salida: "", devBueno: "", devMalo: "" }));

  return valoresFormularioBodega({
    movBodega: Object.fromEntries(camposMovimiento.map(campo => [campo, movimiento?.[campo] || ""])),
    repartos: repartosBase,
    obsInv: movimiento?.obs || "",
    ajusteBodega: movimiento?.ajusteConteo == null ? "" : String(movimiento.ajusteConteo),
    pasosBodega,
  });
}

export function formulariosIguales(actual, base) {
  const normalizar = valor => {
    if (Array.isArray(valor)) return valor.map(normalizar);
    if (valor && typeof valor === "object") {
      return Object.fromEntries(Object.keys(valor).sort().map(clave => [clave, normalizar(valor[clave])]));
    }
    if (typeof valor === "number") return String(valor);
    return valor == null ? "" : valor;
  };
  return JSON.stringify(normalizar(actual)) === JSON.stringify(normalizar(base));
}

export function capturasDiferentesDeBase(capturas = {}, bases = {}) {
  return Object.fromEntries(Object.entries(capturas || {}).filter(([id, actual]) =>
    !formulariosIguales(actual, bases?.[id])
  ));
}
