import test from "node:test";
import assert from "node:assert/strict";
import { filtrarHistorial, fechaHistorialISO, elegirMovimientoBodega, reconstruirBodega, movimientoBodegaParaReporte, movimientoBodegaDeFecha, saldoInicialBodegaEnFecha, saldoCalculadoBodega, rutaNetaBodega, devolucionesSinTiqueteDeMovimiento, cartonesMalosSinTiqueteEnRuta, historialDevolucionesSinTiquete, aplicarEdicionDevolucionSinTiquete } from "../src/historial.js";

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


test("la devolución mala es informativa; la buena sí regresa al saldo", () => {
  assert.equal(rutaNetaBodega([{ salida: 10, devBueno: 3, devMalo: 2 }]), 7);
  assert.equal(rutaNetaBodega([{ salida: 0, tiquetesDevueltos: [{ cartones: "0,5" }] }]), 0.5);
  const [movimiento] = reconstruirBodega([
    { id: "hoy", fecha: "01/10/2026", producido: 0, repartos: [{ salida: 10, devBueno: 3, devMalo: 2 }] },
  ], 100, "2026-10-01");
  assert.equal(movimiento.rutaNeta, 7);
  assert.equal(movimiento.saldoFinal, 93);
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

test("la devolución mala se conserva en historial sin afectar saldo; los buenos entran en la fecha real", () => {
  const movimientosTiquetes = [
    { tipo: "devolucion_mala", fecha: "2026-10-11", fecha_recepcion: "2026-10-12", cartones_delta: -5, ruta_mov_id: "b-11", ruta_id: "r-1" },
    { tipo: "devolucion", fecha: "2026-10-12", fecha_recepcion: "2026-10-12", cartones_delta: 13, ruta_mov_id: "b-11", ruta_id: "r-1" },
  ];
  const reconstruidos = reconstruirBodega([
    { id: "b-11", fecha: "11/10/2026", producido: 0, repartos: [{ id: "r-1", salida: 100 }] },
    { id: "b-12", fecha: "12/10/2026", producido: 0, repartos: [] },
  ], 200, "2026-10-11", movimientosTiquetes);
  const porFecha = Object.fromEntries(reconstruidos.map(m => [fechaHistorialISO(m.fecha), m]));
  assert.equal(porFecha["2026-10-11"].movimientoTiquetes, 0);
  assert.equal(porFecha["2026-10-11"].saldoFinal, 100);
  assert.equal(porFecha["2026-10-12"].movimientoTiquetes, 13);
  assert.equal(porFecha["2026-10-12"].saldoFinal, 113);
});

test("las nuevas devoluciones sin tiquete suman los buenos al recibir y solo registran los malos", () => {
  const origen = {
    id: "b-11", fecha: "11/10/2026", producido: 0, saldoFinal: 100,
    repartos: [{ id: "r-1", nombre: "Bryan", salida: 100 }],
  };
  const recepcion = {
    id: "b-12", fecha: "12/10/2026", producido: 0, repartos: [],
    devolucionesSinTiquete: [{
      id: "sin-tiq-1", fechaRecepcion: "2026-10-12", fechaRutaOrigen: "2026-10-11",
      rutaMovId: "b-11", rutaId: "r-1", repartidor: "Bryan", cartonesBuenos: 13, cartonesMalos: 5,
    }],
  };
  const antes = structuredClone([origen, recepcion]);
  const reconstruidos = reconstruirBodega([origen, recepcion], 200, "2026-10-11");
  const porFecha = Object.fromEntries(reconstruidos.map(m => [fechaHistorialISO(m.fecha), m]));

  assert.equal(porFecha["2026-10-11"].rutaNeta, 100);
  assert.equal(porFecha["2026-10-11"].saldoFinal, 100);
  assert.equal(porFecha["2026-10-12"].movimientoTiquetes, 13);
  assert.equal(porFecha["2026-10-12"].saldoFinal, 108);
  assert.deepEqual([origen, recepcion], antes, "la reconstrucción solo calcula; no modifica registros originales");
  assert.equal(cartonesMalosSinTiqueteEnRuta(devolucionesSinTiqueteDeMovimiento([recepcion]), "b-11", "r-1"), 5);
});

test("el historial normaliza devoluciones antiguas y nuevas para permitir su corrección", () => {
  const movimientos = [
    { id: "b-10", fecha: "10/10/2026", repartos: [{ id: "r-10", nombre: "Ana", devBueno: 3, devMalo: 1 }] },
    { id: "b-12", fecha: "12/10/2026", devolucionesSinTiquete: [{
      id: "d-12", fechaRecepcion: "2026-10-12", fechaRutaOrigen: "2026-10-11",
      rutaMovId: "b-11", rutaId: "r-11", repartidor: "Luis", cartonesBuenos: 4, cartonesMalos: 0,
    }] },
  ];
  const historial = historialDevolucionesSinTiquete(movimientos);
  assert.equal(historial.length, 2);
  assert.equal(historial[0].tipo, "nueva");
  assert.equal(historial[0].fecha, "2026-10-12");
  assert.equal(historial[1].tipo, "legado");
  assert.equal(historial[1].rutaId, "r-10");
});

test("corregir una devolución histórica convierte el registro viejo, reasigna la ruta y recalcula balances", () => {
  const movimientos = [
    { id: "b-10", fecha: "10/10/2026", producido: 0, repartos: [{ id: "r-10", nombre: "Ana", salida: 20 }] },
    { id: "b-11", fecha: "11/10/2026", producido: 0, repartos: [{ id: "r-11", nombre: "Luis", salida: 30 }] },
    { id: "b-12", fecha: "12/10/2026", producido: 0, repartos: [{ id: "r-12", nombre: "Ana", salida: 40, devBueno: 10, devMalo: 2 }] },
  ];
  const preCorreccion = reconstruirBodega(movimientos, 100, "2026-10-10");
  const legado = historialDevolucionesSinTiquete(preCorreccion).find(item => item.id === "legado:b-12:r-12");
  const editados = aplicarEdicionDevolucionSinTiquete(preCorreccion, {
    registro: legado,
    ruta: { movimientoId: "b-11", rutaId: "r-11", fecha: "2026-10-11", repartidor: "Luis" },
    cartonesBuenos: 8, cartonesMalos: 1, motivo: "Conteo físico corregido", por: "encargado",
    fechaHora: "2026-10-13T12:00:00.000Z",
  });
  const porFecha = Object.fromEntries(reconstruirBodega(editados, 100, "2026-10-10")
    .map(movimiento => [fechaHistorialISO(movimiento.fecha), movimiento]));
  const rutaAnterior = editados.find(m => m.id === "b-12");

  assert.equal(rutaAnterior.repartos[0].devBueno, 0);
  assert.equal(rutaAnterior.repartos[0].devMalo, 0);
  assert.equal(porFecha["2026-10-11"].rutaNeta, 30);
  assert.equal(porFecha["2026-10-12"].movimientoTiquetes, 8);
  assert.equal(porFecha["2026-10-12"].saldoFinal, 18);
  const guardada = historialDevolucionesSinTiquete(editados)[0];
  assert.equal(guardada.rutaId, "r-11");
  assert.equal(guardada.original.historialEdiciones[0].motivo, "Conteo físico corregido");
  const corregidaDeNuevo = aplicarEdicionDevolucionSinTiquete(editados, {
    registro: guardada,
    ruta: { movimientoId: "b-10", rutaId: "r-10", fecha: "2026-10-10", repartidor: "Ana" },
    cartonesBuenos: 7.5, cartonesMalos: 0.5, motivo: "Segundo ajuste con medio cartón", por: "admin",
    fechaHora: "2026-10-14T12:00:00.000Z",
  });
  const historialCorregidoDeNuevo = historialDevolucionesSinTiquete(corregidaDeNuevo);
  assert.equal(historialCorregidoDeNuevo.length, 1, "editar varias veces no duplica la devolución");
  assert.equal(historialCorregidoDeNuevo[0].buenos, 7.5);
  assert.equal(historialCorregidoDeNuevo[0].malos, 0.5);
  assert.equal(historialCorregidoDeNuevo[0].original.historialEdiciones.length, 2);
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
  assert.deepEqual(porFecha.map(m => m.saldoFinal), [1000, 995, 1020, 1000]);
  assert.equal(porFecha[2].ajusteHistoricoImplicito, 25);
  assert.equal(porFecha[3].difAjuste, -20);
  const segundo = reconstruirBodega(primero, 0, "2026-10-01");
  assert.deepEqual(segundo.map(m => ({
    fecha: m.fecha, rutaNeta: m.rutaNeta, saldoFinal: m.saldoFinal,
    difAjuste: m.difAjuste, ajusteHistoricoImplicito: m.ajusteHistoricoImplicito,
  })), primero.map(m => ({
    fecha: m.fecha, rutaNeta: m.rutaNeta, saldoFinal: m.saldoFinal,
    difAjuste: m.difAjuste, ajusteHistoricoImplicito: m.ajusteHistoricoImplicito,
  })));
});

test("la apertura de Bodega reinicia el saldo desde su fecha y conserva los cierres anteriores", () => {
  const movimientos = [
    { id: "18", fecha: "18/10/2026", producido: 0, rutaNeta: 0, saldoFinal: 1000 },
    { id: "19", fecha: "19/10/2026", producido: 0, repartos: [{ salida: 42 }], saldoFinal: -42 },
    { id: "20", fecha: "20/10/2026", producido: 10, repartos: [], saldoFinal: 500 },
    { id: "21", fecha: "21/10/2026", producido: 5, repartos: [], saldoFinal: 120 },
  ];
  const antes = structuredClone(movimientos);
  const porFecha = Object.fromEntries(reconstruirBodega(movimientos, 916, "2026-10-20").map(m => [fechaHistorialISO(m.fecha), m]));
  assert.equal(porFecha["2026-10-18"].saldoFinal, 1000);
  assert.equal(porFecha["2026-10-19"].saldoFinal, -42);
  assert.equal(porFecha["2026-10-20"].saldoFinal, 926);
  assert.equal(porFecha["2026-10-21"].saldoFinal, 931);
  assert.deepEqual(movimientos, antes, "los movimientos originales quedan intactos");
});

test("el saldo inicial consultado respeta la fecha de apertura", () => {
  const movimientos = [
    { fecha: "18/10/2026", saldoFinal: 1000 },
    { fecha: "19/10/2026", saldoFinal: -42 },
    { fecha: "20/10/2026", saldoFinal: 926 },
  ];
  assert.equal(saldoInicialBodegaEnFecha(movimientos, 916, "2026-10-20", "2026-10-19"), 1000);
  assert.equal(saldoInicialBodegaEnFecha(movimientos, 916, "2026-10-20", "2026-10-20"), 916);
  assert.equal(saldoInicialBodegaEnFecha(movimientos, 916, "2026-10-20", "2026-10-21"), 926);
  assert.equal(saldoInicialBodegaEnFecha([], 916, "2026-10-20", "2026-10-19"), null);
});

test("el guardado conserva devoluciones buenas anteriores al conteo físico para el saldo del día siguiente", () => {
  const movimientos = [
    { id: "b-13", fecha: "13/10/2026", producido: 0, repartos: [], saldoFinal: 350.5, versionSaldoBodega: 2, ajusteHistoricoImplicito: 0 },
    {
      id: "b-14", fecha: "14/10/2026", producido: 148.5, repartos: [], rutaNeta: 280,
      devolucionesSinTiquete: [{ fechaRecepcion: "2026-10-14", cartonesBuenos: 29, cartonesMalos: 3 }],
      saldoFinal: 219, versionSaldoBodega: 2, ajusteHistoricoImplicito: 0,
    },
    { id: "b-15", fecha: "15/10/2026", producido: 152, repartos: [], rutaNeta: 0, saldoFinal: 371, versionSaldoBodega: 2, ajusteHistoricoImplicito: 0 },
  ];
  const sinImpactoPersistido = reconstruirBodega(movimientos, 916, "2026-10-20");
  assert.equal(sinImpactoPersistido.find(m => m.id === "b-14").saldoFinal, 219);
  assert.equal(sinImpactoPersistido.find(m => m.id === "b-15").saldoFinal, 371);

  const conImpactoPersistido = reconstruirBodega(movimientos.map(m =>
    m.id === "b-14" ? { ...m, movimientoTiquetes: 29 } : m
  ), 916, "2026-10-20");
  assert.equal(conImpactoPersistido.find(m => m.id === "b-14").saldoFinal, 248);
  assert.equal(conImpactoPersistido.find(m => m.id === "b-15").saldoFinal, 400);
  assert.equal(saldoInicialBodegaEnFecha(conImpactoPersistido, 916, "2026-10-20", "2026-10-15"), 248);
});


test("el guardado usa la apertura remota vigente y no persiste la apertura vieja de la pantalla", () => {
  const movimientos = [
    { id: "b-14", fecha: "14/10/2026", saldoFinal: 248, versionSaldoBodega: 2 },
    { id: "b-15", fecha: "15/10/2026", producido: 152, saldoFinal: 371, versionSaldoBodega: 2 },
  ];
  const aperturaActual = saldoInicialBodegaEnFecha(movimientos, 916, "2026-10-20", "2026-10-15");
  const cierreGuardado = saldoCalculadoBodega({ saldoBase: aperturaActual, producido: 152 });

  assert.equal(aperturaActual, 248);
  assert.equal(cierreGuardado, 400);
  assert.notEqual(saldoCalculadoBodega({ saldoBase: 219, producido: 152 }), cierreGuardado);
});
