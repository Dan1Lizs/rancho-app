import { proximaTarea } from "./programacionTareas.js";

export function actividadesDelDia(tareas, fechaISO, lote = "") {
  return tareas.map(tarea => ({ ...tarea, programada: proximaTarea(tarea) }))
    .filter(tarea => (tarea.lote || "") === lote && tarea.programada && tarea.programada <= fechaISO)
    .sort((a, b) => a.programada.localeCompare(b.programada) || a.nombre.localeCompare(b.nombre));
}

export function trabajosDelDia(trabajos, registro) {
  return trabajos.map((nombre, indice) => ({ nombre, indice, realizado: !!registro?.trabajos?.[indice] }));
}

export function tareasManualesDelReporte(texto) {
  return String(texto || "").split(/\r?\n/).map(t => t.trim()).filter(Boolean).slice(0, 30);
}

// Las mismas ventanas de alerta de la Auditoría de Gestión, expresadas como labores concretas.
export function pendientesDeAuditoria({ lote = null, registros = [], fumigaciones = [], trabajos = [], bodegaMovs = [], mpFechaConteo = "" }, fechaISO) {
  const dia = (valor) => {
    const s = String(valor || "");
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$2-$1");
    const ms = Date.parse(`${iso}T00:00:00Z`);
    return Number.isFinite(ms) ? Math.round((Date.parse(`${fechaISO}T00:00:00Z`) - ms) / 86400000) : null;
  };
  const anteriores = (lista) => [...lista].filter(x => dia(x.fecha) !== null && dia(x.fecha) >= 0)
    .sort((a, b) => dia(a.fecha) - dia(b.fecha));
  const pendientes = [];
  if (lote) {
    const regs = anteriores(registros.filter(r => r.lote === lote.id));
    trabajos.forEach((nombre, i) => {
      if (!regs.length) return;
      const realizado = regs.find(r => !!r.trabajos?.[i]);
      const dias = dia((realizado || regs[regs.length - 1]).fecha);
      if (dias >= 10) pendientes.push({ id: `trabajo-${i}`, nombre, detalle: realizado ? `${dias} días sin realizarse` : `Sin registro de realizarse desde que hay datos (${dias} días)` });
    });
    const fum = anteriores(fumigaciones.filter(m => String(m.galpon) === String(lote.galpon)))[0];
    if (!fum || dia(fum.fecha) >= 8) pendientes.push({ id: "fumigacion", nombre: "Revisar y realizar la fumigación de la galera", detalle: fum ? `${dia(fum.fecha)} días desde la última fumigación (${fum.producto || "producto sin indicar"})` : "Sin fumigaciones registradas" });
    if (regs.length && dia(regs[0].fecha) >= 2) pendientes.push({ id: "control", nombre: "Registrar el control diario de la galera", detalle: `${dia(regs[0].fecha)} días sin control diario` });
  } else {
    const movs = anteriores(bodegaMovs);
    const conteo = movs.find(m => m.ajusteConteo != null);
    if (movs.length > 5 && (!conteo || dia(conteo.fecha) > 14)) pendientes.push({ id: "conteo-bodega", nombre: "Hacer conteo físico de cartones en bodega", detalle: conteo ? `${dia(conteo.fecha)} días desde el último conteo` : "Sin conteo físico registrado" });
    if (mpFechaConteo && dia(mpFechaConteo) > 8) pendientes.push({ id: "conteo-materias", nombre: "Hacer conteo físico de materias primas", detalle: `${dia(mpFechaConteo)} días desde el último conteo` });
  }
  return pendientes;
}
