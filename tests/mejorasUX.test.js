import test from "node:test";
import assert from "node:assert/strict";
import { saltosTiquetes, tiquetesDelDia, observacionesCaptura, excepcionesOperacion, csvAuditoria } from "../src/mejorasUX.js";

test("los saltos de tiquete se avisan sin presumir que son una duplicación", () => {
  assert.deepEqual(saltosTiquetes([{ num: "6076" }, { num: "6077" }, { num: "6079" }]), [6078]);
  assert.deepEqual(saltosTiquetes([{ num: "1" }, { num: "1000" }]), []);
});

test("la revisión de captura señala pesos atípicos e incompletos", () => {
  const c = { G3: { tiquetes: [{ num: "6076", cartones: "10", peso: "18.8" }, { num: "6078", cartones: "10", peso: "40" }, { num: "6079", cartones: "", peso: "" }] } };
  const mensajes = observacionesCaptura(c, [{ id: "G3", galpon: 3 }], c.G3.tiquetes);
  assert.equal(mensajes.length, 3);
  assert.ok(mensajes.some(x => x.includes("6077")));
});

test("la secuencia se comparte entre gallineros, incluso con un registro guardado", () => {
  const fecha = "28/09/2026";
  const capturas = { G1: { tiquetes: [{ num: "7001" }, { num: "7002" }, { num: "7003" }, { num: "7005" }] }, G3: { tiquetes: [] } };
  const registros = [
    { lote: "G3", fecha, tiquetes: [{ num: "7004" }] },
    { lote: "G3", fecha: "27/09/2026", tiquetes: [{ num: "7006" }] },
  ];
  const juntos = tiquetesDelDia(capturas, registros, fecha, ["G1"]);
  assert.deepEqual(saltosTiquetes(juntos), []);
  assert.ok(!observacionesCaptura(capturas, [{ id: "G1", galpon: 1 }], juntos).some(x => x.includes("faltan")));
  assert.deepEqual(saltosTiquetes(tiquetesDelDia(capturas, registros, fecha, ["G1", "G3"])), [7004]);
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
