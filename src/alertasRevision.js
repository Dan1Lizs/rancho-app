// Identidad y estado de las alertas de Revisión.
// La identidad no depende de los números que cambian cada día (días, fechas,
// porcentajes), para que un descarte permanezca descartado hasta reactivarlo.
export function normalizarTextoAlerta(texto) {
  return String(texto || "")
    .toLocaleLowerCase("es")
    // Conserva el identificador del galpón (G1/G2) y normaliza solo los
    // números que cambian entre mediciones. Así una alerta de G1 nunca
    // comparte el descarte de G2.
    .replace(/gallinero\s+(\d+)/g, "gallinero G$1")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, "fecha")
    .replace(/\b\d+(?:[.,]\d+)?\b/g, "n")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

export function claveAlerta(item, seccion) {
  if (item?.advId) return item.advId;
  const estable = item?.alertaId || item?.clave || item?.idAlerta;
  return `${seccion}:${estable || normalizarTextoAlerta(item?.texto)}`;
}

export function claveAlertaAnterior(item, seccion) {
  return `${seccion}:${String(item?.texto || "").slice(0, 70)}`;
}

export function ultimoEventoAlerta(eventos, item, seccion) {
  const actual = claveAlerta(item, seccion);
  const anterior = claveAlertaAnterior(item, seccion);
  const textoActual = normalizarTextoAlerta(item?.texto);
  return (eventos || []).find(evento => evento.advId === actual || evento.advId === anterior)
    || (eventos || []).find(evento => {
      if (evento?.seccion && evento.seccion !== seccion) return false;
      const textoEvento = normalizarTextoAlerta(evento?.textoOriginal || evento?.nuevoTexto);
      return textoActual && textoEvento && textoActual === textoEvento;
    })
    || null;
}

export function alertaEstaSuprimida(evento) {
  return evento?.accion === "eliminar" || evento?.accion === "eliminar_definitivo";
}

export function ordenarEventosAlertas(eventos) {
  return [...(eventos || [])].sort((a, b) => {
    const da = Date.parse(a?.registradoEl || a?.fechaISO || "") || Number(a?.id) || 0;
    const db = Date.parse(b?.registradoEl || b?.fechaISO || "") || Number(b?.id) || 0;
    return db - da;
  });
}

