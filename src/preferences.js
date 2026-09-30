export const DEFAULT_PREFERENCES = Object.freeze({
  pantallaInicio: "inicio",
  densidad: "comoda",
  tamanoTexto: "normal",
  favoritos: ["captura", "reporte", "bodega", "pesaje"],
  ordenNavegacion: [],
  tema: "claro",
  notificaciones: {
    faltantesDiarios: true,
    inventarioBajo: true,
    bienestar: true,
    cuentasPorPagar: false,
  },
  confirmaciones: {
    correcciones: true,
    reemplazos: true,
  },
  formatoNumeros: {
    separadorMiles: true,
    decimales: "automaticos",
  },
  borradores: {
    autoguardado: true,
    intervaloSegundos: 5,
    almacenamiento: "local",
    recuperarAutomaticamente: false,
  },
});

const elegir = (valor, permitidos, fallback) => permitidos.includes(valor) ? valor : fallback;

export function normalizarPreferencias(valor = {}) {
  const p = valor && typeof valor === "object" ? valor : {};
  return {
    ...DEFAULT_PREFERENCES,
    ...p,
    pantallaInicio: typeof p.pantallaInicio === "string" ? p.pantallaInicio : DEFAULT_PREFERENCES.pantallaInicio,
    densidad: elegir(p.densidad, ["compacta", "comoda", "campo"], DEFAULT_PREFERENCES.densidad),
    tamanoTexto: elegir(p.tamanoTexto, ["pequeno", "normal", "grande"], DEFAULT_PREFERENCES.tamanoTexto),
    favoritos: Array.isArray(p.favoritos) ? [...new Set(p.favoritos.filter(x => typeof x === "string"))] : [...DEFAULT_PREFERENCES.favoritos],
    ordenNavegacion: Array.isArray(p.ordenNavegacion) ? [...new Set(p.ordenNavegacion.filter(x => typeof x === "string"))] : [],
    tema: elegir(p.tema, ["claro", "oscuro", "automatico", "contraste"], DEFAULT_PREFERENCES.tema),
    notificaciones: { ...DEFAULT_PREFERENCES.notificaciones, ...(p.notificaciones || {}) },
    confirmaciones: { ...DEFAULT_PREFERENCES.confirmaciones, ...(p.confirmaciones || {}) },
    formatoNumeros: { ...DEFAULT_PREFERENCES.formatoNumeros, ...(p.formatoNumeros || {}) },
    borradores: {
      ...DEFAULT_PREFERENCES.borradores,
      ...(p.borradores || {}),
      intervaloSegundos: Math.min(60, Math.max(2, Number(p.borradores?.intervaloSegundos || DEFAULT_PREFERENCES.borradores.intervaloSegundos))),
      almacenamiento: elegir(p.borradores?.almacenamiento, ["local", "nube"], DEFAULT_PREFERENCES.borradores.almacenamiento),
    },
  };
}

export function ordenarPorPreferencia(items, orden = []) {
  const posiciones = new Map(orden.map((id, indice) => [id, indice]));
  return [...items].sort((a, b) => {
    const pa = posiciones.has(a.id) ? posiciones.get(a.id) : Number.MAX_SAFE_INTEGER;
    const pb = posiciones.has(b.id) ? posiciones.get(b.id) : Number.MAX_SAFE_INTEGER;
    return pa - pb;
  });
}

export function completarOrdenNavegacion(items, orden = []) {
  const ids = new Set(items.map(item => item.id));
  return [...new Set([...(Array.isArray(orden) ? orden : []).filter(id => ids.has(id)), ...items.map(item => item.id)])];
}

