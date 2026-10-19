import test from "node:test";
import assert from "node:assert/strict";
import { nombreColeccionRespaldo, resumenArchivoRespaldo } from "../src/respaldo.js";

test("la vista previa resume colecciones y evita exponer valores del respaldo", () => {
  const resumen = resumenArchivoRespaldo({
    "granja2:registros": [{ fecha: "01/10/2026" }, { fecha: "02/10/2026" }],
    "granja2:cxp": { facturas: [{ numero: "F-1" }], pagos: [], notas: [] },
    "granja2:bodegaCfg": { inicialCart: 100 },
    "granja2:preImport:legacy": { debeIgnorarse: true },
  }, [{ fecha: "2026-10-01" }]);
  assert.equal(resumen.registros, 3);
  assert.equal(resumen.configuraciones, 1);
  assert.equal(resumen.conflictos, 1);
  assert.deepEqual(resumen.colecciones.map(item => item.clave), ["granja2:registros", "granja2:cxp:facturas", "granja2:bodegaCfg"]);
  assert.equal(nombreColeccionRespaldo("granja2:registros"), "Controles diarios");
});

test("un respaldo vacío no ofrece colecciones importables", () => {
  assert.deepEqual(resumenArchivoRespaldo({}), { colecciones: [], registros: 0, configuraciones: 0, conflictos: 0 });
});
