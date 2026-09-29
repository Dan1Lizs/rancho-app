import test from "node:test";
import assert from "node:assert/strict";
import { evaluarEstadoCaptura } from "../src/features/captura/estadoCaptura.js";
import { parsearTiquetesPegados } from "../src/features/captura/parsearTiquetes.js";

test("la matriz exige agua o chequeo para marcar un galpón completo", () => {
  const base = { lote: { id: "G1" }, registro: { cartones: 10, alimentoKg: 100, muertas: 0 }, captura: {} };
  assert.equal(evaluarEstadoCaptura(base).completo, false);
  assert.equal(evaluarEstadoCaptura({ ...base, registro: { ...base.registro, aguaL: 0 } }).completo, true);
});

test("mortalidad cero guardada cuenta como dato registrado", () => {
  const estado = evaluarEstadoCaptura({ lote: { id: "G1" }, registro: { muertas: 0 }, captura: {} });
  assert.equal(estado.mort, "guardado");
});

test("el pegado masivo excluye duplicados existentes y dentro del bloque", () => {
  const filas = parsearTiquetesPegados("100\t2\t3,5\n101\t4\t7\n101\t1\t2", ["100"]);
  assert.deepEqual(filas.map((fila) => fila.valido), [false, true, false]);
  assert.equal(filas[0].peso, "3.5");
});

test("una coma decimal no se interpreta como separador de columna", () => {
  const [fila] = parsearTiquetesPegados("200 12 22,8");
  assert.equal(fila.p, 22.8);
  assert.equal(fila.valido, true);
});
