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
  "granja2:favoritos": "favoritos",
  "granja2:mpInvHistorial": "mp_inv_historial",
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
    alert("⚙️ La base de datos no tiene las tablas nuevas de la granja.\n\nSolución: en Supabase → SQL Editor → revisa el archivo supabase_v2_actualizado.sql del repositorio.\nLuego recarga esta página.");
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
  try {
    const { error } = await supabase.from("config").upsert({ key: `sembrado:${tabla}`, data: true, updated_by: emailActual() });
    revisarError(error);
    if (!error) sembradas.add(tabla);
  } catch (e) { console.error("marcarSembrada:", e); }
}

async function leerColeccion(tabla) {
  const filas = [];
  for (let desde = 0; ; desde += 500) {
    const { data, error } = await supabase.from(tabla).select("id, data").order("id").range(desde, desde + 499);
    revisarError(error);
    if (error) return null;
    filas.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return filas.map((fila) => ({ ...fila.data, id: fila.data?.id ?? fila.id }));
}

// Para ediciones históricas: un error de red se distingue de una bodega vacía.
export async function leerBodegaActual() {
  const actual = await leerColeccion("bodega_movs");
  if (actual !== null) ultimaVersion.set("granja2:bodegaMovs", actual);
  return actual;
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
    if (tabla === "lotes") {
      // Si otro usuario eliminó un lote desde nuestra última lectura, una
      // actualización con estado viejo no puede volver a insertarlo.
      const anteriores = filas.filter(f => porId.has(f.id)).map(f => f.id);
      for (let i = 0; i < anteriores.length; i += 400) {
        const { data, error } = await supabase.from("lotes").select("id").in("id", anteriores.slice(i, i + 400));
        if (error) { revisarError(error); return false; }
        const presentes = new Set((data || []).map(f => String(f.id)));
        if (anteriores.slice(i, i + 400).some(id => !presentes.has(id))) return false;
      }
    }
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

export async function eliminarLotePorId(id) {
  const { error } = await supabase.from("lotes").delete().eq("id", String(id));
  revisarError(error);
  if (error) return false;
  const anterior = ultimaVersion.get("granja2:lotes") || [];
  ultimaVersion.set("granja2:lotes", anterior.filter(l => String(l.id) !== String(id)));
  return true;
}

// La corrección opera sobre una sola fila vigente, nunca sobre una copia vieja
// de toda la colección. Cada intento queda registrado antes de cambiar datos.
export async function leerCorreccionesProduccion() {
  const { data, error } = await supabase.from("config").select("key,data").like("key", "granja2:correccionProduccion:%");
  if (error) throw error;
  return (data || []).map(x => x.data).sort((a, b) => String(b.instante).localeCompare(String(a.instante)));
}

export async function corregirProduccion({ id, nuevo, motivo, eliminar = false }) {
  const { data: fila, error: lecturaError } = await supabase.from("registros").select("id,data").eq("id", String(id)).maybeSingle();
  if (lecturaError) throw lecturaError;
  if (!fila) throw new Error("Este registro ya no existe. Actualiza la pantalla.");
  const anterior = { ...fila.data, id: fila.id };
  if (!eliminar && (nuevo.fecha !== anterior.fecha || nuevo.lote !== anterior.lote)) throw new Error("La fecha y el lote no se pueden cambiar desde esta corrección.");
  if (!eliminar) {
    const { data: otras, error } = await supabase.from("registros").select("id,data").neq("id", String(id));
    if (error) throw error;
    const numeros = (nuevo.tiquetes || []).map(t => String(t.num || "").trim()).filter(Boolean);
    if (new Set(numeros).size !== numeros.length) throw new Error("Hay tiquetes repetidos dentro del registro.");
    const choque = (otras || []).find(x => x.data?.fecha !== anterior.fecha && (x.data?.tiquetes || []).some(t => numeros.includes(String(t.num || "").trim())));
    if (choque) throw new Error(`Un tiquete ya está registrado el ${choque.data.fecha}. Revisa los números antes de corregir.`);
  }
  const instante = new Date().toISOString();
  const evento = { id: idNuevo(), instante, por: emailActual(), motivo, accion: eliminar ? "eliminar" : "editar", anterior, nuevo: eliminar ? null : nuevo, estado: "pendiente" };
  const key = `granja2:correccionProduccion:${evento.id}`;
  const { error: auditError } = await supabase.from("config").insert({ key, data: evento, updated_by: emailActual() });
  if (auditError) throw auditError;
  const { data: afectadas, error: cambioError } = eliminar
    ? await supabase.from("registros").delete().eq("id", String(id)).filter("data", "eq", JSON.stringify(fila.data)).select("id")
    : await supabase.from("registros").update({ data: nuevo }).eq("id", String(id)).filter("data", "eq", JSON.stringify(fila.data)).select("id");
  if (cambioError || afectadas?.length !== 1) {
    await supabase.from("config").update({ data: { ...evento, estado: "rechazado" } }).eq("key", key);
    throw cambioError || new Error("Otro dispositivo cambió el registro. Actualiza y revisa antes de guardar.");
  }
  ultimaVersion.delete("granja2:registros");
  const delta = (campo) => Number(eliminar ? 0 : nuevo[campo] || 0) - Number(anterior[campo] || 0);
  const { data: loteFila, error: loteError } = await supabase.from("lotes").select("id,data").eq("id", String(anterior.lote)).maybeSingle();
  if (loteError || !loteFila) throw loteError || new Error("El registro cambió, pero falta el lote. Consulta la auditoría antes de reintentar.");
  const l = loteFila.data;
  const loteNuevo = { ...l,
    aves: Number(l.aves || 0) - delta("muertas"), mortAcum: Number(l.mortAcum || 0) + delta("muertas"),
    acumHuevos: Number(l.acumHuevos || 0) + delta("cartones") * 30,
    acumMasaKg: Number(l.acumMasaKg || 0) + delta("pesoKg"),
    acumAlimentoKg: Number(l.acumAlimentoKg || 0) + delta("alimentoKg"),
  };
  const { data: lotesAfectados, error: actualizacionError } = await supabase.from("lotes").update({ data: loteNuevo }).eq("id", String(anterior.lote)).filter("data", "eq", JSON.stringify(l)).select("id");
  if (actualizacionError || lotesAfectados?.length !== 1) {
    // Una edición concurrente del lote exige intervención: no ocultar el
    // registro que sí cambió ni marcar el evento como completado.
    throw actualizacionError || new Error("El registro cambió, pero los acumulados del lote cambiaron en otro dispositivo. Consulta la auditoría; no repitas la corrección.");
  }
  ultimaVersion.delete("granja2:lotes");
  const { error: cierreError } = await supabase.from("config").update({ data: { ...evento, estado: "aplicado" } }).eq("key", key);
  if (cierreError) throw new Error("El cambio se aplicó, pero no se pudo cerrar la auditoría. Actualiza antes de volver a intentar.");
  return evento;
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
      // Los datos operativos solo se recuperan mediante la migración explícita.
      // Un lote borrado no debe reaparecer desde config ni desde la semilla.
      if (tabla === "lotes" || tabla === "registros" || tabla === "pesajes") {
        ultimaVersion.set(key, arr);
        return arr;
      }
      if (arr.length === 0 && !(await yaSembrada(tabla))) {
        // Rescate: si esta colección vivía antes como un solo bloque (p.ej. una
        // lista nueva que se agregó a la app antes de tener su tabla propia),
        // la recuperamos de ahí una sola vez en vez de mostrarla vacía.
        const { data: legado } = await supabase.from("config").select("data").eq("key", key).maybeSingle();
        if (Array.isArray(legado?.data) && legado.data.length) {
          const ok = await escribirColeccion(key, tabla, legado.data);
          if (ok) return legado.data;
        }
        return porDefecto; // nunca se ha creado nada aquí todavía
      }
      ultimaVersion.set(key, arr);
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

let escriturasPendientes = 0;
export async function escribir(key, valor) {
  const estado = (valor) => {
    if (valor === "Guardando…") escriturasPendientes++;
    else escriturasPendientes = Math.max(0, escriturasPendientes - 1);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("granja:sync", { detail: valor === "Error al guardar" ? valor : escriturasPendientes ? "Guardando…" : "Sincronizado" }));
  };
  estado("Guardando…");
  try {
    if (ES_CXP(key)) {
      const obj = valor || {};
      const ok1 = await escribirColeccion("granja2:cxp:facturas", SUBTABLAS_CXP.facturas, Array.isArray(obj.facturas) ? obj.facturas : []);
      const ok2 = await escribirColeccion("granja2:cxp:pagos", SUBTABLAS_CXP.pagos, Array.isArray(obj.pagos) ? obj.pagos : []);
      const ok3 = await escribirColeccion("granja2:cxp:notas", SUBTABLAS_CXP.notas, Array.isArray(obj.notas) ? obj.notas : []);
      estado(ok1 && ok2 && ok3 ? "Sincronizado" : "Error al guardar");
      return ok1 && ok2 && ok3;
    }

    const tabla = TABLA[key];
    if (tabla) {
      const ok = await escribirColeccion(key, tabla, Array.isArray(valor) ? valor : []);
      estado(ok ? "Sincronizado" : "Error al guardar"); return ok;
    }

    const { error } = await supabase.from("config").upsert({ key, data: valor, updated_by: emailActual() });
    revisarError(error);
    estado(error ? "Error al guardar" : "Sincronizado"); return !error;
  } catch (e) {
    console.error("escribir:", e);
    estado("Error al guardar");
    return false;
  }
}

// Importación aditiva: consulta la base actual y usa INSERT; nunca actualiza ni
// elimina pesajes anteriores. La clave lógica es lote + fecha de medición.
export async function agregarPesajesFaltantes(nuevos, { reemplazar = [] } = {}) {
  const fechaISO = (fecha) => {
    const s = String(fecha || "");
    if (/^\d{4}-\d\d-\d\d/.test(s)) return s.slice(0, 10);
    const m = /^(\d\d?)\/(\d\d?)\/(\d{4})$/.exec(s);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s;
  };
  const clave = (p) => `${p.lote}|${fechaISO(p.fecha)}`;
  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
  if (nuevos.some(p => fechaISO(p.fecha) > hoy)) throw new Error(`No se permiten pesajes posteriores a hoy (${hoy})`);
  const existentes = [];
  for (let desde = 0; ; desde += 500) {
    const { data, error } = await supabase.from("pesajes").select("id, data").order("id").range(desde, desde + 499);
    if (error) { revisarError(error); throw error; }
    existentes.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  const porClave = new Map();
  existentes.forEach(f => porClave.set(clave(f.data), [...(porClave.get(clave(f.data)) || []), f]));
  const reemplazables = new Set(reemplazar);
  let agregados = 0, omitidos = 0, actualizados = 0;
  for (const nuevo of nuevos) {
    const k = clave(nuevo);
    const anteriores = porClave.get(k) || [];
    if (anteriores.length) {
      if (!reemplazables.has(k)) { omitidos++; continue; }
      if (anteriores.length !== 1) throw new Error(`Hay ${anteriores.length} pesajes para ${k}; revisa los duplicados antes de reemplazar`);
      const anterior = anteriores[0];
      const { error } = await supabase.from("pesajes").update({ data: { ...nuevo, id: anterior.id } }).eq("id", anterior.id);
      if (error) { revisarError(error); throw error; }
      anterior.data = { ...nuevo, id: anterior.id };
      actualizados++;
      continue;
    }
    const id = `excel:${nuevo.lote}:${fechaISO(nuevo.fecha)}`;
    const { error } = await supabase.from("pesajes").insert({ id, data: { ...nuevo, id } });
    if (error) {
      // Otro usuario pudo importar la misma fecha mientras se procesaba el archivo.
      if (error.code === "23505") { omitidos++; continue; }
      revisarError(error);
      throw Object.assign(new Error(error.message), { agregados, omitidos });
    }
    const fila = { id, data: { ...nuevo, id } };
    porClave.set(k, [fila]);
    existentes.push(fila);
    agregados++;
  }
  ultimaVersion.set("granja2:pesajes", existentes.map(f => ({ ...f.data, id: f.data?.id ?? f.id })));
  return { agregados, omitidos, actualizados };
}

export async function actualizarPesajePorId(id, nuevo) {
  const fecha = String(nuevo.fecha || "");
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(fecha);
  if (!m) throw new Error("Fecha de pesaje inválida");
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
  if (iso > hoy) throw new Error(`La fecha no puede ser posterior a hoy (${hoy})`);
  const actuales = await leerColeccion("pesajes");
  if (actuales === null) throw new Error("No se pudieron consultar los pesajes actuales");
  if (!actuales.some(p => String(p.id) === String(id))) throw new Error("El pesaje ya no existe");
  if (actuales.some(p => String(p.id) !== String(id) && p.lote === nuevo.lote && fechaRespaldoISO(p.fecha) === iso)) throw new Error("Ya existe otro pesaje de este lote en esa fecha");
  const { error } = await supabase.from("pesajes").update({ data: { ...nuevo, id } }).eq("id", String(id));
  if (error) throw error;
  ultimaVersion.delete("granja2:pesajes");
}

export async function eliminarPesajePorId(id) {
  const { data, error } = await supabase.from("pesajes").delete().eq("id", String(id)).select("id");
  if (error) { revisarError(error); throw error; }
  if (!data?.length) throw new Error("El pesaje ya no existe o no se pudo eliminar");
  const anterior = ultimaVersion.get("granja2:pesajes");
  if (anterior) ultimaVersion.set("granja2:pesajes", anterior.filter(p => String(p.id) !== String(id)));
}

// Un respaldo nunca utiliza escribirColeccion: esa función interpreta los
// registros ausentes del archivo como borrados y puede actualizar filas vivas.
export async function agregarRespaldoFaltante(datos) {
  const resumen = { agregados: 0, omitidos: 0, futuros: 0, configuraciones: 0, desconocidos: 0 };
  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
  const insertarFaltantes = async (tabla, items) => {
    if (!Array.isArray(items)) throw new Error(`Formato inválido para ${tabla}`);
    const actuales = [];
    for (let desde = 0; ; desde += 500) {
      const { data, error } = await supabase.from(tabla).select("id, data").order("id").range(desde, desde + 499);
      if (error) throw error;
      actuales.push(...(data || []));
      if (!data || data.length < 500) break;
    }
    const ids = new Set(actuales.map(x => String(x.id)));
    const huellaDe = (x) => JSON.stringify({ ...x, id: undefined });
    const huellas = new Set(actuales.map(x => huellaDe(x.data || {})));
    const claveLogica = (x) => {
      if (tabla !== "registros" && tabla !== "pesajes") return "";
      const fecha = String(x.fecha || "");
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(fecha);
      return `${x.lote}|${m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : fecha.slice(0, 10)}`;
    };
    const claves = new Set(actuales.map(x => claveLogica(x.data || {})).filter(Boolean));
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Registro inválido en ${tabla}`);
      if (item.fecha && fechaRespaldoISO(item.fecha) > hoy) { resumen.futuros++; continue; }
      const id = item.id == null || item.id === "" ? idNuevo() : String(item.id);
      const k = claveLogica(item);
      const huella = huellaDe(item);
      if (ids.has(id) || huellas.has(huella) || (k && claves.has(k))) { resumen.omitidos++; continue; }
      const { error } = await supabase.from(tabla).insert({ id, data: { ...item, id: item.id ?? id } });
      if (error?.code === "23505") { resumen.omitidos++; continue; }
      if (error) throw error;
      ids.add(id); huellas.add(huella); if (k) claves.add(k);
      resumen.agregados++;
    }
    ultimaVersion.delete(Object.keys(TABLA).find(k => TABLA[k] === tabla));
  };
  for (const [key, valor] of Object.entries(datos)) {
    if (TABLA[key]) await insertarFaltantes(TABLA[key], valor);
    else if (ES_CXP(key)) {
      if (!valor || typeof valor !== "object") throw new Error("Formato inválido para cuentas por pagar");
      for (const [parte, tabla] of Object.entries(SUBTABLAS_CXP)) await insertarFaltantes(tabla, valor[parte] || []);
    } else if (key.startsWith("granja2:") && !key.startsWith("granja2:preImport")) {
      const { data, error } = await supabase.from("config").select("key").eq("key", key).maybeSingle();
      if (error) throw error;
      if (data) { resumen.omitidos++; continue; }
      const { error: errorInsert } = await supabase.from("config").insert({ key, data: valor, updated_by: emailActual() });
      if (errorInsert?.code === "23505") { resumen.omitidos++; continue; }
      if (errorInsert) throw errorInsert;
      resumen.configuraciones++;
    } else resumen.desconocidos++;
  }
  return resumen;
}

const fechaRespaldoISO = (fecha) => {
  const s = String(fecha || "");
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s.slice(0, 10);
};

export async function detectarFechasRespaldo(datos) {
  const conflictos = [];
  for (const [key, tabla] of [["granja2:registros", "registros"], ["granja2:pesajes", "pesajes"]]) {
    const items = datos[key];
    if (!Array.isArray(items)) continue;
    const filas = [];
    for (let desde = 0; ; desde += 500) {
      const { data, error } = await supabase.from(tabla).select("id,data").order("id").range(desde, desde + 499);
      if (error) throw error;
      filas.push(...(data || []));
      if (!data || data.length < 500) break;
    }
    const porFecha = new Map();
    filas.forEach(f => {
      const k = `${f.data?.lote}|${fechaRespaldoISO(f.data?.fecha)}`;
      porFecha.set(k, [...(porFecha.get(k) || []), f]);
    });
    const vistos = new Set();
    items.forEach(item => {
      const k = `${item.lote}|${fechaRespaldoISO(item.fecha)}`;
      const ahora = new Date();
      const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
      if (vistos.has(k) || fechaRespaldoISO(item.fecha) > hoy || !porFecha.has(k)) return;
      vistos.add(k);
      const actuales = porFecha.get(k);
      conflictos.push({ token: `${tabla}|${k}`, tabla, lote: item.lote, fecha: fechaRespaldoISO(item.fecha), actual: actuales[0], nuevo: item, duplicados: actuales.length });
    });
  }
  return conflictos;
}

export async function reemplazarFechasRespaldo(conflictos) {
  let actualizados = 0;
  for (const c of conflictos) {
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
    if (fechaRespaldoISO(c.nuevo.fecha) > hoy) throw new Error("No se permiten fechas futuras");
    if (!['registros', 'pesajes'].includes(c.tabla) || c.duplicados !== 1) throw new Error(`Fecha duplicada en ${c.tabla}: ${c.fecha}`);
    const { data: vigente, error: errorLectura } = await supabase.from(c.tabla).select("id,data").eq("id", c.actual.id).maybeSingle();
    if (errorLectura) throw errorLectura;
    if (!vigente || JSON.stringify(vigente.data) !== JSON.stringify(c.actual.data)) throw new Error(`Los datos de ${c.fecha} cambiaron; vuelve a cargar el respaldo antes de reemplazar`);
    const { error } = await supabase.from(c.tabla).update({ data: { ...c.nuevo, id: c.actual.id } }).eq("id", c.actual.id);
    if (error) throw error;
    actualizados++;
  }
  ultimaVersion.delete("granja2:registros");
  ultimaVersion.delete("granja2:pesajes");
  return actualizados;
}
