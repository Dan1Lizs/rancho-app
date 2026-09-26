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
