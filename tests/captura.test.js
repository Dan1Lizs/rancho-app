import test from "node:test";
import assert from "node:assert/strict";
import { capturaTieneDatosOperativos, evaluarEstadoCaptura, estadosCapturaDelDia } from "../src/features/captura/estadoCaptura.js";
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

test("el pegado masivo admite cartones enteros o medios, pero rechaza fracciones distintas", () => {
  const filas = parsearTiquetesPegados("201 7 15\n202 4,5 9\n203 7,25 15");
  assert.deepEqual(filas.map((fila) => fila.valido), [true, true, false]);
});

test("en levante la producción no queda pendiente y los controles útiles siguen pendientes", () => {
  const estado = evaluarEstadoCaptura({
    lote: { id: "G4", nac: "2026-10-01", edadInicioPosturaSemanas: 18 },
    registro: { posturaAplica: true },
    captura: {},
    fecha: "2026-10-22",
  });
  assert.equal(estado.prod, "no_aplica");
  assert.equal(estado.alim, "pendiente");
  assert.equal(estado.mort, "pendiente");
  assert.equal(estado.agua, "pendiente");
  assert.equal(estado.completo, false);
});

test("la matriz no muestra galpones antes de su nacimiento", () => {
  const estados = estadosCapturaDelDia({
    lotes: [{ id: "G1", nac: "2026-10-15" }, { id: "G4", nac: "2026-10-22" }],
    registros: [], capturas: {}, fecha: "2026-10-21",
  });
  assert.deepEqual(estados.map(estado => estado.lote.id), ["G1"]);
});

test("se pueden guardar controles útiles sin producción y un cero explícito de mortalidad", () => {
  assert.equal(capturaTieneDatosOperativos({}), false);
  assert.equal(capturaTieneDatosOperativos({ aguaL: "120" }), true);
  assert.equal(capturaTieneDatosOperativos({ chequeo: { aguaObs: "Normal" } }), true);
  assert.equal(capturaTieneDatosOperativos({ trabajos: { limpieza: true } }), true);
  assert.equal(capturaTieneDatosOperativos({ meds: [{ producto: "Vitamina" }] }), true);
  assert.equal(capturaTieneDatosOperativos({ muertas: "0" }), true);
});
