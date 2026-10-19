export function analizarRuta(hash) {
  const crudo = String(hash || "").replace(/^#\/?/, "");
  if (!crudo) return null;
  const indice = crudo.indexOf("?");
  const vista = indice < 0 ? crudo : crudo.slice(0, indice);
  if (!vista) return null;
  return { vista, params: new URLSearchParams(indice < 0 ? "" : crudo.slice(indice + 1)) };
}

export function serializarRuta(vista, valores = {}) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(valores)) {
    if (valor !== undefined && valor !== null && String(valor) !== "") params.set(clave, String(valor));
  }
  const consulta = params.toString();
  return `#${vista}${consulta ? `?${consulta}` : ""}`;
}
