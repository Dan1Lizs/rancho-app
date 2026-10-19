import test from "node:test";
import assert from "node:assert/strict";
import { analizarRuta, serializarRuta } from "../src/rutas.js";

test("un enlace profundo conserva la vista y sus filtros aunque el texto esté codificado", () => {
  const ruta = analizarRuta("#/planta?sub=historial&categoria=Aves&formula=651+Impulsor+VYMISA&id=mov-123");
  assert.equal(ruta.vista, "planta");
  assert.equal(ruta.params.get("sub"), "historial");
  assert.equal(ruta.params.get("categoria"), "Aves");
  assert.equal(ruta.params.get("formula"), "651 Impulsor VYMISA");
  assert.equal(ruta.params.get("id"), "mov-123");
});

test("la ruta inicial se puede serializar y volver a leer sin perder fecha o galpón", () => {
  const hash = serializarRuta("captura", { fecha: "2026-10-18", lote: "lote-4" });
  const ruta = analizarRuta(hash);
  assert.equal(ruta.vista, "captura");
  assert.equal(ruta.params.get("fecha"), "2026-10-18");
  assert.equal(ruta.params.get("lote"), "lote-4");
});

test("un hash vacío no fuerza una ruta", () => {
  assert.equal(analizarRuta(""), null);
  assert.equal(analizarRuta("#"), null);
});
