export function kgNucleoEnFormula(formula, basculaDeIngrediente) {
  if (!formula || formula.uso === "Ganado") return 0;
  return Object.entries(formula.items || {}).reduce((total, [codigo, kg]) => (
    total + (basculaDeIngrediente(codigo) === 4 ? Number(kg || 0) : 0)
  ), 0);
}

export function nucleosDisponibles(formulas, basculaDeIngrediente) {
  return Object.entries(formulas || {})
    .filter(([, formula]) => kgNucleoEnFormula(formula, basculaDeIngrediente) > 0)
    .map(([nombre]) => nombre);
}

export function resolverNucleoFormula(nombreFormula, formulas, basculaDeIngrediente) {
  const formula = formulas?.[nombreFormula];
  if (!formula || formula.uso !== "Aves") return "";

  const disponibles = nucleosDisponibles(formulas, basculaDeIngrediente);
  if (Object.hasOwn(formula, "nucleo")) {
    return formula.nucleo === "" || disponibles.includes(formula.nucleo) ? formula.nucleo : "";
  }
  return disponibles.includes(nombreFormula) ? nombreFormula : "";
}
