// Almacenamiento compartido de la granja — tabla "kv" en Supabase
import { supabase } from "./supabase";

let avisoTabla = false;
const revisarError = (error) => {
  if (!error) return;
  console.error("Error de base de datos:", error);
  const msg = (error.message || "").toLowerCase();
  if (!avisoTabla && (msg.includes("relation") || msg.includes("does not exist") || error.code === "42P01" || error.code === "PGRST205")) {
    avisoTabla = true;
    alert("⚙️ La base de datos no tiene la tabla de la granja.\n\nSolución: en Supabase → SQL Editor → pega el contenido de supabase.sql → Run.\nLuego recarga esta página.");
  }
};

export async function leer(key, porDefecto) {
  try {
    const { data, error } = await supabase.from("kv").select("value").eq("key", key).maybeSingle();
    revisarError(error);
    if (error || !data) return porDefecto;
    return data.value ?? porDefecto;
  } catch (e) {
    console.error("leer:", e);
    return porDefecto;
  }
}

export async function escribir(key, valor) {
  try {
    const { error } = await supabase.from("kv").upsert({ key, value: valor, updated_at: new Date().toISOString() });
    revisarError(error);
    return !error;
  } catch (e) {
    console.error("escribir:", e);
    return false;
  }
}
