import test from "node:test";
import assert from "node:assert/strict";
import { saltosTiquetes, observacionesCaptura, excepcionesOperacion, csvAuditoria } from "../src/mejorasUX.js";

test("los saltos de tiquete se avisan sin presumir que son una duplicación", () => {
  assert.deepEqual(saltosTiquetes([{ num: "6076" }, { num: "6077" }, { num: "6079" }]), [6078]);
  assert.deepEqual(saltosTiquetes([{ num: "1" }, { num: "1000" }]), []);
});

test("la revisión de captura señala pesos atípicos e incompletos", () => {
  const c = { G3: { tiquetes: [{ num: "6076", cartones: "10", peso: "18.8" }, { num: "6078", cartones: "10", peso: "40" }, { num: "6079", cartones: "", peso: "" }] } };
  const mensajes = observacionesCaptura(c, [{ id: "G3", galpon: 3 }]);
  assert.equal(mensajes.length, 3);
  assert.ok(mensajes.some(x => x.includes("6077")));
});

test("el centro de revisión distingue duplicados y saldos negativos", () => {
  const h = excepcionesOperacion({ registros: [{ fecha: "25/09/2026", lote: "G3" }, { fecha: "25/09/2026", lote: "G3" }], lotes: [], saldoAves: 10, saldoGanado: -2, saldosAvesFormula: null, saldosGanadoFormula: null, bodegaMovs: [], retirosActivos: [], tareas: [] });
  assert.ok(h.some(x => x.tipo === "Duplicado"));
  assert.ok(h.some(x => x.tipo === "Saldo negativo"));
});

test("la exportación CSV conserva comas y comillas de la auditoría", () => {
  const csv = csvAuditoria([{ fecha: "28/09/2026", area: "Bodega", accion: "Edición", responsable: "José", motivo: 'Cambio, "conteo"', antes: 5, despues: 6 }]);
  assert.ok(csv.includes('"Cambio, ""conteo"""'));
});
