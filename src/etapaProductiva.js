import { fechaHistorialISO } from "./historial.js";

export const EDAD_POSTURA_SEMANAS_DEFAULT = 18;

const DIAS_SEMANA = 7 * 24 * 60 * 60 * 1000;

export function semanasDelLoteEnFecha(lote, fecha) {
  const nac = fechaHistorialISO(lote?.nac);
  const dia = fechaHistorialISO(fecha);
  if (!nac || !dia) return NaN;
  return (Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${nac}T00:00:00Z`)) / DIAS_SEMANA;
}
export function loteExistiaEnFecha(lote, fecha) {
  const nacimiento = fechaHistorialISO(lote?.nac);
  const dia = fechaHistorialISO(fecha);
  return !nacimiento || !dia || dia >= nacimiento;
}

export function estadoProductivoEnFecha(lote, fecha) {
  const dia = fechaHistorialISO(fecha);
  const historial = (lote?.historialEstadoProd || [])
    .map(evento => ({ ...evento, desde: fechaHistorialISO(evento.desde) }))
    .filter(evento => evento.desde && (!dia || evento.desde <= dia))
    .sort((a, b) => a.desde.localeCompare(b.desde));
  if (historial.length) return historial.at(-1).estado || "Producción normal";

  const desde = fechaHistorialISO(lote?.estadoProdDesde);
  if (desde && dia && dia < desde) return "Producción normal";
  return lote?.estadoProd || "Producción normal";
}

export function loteEnLevante(lote, fecha) {
  if (!lote) return false;
  const edadSemanas = semanasDelLoteEnFecha(lote, fecha);
  const inicio = Number(lote.edadInicioPosturaSemanas || EDAD_POSTURA_SEMANAS_DEFAULT);
  return (Number.isFinite(edadSemanas) && edadSemanas < inicio)
    || estadoProductivoEnFecha(lote, fecha) === "Levante / pre-postura";
}

export function motivoExclusionPostura(lote, fecha) {
  if (!lote) return "lote no disponible";
  const dia = fechaHistorialISO(fecha);
  const cierre = fechaHistorialISO(lote.cerradoFecha);
  const nacimiento = fechaHistorialISO(lote.nac);
  if (lote.estado === "cerrado" && (!dia || !cierre || dia > cierre)) return "lote cerrado";
  if (!dia || !nacimiento) return "falta fecha válida de control o nacimiento";
  if (dia < nacimiento) return "control anterior al nacimiento";
  if (loteEnLevante(lote, fecha)) return "levante / pre-postura";
  if (!Number.isFinite(semanasDelLoteEnFecha(lote, fecha))) return "edad no disponible";
  const estado = estadoProductivoEnFecha(lote, fecha);
  return estado === "Producción normal" ? null : `etapa especial: ${estado}`;
}

export function loteCuentaPostura(lote, fecha) {
  return motivoExclusionPostura(lote, fecha) === null;
}

export function registroCuentaPostura(registro, lote) {
  if (registro?.posturaAplica === false) return false;
  return loteCuentaPostura(lote, registro?.fecha);
}

export function resumenPostura({ registros = [], lotes = [], fecha }) {
  const elegibles = (lotes || []).filter(lote => loteCuentaPostura(lote, fecha));
  const elegiblesIds = new Set(elegibles.map(lote => String(lote.id)));
  const excluidos = (lotes || []).filter(lote => !elegiblesIds.has(String(lote.id)))
    .map(lote => ({ lote, motivo: motivoExclusionPostura(lote, fecha) }));
  const ids = new Set(elegibles.map(lote => String(lote.id)));
  const dia = fechaHistorialISO(fecha);
  const avesPorLote = new Map(elegibles.map(lote => {
    const iniciales = Number(lote.avesIniciales || lote.aves || 0);
    const muertasAntes = (registros || []).reduce((total, registro) => {
      if (String(registro.lote) !== String(lote.id) || fechaHistorialISO(registro.fecha) >= dia) return total;
      return total + Math.max(0, Number(registro.muertas || 0));
    }, 0);
    return [String(lote.id), Math.max(0, iniciales - muertasAntes)];
  }));
  const aves = [...avesPorLote.values()].reduce((total, cantidad) => total + cantidad, 0);
  const relevantes = (registros || []).filter(registro => registro.fecha === fecha
    && ids.has(String(registro.lote))
    && registroCuentaPostura(registro, elegibles.find(lote => String(lote.id) === String(registro.lote))));
  const cartones = relevantes.reduce((total, registro) => total + Number(registro.cartones || 0), 0);
  return {
    lotes: elegibles,
    excluidos,
    aves,
    avesPorLote,
    cartones,
    huevos: cartones * 30,
    postura: aves > 0 ? (cartones * 30 / aves) * 100 : null,
  };
}
