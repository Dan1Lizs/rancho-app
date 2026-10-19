import test from "node:test";
import assert from "node:assert/strict";
import { baseDeRegistro, decidirCambioColeccion, decidirEliminacionColeccion, registroCambioDesdeBase } from "../src/concurrencia.js";

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

test("la decisión compare-and-set conserva cambios remotos y permite solo una escritura basada en lo observado", () => {
  const base = { id: "r1", cantidad: 10 };
  assert.equal(decidirCambioColeccion({ base, remoto: base, nuevo: { ...base, cantidad: 11 } }), "actualizar");
  assert.equal(decidirCambioColeccion({ base, remoto: { ...base, cantidad: 12 }, nuevo: { ...base, cantidad: 11 } }), "conflicto");
  assert.equal(decidirCambioColeccion({ base: null, remoto: null, nuevo: { id: "r2" } }), "insertar");
  assert.equal(decidirCambioColeccion({ base: null, remoto: { id: "r2" }, nuevo: { id: "r2" } }), "sin-cambio");
  assert.equal(decidirCambioColeccion({ base: null, remoto: { id: "r2", cantidad: 3 }, nuevo: { id: "r2", cantidad: 4 } }), "conflicto");
});

test("la eliminación concurrente solo quita el contenido que se revisó", () => {
  const base = { id: "r1", cantidad: 10 };
  assert.equal(decidirEliminacionColeccion({ base, remoto: base }), "eliminar");
  assert.equal(decidirEliminacionColeccion({ base, remoto: { ...base, cantidad: 12 } }), "conflicto");
  assert.equal(decidirEliminacionColeccion({ base, remoto: null }), "ya-eliminado");
});
