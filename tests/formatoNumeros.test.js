import test from "node:test";
import assert from "node:assert/strict";
import { numeroMaxDosDecimales, numeroDosDecimales } from "../src/formatoNumeros.js";

test("muestra enteros sin ceros decimales", () => {
  assert.equal(numeroMaxDosDecimales(24), "24");
  assert.equal(numeroMaxDosDecimales("24.0000"), "24");
});

test("redondea valores a un máximo de dos decimales", () => {
  assert.equal(numeroMaxDosDecimales("24.60000000002"), "24.6");
  assert.equal(numeroMaxDosDecimales(1.236), "1.24");
  assert.equal(numeroDosDecimales(9.999), 10);
});

test("conserva el valor de reemplazo para datos vacíos", () => {
  assert.equal(numeroMaxDosDecimales(""), "—");
  assert.equal(numeroMaxDosDecimales(null, "sin dato"), "sin dato");
});

