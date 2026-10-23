import test from "node:test";
import assert from "node:assert/strict";
import { entradaProducidaReporte, sumarCartonesProduccion } from "../src/features/reportes/calculosControlDiario.js";

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
