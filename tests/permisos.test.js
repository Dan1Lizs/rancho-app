import test from "node:test";
import assert from "node:assert/strict";
import { puedeAccederVista, resolverVistaSegura, rolActivoParaEmail, vistasPermitidas } from "../src/permisos.js";

const todas = ["inicio", "captura", "reporte", "historial", "cxp"];

test("Historial queda reservado a admin y encargado", () => {
  assert.equal(puedeAccederVista("admin", "historial", todas), true);
  assert.equal(puedeAccederVista("encargado", "historial", todas), true);
  for (const rol of ["bodega", "planta", "bienestar", "consulta", "sin_acceso"]) {
    assert.equal(puedeAccederVista(rol, "historial", todas), false);
  }
});

test("solo admin ve Cuentas por Pagar; los roles con Revisión no reciben esa vista", () => {
  assert.deepEqual(vistasPermitidas("admin", todas), todas);
  for (const rol of ["encargado", "bodega", "planta", "bienestar", "consulta"]) {
    assert.equal(puedeAccederVista(rol, "cxp", todas), false);
  }
  for (const rol of ["encargado", "planta", "bienestar"]) {
    assert.equal(puedeAccederVista(rol, "revision", todas), true);
  }
});

test("Administración y sus respaldos quedan reservados al rol administrador", () => {
  const vistas = [...todas, "administracion"];
  assert.equal(puedeAccederVista("admin", "administracion", vistas), true);
  for (const rol of ["encargado", "bodega", "planta", "bienestar", "consulta", "sin_acceso"]) {
    assert.equal(puedeAccederVista(rol, "administracion", vistas), false);
  }
});

test("un enlace profundo se conserva mientras carga el rol", () => {
  assert.equal(resolverVistaSegura("cargando", "reporte", todas), "reporte");
  assert.equal(resolverVistaSegura("encargado", "historial", todas), "historial");
  assert.equal(resolverVistaSegura("consulta", "historial", todas), "inicio");
});


test("resuelve el rol activo por correo sin distinguir mayúsculas ni espacios", () => {
  const roles = [{ email: " Admin@rancho.test ", role: "ADMIN", active: true }];
  assert.equal(rolActivoParaEmail(roles, "admin@rancho.test"), "admin");
});

test("no concede navegación a usuarios inactivos, sin registro o con rol desconocido", () => {
  assert.equal(rolActivoParaEmail([{ email: "user@rancho.test", role: "bodega", active: false }], "user@rancho.test"), "sin_acceso");
  assert.equal(rolActivoParaEmail([], "user@rancho.test"), "sin_acceso");
  assert.equal(rolActivoParaEmail([{ email: "user@rancho.test", role: "superadmin", active: true }], "user@rancho.test"), "sin_acceso");
});
