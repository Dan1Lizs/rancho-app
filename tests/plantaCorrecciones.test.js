import test from "node:test";
import assert from "node:assert/strict";
import { correccionesInventarioPlanta } from "../src/plantaCorrecciones.js";

const recetas = {
  formulas: {
    "Aves A": { items: { MAIZ: 10, MICRO: 0.5 } },
    "Aves B": { items: { MAIZ: 12, MICRO: 0.25 } },
    "Ganado C": { items: { SOYA: 8, MICRO: 0.3 } },
  },
};
const usoFormula = nombre => nombre.startsWith("Ganado") ? "Ganado" : "Aves";
const basculaDe = codigo => codigo === "MICRO" ? 4 : 1;
const kgNucleoDe = nombre => recetas.formulas[nombre]?.items?.MICRO || 0;
const deps = { recetas, usoFormula, basculaDe, kgNucleoDe };

test("corregir un bache revierte la receta anterior, aplica la nueva y ajusta el núcleo", () => {
  const anterior = {
    id: "bache-1", tipo: "bache", fecha: "01/10/2026", formula: "Aves A",
    nucleoFormula: "Aves A", baches: 2, kg: 1380, numBache: "A",
    componentesReceta: { MAIZ: 10, MICRO: 0.5 },
  };
  const nuevo = {
    ...anterior, fecha: "02/10/2026", formula: "Ganado C", categoria: "Ganado",
    nucleoFormula: "", baches: 3, numBache: "B",
    componentesReceta: { SOYA: 8, MICRO: 0.3 },
  };
  const resultado = correccionesInventarioPlanta({ anterior, nuevo, ...deps });
  assert.deepEqual(resultado.kardex.map(m => [m.fecha, m.mp, m.tipo, m.kg]), [
    ["01/10/2026", "MAIZ", "entrada", 20],
    ["02/10/2026", "SOYA", "salida", 24],
    ["02/10/2026", "MICRO", "salida", 0.9],
  ]);
  assert.deepEqual(resultado.nucleoDelta, { "Aves A": 2 });
});

test("cambiar solo los kilos producidos no duplica las salidas de materias primas", () => {
  const anterior = { tipo: "bache", fecha: "01/10/2026", formula: "Aves A", nucleoFormula: "Aves A", baches: 2, kg: 1380, numBache: "A", componentesReceta: { MAIZ: 10, MICRO: 0.5 } };
  const nuevo = { ...anterior, kg: 1400 };
  assert.deepEqual(correccionesInventarioPlanta({ anterior, nuevo, ...deps }), { kardex: [], nucleoDelta: {} });
});

test("corregir una producción de núcleo revierte las porciones y materias primas de ambas fórmulas", () => {
  const anterior = { tipo: "nucleo", fecha: "01/10/2026", formula: "Aves A", porciones: 4, numNucleo: "1", componentesReceta: { MAIZ: 10, MICRO: 0.5 } };
  const nuevo = { ...anterior, fecha: "02/10/2026", formula: "Aves B", porciones: 6, numNucleo: "2", componentesReceta: { MAIZ: 12, MICRO: 0.25 } };
  const resultado = correccionesInventarioPlanta({ anterior, nuevo, ...deps });
  assert.deepEqual(resultado.kardex.map(m => [m.fecha, m.mp, m.tipo, m.kg]), [
    ["01/10/2026", "MICRO", "entrada", 2],
    ["02/10/2026", "MICRO", "salida", 1.5],
  ]);
  assert.deepEqual(resultado.nucleoDelta, { "Aves A": -4, "Aves B": 6 });
});
