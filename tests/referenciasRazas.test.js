import test from "node:test";
import assert from "node:assert/strict";
import { REFERENCIAS_RAZAS, claveRaza, referenciaRaza, valorCentral } from "../src/referenciasRazas.js";

test("cada línea utiliza su propia tabla, sin confundir Hy-Line Brown con W-36", () => {
  assert.equal(claveRaza("ISA Brown"), "isa");
  assert.equal(claveRaza("Lohmann Brown"), "lohmann");
  assert.equal(claveRaza("Hy-Line Brown"), "hyline");
  assert.equal(claveRaza("Hy-Line W-36 reproductoras"), "w36");
  assert.equal(claveRaza("Hy-Line Brown Max"), null);
  assert.deepEqual(referenciaRaza("Hy-Line Brown", 26).peso, [1810, 1913]);
  assert.deepEqual(referenciaRaza("Hy-Line W-36", 26).peso, [1545, 1641]);
});

test("las cifras semanales coinciden con las tablas y cesan al final del manual", () => {
  assert.equal(referenciaRaza("ISA Brown", 26).postura[0], 96.1);
  assert.equal(valorCentral(referenciaRaza("Lohmann Brown", 26).peso), 1893);
  assert.deepEqual(referenciaRaza("Hy-Line Brown", 40).postura, [91.9, 97.2]);
  assert.equal(referenciaRaza("Hy-Line Brown", 40).haa[0], 133.1);
  assert.equal(referenciaRaza("ISA Brown", 100).peso[0], 1975);
  assert.equal(referenciaRaza("ISA Brown", 101), null);
  assert.equal(referenciaRaza("Lohmann Brown", 96), null);
  assert.equal(referenciaRaza("Hy-Line W-36", 76), null);
  assert.equal(referenciaRaza("ISA Brown", 17).postura, undefined);
  for (const [id, ultimo] of [["isa", 100], ["lohmann", 95], ["hyline", 100], ["w36", 75]]) {
    assert.equal(Object.keys(REFERENCIAS_RAZAS[id].semanas).length, ultimo);
  }
});
