const decimal = (valor) => String(valor || "").trim().replace(",", ".");

function separarLinea(linea) {
  const porColumnas = linea.split(/\t|;/).map((celda) => celda.trim()).filter(Boolean);
  if (porColumnas.length > 1) return porColumnas;
  return linea.trim().split(/\s+/).filter(Boolean);
}

export function parsearTiquetesPegados(texto, usados = []) {
  const usadosNormalizados = new Set(usados.map((numero) => String(numero).trim()).filter(Boolean));
  const vistos = new Set();
  return String(texto || "").trim().split(/\r?\n/).filter(Boolean).map((linea, indice) => {
    const [numero = "", cartonesRaw = "", pesoRaw = ""] = separarLinea(linea);
    const num = String(numero).trim();
    const cartones = decimal(cartonesRaw);
    const peso = decimal(pesoRaw);
    const c = Number(cartones) || 0;
    const p = Number(peso) || 0;
    const duplicado = Boolean(num) && (usadosNormalizados.has(num) || vistos.has(num));
    if (num) vistos.add(num);
    return {
      idx: indice + 1,
      num,
      cartones,
      peso,
      c,
      p,
      pesoPromHuevo: c > 0 && p > 0 ? (p * 1000) / (c * 30) : null,
      duplicado,
      valido: Boolean(num) && c > 0 && p > 0 && !duplicado,
    };
  });
}
