const clavesConError = new Set();

function emitir(nombre, detalle) {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined") return;
  window.dispatchEvent(new CustomEvent(nombre, { detail: detalle }));
}

export function registrarErrorLectura(key, error) {
  const clave = String(key || "desconocida");
  clavesConError.add(clave);
  emitir("granja:read-error", { key: clave, message: error?.message || "" });
}

export function registrarLecturaCorrecta(key) {
  const clave = String(key || "desconocida");
  clavesConError.delete(clave);
  emitir("granja:read-success", { key: clave });
}

export function lecturaBloqueada(key) {
  return clavesConError.has(String(key || ""));
}

export function lecturasConError() {
  return [...clavesConError];
}

export function registrarConflictoEscritura(key) {
  emitir("granja:write-conflict", { key: String(key || "desconocida") });
}

export function limpiarEstadoLecturasParaPruebas() {
  clavesConError.clear();
}
