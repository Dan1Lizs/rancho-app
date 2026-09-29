const VISTAS_BASE_POR_ROL = {
  encargado: ["inicio", "reporte", "captura", "revision", "bodega", "planta", "pesaje", "insumos", "lotes", "pedidomp", "formulas", "historial"],
  bodega: ["inicio", "bodega", "reporte"],
  planta: ["inicio", "planta", "pedidomp", "formulas", "revision", "reporte"],
  bienestar: ["inicio", "pesaje", "reporte", "revision"],
  consulta: ["inicio", "reporte", "bodega", "planta", "pesaje", "insumos", "lotes", "pedidomp", "formulas"],
};

export const vistasPermitidas = (rol, todasLasVistas = []) => {
  if (rol === "admin") return [...todasLasVistas];
  return [...(VISTAS_BASE_POR_ROL[rol] || [])];
};

export const puedeAccederVista = (rol, vista, todasLasVistas = []) =>
  vistasPermitidas(rol, todasLasVistas).includes(vista);

