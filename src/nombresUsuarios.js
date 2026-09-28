export function nombreVisible(valor, directorio = {}) {
  const texto = String(valor || "").trim();
  return directorio[texto.toLowerCase()]?.trim() || texto || "Sin indicar";
}
