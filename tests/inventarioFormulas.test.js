import test from "node:test";
import assert from "node:assert/strict";
import { saldosFormulasDesdeConteo } from "../src/inventarioFormulas.js";

test("el conteo distribuye el total y posteriores movimientos conservan la fórmula", () => {
  const movimientos = [
    { tipo: "ajuste", categoria: "Ganado", fecha: "28/09/2026", registradoEl: "2026-09-28T15:00:00Z", conteosFormula: { Desarrollo: 120, Engorde: 80 } },
    { tipo: "bache", categoria: "Ganado", formula: "Desarrollo", fecha: "28/09/2026", registradoEl: "2026-09-28T16:00:00Z", kg: 50 },
    { tipo: "servido", categoria: "Ganado", formula: "Engorde", fecha: "29/09/2026", registradoEl: "2026-09-29T13:00:00Z", kg: 12 },
    { tipo: "servido", categoria: "Ganado", formula: "Desarrollo", fecha: "28/09/2026", registradoEl: "2026-09-28T14:00:00Z", kg: 20 },
  ];
  assert.deepEqual(saldosFormulasDesdeConteo("Ganado", ["Desarrollo", "Engorde"], movimientos, []), { Desarrollo: 170, Engorde: 68 });
});

test("el servido de aves posterior al conteo se descuenta solo de su fórmula", () => {
  const movimientos = [{ tipo: "ajuste", categoria: "Aves", fecha: "28/09/2026", registradoEl: "2026-09-28T15:00:00Z", conteosFormula: { Impulsor: 500, Postura: 200 } }];
  const registros = [
    { fecha: "28/09/2026", registradoEl: "2026-09-28T16:00:00Z", formulaConcentrado: "Postura", alimentoKg: 30 },
    { fecha: "28/09/2026", registradoEl: "2026-09-28T14:00:00Z", formulaConcentrado: "Impulsor", alimentoKg: 40 },
  ];
  assert.deepEqual(saldosFormulasDesdeConteo("Aves", ["Impulsor", "Postura"], movimientos, registros), { Impulsor: 500, Postura: 170 });
});
