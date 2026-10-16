import test from "node:test";
import assert from "node:assert/strict";
import { loteCuentaPostura, loteEnLevante, resumenPostura } from "../src/etapaProductiva.js";

test("pollitas menores a la edad configurada no entran en los KPIs de postura", () => {
  const lote = { id: "P1", nac: "2026-10-15", aves: 1000 };
  assert.equal(loteCuentaPostura(lote, "2026-10-16"), false);
  assert.equal(loteEnLevante(lote, "2026-10-16"), true);
  assert.equal(resumenPostura({ fecha: "16/10/2026", lotes: [lote], registros: [] }).postura, null);
});
test("la etapa de levante se puede fechar aunque ya alcanzó la edad mínima, si sigue marcada pre-postura", () => {
  const lote = { id: "P1", nac: "2025-01-01", aves: 1000, estadoProd: "Producción normal", historialEstadoProd: [{ desde: "2026-10-01", estado: "Levante / pre-postura" }] };
  assert.equal(loteEnLevante(lote, "2026-10-16"), true);
  assert.equal(loteCuentaPostura(lote, "2026-10-16"), false);
});
test("muda y estados especiales no cuentan como postura, pero la etapa se puede fechar", () => {
  const lote = {
    id: "A1", nac: "2025-01-01", aves: 500, estadoProd: "Producción normal",
    historialEstadoProd: [
      { estado: "Producción normal", desde: "2025-01-01" },
      { estado: "Pelecha (muda)", desde: "2026-09-01" },
      { estado: "Producción normal", desde: "2026-10-01" },
    ],
  };
  assert.equal(loteCuentaPostura(lote, "15/09/2026"), false);
  assert.equal(loteCuentaPostura(lote, "15/10/2026"), true);
});

test("un registro explícitamente fuera de postura no deprime los KPIs de otros galpones", () => {
  const lotes = [
    { id: "P1", nac: "2025-01-01", aves: 1000, estadoProd: "Producción normal" },
    { id: "A1", nac: "2025-01-01", aves: 500, estadoProd: "Producción normal" },
  ];
  const registros = [
    { fecha: "16/10/2026", lote: "P1", cartones: 30, posturaAplica: false },
    { fecha: "16/10/2026", lote: "A1", cartones: 50, posturaAplica: true },
  ];
  assert.equal(resumenPostura({ fecha: "16/10/2026", lotes, registros }).aves, 1500);
  assert.equal(resumenPostura({ fecha: "16/10/2026", lotes, registros }).huevos, 1500);
  assert.equal(resumenPostura({ fecha: "16/10/2026", lotes, registros }).postura, 100);
});

test("la postura histórica usa las aves alojadas menos la mortalidad anterior al día", () => {
  const lote = { id: "A1", nac: "2025-01-01", avesIniciales: 100, aves: 80 };
  const registros = [
    { fecha: "14/10/2026", lote: "A1", muertas: 10 },
    { fecha: "15/10/2026", lote: "A1", muertas: 5 },
    { fecha: "16/10/2026", lote: "A1", muertas: 5, cartones: 2 },
  ];
  const resumen = resumenPostura({ fecha: "16/10/2026", lotes: [lote], registros });
  assert.equal(resumen.aves, 85);
  assert.equal(resumen.huevos, 60);
  assert.equal(resumen.postura, (60 / 85) * 100);
});

test("un lote cerrado conserva postura hasta la fecha de cierre y se excluye después", () => {
  const lote = { id: "A1", nac: "2025-01-01", aves: 100, estado: "cerrado", cerradoFecha: "15/10/2026" };
  assert.equal(loteCuentaPostura(lote, "15/10/2026"), true);
  assert.equal(loteCuentaPostura(lote, "16/10/2026"), false);
});
