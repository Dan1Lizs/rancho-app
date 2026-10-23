import test from "node:test";
import assert from "node:assert/strict";
import { ajustarMovimientosTiquetesReporte, entradaProducidaReporte, resumenDevolucionesRutaReporte, saldoBodegaReporte, sumarCartonesProduccion } from "../src/features/reportes/calculosControlDiario.js";
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

test("el reporte conserva los malos como dato, pero no los aplica al saldo", () => {
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
  assert.equal(recibidosHoy.detalleRutas[0].buenosExplicitos, 13);
  assert.equal(recibidosHoy.detalleRutas[0].malosVinculados, 0);
  assert.equal(cargadosAlOrigen.detalleRutas[0].malosVinculados, 5);

  const salidaRuta = rutaNetaBodega([{ salida: 100, devMalo: 5 }]);
  const saldoTrasSalidaYMalos = saldoBodegaReporte(200, 0, { movimientoTiquetes: 0 }, salidaRuta);
  const saldoTrasDevolucionBuena = saldoBodegaReporte(saldoTrasSalidaYMalos.saldoFinal, 0, { movimientoTiquetes: 13 }, 0);
  assert.equal(salidaRuta, 100);
  assert.equal(saldoTrasSalidaYMalos.saldoFinal, 100);
  assert.equal(saldoTrasDevolucionBuena.saldoFinal, 113);
});


test("una devolución histórica anterior a la apertura actual no se convierte en una salida ficticia", () => {
  const ajuste = ajustarMovimientosTiquetesReporte({
    movimientoTiquetes: 0, buenosExplicitosHoy: 13,
    fecha: "2026-10-12", fechaApertura: "2026-10-20",
  });
  assert.equal(ajuste.otrosMovimientos, 0);
  assert.equal(ajuste.movimientoParaSaldo, 13);
  const saldo = saldoBodegaReporte(513, 148.5, { movimientoTiquetes: ajuste.movimientoParaSaldo, regalado: 1 }, 0);
  assert.equal(saldo.saldoFinal, 673.5);
});

test("conserva otros movimientos reales al separar una devolución histórica", () => {
  const ajuste = ajustarMovimientosTiquetesReporte({
    movimientoTiquetes: -2, buenosExplicitosHoy: 13,
    fecha: "2026-10-12", fechaApertura: "2026-10-20",
  });
  assert.equal(ajuste.otrosMovimientos, -2);
  assert.equal(ajuste.movimientoParaSaldo, 11);
});
