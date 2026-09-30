import test from "node:test";
import assert from "node:assert/strict";
import { alertaEstaSuprimida, claveAlerta, normalizarTextoAlerta, ultimoEventoAlerta } from "../src/alertasRevision.js";

test("la identidad de una alerta ignora números que cambian cada día", () => {
  assert.equal(
    normalizarTextoAlerta("Impulsor: 2.5 días sin consumo (29/09/2026)"),
    "impulsor: n días sin consumo (fecha)",
  );
  assert.equal(
    claveAlerta({ texto: "Gallinero 1: 12 días sin control" }, "auditoria"),
    claveAlerta({ texto: "Gallinero 1: 13 días sin control" }, "auditoria"),
  );
  assert.notEqual(
    claveAlerta({ texto: "Gallinero 1: 12 días sin control" }, "auditoria"),
    claveAlerta({ texto: "Gallinero 2: 12 días sin control" }, "auditoria"),
  );
});

test("un evento de reactivación reemplaza el descarte anterior", () => {
  const item = { alertaId: "cobertura:aves:impulsor", texto: "sin consumo suficiente" };
  const id = claveAlerta(item, "cobertura");
  const eventos = [
    { advId: id, accion: "reactivar", registradoEl: "2026-09-29T12:00:00Z" },
    { advId: id, accion: "eliminar", registradoEl: "2026-09-29T11:00:00Z" },
  ];
  const ultimo = ultimoEventoAlerta(eventos, item, "cobertura");
  assert.equal(ultimo.accion, "reactivar");
  assert.equal(alertaEstaSuprimida(ultimo), false);
});

test("mantiene descartes antiguos aunque cambien las cifras de la alerta", () => {
  const item = { texto: "Gallinero 2: 13 días sin control" };
  const evento = {
    advId: "auditoria:Gallinero 2: 12 días sin control",
    seccion: "auditoria",
    textoOriginal: "Gallinero 2: 12 días sin control",
    accion: "eliminar",
  };
  assert.equal(ultimoEventoAlerta([evento], item, "auditoria"), evento);
  assert.equal(alertaEstaSuprimida(ultimoEventoAlerta([evento], item, "auditoria")), true);
});

