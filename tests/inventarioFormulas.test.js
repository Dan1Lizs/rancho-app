import test from "node:test";
import assert from "node:assert/strict";
import { saldosFormulasDesdeConteo, deltaConteoFormula, calcularSaldoPlantaCategoria } from "../src/inventarioFormulas.js";

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

test("contar una fórmula distribuye el saldo sin inflarlo y la última concilia el total", () => {
  const formulas = ["Impulsor", "Postura"];
  assert.equal(deltaConteoFormula(500, null, "Impulsor", 100, formulas), 0);
  assert.equal(deltaConteoFormula(500, { Impulsor: 100, Postura: null }, "Postura", 150, formulas), -250);
  assert.equal(deltaConteoFormula(250, { Impulsor: 100, Postura: 150 }, "Impulsor", 120, formulas), 20);
});

test("un conteo individual no inventa valores para otras fórmulas", () => {
  const movimientos = [{ tipo: "ajuste", categoria: "Ganado", formula: "Desarrollo", fecha: "28/09/2026", registradoEl: "2026-09-28T15:00:00Z", conteosFormula: { Desarrollo: 120 } }];
  assert.deepEqual(saldosFormulasDesdeConteo("Ganado", ["Desarrollo", "Engorde"], movimientos, []), { Desarrollo: 120, Engorde: null });
});
test("la apertura inferida ignora consumo previo al primer bache de Planta", () => {
  const saldo = calcularSaldoPlantaCategoria({
    categoria: "Aves",
    fechaHasta: "2026-09-02",
    saldoInicial: 3850,
    movimientos: [
      { tipo: "bache", categoria: "Aves", fecha: "01/09/2026", kg: 100 },
      { tipo: "bache", categoria: "Aves", fecha: "02/09/2026", kg: 200 },
    ],
    registros: [
      { fecha: "31/08/2026", alimentoKg: 900 },
      { fecha: "02/09/2026", alimentoKg: 150 },
    ],
  });
  assert.equal(saldo, 4000);
  assert.equal(calcularSaldoPlantaCategoria({ categoria: "Aves", fechaHasta: "2026-08-31", movimientos: [], registros: [] }), null);
});

test("el conteo fisico absoluto reemplaza el saldo previo y suma todos los baches de aves", () => {
  const movimientos = [
    { tipo: "ajuste", categoria: "Aves", formula: "651 Impulsor VYMISA", fecha: "28/09/2026", registradoEl: "2026-09-29T05:59:46.638Z", kg: 849.6, saldoReal: -13203.99, conteosFormula: { "651 Impulsor VYMISA": 849.6 } },
    { tipo: "bache", categoria: "Aves", formula: "651 Impulsor VYMISA", fecha: "29/09/2026", kg: 689.72 },
    { tipo: "bache", categoria: "Aves", formula: "Impulsor", fecha: "30/09/2026", kg: 1378.72 },
    { tipo: "bache", categoria: "Aves", formula: "651 Impulsor VYMISA", fecha: "01/10/2026", kg: 2758.14 },
  ];
  const registros = [
    { fecha: "28/09/2026", registradoEl: "2026-09-29T05:07:32.051Z", alimentoKg: 760.5 },
    { fecha: "28/09/2026", registradoEl: "2026-09-29T23:11:09.391Z", alimentoKg: 535.9 },
    { fecha: "29/09/2026", alimentoKg: 760.5 },
    { fecha: "30/09/2026", alimentoKg: 760.5 },
    { fecha: "01/10/2026", alimentoKg: 760.5 },
  ];
  const datos = { categoria: "Aves", saldoInicial: 3850, movimientos, registros };
  assert.equal(calcularSaldoPlantaCategoria({ ...datos, fechaHasta: "2026-09-30" }), 1397.04);
  assert.equal(calcularSaldoPlantaCategoria({ ...datos, fechaHasta: "2026-10-01" }), 3394.68);
});
