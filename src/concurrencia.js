const mismoValor = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function decidirCambioColeccion({ base, remoto, nuevo }) {
  const existeBase = base != null;
  const existeRemoto = remoto != null;
  if (existeBase && mismoValor(nuevo, base)) return "sin-cambio";
  if (existeRemoto && mismoValor(nuevo, remoto)) return "sin-cambio";
  if (!existeBase) return existeRemoto ? "conflicto" : "insertar";
  if (!existeRemoto) return "conflicto";
  return mismoValor(base, remoto) ? "actualizar" : "conflicto";
}

export function decidirEliminacionColeccion({ base, remoto }) {
  if (remoto == null) return "ya-eliminado";
  return mismoValor(base, remoto) ? "eliminar" : "conflicto";
}

export function registroCambioDesdeBase(base, actual) {
  return JSON.stringify(base || null) !== JSON.stringify(actual || null);
}

export function baseDeRegistro(registros, fecha, loteId) {
  const encontrado = registros.find((registro) => registro.fecha === fecha && registro.lote === loteId);
  return encontrado ? JSON.parse(JSON.stringify(encontrado)) : null;
}
