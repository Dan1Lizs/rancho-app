import { supabase } from "./supabase";
import { proximaTarea } from "./programacionTareas.js";
export { proximaTarea, diasHastaTarea } from "./programacionTareas.js";

const prefijo = "granja2:tarea:";

export async function leerTareasProgramadas() {
  const tareas = [];
  for (let desde = 0; ; desde += 500) {
    const { data, error } = await supabase.from("config").select("key,data").like("key", `${prefijo}%`).order("key").range(desde, desde + 499);
    if (error) throw error;
    tareas.push(...(data || []).map(f => f.data));
    if (!data || data.length < 500) break;
  }
  return tareas.filter(t => t && t.id).sort((a, b) => (proximaTarea(a) || "9999").localeCompare(proximaTarea(b) || "9999"));
}

export async function guardarTareaProgramada(tarea) {
  const { error } = await supabase.from("config").upsert({ key: `${prefijo}${tarea.id}`, data: tarea, updated_by: window.__usuarioEmail || null });
  if (error) throw error;
}

export async function eliminarTareaProgramada(id) {
  const { error } = await supabase.from("config").delete().eq("key", `${prefijo}${id}`);
  if (error) throw error;
}
