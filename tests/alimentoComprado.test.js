import test from "node:test";
import assert from "node:assert/strict";
import { calcularSaldoAlimentoComprado, convertirAkg, disponibilidadAlimentoComprado } from "../src/alimentoComprado.js";

test("convierte presentaciones y kilos a una sola unidad de inventario", () => {
  assert.equal(convertirAkg(7, "Saco", 46), 322);
  assert.equal(convertirAkg(7, "kg", 46), 7);
  assert.equal(convertirAkg(-1, "Saco", 46), null);
});
test("el kardex comprado descuenta consumo por lote sin tocar el saldo de Planta propia", () => {
  const movimientos = [{ tipo: "compra_comprado", productoCompradoId: "pollita-inicio", fecha: "16/10/2026", kg: 322 }];
  const registros = [
    { fecha: "16/10/2026", lote: "G4", origenAlimento: "comprado", productoCompradoId: "pollita-inicio", alimentoKg: 18 },
    { fecha: "16/10/2026", lote: "G1", origenAlimento: "propio", formulaConcentrado: "Impulsor", alimentoKg: 80 },
  ];
  assert.equal(calcularSaldoAlimentoComprado("pollita-inicio", "2026-10-16", movimientos, registros), 304);
});

test("los ajustes físicos reemplazan la diferencia en kg y las compras con fecha futura no adelantan saldo", () => {
  const movimientos = [
    { tipo: "compra_comprado", productoCompradoId: "p1", fecha: "16/10/2026", kg: 322 },
    { tipo: "ajuste_comprado", productoCompradoId: "p1", fecha: "16/10/2026", kg: -12, registradoEl: "2026-10-16T18:00:00.000Z" },
    { tipo: "compra_comprado", productoCompradoId: "p1", fecha: "17/10/2026", kg: 50 },
  ];
  assert.equal(calcularSaldoAlimentoComprado("p1", "16/10/2026", movimientos, []), 310);
  assert.equal(calcularSaldoAlimentoComprado("p1", "17/10/2026", movimientos, []), 360);
});

test("validar disponibilidad al editar no cuenta dos veces el registro reemplazado", () => {
  const movimientos = [{ tipo: "compra_comprado", productoCompradoId: "p1", fecha: "16/10/2026", kg: 100 }];
  const registros = [{ fecha: "16/10/2026", lote: "G4", origenAlimento: "comprado", productoCompradoId: "p1", alimentoKg: 20 }];
  assert.equal(disponibilidadAlimentoComprado({ productoId: "p1", fecha: "16/10/2026", movimientos, registros, reemplazar: registros }), 100);
});
