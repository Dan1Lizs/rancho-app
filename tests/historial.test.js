import test from "node:test";
import assert from "node:assert/strict";
import { filtrarHistorial, elegirMovimientoBodega, reconstruirBodega, movimientoBodegaParaReporte, movimientoBodegaDeFecha, rutaNetaBodega } from "../src/historial.js";

test("el período filtra D/M/A e ISO sin confundir años y permite ver todo", () => {
  const items = [{ fecha: "25/09/2025" }, { fecha: "01/09/2026" }, { fecha: "2026-09-26" }, { fecha: "27/09/2026" }];
  const hoy = new Date(2026, 8, 26);
  assert.deepEqual(filtrarHistorial(items, "30", hoy), items.slice(1, 3));
  assert.deepEqual(filtrarHistorial(items, "mes", hoy), items.slice(1, 3));
  assert.deepEqual(filtrarHistorial(items, "todo", hoy), items);
});

test("editar un día recalcula los saldos posteriores sin perder ajustes físicos", () => {
  const movimientos = [
    { id: "25", fecha: "25/09/2026", producido: 12, rutaNeta: 3 },
    { id: "26", fecha: "26/09/2026", producido: 10, rutaNeta: 2 },
    { id: "27", fecha: "27/09/2026", producido: 8, ajusteConteo: 130 },
    { id: "28", fecha: "28/09/2026", producido: 5 },
  ];
  assert.deepEqual(reconstruirBodega(movimientos, 100, "2026-09-25").map(m => m.saldoFinal), [135, 130, 117, 109]);
});

test("un día nuevo tiene ID estable y una edición conserva el ID elegido entre duplicados", () => {
  const existentes = [{ id: "viejo-1", fecha: "25/09/2026" }, { id: "viejo-2", fecha: "25/09/2026" }];
  assert.equal(elegirMovimientoBodega([], "2026-09-26").id, "bodega-2026-09-26");
  assert.equal(elegirMovimientoBodega(existentes, "2026-09-25", "viejo-2").id, "viejo-2");
  assert.equal(elegirMovimientoBodega(existentes, "2026-09-25", "viejo-2").delDia.length, 2);
});

test("la impresión de historial toma el movimiento elegido aunque no sea el último", () => {
  const movimientos = [{ id: "hoy", fecha: "27/09/2026" }, { id: "antes", fecha: "25/09/2026" }];
  assert.equal(movimientoBodegaParaReporte(movimientos, "antes").fecha, "25/09/2026");
  assert.equal(movimientoBodegaParaReporte(movimientos).id, "hoy");
});

test("al imprimir Bodega, el movimiento elegido pertenece a la fecha visible", () => {
  const movimientos = [
    { id: "seis", fecha: "06/10/2026" },
    { id: "cinco", fecha: "05/10/2026" },
  ];
  assert.equal(movimientoBodegaDeFecha(movimientos, "2026-10-05", "seis").id, "cinco");
  assert.equal(movimientoBodegaDeFecha(movimientos, "2026-10-05", "cinco").id, "cinco");
});


test("la devolución mala aumenta la salida proyectada; la buena sí regresa al saldo", () => {
  assert.equal(rutaNetaBodega([{ salida: 10, devBueno: 3, devMalo: 2 }]), 9);
  const [movimiento] = reconstruirBodega([
    { id: "hoy", fecha: "01/10/2026", producido: 0, repartos: [{ salida: 10, devBueno: 3, devMalo: 2 }] },
  ], 100, "2026-10-01");
  assert.equal(movimiento.rutaNeta, 9);
  assert.equal(movimiento.saldoFinal, 91);
});

test("recalcula el historial, conserva saltos antiguos sin conteo y es idempotente", () => {
  const legado = [
    { id: "01", fecha: "01/10/2026", saldoFinal: 1000 },
    { id: "02", fecha: "02/10/2026", saldoFinal: 995, repartos: [{ salida: 10, devBueno: 2, devMalo: 3 }] },
    { id: "03", fecha: "03/10/2026", saldoFinal: 1020, producido: 0 },
    { id: "04", fecha: "04/10/2026", saldoFinal: 1000, ajusteConteo: 1000, difAjuste: -20, producido: 0 },
  ];
  const primero = reconstruirBodega(legado, 0, "2026-10-01");
  const porFecha = [...primero].reverse();
  assert.deepEqual(porFecha.map(m => m.saldoFinal), [1000, 989, 1014, 1000]);
  assert.equal(porFecha[2].ajusteHistoricoImplicito, 25);
  assert.equal(porFecha[3].difAjuste, -14);
  const segundo = reconstruirBodega(primero, 0, "2026-10-01");
  assert.deepEqual(segundo.map(m => ({
    fecha: m.fecha, rutaNeta: m.rutaNeta, saldoFinal: m.saldoFinal,
    difAjuste: m.difAjuste, ajusteHistoricoImplicito: m.ajusteHistoricoImplicito,
  })), primero.map(m => ({
    fecha: m.fecha, rutaNeta: m.rutaNeta, saldoFinal: m.saldoFinal,
    difAjuste: m.difAjuste, ajusteHistoricoImplicito: m.ajusteHistoricoImplicito,
  })));
});
