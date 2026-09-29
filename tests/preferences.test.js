import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PREFERENCES, normalizarPreferencias, ordenarPorPreferencia } from "../src/preferences.js";

test("las preferencias descartadas no forman parte del modelo", () => {
  for (const clave of ["gallineroPredeterminado", "reportePredeterminado", "periodoPredeterminado", "impresion"]) {
    assert.equal(Object.hasOwn(DEFAULT_PREFERENCES, clave), false);
  }
});

test("normaliza opciones inválidas y limita el intervalo de borradores", () => {
  const p = normalizarPreferencias({ densidad: "imposible", borradores: { intervaloSegundos: 500, almacenamiento: "nube" } });
  assert.equal(p.densidad, "comoda");
  assert.equal(p.borradores.intervaloSegundos, 60);
  assert.equal(p.borradores.almacenamiento, "nube");
});

test("el orden personal conserva también módulos nuevos", () => {
  const items = [{ id: "inicio" }, { id: "captura" }, { id: "reporte" }];
  assert.deepEqual(ordenarPorPreferencia(items, ["reporte", "inicio"]).map(x => x.id), ["reporte", "inicio", "captura"]);
});

