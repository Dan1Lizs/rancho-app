const VISTAS_BASE_POR_ROL = {
  encargado: ["inicio", "reporte", "captura", "revision", "bodega", "planta", "pesaje", "insumos", "lotes", "pedidomp", "formulas", "historial", "preferencias"],
  bodega: ["inicio", "bodega", "reporte", "preferencias"],
  planta: ["inicio", "planta", "pedidomp", "formulas", "revision", "reporte", "preferencias"],
  bienestar: ["inicio", "pesaje", "reporte", "revision", "preferencias"],
  consulta: ["inicio", "reporte", "bodega", "planta", "pesaje", "insumos", "lotes", "pedidomp", "formulas", "preferencias"],
};

export const vistasPermitidas = (rol, todasLasVistas = []) => {
  if (rol === "admin") return [...todasLasVistas];
  return [...(VISTAS_BASE_POR_ROL[rol] || [])];
};

export const puedeAccederVista = (rol, vista, todasLasVistas = []) =>
  vistasPermitidas(rol, todasLasVistas).includes(vista);

export const resolverVistaSegura = (rol, vista, todasLasVistas = []) => {
  if (rol === "cargando") return vista;
  return puedeAccederVista(rol, vista, todasLasVistas) ? vista : "inicio";
};

