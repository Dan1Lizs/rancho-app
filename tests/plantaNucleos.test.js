import test from "node:test";
import assert from "node:assert/strict";
import { kgNucleoEnFormula, nucleosDisponibles, resolverNucleoFormula } from "../src/plantaNucleos.js";

const bascula = codigo => ({ MP001: 1, MP048: 4, MP049: 4 }[codigo] || 4);

test("una fórmula de Impulsor 651 usa por defecto su propio núcleo, no el de Impulsor", () => {
  const formulas = {
    Impulsor: { uso: "Aves", items: { MP048: 5 } },
    "651 Impulsor VYMISA": { uso: "Aves", items: { MP049: 7 } },
  };

  assert.deepEqual(nucleosDisponibles(formulas, bascula), ["Impulsor", "651 Impulsor VYMISA"]);
  assert.equal(kgNucleoEnFormula(formulas["651 Impulsor VYMISA"], bascula), 7);
  assert.equal(resolverNucleoFormula("651 Impulsor VYMISA", formulas, bascula), "651 Impulsor VYMISA");
});

test("una fórmula permite elegir otro núcleo o indicar que no lleva núcleo", () => {
  const formulas = {
    Impulsor: { uso: "Aves", items: { MP048: 5 } },
    "651 Impulsor VYMISA": { uso: "Aves", nucleo: "Impulsor", items: { MP049: 7 } },
    Desarrollo: { uso: "Ganado", items: { MP048: 3 } },
    "Sin premezcla": { uso: "Aves", nucleo: "", items: { MP001: 10 } },
  };

  assert.equal(resolverNucleoFormula("651 Impulsor VYMISA", formulas, bascula), "Impulsor");
  assert.equal(resolverNucleoFormula("Desarrollo", formulas, bascula), "");
  assert.equal(resolverNucleoFormula("Sin premezcla", formulas, bascula), "");
});
