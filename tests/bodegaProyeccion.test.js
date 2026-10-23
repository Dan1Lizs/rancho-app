import test from "node:test";
import assert from "node:assert/strict";
import { fechaHistorialISO, saldoInicialBodegaEnFecha } from "../src/historial.js";
import { reconstruirBodegaSoloLectura } from "../src/bodegaProyeccion.js";

test("la proyección usa la producción guardada y conserva la cadena aunque el conteo físico sea posterior", () => {
  const movimientos = [
    { id: "02", fecha: "02/10/2026", producido: 0, ajusteConteo: 400, saldoFinal: 400, versionSaldoBodega: 2 },
    { id: "15", fecha: "15/10/2026", producido: 0, saldoFinal: 400, versionSaldoBodega: 2 },
    { id: "16", fecha: "16/10/2026", producido: 0, saldoFinal: 400, versionSaldoBodega: 2 },
    { id: "17", fecha: "17/10/2026", producido: 145, saldoFinal: 545, versionSaldoBodega: 2 },
    { id: "19", fecha: "19/10/2026", producido: 0, ajusteConteo: 916, saldoFinal: 916, versionSaldoBodega: 2 },
  ];
  const registros = [
    { fecha: "16/10/2026", cartones: 150.5 },
    { fecha: "17/10/2026", cartones: 145 },
    { fecha: "19/10/2026", cartones: 0 },
  ];
  const movimientosAntes = structuredClone(movimientos);
  const registrosAntes = structuredClone(registros);

  const vista = reconstruirBodegaSoloLectura(movimientos, registros, 0, "20/10/2026");
  const porFecha = Object.fromEntries(vista.map(m => [fechaHistorialISO(m.fecha), m]));

  assert.equal(porFecha["2026-10-16"].saldoFinal, 550.5);
  assert.equal(saldoInicialBodegaEnFecha(vista, 0, "20/10/2026", "17/10/2026"), 550.5);
  assert.equal(porFecha["2026-10-17"].saldoFinal, 695.5);
  assert.equal(porFecha["2026-10-19"].saldoFinal, 916, "el conteo explícito posterior sigue siendo ancla");
  assert.deepEqual(movimientos, movimientosAntes, "no modifica los movimientos guardados");
  assert.deepEqual(registros, registrosAntes, "no modifica los controles guardados");
});

test("la proyección no decide a ciegas si el día que debe recalcular tiene Bodega duplicada", () => {
  const movimientos = [
    { id: "15", fecha: "15/10/2026", producido: 0, ajusteConteo: 400, saldoFinal: 400 },
    { id: "16a", fecha: "16/10/2026", producido: 0, saldoFinal: 400 },
    { id: "16b", fecha: "16/10/2026", producido: 0, saldoFinal: 400 },
  ];
  const registros = [{ fecha: "16/10/2026", cartones: 150.5 }];
  const vista = reconstruirBodegaSoloLectura(movimientos, registros, 0, "20/10/2026");

  assert.equal(vista.find(m => m.id === "16a").saldoFinal, 400);
  assert.equal(vista.find(m => m.id === "16b").saldoFinal, 400);
});
