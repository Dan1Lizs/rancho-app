// ═══════════════════════════════════════════════════════════════════════
// Migrador de datos: de la tabla vieja "kv" (un bloque JSON por clave) a
// las tablas nuevas de la v6 (una fila por registro).
//
// Se ejecuta UNA SOLA VEZ, desde el botón "🔧 Migrar a base de datos v6"
// en Historial. Es seguro tocarlo más de una vez por error: si detecta que
// una tabla nueva ya tiene datos, no la vuelve a tocar.
// ═══════════════════════════════════════════════════════════════════════
import { supabase } from "./supabase";

const TABLA = {
  "granja2:lotes": "lotes",
  "granja2:registros": "registros",
  "granja2:pesajes": "pesajes",
  "granja2:medicaciones": "medicaciones",
  "granja2:fumigaciones": "fumigaciones",
  "granja2:bodegaMovs": "bodega_movs",
  "granja2:plantaMovs": "planta_movs",
  "granja2:facturas": "facturas",
  "granja2:bitacora": "bitacora",
  "granja2:vacunas": "vacunas",
  "granja2:enfermedades": "enfermedades",
  "granja2:necropsias": "necropsias",
  "granja2:planVacunas": "plan_vacunas",
  "granja2:mpPedidos": "mp_pedidos",
  "granja2:insumos": "insumos",
  "granja2:insumosMovs": "insumos_movs",
  "granja2:kardex": "kardex",
  "granja2:mpCatalogo": "mp_catalogo",
};

// Claves de "un solo bloque" que se copian tal cual a la tabla config
const CONFIG_KEYS = [
  "granja2:mpInventario", "granja2:mpConfig", "granja2:recetas", "granja2:nucleoInv",
  "granja2:plantaCfg", "granja2:bodegaCfg", "granja2:cfgAdmins", "granja2:costos",
];

const idNuevo = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

async function leerViejo(key) {
  const { data, error } = await supabase.from("kv").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`No se pudo leer "${key}" de la tabla vieja: ${error.message}`);
  return data ? data.value : null;
}

async function tablaTieneFilas(tabla) {
  const { count, error } = await supabase.from(tabla).select("id", { count: "exact", head: true });
  if (error) throw new Error(`No se pudo revisar la tabla "${tabla}": ${error.message}. ¿Ya corriste supabase_v2.sql?`);
  return (count || 0) > 0;
}

async function insertarEnBloques(tabla, filas) {
  for (let i = 0; i < filas.length; i += 400) {
    const { error } = await supabase.from(tabla).upsert(filas.slice(i, i + 400));
    if (error) throw new Error(`Error copiando a "${tabla}": ${error.message}`);
  }
}

async function migrarColeccion(claveVieja, tabla, resumen) {
  if (await tablaTieneFilas(tabla)) { resumen.saltadas.push(tabla); return; }
  // Una tabla vaciada después de haber sido usada no se restaura desde kv.
  const { data: marcada, error: errorMarca } = await supabase.from("config").select("key").eq("key", `sembrado:${tabla}`).maybeSingle();
  if (errorMarca) throw new Error(`No se pudo comprobar si ${tabla} ya fue migrada: ${errorMarca.message}`);
  if (marcada) { resumen.saltadas.push(tabla); return; }
  const arr = await leerViejo(claveVieja);
  if (!Array.isArray(arr) || !arr.length) { resumen.vacias.push(tabla); return; }
  const filas = arr.map((item) => {
    const conId = { ...item };
    if (conId.id === undefined || conId.id === null || conId.id === "") conId.id = idNuevo();
    return { id: String(conId.id), data: conId };
  });
  await insertarEnBloques(tabla, filas);
  await supabase.from("config").upsert({ key: `sembrado:${tabla}`, data: true });
  resumen.migradas.push(`${tabla} (${filas.length})`);
  return filas; // por si el llamador necesita los ids (necropsias → fotos)
}

export async function migrarDesdeV1(onProgreso) {
  const paso = (msg) => onProgreso && onProgreso(msg);
  const resumen = { migradas: [], vacias: [], saltadas: [], errores: [] };

  // 1) Colecciones normales
  for (const [claveVieja, tabla] of Object.entries(TABLA)) {
    paso(`Copiando ${tabla}…`);
    try {
      await migrarColeccion(claveVieja, tabla, resumen);
    } catch (e) {
      resumen.errores.push(`${tabla}: ${e.message}`);
    }
  }

  // 2) Cuentas por pagar (objeto {facturas, pagos, notas} → 3 tablas)
  paso("Copiando Por Pagar…");
  try {
    if (await tablaTieneFilas("cxp_facturas")) {
      resumen.saltadas.push("cxp_facturas/pagos/notas");
    } else {
      const viejo = await leerViejo("granja2:cxp");
      if (viejo && typeof viejo === "object") {
        const partes = [
          ["facturas", "cxp_facturas"],
          ["pagos", "cxp_pagos"],
          ["notas", "cxp_notas"],
        ];
        for (const [campo, tabla] of partes) {
          const arr = Array.isArray(viejo[campo]) ? viejo[campo] : [];
          if (!arr.length) { resumen.vacias.push(tabla); continue; }
          const filas = arr.map((item) => {
            const conId = { ...item };
            if (conId.id === undefined || conId.id === null || conId.id === "") conId.id = idNuevo();
            return { id: String(conId.id), data: conId };
          });
          await insertarEnBloques(tabla, filas);
          await supabase.from("config").upsert({ key: `sembrado:${tabla}`, data: true });
          resumen.migradas.push(`${tabla} (${filas.length})`);
        }
      } else {
        resumen.vacias.push("cxp_facturas/pagos/notas");
      }
    }
  } catch (e) {
    resumen.errores.push(`cxp: ${e.message}`);
  }

  // 3) Ajustes de "un solo bloque"
  paso("Copiando ajustes generales…");
  for (const key of CONFIG_KEYS) {
    try {
      const { data: yaExiste } = await supabase.from("config").select("key").eq("key", key).maybeSingle();
      if (yaExiste) { resumen.saltadas.push(key.replace("granja2:", "")); continue; }
      const viejo = await leerViejo(key);
      if (viejo === null || viejo === undefined) { resumen.vacias.push(key.replace("granja2:", "")); continue; }
      const { error } = await supabase.from("config").upsert({ key, data: viejo });
      if (error) throw new Error(error.message);
      resumen.migradas.push(key.replace("granja2:", ""));
    } catch (e) {
      resumen.errores.push(`${key}: ${e.message}`);
    }
  }

  // 4) Fotos de necropsias (una clave dinámica por necropsia: granja2:necfoto:<id>)
  paso("Copiando fotos de necropsias…");
  try {
    const necropsias = (await leerViejo("granja2:necropsias")) || [];
    for (const n of necropsias) {
      if (!n?.numFotos) continue;
      const key = `granja2:necfoto:${n.id}`;
      const { data: yaExiste } = await supabase.from("config").select("key").eq("key", key).maybeSingle();
      if (yaExiste) continue;
      const fotos = await leerViejo(key);
      if (fotos) {
        await supabase.from("config").upsert({ key, data: fotos });
        resumen.migradas.push(`fotos necropsia ${n.id}`);
      }
    }
  } catch (e) {
    resumen.errores.push(`fotos de necropsias: ${e.message}`);
  }

  return resumen;
}
