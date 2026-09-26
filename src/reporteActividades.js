import { proximaTarea } from "./programacionTareas.js";

export function actividadesDelDia(tareas, fechaISO, lote = "") {
  return tareas.map(tarea => ({ ...tarea, programada: proximaTarea(tarea) }))
    .filter(tarea => (tarea.lote || "") === lote && tarea.programada && tarea.programada <= fechaISO)
    .sort((a, b) => a.programada.localeCompare(b.programada) || a.nombre.localeCompare(b.nombre));
}

export function trabajosDelDia(trabajos, registro) {
  return trabajos.map((nombre, indice) => ({ nombre, indice, realizado: !!registro?.trabajos?.[indice] }));
}
