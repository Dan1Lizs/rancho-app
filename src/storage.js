// ═══════════════════════════════════════════════════════════════════════
// Almacenamiento compartido de la granja — v6 (tablas reales por registro)
//
// El resto de la app (App.jsx) sigue llamando exactamente igual que antes:
//   const lotes = await leer(K.lotes, []);
//   await escribir(K.lotes, nuevosLotes);
//
// Pero por dentro, ya NO se guarda todo como un bloque JSON gigante en una
// sola fila. Cada colección (lotes, registros, pesajes, etc.) vive en su
// propia tabla de Supabase, con una fila por registro. Cuando la app llama
// escribir(clave, arregloCompleto), esta capa compara ese arreglo contra lo
// último que sabíamos de esa colección y:
//   • Solo INSERTA/ACTUALIZA los registros que de verdad cambiaron
//   • Solo BORRA los que de verdad desaparecieron
//   • Nunca toca los registros que otra persona haya agregado mientras tanto
//
// Así, si Roxana guarda un pesaje y el encargado guarda un registro diario
// casi al mismo tiempo, cada quien escribe SU fila — nadie le borra el
// trabajo al otro. Antes, cualquiera de los dos guardados reescribía TODO
// el historial completo y el que guardaba último "ganaba", borrando al otro.
// ═══════════════════════════════════════════════════════════════════════
import { supabase } from "./supabase";

// Claves (las mismas de siempre, definidas en App.jsx como "K.xxx") que
// representan una LISTA de registros independientes → cada una tiene su
// propia tabla real en la base de datos.
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

// "Por Pagar" es especial: es un objeto {facturas, pagos, notas} donde cada
// parte es en realidad una lista de registros — así que cada parte recibe
// su propia tabla también (ver leer/escribir más abajo).
const ES_CXP = (key) => key === "granja2:cxp";
const SUBTABLAS_CXP = { facturas: "cxp_facturas", pagos: "cxp_pagos", notas: "cxp_notas" };

const idNuevo = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const emailActual = () => (typeof window !== "undefined" && window.__usuarioEmail) || null;

let avisoTabla = false;
const revisarError = (error) => {
  if (!error) return;
  console.error("Error de base de datos:", error);
  const msg = (error.message || "").toLowerCase();
  if (!avisoTabla && (msg.includes("relation") || msg.includes("does not exist") || error.code === "42P01" || error.code === "PGRST205")) {
    avisoTabla = true;
    alert("⚙️ La base de datos no tiene las tablas nuevas de la granja.\n\nSolución: en Supabase → SQL Editor → pega el contenido de supabase_v2.sql → Run.\nLuego recarga esta página.");
  }
};

// Recordamos, por cada colección, el último arreglo que leímos/escribimos
// con éxito — así al guardar solo enviamos lo que cambió de verdad.
const ultimaVersion = new Map();
// Colecciones que ya sabemos que existen con datos reales (para no volver a
// "sembrar" datos de ejemplo si alguien de verdad vació la lista a propósito).
const sembradas = new Set();

async function yaSembrada(tabla) {
  if (sembradas.has(tabla)) return true;
  try {
    const { data } = await supabase.from("config").select("key").eq("key", `sembrado:${tabla}`).maybeSingle();
    if (data) { sembradas.add(tabla); return true; }
  } catch { /* si falla, mejor sembrar de más que perder la pantalla */ }
  return false;
}
async function marcarSembrada(tabla) {
  if (sembradas.has(tabla)) return;
  sembradas.add(tabla);
  try { await supabase.from("config").upsert({ key: `sembrado:${tabla}`, data: true, updated_by: emailActual() }); } catch { /* no crítico */ }
}

async function leerColeccion(tabla) {
  const { data, error } = await supabase.from(tabla).select("id, data");
  revisarError(error);
  if (error) return null;
  return (data || []).map((fila) => ({ ...fila.data, id: fila.data?.id ?? fila.id }));
}

async function escribirColeccion(claveCache, tabla, arregloNuevo) {
  const base = ultimaVersion.get(claveCache) || [];
  const porId = new Map(base.map((it) => [String(it.id), it]));
  const usados = new Set();
  const filas = [];

  for (const item of arregloNuevo) {
    if (item.id === undefined || item.id === null || item.id === "") item.id = idNuevo();
    const idStr = String(item.id);
    usados.add(idStr);
    const previo = porId.get(idStr);
    if (!previo || JSON.stringify(previo) !== JSON.stringify(item)) {
      filas.push({ id: idStr, data: item });
    }
  }
  const aBorrar = [...porId.keys()].filter((idb) => !usados.has(idb));

  try {
    // Se envía en bloques por si algún día una colección crece mucho
    for (let i = 0; i < filas.length; i += 400) {
      const { error } = await supabase.from(tabla).upsert(filas.slice(i, i + 400));
      revisarError(error);
      if (error) return false;
    }
    if (aBorrar.length) {
      for (let i = 0; i < aBorrar.length; i += 400) {
        const { error } = await supabase.from(tabla).delete().in("id", aBorrar.slice(i, i + 400));
        revisarError(error);
        if (error) return false;
      }
    }
    ultimaVersion.set(claveCache, arregloNuevo);
    if (filas.length || aBorrar.length || arregloNuevo.length) await marcarSembrada(tabla);
    return true;
  } catch (e) {
    console.error("escribir:", e);
    return false;
  }
}

export async function leer(key, porDefecto) {
  try {
    if (ES_CXP(key)) {
      const [facturas, pagos, notas] = await Promise.all([
        leerColeccion(SUBTABLAS_CXP.facturas),
        leerColeccion(SUBTABLAS_CXP.pagos),
        leerColeccion(SUBTABLAS_CXP.notas),
      ]);
      if (facturas === null || pagos === null || notas === null) return porDefecto;
      ultimaVersion.set("granja2:cxp:facturas", facturas);
      ultimaVersion.set("granja2:cxp:pagos", pagos);
      ultimaVersion.set("granja2:cxp:notas", notas);
      const vacio = !facturas.length && !pagos.length && !notas.length;
      if (vacio && !(await yaSembrada(SUBTABLAS_CXP.facturas))) return porDefecto;
      return { facturas, pagos, notas };
    }

    const tabla = TABLA[key];
    if (tabla) {
      const arr = await leerColeccion(tabla);
      if (arr === null) return porDefecto; // error de conexión / tabla inexistente
      ultimaVersion.set(key, arr);
      if (arr.length === 0 && !(await yaSembrada(tabla))) return porDefecto; // nunca se ha creado nada aquí todavía
      return arr;
    }

    // Claves "de un solo bloque" (ajustes, catálogos, respaldos temporales, fotos de necropsias...)
    const { data, error } = await supabase.from("config").select("data").eq("key", key).maybeSingle();
    revisarError(error);
    if (error || !data) return porDefecto;
    return data.data ?? porDefecto;
  } catch (e) {
    console.error("leer:", e);
    return porDefecto;
  }
}

export async function escribir(key, valor) {
  try {
    if (ES_CXP(key)) {
      const obj = valor || {};
      const ok1 = await escribirColeccion("granja2:cxp:facturas", SUBTABLAS_CXP.facturas, Array.isArray(obj.facturas) ? obj.facturas : []);
      const ok2 = await escribirColeccion("granja2:cxp:pagos", SUBTABLAS_CXP.pagos, Array.isArray(obj.pagos) ? obj.pagos : []);
      const ok3 = await escribirColeccion("granja2:cxp:notas", SUBTABLAS_CXP.notas, Array.isArray(obj.notas) ? obj.notas : []);
      return ok1 && ok2 && ok3;
    }

    const tabla = TABLA[key];
    if (tabla) {
      return await escribirColeccion(key, tabla, Array.isArray(valor) ? valor : []);
    }

    const { error } = await supabase.from("config").upsert({ key, data: valor, updated_by: emailActual() });
    revisarError(error);
    return !error;
  } catch (e) {
    console.error("escribir:", e);
    return false;
  }
}
