import { supabase } from "./supabase";

const prefijo = "granja2:tarea:";
const fechaUTC = iso => new Date(`${iso}T12:00:00Z`);
const isoDe = fecha => fecha.toISOString().slice(0, 10);

export function proximaTarea(tarea) {
  if (!tarea.inicio || !/^\d{4}-\d{2}-\d{2}$/.test(tarea.inicio)) return null;
  const base = tarea.ultima && tarea.ultima >= tarea.inicio ? tarea.ultima : tarea.inicio;
  if (tarea.repeticion === "una") return tarea.ultima ? null : tarea.inicio;
  if (tarea.repeticion === "dias") {
    const cada = Number(tarea.cadaDias);
    if (!Number.isInteger(cada) || cada < 1 || cada > 3650) return null;
    if (!tarea.ultima) return tarea.inicio;
    const d = fechaUTC(base);
    d.setUTCDate(d.getUTCDate() + cada);
    return isoDe(d);
  }
  if (tarea.repeticion === "semanal") {
    const dias = (tarea.diasSemana || []).map(Number);
    if (!dias.length) return null;
    const d = fechaUTC(base);
    for (let i = tarea.ultima ? 1 : 0; i <= 7; i++) {
      const candidata = new Date(d);
      candidata.setUTCDate(candidata.getUTCDate() + i);
      if (dias.includes(candidata.getUTCDay())) return isoDe(candidata);
    }
  }
  return null;
}

export const diasHastaTarea = (iso, hoy) => Math.round((fechaUTC(iso) - fechaUTC(hoy)) / 86400000);

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
