// Crea movimientos compensatorios cuando se corrige un movimiento de planta
// que afecta materias primas o el inventario actual de núcleos.
const nuevaId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;

function itemsReceta(movimiento, recetas) {
  const guardados = movimiento.componentesReceta;
  if (guardados && typeof guardados === "object" && Object.keys(guardados).length) return guardados;
  return recetas.formulas[movimiento.formula]?.items || null;
}

function nombreMovimiento(movimiento, tipo) {
  const cantidad = tipo === "bache" ? Number(movimiento.baches || 0) : Number(movimiento.porciones || 0);
  const etiqueta = tipo === "bache" ? "bache" : "núcleo";
  const numeroRegistro = tipo === "bache" ? movimiento.numBache : movimiento.numNucleo;
  return `${etiqueta} ${movimiento.formula || "sin fórmula"} ×${cantidad}${numeroRegistro ? ` #${numeroRegistro}` : ""}`;
}

function componentesAfectados(movimiento, tipo, { recetas, basculaDe, kgNucleoDe, usoFormula }) {
  const cantidad = numero(tipo === "bache" ? movimiento.baches : movimiento.porciones);
  if (cantidad <= 0) return [];
  const items = itemsReceta(movimiento, recetas);
  if (!items) throw new Error(`No se encontró la receta de ${movimiento.formula || "este movimiento"}; no se puede compensar el kardex con seguridad.`);
  const nucleo = tipo === "bache"
    ? (Object.hasOwn(movimiento, "nucleoFormula")
      ? movimiento.nucleoFormula
      : (kgNucleoDe(movimiento.formula) > 0 ? movimiento.formula : ""))
    : "";
  const usaNucleo = tipo === "bache" && usoFormula(movimiento.formula) === "Aves" && nucleo && kgNucleoDe(nucleo) > 0;
  return Object.entries(items)
    .filter(([codigo, kg]) => Number(kg) > 0 && (tipo === "bache"
      ? (!usaNucleo || basculaDe(codigo) !== 4)
      : basculaDe(codigo) === 4))
    .map(([mp, kg]) => ({
      mp,
      kg: +(Number(kg) * cantidad).toFixed(tipo === "bache" ? 2 : 3),
    }));
}

export function correccionesInventarioPlanta({ anterior, nuevo, recetas, basculaDe, kgNucleoDe, usoFormula }) {
  const tipo = anterior.tipo || "bache";
  if (tipo !== "bache" && tipo !== "nucleo") return { kardex: [], nucleoDelta: {} };

  const claveNucleo = movimiento => tipo === "bache"
    ? (Object.hasOwn(movimiento, "nucleoFormula")
      ? movimiento.nucleoFormula
      : (kgNucleoDe(movimiento.formula) > 0 ? movimiento.formula : ""))
    : movimiento.formula;
  const cantidad = movimiento => numero(tipo === "bache" ? movimiento.baches : movimiento.porciones);
  const cambioConEfecto = ["formula", "fecha", "baches", "porciones", "nucleoFormula", "numBache", "numNucleo"]
    .some(campo => String(anterior[campo] ?? "") !== String(nuevo[campo] ?? ""));
  if (!cambioConEfecto) return { kardex: [], nucleoDelta: {} };

  const anteriores = componentesAfectados(anterior, tipo, { recetas, basculaDe, kgNucleoDe, usoFormula });
  const nuevos = componentesAfectados(nuevo, tipo, { recetas, basculaDe, kgNucleoDe, usoFormula });
  const etiquetaAnterior = nombreMovimiento(anterior, tipo);
  const etiquetaNueva = nombreMovimiento(nuevo, tipo);
  const kardex = [
    ...anteriores.map(item => ({
      id: nuevaId(), fecha: anterior.fecha, mp: item.mp, tipo: "entrada", kg: item.kg,
      ref: `Corrección de planta · reversa ${etiquetaAnterior}`,
    })),
    ...nuevos.map(item => ({
      id: nuevaId(), fecha: nuevo.fecha, mp: item.mp, tipo: "salida", kg: item.kg,
      ref: `Corrección de planta · aplica ${etiquetaNueva}`,
    })),
  ];

  const nucleoDelta = {};
  const sumarNucleo = (formula, delta) => {
    if (formula && delta) nucleoDelta[formula] = +(numero(nucleoDelta[formula]) + delta).toFixed(2);
  };
  if (tipo === "bache") {
    const nucleoAnterior = claveNucleo(anterior);
    const nucleoNuevo = claveNucleo(nuevo);
    if (nucleoAnterior && kgNucleoDe(nucleoAnterior) > 0 && usoFormula(anterior.formula) === "Aves") sumarNucleo(nucleoAnterior, cantidad(anterior));
    if (nucleoNuevo && kgNucleoDe(nucleoNuevo) > 0 && usoFormula(nuevo.formula) === "Aves") sumarNucleo(nucleoNuevo, -cantidad(nuevo));
  } else {
    sumarNucleo(anterior.formula, -cantidad(anterior));
    sumarNucleo(nuevo.formula, cantidad(nuevo));
  }
  Object.entries(nucleoDelta).forEach(([formula, delta]) => { if (Math.abs(delta) < 0.005) delete nucleoDelta[formula]; });
  return { kardex, nucleoDelta };
}
