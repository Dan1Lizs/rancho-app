import * as XLSX from "xlsx";

export const fechaPesajeISO = (valor) => {
  if (valor instanceof Date && !isNaN(valor)) return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, "0")}-${String(valor.getDate()).padStart(2, "0")}`;
  if (typeof valor === "number" && valor > 30000 && valor < 80000) {
    const d = XLSX.SSF.parse_date_code(valor);
    return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : "";
  }
  const s = String(valor ?? "").trim();
  const iso = /^(20\d\d)-(\d\d?)-(\d\d?)/.exec(s);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = /^(\d{1,2})\/(\d{1,3})\/(20\d\d)$/.exec(s);
  // La hoja antigua tiene "17/011/2025": se interpreta como 17/11/2025.
  const mes = dmy?.[2].length === 3 && dmy[2].startsWith("0") ? dmy[2].slice(1) : dmy?.[2];
  if (dmy && +mes >= 1 && +mes <= 12 && +dmy[1] >= 1 && +dmy[1] <= 31) return `${dmy[3]}-${mes.padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return "";
};

export const clavePesaje = (lote, fecha) => `${lote}|${fechaPesajeISO(fecha)}`;

export const pesoEnGramos = (valor) => {
  if (valor == null || String(valor).trim() === "") return null;
  let s = String(valor).trim().replace(/\s/g, "");
  if (/^\d{1,3}[.,]\d{3}$/.test(s)) {
    // 1.820 puede significar 1,820 kg o 1820 g: ambas equivalen a 1820 g.
    const entero = +s.replace(/[.,]/, "");
    return entero >= 200 && entero <= 5000 ? entero : null;
  }
  s = s.replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  const n = +s;
  const g = n < 10 ? Math.round(n * 1000) : n;
  return g >= 200 && g <= 5000 ? g : null;
};

const normalizarTitulo = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const extraerTablaSimple = (libro, fecha, lote) => {
  if (!fechaPesajeISO(fecha)) return [];
  for (const hoja of libro.SheetNames) {
    const filas = XLSX.utils.sheet_to_json(libro.Sheets[hoja], { header: 1, defval: null });
    const encabezado = filas.slice(0, 10).flatMap((fila, r) => fila.map((valor, c) =>
      /^(peso(?:s)?(?:\s*\((?:kg|g)\))?|weight|gramos?|kilogramos?|kg)$/.test(normalizarTitulo(valor)) ? { r, c } : null)).find(Boolean);
    let pesos = [];
    let columna = "A";
    if (encabezado) {
      columna = XLSX.utils.encode_col(encabezado.c);
      pesos = filas.slice(encabezado.r + 1).map(f => f[encabezado.c]).filter(v => v != null && String(v).trim() !== "");
      // Una fila de pesos debajo de un título ocupa varias columnas.
      if (pesos.length < 3) pesos = (filas[encabezado.r + 1] || []).slice(encabezado.c).filter(v => v != null && String(v).trim() !== "");
    } else if (libro.SheetNames.length === 1) {
      const conDatos = filas.filter(f => f.some(v => v != null && String(v).trim() !== ""));
      if (conDatos.every(f => f.filter(v => v != null && String(v).trim() !== "").length === 1)) {
        pesos = conDatos.map(f => f.find(v => v != null && String(v).trim() !== ""));
      } else if (conDatos.length === 1) {
        pesos = conDatos[0].filter(v => v != null && String(v).trim() !== "");
      }
    }
    if (pesos.length >= 3 && pesos.filter(v => pesoEnGramos(v) != null).length >= 3) {
      return [{ hoja, columna, fecha: fechaPesajeISO(fecha), galpon: "", codigo: "", nacimiento: "", lote, incluir: !!lote,
        pesos: pesos.map(v => pesoEnGramos(v) ?? String(v)) }];
    }
  }
  return [];
};

export const extraerPesajesExcel = (buffer, { fecha = "", lote = "" } = {}) => {
  const libro = XLSX.read(buffer, { type: "array", cellDates: true });
  const encontrados = [];
  for (const hoja of libro.SheetNames.filter(n => /pesaje/i.test(n))) {
    const filas = XLSX.utils.sheet_to_json(libro.Sheets[hoja], { header: 1, defval: null });
    const galpon = /(?:galera|galpon|gallinero)\s*#?\s*(\d)/i.exec(hoja)?.[1];
    const codigo = /(?:-|lote\s*:?\s*)(0[12])\b/i.exec(hoja)?.[1] || "";
    const nacimiento = filas.slice(0, 3).flatMap((fila, i) => fila.map((valor, j) =>
      /fecha\s*nacimiento/i.test(String(valor || "")) ? fechaPesajeISO(filas[i + 1]?.[j]) : "")).find(Boolean) || "";
    // Las fechas de las hojas originales están encima de cada columna de pesos.
    for (let r = 0; r < Math.min(18, filas.length); r++) {
      for (let c = 0; c < (filas[r]?.length || 0); c++) {
        const fecha = fechaPesajeISO(filas[r][c]);
        const esNacimiento = /fecha\s*nacimiento/i.test((filas[r - 1] || []).join(" "));
        if (!fecha || c === 0 || esNacimiento) continue;
        // Un encabezado preliminar puede repetir la fecha encima de la tabla;
        // la fecha más cercana a la muestra es la que corresponde a los pesos.
        if (filas.slice(r + 1, Math.min(18, filas.length)).some(f => fechaPesajeISO(f?.[c]))) continue;
        const pesos = [];
        const columnas = [c];
        if (!fechaPesajeISO(filas[r]?.[c + 1]) && /semana/i.test(String(filas[r - 1]?.[c] ?? ""))) columnas.push(c + 1);
        for (let i = r + 1; i < filas.length; i++) {
          // Una muestra tiene su número de ave al inicio de la fila (A o B).
          const numero = +filas[i]?.[0] || +filas[i]?.[1];
          if (!Number.isInteger(numero) || numero < 1 || numero > 500) {
            if (pesos.length) break;
            continue;
          }
          for (const col of columnas) {
            const valor = filas[i]?.[col];
            if (valor != null && String(valor).trim() !== "") pesos.push(pesoEnGramos(valor) ?? String(valor));
          }
        }
        if (pesos.length >= 3) encontrados.push({ hoja, columna: XLSX.utils.encode_col(c), fecha, galpon, codigo, nacimiento, lote: "", pesos });
      }
    }
  }
  return encontrados.length ? encontrados : extraerTablaSimple(libro, fecha, lote);
};
