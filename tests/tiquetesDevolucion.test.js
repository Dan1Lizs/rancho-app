import test from "node:test";
import assert from "node:assert/strict";
import {
  buscarTiqueteDevuelto,
  asociarUsosDeTiquetesARepartos,
  cartonesUsadosTiquete,
  esCantidadMediaCarton,
  formatoCartones,
  fechaISODeTiquete,
  idOperacionTiquete,
  impactoTiquetesEnFecha,
  idRepartoBodega,
  numeroCartones,
  rutasBodegaParaTiquetes,
  validarUsoTiquete,
} from "../src/features/bodega/tiquetesDevolucion.js";

test("un uso parcial deja el sobrante del tiquete disponible", () => {
  const tiquetes = [{ id: "ticket-1", numero: "DV-12", saldo_cartones: 8 }];
  assert.equal(validarUsoTiquete({ tiquetes, numero: " dv-12 ", cartones: 3 }).ok, true);
  assert.equal(validarUsoTiquete({ tiquetes, numero: "DV-12", cartones: 9 }).motivo, "saldo-insuficiente");
  assert.equal(validarUsoTiquete({ tiquetes, numero: "desconocido", cartones: 1 }).motivo, "no-encontrado");
  assert.equal(validarUsoTiquete({ tiquetes, numero: "DV-12", cartones: "2,5" }).ok, true);
  assert.equal(validarUsoTiquete({ tiquetes, numero: "DV-12", cartones: 1.25 }).motivo, "cantidad-invalida");
  assert.equal(numeroCartones("7,5"), 7.5);
  assert.equal(esCantidadMediaCarton("7,5"), true);
  assert.equal(esCantidadMediaCarton("7.25"), false);
  assert.equal(formatoCartones(148.5), "148.5");
  assert.equal(formatoCartones(149), "149");
});

test("el kardex suma entradas, usos y correcciones solo en su fecha efectiva", () => {
  const movimientos = [
    { fecha: "2026-10-01", cartones_delta: 12, tipo: "devolucion" },
    { fecha: "2026-10-02", operacion_id: "op-uso", cartones_delta: -5, tipo: "uso" },
    { fecha: "2026-10-02", cartones_delta: 2, tipo: "correccion" },
  ];
  assert.equal(impactoTiquetesEnFecha(movimientos, "2026-10-01"), 12);
  assert.equal(impactoTiquetesEnFecha(movimientos, "2026-10-02"), -3);
  assert.equal(impactoTiquetesEnFecha(movimientos, "2026-10-02", ["op-uso"]), 2);
});

test("normaliza fechas históricas y crea identificadores de operación válidos para Postgres", () => {
  assert.equal(fechaISODeTiquete("30/09/2026"), "2026-09-30");
  assert.equal(fechaISODeTiquete("2026-10-01"), "2026-10-01");
  assert.match(idOperacionTiquete(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test("el historial de uso se acumula por id del tiquete, no por su número editable", () => {
  const tiquete = { id: "ticket-1", numero: "DV-12" };
  const movimientos = [
    { tiquete_id: "ticket-1", tipo: "uso", cartones_delta: -2 },
    { tiquete_id: "ticket-1", tipo: "uso", cartones_delta: -3 },
    { tiquete_id: "ticket-2", tipo: "uso", cartones_delta: -7 },
  ];
  assert.equal(cartonesUsadosTiquete(tiquete, movimientos), 5);
  assert.equal(buscarTiqueteDevuelto([tiquete], " dv-12 "), tiquete);
});

test("las rutas quedan asociadas a un identificador estable del repartidor", () => {
  const movimientos = [{
    id: "bodega-2026-10-01",
    fecha: "01/10/2026",
    repartos: [{ nombre: "Rosa", salida: 20 }, { id: "ruta-2", nombre: "Luis", salida: 10 }],
  }];
  const rutas = rutasBodegaParaTiquetes(movimientos);
  assert.equal(rutas.length, 2);
  assert.equal(rutas[0].rutaId, "legacy:bodega-2026-10-01:0");
  assert.equal(idRepartoBodega("bodega-2026-10-01", movimientos[0].repartos[1], 1), "ruta-2");
  assert.equal(rutas[0].fecha, "2026-10-01");
});

test("los usos registrados se vuelven a asociar a la ruta al cargar o consultar una fecha", () => {
  const ruta = { nombre: "Rosa", salida: 10 };
  const uso = {
    operacion_id: "uso-1", tiquete_id: "dev-1", tipo: "uso", numero: "DV-2",
    cartones_delta: -0.5, fecha: "2026-10-02", ruta_mov_id: "b-02", ruta_id: "legacy:b-02:0",
  };
  const resultado = asociarUsosDeTiquetesARepartos("b-02", [ruta], [uso, uso]);
  assert.equal(resultado[0].tiquetesDevueltos.length, 1);
  assert.equal(resultado[0].tiquetesDevueltos[0].cartones, 0.5);
  assert.equal(resultado[0].id, "legacy:b-02:0");
  assert.equal(asociarUsosDeTiquetesARepartos("b-03", [ruta], [uso])[0], ruta);
});
