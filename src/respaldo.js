export function resumenArchivoRespaldo(datos = {}, conflictos = []) {
  const colecciones = [];
  let registros = 0;
  let configuraciones = 0;
  for (const [clave, valor] of Object.entries(datos || {})) {
    if (Array.isArray(valor)) {
      colecciones.push({ clave, cantidad: valor.length });
      registros += valor.length;
    } else if (clave === "granja2:cxp" && valor && typeof valor === "object") {
      for (const [parte, lista] of Object.entries(valor)) {
        if (!Array.isArray(lista)) continue;
        const llave = `${clave}:${parte}`;
        colecciones.push({ clave: llave, cantidad: lista.length });
        registros += lista.length;
      }
    } else if (clave.startsWith("granja2:") && !clave.startsWith("granja2:preImport") && valor !== null && valor !== undefined) {
      colecciones.push({ clave, cantidad: 1, configuracion: true });
      configuraciones++;
    }
  }
  return {
    colecciones: colecciones.filter(item => item.cantidad > 0),
    registros,
    configuraciones,
    conflictos: conflictos.length,
  };
}

export function nombreColeccionRespaldo(clave) {
  const nombres = {
    "granja2:lotes": "Lotes",
    "granja2:registros": "Controles diarios",
    "granja2:pesajes": "Pesajes",
    "granja2:bodegaMovs": "Movimientos de bodega",
    "granja2:plantaMovs": "Movimientos de planta",
    "granja2:bitacora": "Bitácora",
    "granja2:facturas": "Facturas",
    "granja2:cxp:facturas": "Cuentas por pagar · facturas",
    "granja2:cxp:pagos": "Cuentas por pagar · pagos",
    "granja2:cxp:notas": "Cuentas por pagar · notas",
  };
  const claveNormalizada = clave.replace(/^granja2:/, "").replace(/([A-Z])/g, " $1").replaceAll(":", " · ");
  return nombres[clave] || claveNormalizada;
}
