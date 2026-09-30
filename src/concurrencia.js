export function registroCambioDesdeBase(base, actual) {
  return JSON.stringify(base || null) !== JSON.stringify(actual || null);
}

export function baseDeRegistro(registros, fecha, loteId) {
  const encontrado = registros.find((registro) => registro.fecha === fecha && registro.lote === loteId);
  return encontrado ? JSON.parse(JSON.stringify(encontrado)) : null;
}
