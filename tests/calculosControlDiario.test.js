import test from "node:test";
import assert from "node:assert/strict";
import { ajustarMovimientosTiquetesReporte, entradaProducidaReporte, resumenDevolucionesRutaReporte, salidaEfectivaRepartoReporte, salidaEfectivaReporte, saldoBodegaReporte, sumarCartonesProduccion } from "../src/features/reportes/calculosControlDiario.js";
import { rutaNetaBodega } from "../src/historial.js";

test("la suma de producción conserva medios cartones y tolera datos numéricos en texto", () => {
  assert.equal(sumarCartonesProduccion([49, "40", "59,5", 0]), 148.5);
  assert.equal(sumarCartonesProduccion([{ cartones: 148.4 }, { cartones: 0.1 }]), 148.5);
});

test("el reporte prefiere la producción de los registros del día a un total de Bodega redondeado", () => {
  const registros = [{ cartones: 49 }, { cartones: 40 }, { cartones: 59.5 }];
  assert.equal(entradaProducidaReporte(registros, { producido: 149 }, registros), 148.5);
});

test("sin registros diarios el reporte conserva el valor guardado en Bodega", () => {
  assert.equal(entradaProducidaReporte([], { producido: 148.5 }, []), 148.5);
  assert.equal(entradaProducidaReporte([], null, []), "");
});

test("el saldo del reporte usa producción exacta y conserva medios cartones", () => {
  const saldo = saldoBodegaReporte(518, 148.5, { comprado: 0 }, -8);
  assert.equal(saldo.saldoFinal, 674.5);
});

test("un conteo físico prevalece y la diferencia queda visible", () => {
  const saldo = saldoBodegaReporte(518, 148.5, { ajusteConteo: 675 }, -8);
  assert.equal(saldo.saldoProyectado, 674.5);
  assert.equal(saldo.saldoFinal, 675);
  assert.equal(saldo.ajusteConteo, 0.5);
});

test("el reporte aplica a los retornos históricos la lógica nueva sin cambiar sus registros", () => {
  const movimientosBodega = [
    { id: "b-11", fecha: "11/10/2026", repartos: [{ id: "r-bryan-11", nombre: "Bryan", salida: 100 }] },
    { id: "b-12", fecha: "12/10/2026", repartos: [], devolucionesSinTiquete: [{
      id: "dev-12", fechaRecepcion: "2026-10-12", fechaRutaOrigen: "2026-10-11",
      rutaMovId: "b-11", rutaId: "r-bryan-11", repartidor: "Bryan", cartonesBuenos: 13, cartonesMalos: 5,
    }] },
  ];

  const recibidosHoy = resumenDevolucionesRutaReporte({
    movimientosBodega,
    fecha: "2026-10-12",
    movimientoId: "b-12",
    repartos: [{ nombre: "Bryan" }],
  });
  const cargadosAlOrigen = resumenDevolucionesRutaReporte({
    movimientosBodega,
    fecha: "2026-10-11",
    movimientoId: "b-11",
    repartos: movimientosBodega[0].repartos,
  });

  assert.equal(recibidosHoy.buenosExplicitosHoy, 13);
  assert.equal(recibidosHoy.detalleRutas[0].buenosExplicitos, 0);
  assert.equal(recibidosHoy.detalleRutas[0].malosVinculados, 0);
  assert.equal(recibidosHoy.malosRecibidosHoy, 5);
  assert.equal(recibidosHoy.impactoMalosSeparado, -5);
  assert.equal(recibidosHoy.impactoMalosIncluidoEnMovimiento, 0);
  assert.equal(cargadosAlOrigen.detalleRutas[0].buenosIntegrados, 13);
  assert.equal(cargadosAlOrigen.detalleRutas[0].malosVinculados, 5);
  assert.equal(cargadosAlOrigen.detalleRutas[0].malosIntegrados, 5);

  const salidaRuta = salidaEfectivaReporte(
    movimientosBodega[0].repartos, cargadosAlOrigen.detalleRutas, movimientosBodega[0].rutaNeta,
  );
  const saldoTrasSalidaYMalos = saldoBodegaReporte(200, 0, { movimientoTiquetes: 0 }, salidaRuta);
  const ajusteRecepcion = ajustarMovimientosTiquetesReporte({
    movimientoTiquetes: 0,
    impactoMalosIncluidoEnMovimiento: recibidosHoy.impactoMalosIncluidoEnMovimiento,
    impactoMalosSeparado: recibidosHoy.impactoMalosSeparado,
  });
  const saldoTrasRecepcion = saldoBodegaReporte(
    saldoTrasSalidaYMalos.saldoFinal, 0, { movimientoTiquetes: ajusteRecepcion.movimientoParaSaldo }, 0,
    recibidosHoy.impactoMalosSeparado,
  );
  assert.equal(salidaRuta, 82);
  assert.equal(saldoTrasSalidaYMalos.saldoFinal, 118);
  assert.equal(saldoTrasRecepcion.saldoFinal, 113);
});

test("la salida efectiva también descuenta devoluciones históricas que están en el registro de ruta", () => {
  assert.equal(salidaEfectivaRepartoReporte({ salida: 100, devBueno: 2, devMalo: 5 }), 93);
});

test("el reporte descuenta buenos y malos de la entrega y aplica la merma una sola vez al recibirla", () => {
  const movimientosBodega = [
    { id: "b-11", fecha: "11/10/2026", repartos: [{ id: "r-1", nombre: "Bryan", salida: 100 }] },
    { id: "b-12", fecha: "12/10/2026", movimientoTiquetes: -5, repartos: [], devolucionesSinTiquete: [{
      id: "dev-12", fechaRecepcion: "2026-10-12", fechaRutaOrigen: "2026-10-11",
      rutaMovId: "b-11", rutaId: "r-1", repartidor: "Bryan", cartonesBuenos: 2, cartonesMalos: 5,
      reglaSalidaNeta: true,
    }] },
  ];
  const reporteOrigen = resumenDevolucionesRutaReporte({
    movimientosBodega,
    fecha: "2026-10-11",
    movimientoId: "b-11",
    repartos: movimientosBodega[0].repartos,
  });
  assert.equal(reporteOrigen.detalleRutas[0].buenosIntegrados, 2);
  assert.equal(reporteOrigen.detalleRutas[0].malosIntegrados, 5);
  assert.equal(rutaNetaBodega([{ salida: 100 }]) - reporteOrigen.detalleRutas[0].buenosIntegrados - reporteOrigen.detalleRutas[0].malosIntegrados, 93);

  const recibidoHoy = resumenDevolucionesRutaReporte({ movimientosBodega, fecha: "2026-10-12", movimientoId: "b-12", repartos: [] });
  const ajuste = ajustarMovimientosTiquetesReporte({
    movimientoTiquetes: -5,
    impactoMalosIncluidoEnMovimiento: recibidoHoy.impactoMalosIncluidoEnMovimiento,
  });
  assert.equal(recibidoHoy.malosRecibidosHoy, 5);
  assert.equal(ajuste.otrosMovimientos, 0);
  assert.equal(saldoBodegaReporte(107, 0, { movimientoTiquetes: ajuste.movimientoParaSaldo }, 0, recibidoHoy.impactoMalosSeparado).saldoFinal, 102);
});


test("una devolución buena histórica se reclasifica y se quita de la entrada guardada", () => {
  const ajuste = ajustarMovimientosTiquetesReporte({
    movimientoTiquetes: 13, buenosExplicitosHoy: 13,
    movimientoTiquetesYaIncluyeBuenosExplicitos: true,
  });
  assert.equal(ajuste.otrosMovimientos, 0);
  assert.equal(ajuste.movimientoParaSaldo, 0);
});

test("conserva otros movimientos reales al separar una devolución histórica", () => {
  const ajuste = ajustarMovimientosTiquetesReporte({
    movimientoTiquetes: 11, buenosExplicitosHoy: 13,
    movimientoTiquetesYaIncluyeBuenosExplicitos: true,
  });
  assert.equal(ajuste.otrosMovimientos, -2);
  assert.equal(ajuste.movimientoParaSaldo, -2);
});

test("las devoluciones buenas no se suman como entrada aparte en el reporte", () => {
  const ajuste = ajustarMovimientosTiquetesReporte({
    movimientoTiquetes: 13,
    buenosExplicitosHoy: 13,
    movimientoTiquetesYaIncluyeBuenosExplicitos: true,
  });
  assert.equal(ajuste.otrosMovimientos, 0);
  assert.equal(ajuste.movimientoParaSaldo, 0);

  const saldo = saldoBodegaReporte(526.5, 148.5, {
    regalado: 1,
    movimientoTiquetes: ajuste.movimientoParaSaldo,
  }, -13);
  assert.equal(saldo.saldoFinal, 687);
});

test("el reporte histórico del ejemplo rebaja 12.5, 16.5 y 3 de sus rutas y descuenta los malos al recibir", () => {
  const repartoAndres = { id: "r-andres", nombre: "Andrés", salida: 150 };
  const repartoBrayan = { id: "r-brayan", nombre: "Brayan", salida: 130 };
  const movimientosBodega = [{
    id: "b-12", fecha: "12/10/2026", producido: 148.5, movimientoTiquetes: 29,
    repartos: [repartoAndres, repartoBrayan],
  }];
  const movimientosTiquetes = [
    { tipo: "devolucion", numero: "D-1", fecha: "2026-10-12", ruta_mov_id: "b-12", ruta_id: "r-andres", repartidor: "Andrés", cartones_delta: 12.5, regla_salida_neta: false },
    { tipo: "devolucion", numero: "D-2", fecha: "2026-10-12", ruta_mov_id: "b-12", ruta_id: "r-brayan", repartidor: "Brayan", cartones_delta: 16.5, regla_salida_neta: false },
    { tipo: "devolucion_mala", numero: "D-2", fecha: "2026-10-12", ruta_mov_id: "b-12", ruta_id: "r-brayan", repartidor: "Brayan", cartones_delta: 0, cartones_informativos: 3, regla_salida_neta: false },
  ];
  const datosGuardadosAntes = structuredClone({ movimientosBodega, movimientosTiquetes });
  const resumen = resumenDevolucionesRutaReporte({
    movimientosBodega, movimientosTiquetes, fecha: "2026-10-12", movimientoId: "b-12",
    repartos: [repartoAndres, repartoBrayan],
  });
  const efectivaAndres = salidaEfectivaRepartoReporte(repartoAndres, resumen.detalleRutas[0]);
  const efectivaBrayan = salidaEfectivaRepartoReporte(repartoBrayan, resumen.detalleRutas[1]);
  const ajuste = ajustarMovimientosTiquetesReporte({
    movimientoTiquetes: movimientosBodega[0].movimientoTiquetes,
    buenosExplicitosHoy: resumen.buenosExplicitosHoy,
    movimientoTiquetesYaIncluyeBuenosExplicitos: true,
    impactoMalosIncluidoEnMovimiento: resumen.impactoMalosIncluidoEnMovimiento,
  });
  const salidaEfectiva = salidaEfectivaReporte([repartoAndres, repartoBrayan], resumen.detalleRutas);
  const saldo = saldoBodegaReporte(350.5, 148.5, { movimientoTiquetes: ajuste.movimientoParaSaldo }, salidaEfectiva, resumen.impactoMalosSeparado);

  assert.equal(efectivaAndres, 137.5);
  assert.equal(efectivaBrayan, 110.5);
  assert.equal(salidaEfectiva, 248);
  assert.equal(resumen.malosRecibidosHoy, 3);
  assert.equal(resumen.impactoMalosSeparado, -3);
  assert.equal(ajuste.otrosMovimientos, 0, "la entrada histórica de 29 no se duplica en otros movimientos");
  assert.equal(saldo.saldoFinal, 248);
  assert.deepEqual({ movimientosBodega, movimientosTiquetes }, datosGuardadosAntes, "el cálculo del reporte no reescribe el historial");
});
