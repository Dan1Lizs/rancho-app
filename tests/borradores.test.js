import test from "node:test";
import assert from "node:assert/strict";
import {
  capturasDiferentesDeBase,
  formularioBodegaDesdeMovimiento,
  formulariosIguales,
  inventarioMPTieneDatos,
  valoresFormularioBodega,
} from "../src/borradores.js";

test("date and responsible alone do not make an MP draft, but zero is a real count", () => {
  assert.equal(inventarioMPTieneDatos({}), false);
  assert.equal(inventarioMPTieneDatos({ MP001: { sacos: "", kg: "" } }), false);
  assert.equal(inventarioMPTieneDatos({ MP001: { sacos: "0", kg: "" } }), true);
  assert.equal(inventarioMPTieneDatos({ MP001: { sacos: "", kg: " 2.5 " } }), true);
});

test("saved Bodega values are not treated as changes", () => {
  const movimiento = {
    comprado: 2, vendGranja: 1, destruido: 0, regalado: 0,
    repartos: [{ nombre: "Bryan", salida: 12, devBueno: 1, devMalo: 0 }],
    obs: "Conteo revisado", ajusteConteo: 40,
  };
  const base = formularioBodegaDesdeMovimiento(movimiento, ["Bryan"]);
  const iguales = valoresFormularioBodega({
    movBodega: { comprado: "2", vendGranja: "1", destruido: "", regalado: "" },
    repartos: [{ nombre: "Bryan", salida: "12", devBueno: "1", devMalo: "0" }],
    obsInv: "Conteo revisado", ajusteBodega: "40",
  });

  assert.ok(formulariosIguales(iguales, base));
  assert.ok(!formulariosIguales({ ...iguales, obsInv: "Conteo corregido" }, base));
});

test("only captures that differ from saved values are kept as drafts", () => {
  const base = { G1: { alimento: "20" }, G2: { alimento: "30" } };
  const actual = { G1: { alimento: "20" }, G2: { alimento: "31" } };

  assert.deepEqual(capturasDiferentesDeBase(actual, base), { G2: { alimento: "31" } });
  assert.deepEqual(capturasDiferentesDeBase(base, base), {});
  assert.ok(formulariosIguales({ tiquetes: [{ num: 701 }] }, { tiquetes: [{ num: "701" }] }));
});
