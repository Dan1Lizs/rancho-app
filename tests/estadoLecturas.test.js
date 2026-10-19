import test from "node:test";
import assert from "node:assert/strict";
import { limpiarEstadoLecturasParaPruebas, lecturaBloqueada, lecturasConError, registrarErrorLectura, registrarLecturaCorrecta } from "../src/estadoLecturas.js";

test("una lectura fallida marca únicamente su sección como no segura", () => {
  limpiarEstadoLecturasParaPruebas();
  registrarErrorLectura("granja2:bodegaMovs", new Error("sin conexión"));
  assert.equal(lecturaBloqueada("granja2:bodegaMovs"), true);
  assert.equal(lecturaBloqueada("granja2:plantaMovs"), false);
  assert.deepEqual(lecturasConError(), ["granja2:bodegaMovs"]);
});

test("una lectura posterior correcta libera solo la clave recuperada", () => {
  limpiarEstadoLecturasParaPruebas();
  registrarErrorLectura("granja2:bodegaMovs");
  registrarErrorLectura("granja2:plantaMovs");
  registrarLecturaCorrecta("granja2:bodegaMovs");
  assert.equal(lecturaBloqueada("granja2:bodegaMovs"), false);
  assert.equal(lecturaBloqueada("granja2:plantaMovs"), true);
  limpiarEstadoLecturasParaPruebas();
});
