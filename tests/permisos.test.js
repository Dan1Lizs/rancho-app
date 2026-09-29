import test from "node:test";
import assert from "node:assert/strict";
import { puedeAccederVista, vistasPermitidas } from "../src/permisos.js";

const todas = ["inicio", "captura", "reporte", "historial", "cxp"];

test("Historial queda reservado a admin y encargado", () => {
  assert.equal(puedeAccederVista("admin", "historial", todas), true);
  assert.equal(puedeAccederVista("encargado", "historial", todas), true);
  for (const rol of ["bodega", "planta", "bienestar", "consulta", "sin_acceso"]) {
    assert.equal(puedeAccederVista(rol, "historial", todas), false);
  }
});

test("admin recibe todas las vistas y encargado no recibe cuentas por pagar", () => {
  assert.deepEqual(vistasPermitidas("admin", todas), todas);
  assert.equal(puedeAccederVista("encargado", "cxp", todas), false);
});

