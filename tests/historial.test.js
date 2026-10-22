import test from "node:test";
import assert from "node:assert/strict";
import { filtrarHistorial, fechaHistorialISO, elegirMovimientoBodega, reconstruirBodega, movimientoBodegaParaReporte, movimientoBodegaDeFecha, rutaNetaBodega } from "../src/historial.js";

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
  assert.equal(rutaNetaBodega([{ salida: 0, tiquetesDevueltos: [{ cartones: "0,5" }] }]), 0.5);
  const [movimiento] = reconstruirBodega([
    { id: "hoy", fecha: "01/10/2026", producido: 0, repartos: [{ salida: 10, devBueno: 3, devMalo: 2 }] },
  ], 100, "2026-10-01");
  assert.equal(movimiento.rutaNeta, 9);
  assert.equal(movimiento.saldoFinal, 91);
});

test("las devoluciones por tiquete entran el día recibido y el uso parcial resta en su propio día", () => {
  const movimientosTiquetes = [
    { fecha: "2026-10-02", tipo: "devolucion", cartones_delta: 9 },
    { fecha: "2026-10-03", tipo: "uso", cartones_delta: -4 },
  ];
  const reconstruidos = reconstruirBodega([
    { id: "b-01", fecha: "01/10/2026", producido: 0, repartos: [] },
    { id: "b-03", fecha: "03/10/2026", producido: 2, repartos: [] },
  ], 100, "2026-10-01", movimientosTiquetes);
  const porFecha = Object.fromEntries(reconstruidos.map(m => [fechaHistorialISO(m.fecha), m]));
  assert.equal(porFecha["2026-10-02"].movimientoSoloTiquetes, true);
  assert.equal(porFecha["2026-10-02"].saldoFinal, 109);
  assert.equal(porFecha["2026-10-03"].movimientoTiquetes, -4);
  assert.equal(porFecha["2026-10-03"].saldoFinal, 107);
});

test("la devolución mala se imputa a la ruta de origen y los buenos entran en la fecha real", () => {
  const movimientosTiquetes = [
    { tipo: "devolucion_mala", fecha: "2026-10-11", fecha_recepcion: "2026-10-12", cartones_delta: -5, ruta_mov_id: "b-11", ruta_id: "r-1" },
    { tipo: "devolucion", fecha: "2026-10-12", fecha_recepcion: "2026-10-12", cartones_delta: 13, ruta_mov_id: "b-11", ruta_id: "r-1" },
  ];
  const reconstruidos = reconstruirBodega([
    { id: "b-11", fecha: "11/10/2026", producido: 0, repartos: [{ id: "r-1", salida: 100 }] },
    { id: "b-12", fecha: "12/10/2026", producido: 0, repartos: [] },
  ], 200, "2026-10-11", movimientosTiquetes);
  const porFecha = Object.fromEntries(reconstruidos.map(m => [fechaHistorialISO(m.fecha), m]));
  assert.equal(porFecha["2026-10-11"].movimientoTiquetes, -5);
  assert.equal(porFecha["2026-10-11"].saldoFinal, 95);
  assert.equal(porFecha["2026-10-12"].movimientoTiquetes, 13);
  assert.equal(porFecha["2026-10-12"].saldoFinal, 108);
});

test("reutilizar un tiquete se suma a la ruta sin duplicar el descuento del kardex", () => {
  const reconstruidos = reconstruirBodega([
    { id: "b-01", fecha: "01/10/2026", producido: 0, repartos: [{ id: "r-1", salida: 10 }] },
  ], 100, "2026-10-01", [
    { id: "m-1", operacion_id: "uso-1", tipo: "uso", fecha: "2026-10-01", cartones_delta: -5, ruta_mov_id: "b-01", ruta_id: "r-1" },
  ]);
  const [movimiento] = reconstruidos;
  assert.equal(movimiento.repartos[0].tiquetesDevueltos[0].cartones, 5);
  assert.equal(movimiento.rutaNeta, 15);
  assert.equal(movimiento.movimientoTiquetes, 0);
  assert.equal(movimiento.saldoFinal, 85);
});

test("la producción y el saldo de Bodega conservan el medio cartón", () => {
  const [movimiento] = reconstruirBodega([
    { id: "b-01", fecha: "01/10/2026", producido: 148.5, repartos: [] },
  ], 0, "2026-10-01");
  assert.equal(movimiento.producido, 148.5);
  assert.equal(movimiento.saldoFinal, 148.5);
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
