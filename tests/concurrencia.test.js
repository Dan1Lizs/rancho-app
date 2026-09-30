import test from "node:test";
import assert from "node:assert/strict";
import { baseDeRegistro, registroCambioDesdeBase } from "../src/concurrencia.js";

test("detecta cuando otro usuario modifica el mismo control", () => {
  const base = { id: "r1", fecha: "29/09/2026", lote: "G1", cartones: 12 };
  assert.equal(registroCambioDesdeBase(base, { ...base, cartones: 13 }), true);
  assert.equal(registroCambioDesdeBase(base, { ...base }), false);
});

test("detecta una creación remota mientras el formulario nuevo estaba abierto", () => {
  assert.equal(registroCambioDesdeBase(null, { id: "r2", fecha: "29/09/2026", lote: "G1" }), true);
});

test("la base de edición es una copia independiente", () => {
  const registros = [{ id: "r1", fecha: "29/09/2026", lote: "G1", chequeo: { cresta: "Rojo normal" } }];
  const base = baseDeRegistro(registros, "29/09/2026", "G1");
  registros[0].chequeo.cresta = "Pálida";
  assert.equal(base.chequeo.cresta, "Rojo normal");
});
