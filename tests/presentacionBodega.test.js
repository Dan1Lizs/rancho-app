import test from "node:test";
import assert from "node:assert/strict";
import { filasCambiosBodega, presentacionRutaNeta } from "../src/bodegaResumen.js";
import { nombreVisible, nombreResponsableSesion } from "../src/nombresUsuarios.js";

test("la comparación muestra cambios legibles sin IDs internos", () => {
  const antes = { id: "uuid", fecha: "26/09/2026", producido: 116, saldoFinal: 781.5, repartos: [{ nombre: "Andrés", salida: 10 }] };
  const despues = { ...antes, producido: 120, saldoFinal: 785.5, repartos: [{ nombre: "Andrés", salida: 12 }] };
  assert.deepEqual(filasCambiosBodega(antes, despues), [
    { nombre: "Producido", antes: "116 cart", despues: "120 cart" },
    { nombre: "Saldo final", antes: "781.5 cart", despues: "785.5 cart" },
    { nombre: "Andrés · Salida", antes: "10 cart", despues: "12 cart" },
  ]);
});

test("el nombre visible reconoce correo sin depender de mayúsculas y conserva otras identidades", () => {
  const directorio = { "jdq@ejemplo.com": "José Daniel" };
  assert.equal(nombreVisible("JDQ@EJEMPLO.COM", directorio), "José Daniel");
  assert.equal(nombreVisible("Roxana", directorio), "Roxana");
});

test("el responsable usa el nombre configurado y puede recurrir al perfil de sesión", () => {
  assert.equal(nombreResponsableSesion("JD@ejemplo.com", { "jd@ejemplo.com": "José Daniel" }, "Otro nombre"), "José Daniel");
  assert.equal(nombreResponsableSesion("otro@ejemplo.com", {}, "Eric"), "Eric");
  assert.equal(nombreResponsableSesion("otro@ejemplo.com", {}), "otro@ejemplo.com");
});

test("la devolución neta se presenta como entrada y la salida neta como salida", () => {
  assert.deepEqual(presentacionRutaNeta(-7.5), {
    tipo: "devolucion",
    etiqueta: "Devolución neta de ruta",
    signo: "+",
    cantidad: 7.5,
  });
  assert.deepEqual(presentacionRutaNeta(7.5), {
    tipo: "salida",
    etiqueta: "Salida neta a ruta",
    signo: "−",
    cantidad: 7.5,
  });
  assert.deepEqual(filasCambiosBodega({ rutaNeta: 0 }, { rutaNeta: -3 }), [
    {
      nombre: "Impacto neto de ruta",
      antes: "Salida neta a ruta (−) · 0 cart",
      despues: "Devolución neta de ruta (+) · 3 cart",
    },
  ]);
});
