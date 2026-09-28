const CAMPOS = [
  ["producido", "Producido", "cart"], ["comprado", "Comprado", "cart"],
  ["rutaNeta", "Salida neta a ruta", "cart"], ["vendGranja", "Vendido en granja", "cart"],
  ["destruido", "Destruido", "cart"], ["regalado", "Regalado", "cart"],
  ["ajusteConteo", "Conteo físico", "cart"], ["difAjuste", "Diferencia del conteo", "cart"],
  ["saldoFinal", "Saldo final", "cart"], ["obs", "Observaciones", ""],
];

export function valorBodega(valor, unidad = "") {
  if (valor === null || valor === undefined || valor === "") return "—";
  return `${valor}${unidad ? ` ${unidad}` : ""}`;
}

export function filasCambiosBodega(anterior = {}, nuevo = {}) {
  const filas = CAMPOS.map(([campo, nombre, unidad]) => ({
    nombre, antes: valorBodega(anterior?.[campo], unidad), despues: valorBodega(nuevo?.[campo], unidad),
  }));
  const repartidores = new Set([...(anterior?.repartos || []), ...(nuevo?.repartos || [])].map(r => r.nombre).filter(Boolean));
  for (const nombre of repartidores) {
    const a = (anterior?.repartos || []).find(r => r.nombre === nombre) || {};
    const n = (nuevo?.repartos || []).find(r => r.nombre === nombre) || {};
    for (const [campo, etiqueta] of [["salida", "Salida"], ["devBueno", "Devolución buena"], ["devMalo", "Devolución mala"]]) {
      filas.push({ nombre: `${nombre} · ${etiqueta}`, antes: valorBodega(a[campo], "cart"), despues: valorBodega(n[campo], "cart") });
    }
  }
  return filas.filter(f => f.antes !== f.despues);
}
