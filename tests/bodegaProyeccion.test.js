import test from "node:test";
import assert from "node:assert/strict";
import { fechaHistorialISO, saldoInicialBodegaEnFecha } from "../src/historial.js";
import { reconstruirBodegaSoloLectura, reconciliarBodegaConProduccion, validarCadenaBodega } from "../src/bodegaProyeccion.js";
import { ajustarMovimientosTiquetesReporte, resumenDevolucionesRutaReporte, salidaEfectivaReporte, saldoBodegaReporte } from "../src/features/reportes/calculosControlDiario.js";

test("la proyección usa la producción guardada y conserva la cadena aunque el conteo físico sea posterior", () => {
  const movimientos = [
    { id: "02", fecha: "02/10/2026", producido: 0, ajusteConteo: 400, saldoFinal: 400, versionSaldoBodega: 2 },
    { id: "15", fecha: "15/10/2026", producido: 0, saldoFinal: 400, versionSaldoBodega: 2 },
    { id: "16", fecha: "16/10/2026", producido: 0, saldoFinal: 400, versionSaldoBodega: 2 },
    { id: "17", fecha: "17/10/2026", producido: 145, saldoFinal: 545, versionSaldoBodega: 2 },
    { id: "19", fecha: "19/10/2026", producido: 0, ajusteConteo: 916, saldoFinal: 916, versionSaldoBodega: 2 },
  ];
  const registros = [
    { fecha: "16/10/2026", cartones: 150.5 },
    { fecha: "17/10/2026", cartones: 145 },
    { fecha: "19/10/2026", cartones: 0 },
  ];
  const movimientosAntes = structuredClone(movimientos);
  const registrosAntes = structuredClone(registros);

  const vista = reconstruirBodegaSoloLectura(movimientos, registros, 0, "20/10/2026", [], "16/10/2026");
  const porFecha = Object.fromEntries(vista.map(m => [fechaHistorialISO(m.fecha), m]));

  assert.equal(porFecha["2026-10-16"].saldoFinal, 550.5);
  assert.equal(saldoInicialBodegaEnFecha(vista, 0, "20/10/2026", "17/10/2026"), 550.5);
  assert.equal(porFecha["2026-10-17"].saldoFinal, 695.5);
  assert.equal(porFecha["2026-10-19"].saldoFinal, 916, "el conteo explícito posterior sigue siendo ancla");
  assert.deepEqual(movimientos, movimientosAntes, "no modifica los movimientos guardados");
  assert.deepEqual(registros, registrosAntes, "no modifica los controles guardados");
});

test("la proyección no decide a ciegas si el día que debe recalcular tiene Bodega duplicada", () => {
  const movimientos = [
    { id: "15", fecha: "15/10/2026", producido: 0, ajusteConteo: 400, saldoFinal: 400 },
    { id: "16a", fecha: "16/10/2026", producido: 0, saldoFinal: 400 },
    { id: "16b", fecha: "16/10/2026", producido: 0, saldoFinal: 400 },
  ];
  const registros = [{ fecha: "16/10/2026", cartones: 150.5 }];
  const vista = reconstruirBodegaSoloLectura(movimientos, registros, 0, "20/10/2026", [], "16/10/2026");

  assert.equal(vista.find(m => m.id === "16a").saldoFinal, 400);
  assert.equal(vista.find(m => m.id === "16b").saldoFinal, 400);
});

test("reconcilia producción faltante y resta devoluciones una sola vez en la cadena de Bodega", () => {
  const movimientos = [
    { id: "28", fecha: "28/10/2026", producido: 0, ajusteConteo: 584, saldoFinal: 584, versionSaldoBodega: 2 },
    { id: "29", fecha: "29/10/2026", producido: 149.5, saldoFinal: 733.5, versionSaldoBodega: 2 },
    { id: "01", fecha: "01/11/2026", producido: 149, vendGranja: 15, destruido: 2, regalado: 3, saldoFinal: 862.5, versionSaldoBodega: 2 },
    {
      id: "02", fecha: "02/11/2026", producido: 135.5, rutaNeta: 568, movimientoTiquetes: -1.5, regalado: 3, saldoFinal: 425.5, versionSaldoBodega: 2,
      repartos: [{ id: "andres", nombre: "Andrés", salida: 200 }, { id: "edy", nombre: "Edy", salida: 439.5 }],
      devolucionesSinTiquete: [
        { id: "d1", rutaMovId: "02", rutaId: "andres", repartidor: "Andrés", cartonesBuenos: 61, cartonesMalos: 0.5, fechaRecepcion: "2026-11-02", reglaSalidaNeta: true },
        { id: "d2", rutaMovId: "02", rutaId: "edy", repartidor: "Edy", cartonesBuenos: 9, cartonesMalos: 1, fechaRecepcion: "2026-11-02", reglaSalidaNeta: true },
      ],
    },
  ];
  const registros = [
    { fecha: "30/10/2026", cartones: 151 }, { fecha: "31/10/2026", cartones: 150 },
    { fecha: "01/11/2026", cartones: 149 }, { fecha: "02/11/2026", cartones: 135.5 },
  ];

  const reconciliacion = reconciliarBodegaConProduccion(movimientos, registros, 0, "20/10/2026", [], "30/10/2026");
  const porFecha = Object.fromEntries(reconciliacion.movimientos.map(m => [fechaHistorialISO(m.fecha), m]));
  const reporte = resumenDevolucionesRutaReporte({
    movimientosBodega: reconciliacion.movimientos,
    fecha: "2026-11-02", movimientoId: "02", repartos: porFecha["2026-11-02"].repartos,
  });

  assert.equal(reconciliacion.duplicado, null);
  assert.deepEqual(reconciliacion.generados.map(m => fechaHistorialISO(m.fecha)).sort(), ["2026-10-30", "2026-10-31"]);
  assert.equal(porFecha["2026-10-30"].saldoFinal, 884.5);
  assert.equal(porFecha["2026-10-31"].saldoFinal, 1034.5);
  assert.equal(porFecha["2026-11-01"].saldoFinal, 1163.5);
  assert.equal(porFecha["2026-11-02"].rutaNeta, 568);
  assert.equal(porFecha["2026-11-02"].movimientoTiquetes, -1.5);
  assert.equal(porFecha["2026-11-02"].saldoFinal, 726.5);
  assert.equal(saldoInicialBodegaEnFecha(reconciliacion.movimientos, 0, "20/10/2026", "03/11/2026"), 726.5);
  const salidaEfectiva = salidaEfectivaReporte(porFecha["2026-11-02"].repartos, reporte.detalleRutas);
  assert.equal(salidaEfectiva, 568);
  const otros = ajustarMovimientosTiquetesReporte({
    movimientoTiquetes: porFecha["2026-11-02"].movimientoTiquetes,
    buenosExplicitosHoy: reporte.buenosExplicitosHoy,
    impactoMalosIncluidoEnMovimiento: reporte.impactoMalosIncluidoEnMovimiento,
    movimientoTiquetesYaIncluyeBuenosExplicitos: true,
  }).movimientoParaSaldo;
  assert.equal(saldoBodegaReporte(1163.5, 135.5, { ...porFecha["2026-11-02"], movimientoTiquetes: otros }, salidaEfectiva, reporte.impactoMalosSeparado).saldoFinal, 726.5);
  assert.equal(validarCadenaBodega(reconciliacion.movimientos).ok, true);
  const salidaBrutaGuardada = reconciliacion.movimientos.map(m => fechaHistorialISO(m.fecha) === "2026-11-02" ? { ...m, rutaNeta: 639.5 } : m);
  assert.equal(validarCadenaBodega(salidaBrutaGuardada).motivo, "ruta", "detecta que se guardó la salida bruta sin rebajar las devoluciones");

  const cadenaRota = reconciliacion.movimientos.map(m => fechaHistorialISO(m.fecha) === "2026-11-02" ? { ...m, saldoFinal: 700 } : m);
  assert.equal(validarCadenaBodega(cadenaRota).ok, false, "bloquea una escritura cuyo cierre no coincide con el día anterior y los movimientos");
});

test("la sincronización desde una fecha nunca reescribe discrepancias históricas anteriores", () => {
  const movimientos = [
    { id: "16", fecha: "16/10/2026", producido: 0, saldoFinal: 400, versionSaldoBodega: 2 },
    { id: "30", fecha: "30/10/2026", producido: 100, saldoFinal: 500, versionSaldoBodega: 2 },
  ];
  const registros = [
    { fecha: "16/10/2026", cartones: 150.5 },
    { fecha: "30/10/2026", cartones: 100 },
  ];
  const antes = structuredClone(movimientos);
  const resultado = reconciliarBodegaConProduccion(movimientos, registros, 0, "20/10/2026", [], "30/10/2026");
  const fecha16 = resultado.movimientos.find(m => fechaHistorialISO(m.fecha) === "2026-10-16");
  assert.deepEqual(fecha16, antes[0], "el dato previo al tramo autorizado se conserva sin recálculo");
  assert.equal(resultado.movimientos.find(m => fechaHistorialISO(m.fecha) === "2026-10-30").saldoFinal, 500);
  assert.deepEqual(movimientos, antes, "la proyección no muta las filas de origen");
});
