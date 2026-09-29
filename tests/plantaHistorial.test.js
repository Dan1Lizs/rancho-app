import test from "node:test";
import assert from "node:assert/strict";
import { filtrarMovimientosPlanta, filtroPlantaInicial } from "../src/plantaHistorial.js";

const datos = [
  { fecha: "25/09/2026", tipo: "bache", categoria: "Aves", formula: "Impulsor", numBache: "P-17", responsable: "José" },
  { fecha: "26/09/2026", tipo: "servido", categoria: "Ganado", formula: "Ganado", detalle: "Corral 3", responsable: "Eric" },
];

test("el historial de planta combina fecha, fórmula, tipo y búsqueda sin perder datos", () => {
  const filtro = { ...filtroPlantaInicial(), desde: "2026-09-25", hasta: "2026-09-25", formula: "Impulsor", tipo: "bache", texto: "jose" };
  assert.deepEqual(filtrarMovimientosPlanta(datos, filtro), [datos[0]]);
  assert.deepEqual(filtrarMovimientosPlanta(datos, { ...filtro, tipo: "servido" }), []);
  assert.equal(filtrarMovimientosPlanta(datos, filtroPlantaInicial()).length, 2);
});
