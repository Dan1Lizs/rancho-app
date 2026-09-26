import test from "node:test";
import assert from "node:assert/strict";
import { actividadesDelDia, trabajosDelDia } from "../src/reporteActividades.js";
import { planServidoGanado } from "../src/servidoGanado.js";

test("el reporte separa labores generales y de galera, e incluye atrasadas", () => {
  const tareas = [
    { id: "1", nombre: "Zacate", lote: "", inicio: "2026-09-25", repeticion: "una" },
    { id: "2", nombre: "Lavado", lote: "G1", inicio: "2026-09-26", repeticion: "una" },
    { id: "3", nombre: "Mañana", lote: "G1", inicio: "2026-09-27", repeticion: "una" },
    { id: "4", nombre: "Terminado", lote: "G1", inicio: "2026-09-25", ultima: "2026-09-25", repeticion: "una" },
  ];
  assert.deepEqual(actividadesDelDia(tareas, "2026-09-26", "").map(t => t.nombre), ["Zacate"]);
  assert.deepEqual(actividadesDelDia(tareas, "2026-09-26", "G1").map(t => t.nombre), ["Lavado"]);
  assert.deepEqual(trabajosDelDia(["A", "B"], { trabajos: { 0: true } }).filter(t => !t.realizado).map(t => t.nombre), ["B"]);
  const semanal = { id: "5", nombre: "Viernes", lote: "G1", inicio: "2026-09-18", ultima: "2026-09-18", repeticion: "semanal", diasSemana: [5] };
  assert.equal(actividadesDelDia([semanal], "2026-09-26", "G1")[0].programada, "2026-09-25");
});

test("el servido calculado evita repetir un corral y detecta servido sin corral", () => {
  const grupos = [{ nombre: "Potrero", formula: "Cría", animales: 10, kgAnimal: 2 }, { nombre: "Toros", formula: "Engorde", animales: 4, kgAnimal: 5 }];
  const plan = planServidoGanado(grupos, "2026-09-26", [{ tipo: "servido", categoria: "Ganado", fecha: "26/09/2026", detalle: "Potrero", grupoKey: "0", kg: 20 }]);
  assert.equal(plan.pendientes.length, 1);
  assert.equal(plan.pendientes[0].nombre, "Toros");
  assert.equal(plan.pendientes[0].kg, 20);
  assert.equal(plan.sinGrupo.length, 0);
  const ambiguo = planServidoGanado(grupos, "2026-09-26", [{ tipo: "servido", categoria: "Ganado", fecha: "26/09/2026", detalle: "Potreros + toros", kg: 40 }]);
  assert.equal(ambiguo.sinGrupo.length, 1);
});
