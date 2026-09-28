export function nombreVisible(valor, directorio = {}) {
  const texto = String(valor || "").trim();
  return directorio[texto.toLowerCase()]?.trim() || texto || "Sin indicar";
}

export function nombreResponsableSesion(email, directorio = {}, nombrePerfil = "") {
  const correo = String(email || "").trim();
  return directorio[correo.toLowerCase()]?.trim() || String(nombrePerfil || "").trim() || correo;
}
