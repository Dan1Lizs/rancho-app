import test from "node:test";
import assert from "node:assert/strict";
import { saltosTiquetes, tiquetesDelDia, observacionesCaptura, erroresCaptura, excepcionesOperacion, csvAuditoria } from "../src/mejorasUX.js";

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

test("el guardado detiene cantidades negativas, no numéricas, fraccionadas o superiores al saldo de aves", () => {
  const errores = erroresCaptura({
    lote1: { muertas: "2.5", quebrados: "-1", alimento6am: "abc", alimento1pm: "4.25", aguaL: "-3" },
    lote2: { muertas: "11" },
  }, [
    { id: "lote1", galpon: 1, aves: 10 },
    { id: "lote2", galpon: 2, aves: 10 },
  ]);
  assert.equal(errores.length, 5);
  assert.ok(errores.some(x => x.includes("huevos quebrados")));
  assert.ok(errores.some(x => x.includes("alimento de la mañana")));
  assert.ok(errores.some(x => x.includes("un entero")));
  assert.ok(errores.some(x => x.includes("superar las aves")));
});

test("la captura de cartones admite enteros y medios cartones, no fracciones distintas", () => {
  const errores = erroresCaptura({
    lote1: { tiquetes: [{ num: "1", cartones: "7.25" }, { num: "2", cartones: "4.5" }] },
  }, [{ id: "lote1", galpon: 1, aves: 100 }]);
  assert.equal(errores.length, 1);
  assert.match(errores[0], /enteros o terminar en \.5/);
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

test("las excepciones de revisión incluyen un destino para investigar el origen", () => {
  const h = excepcionesOperacion({
    registros: [{ fecha: "25/09/2026", lote: "G3" }, { fecha: "25/09/2026", lote: "G3" }],
    lotes: [], saldoAves: 10, saldoGanado: -2,
    saldosAvesFormula: { "Cría": 8 }, saldosGanadoFormula: { "Impulsor": -3 },
    bodegaMovs: [{ id: "cierre-antiguo", fecha: "01/01/2000" }], retirosActivos: [], tareas: [],
  });
  const duplicado = h.find(x => x.tipo === "Duplicado");
  const negativo = h.find(x => x.tipo === "Saldo negativo" && x.texto.includes("Concentrado Ganado"));
  const formula = h.find(x => x.tipo === "Saldo negativo" && x.texto.includes("Impulsor"));
  const diferencia = h.find(x => x.tipo === "Sin conciliar");
  const bodega = h.find(x => x.tipo === "Bodega");
  assert.equal(duplicado.destino.vista, "historial");
  assert.deepEqual(duplicado.destino, { vista: "historial", fecha: "2026-09-25", lote: "G3" });
  assert.deepEqual(negativo.destino, { vista: "planta", categoria: "Ganado" });
  assert.deepEqual(formula.destino, { vista: "planta", categoria: "Ganado", formula: "Impulsor" });
  assert.equal(diferencia.destino.vista, "planta");
  assert.equal(bodega.destino.vista, "bodega");
  assert.equal(bodega.destino.id, "cierre-antiguo");
});

test("los controles pendientes enlazan al galpón que falta", () => {
  const h = excepcionesOperacion({
    registros: [], lotes: [{ id: "lote-1", galpon: 1, estado: "activo" }],
    saldoAves: 0, saldoGanado: 0, saldosAvesFormula: null, saldosGanadoFormula: null,
    bodegaMovs: [], retirosActivos: [], tareas: [],
  });
  const pendiente = h.find(x => x.tipo === "Pendiente");
  assert.equal(pendiente.destino.vista, "captura");
  assert.equal(pendiente.destino.lote, "lote-1");
  assert.match(pendiente.destino.fecha, /^\d{4}-\d{2}-\d{2}$/);
});

test("la exportación CSV conserva comas y comillas de la auditoría", () => {
  const csv = csvAuditoria([{ fecha: "28/09/2026", area: "Bodega", accion: "Edición", responsable: "José", motivo: 'Cambio, "conteo"', antes: 5, despues: 6 }]);
  assert.ok(csv.includes('"Cambio, ""conteo"""'));
});


test("las excepciones enlazan movimientos de planta fechados en el futuro", () => {
  const movimiento = { id: "bache-futuro", fecha: "30/10/2026", tipo: "bache", categoria: "Aves", formula: "651 Impulsor VYMISA", kg: 687.86 };
  const h = excepcionesOperacion({
    registros: [], lotes: [], saldoAves: 0, saldoGanado: 0,
    saldosAvesFormula: null, saldosGanadoFormula: null,
    bodegaMovs: [], retirosActivos: [], tareas: [], plantaMovs: [movimiento],
    hoy: new Date(2026, 9, 3),
  });
  const alerta = h.find(x => x.tipo === "Fecha futura");
  assert.ok(alerta.texto.includes("30/10/2026"));
  assert.deepEqual(alerta.destino, { vista: "planta", sub: "historial", categoria: "Aves", formula: "651 Impulsor VYMISA", id: "bache-futuro", fecha: "2026-10-30" });
});

test("los controles y pesajes futuros o con cantidades negativas llevan al registro exacto", () => {
  const h = excepcionesOperacion({
    registros: [{ id: "r-futuro", fecha: "20/10/2026", lote: "G1", alimentoKg: -2 }],
    pesajes: [{ id: "p-futuro", fecha: "21/10/2026", lote: "G1", pesos: [1800, -1] }],
    lotes: [], saldoAves: 0, saldoGanado: 0, saldosAvesFormula: null, saldosGanadoFormula: null,
    bodegaMovs: [], retirosActivos: [], tareas: [], hoy: new Date(2026, 9, 18),
  });
  const fechaRegistro = h.find(x => x.tipo === "Fecha futura" && x.destino.id === "r-futuro");
  const cantidadRegistro = h.find(x => x.tipo === "Cantidad inválida" && x.destino.id === "r-futuro");
  const fechaPesaje = h.find(x => x.tipo === "Fecha futura" && x.destino.id === "p-futuro");
  const cantidadPesaje = h.find(x => x.tipo === "Cantidad inválida" && x.destino.id === "p-futuro");
  assert.deepEqual(fechaRegistro.destino, { vista: "historial", fecha: "2026-10-20", lote: "G1", id: "r-futuro" });
  assert.equal(cantidadRegistro.texto.includes("alimentoKg"), true);
  assert.deepEqual(fechaPesaje.destino, { vista: "pesaje", sub: "histpesajes", fecha: "2026-10-21", lote: "G1", id: "p-futuro" });
  assert.match(cantidadPesaje.texto, /pesos negativos/);
});
