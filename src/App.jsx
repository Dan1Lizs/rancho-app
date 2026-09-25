import React, { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import * as XLSX from "xlsx";
import { leer, escribir, agregarPesajesFaltantes, eliminarLotePorId } from "./storage";
import { extraerPesajesExcel, clavePesaje, pesoEnGramos } from "./bienestarImport";
import { migrarDesdeV1 } from "./migracion";
import { supabase } from "./supabase";

// ─── Tokens ─────────────────────────────────────────────────────
const C = {
  fondo: "#F6F6F1", superficie: "#FFFFFF",
  verde: "#14432A", verdeSuave: "#E7EFE8",
  yema: "#E8940A", yemaSuave: "#FDF3E0",
  alerta: "#C4442A", alertaSuave: "#FBEAE6",
  texto: "#1C1F1A", textoSuave: "#6B7266", borde: "#E4E4DC",
};
const fuentes = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');`;
const HXC = 30;
const VERSION_APP = "7.3";
const K = {
  lotes: "granja2:lotes", registros: "granja2:registros", pesajes: "granja2:pesajes",
  meds: "granja2:medicaciones", fums: "granja2:fumigaciones", movs: "granja2:bodegaMovs",
  planta: "granja2:plantaMovs", facturas: "granja2:facturas", bitacora: "granja2:bitacora",
  vacunas: "granja2:vacunas", enfermedades: "granja2:enfermedades",
  necropsias: "granja2:necropsias", planVac: "granja2:planVacunas",
  mpInv: "granja2:mpInventario", mpConfig: "granja2:mpConfig", mpPedidos: "granja2:mpPedidos",
  recetas: "granja2:recetas", mpCat: "granja2:mpCatalogo", nucleo: "granja2:nucleoInv", cxp: "granja2:cxp", kardex: "granja2:kardex", admins: "granja2:cfgAdmins", favoritos: "granja2:favoritos", mpInvHist: "granja2:mpInvHistorial",
  insumos: "granja2:insumos", insumosMovs: "granja2:insumosMovs",
  plantaCfg: "granja2:plantaCfg", bodegaCfg: "granja2:bodegaCfg",
  costos: "granja2:costos",
};

const hoyStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const sumarDias = (dmy, dias) => {
  const [d, m, y] = dmy.split("/").map(Number);
  const f = new Date(y, m - 1, d + Number(dias));
  return `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}/${f.getFullYear()}`;
};
const aDate = (dmy) => { const [d, m, y] = dmy.split("/").map(Number); return new Date(y, m - 1, d); };
const fechaVacuna = (nacISO, dias) => {
  const [y, m, d] = nacISO.split("-").map(Number);
  const f = new Date(y, m - 1, d + Number(dias));
  return { date: f, str: `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}/${f.getFullYear()}` };
};

const comprimirImagen = (file) => new Promise((res, rej) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const max = 1024;
    const esc = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    res(c.toDataURL("image/jpeg", 0.7));
  };
  img.onerror = rej;
  img.src = url;
});

const semanasDe = (fechaNac) => {
  const [y, m, d] = fechaNac.split("-").map(Number);
  return Math.max(0, (Date.now() - new Date(y, m - 1, d).getTime()) / (7 * 24 * 3600 * 1000));
};

// ─── Semilla (formato REPORTE DIARIO DE OPERACION, ago 2026) ────
const SEED_LOTES = [
  { id: "G1", galpon: 1, raza: "ISA Brown", nac: "2025-08-12", aves: 1954, posturaIdeal: 92.3, mortAcum: 465, avesIniciales: 2419, formula: "Postura F1", racionGAve: 118, acumHuevos: 396000, acumAlimentoKg: 56200, acumMasaKg: 24300 },
  { id: "G2", galpon: 2, raza: "Lohmann Brown", nac: "2025-04-10", aves: 1957, posturaIdeal: 80.7, mortAcum: 446, avesIniciales: 2403, formula: "Ponedora 18+", racionGAve: 120, acumHuevos: 398000, acumAlimentoKg: 66500, acumMasaKg: 24900 },
  { id: "G3", galpon: 3, raza: "Hy-Line Brown", nac: "2026-01-13", aves: 2415, posturaIdeal: 96.0, mortAcum: 73, avesIniciales: 2488, formula: "Impulsor", racionGAve: 110, acumHuevos: 48000, acumAlimentoKg: 8900, acumMasaKg: 2800 },
  { id: "G4", galpon: 4, raza: "Lohmann Brown", nac: "2025-04-10", aves: 2102, posturaIdeal: 80.7, mortAcum: 300, avesIniciales: 2403, formula: "Ponedora 18+", racionGAve: 120, acumHuevos: 402000, acumAlimentoKg: 67100, acumMasaKg: 25200 },
];

const SEED_REGISTROS = [
  { fecha: "20/08/2026", lote: "G1", cartones: 54.5, quebrados: 45, pesoKg: 100.7, muertas: 1, dx: "", alimentoKg: 230, por: "" },
  { fecha: "20/08/2026", lote: "G2", cartones: 44.5, quebrados: 45, pesoKg: 80.3, muertas: 5, dx: "", alimentoKg: 264, por: "" },
  { fecha: "20/08/2026", lote: "G3", cartones: 60, quebrados: 90, pesoKg: 128.4, muertas: 4, dx: "", alimentoKg: 254, por: "" },
  { fecha: "20/08/2026", lote: "G4", cartones: 44.5, quebrados: 40, pesoKg: 80.2, muertas: 2, dx: "", alimentoKg: 270, por: "" },
  { fecha: "19/08/2026", lote: "G1", cartones: 50, quebrados: 30, pesoKg: 92.4, muertas: 2, dx: "", alimentoKg: 230, por: "" },
  { fecha: "19/08/2026", lote: "G2", cartones: 44, quebrados: 45, pesoKg: 78.6, muertas: 2, dx: "", alimentoKg: 264, por: "" },
  { fecha: "19/08/2026", lote: "G3", cartones: 59, quebrados: 90, pesoKg: 108.4, muertas: 1, dx: "Oviducto impactado", alimentoKg: 254, por: "" },
  { fecha: "19/08/2026", lote: "G4", cartones: 44, quebrados: 42, pesoKg: 79.4, muertas: 1, dx: "", alimentoKg: 270, por: "" },
];

const SEED_PESAJES = [
  { lote: "G1", semana: 54, fecha: "18/08/2026", pesos: [1880, 1920, 1850, 1990, 1905, 1860, 1940, 1875, 1910, 1895], meta: 2050 },
  { lote: "G3", semana: 32, fecha: "18/08/2026", pesos: [1720, 1760, 1690, 1810, 1745, 1700, 1780, 1715], meta: 1950 },
];

const SEED_COSTOS = { "Postura F1": "", "Ponedora 18+": "", "Impulsor": "" };
const SEED_PLANTA = { saldoKg: 3850 };

// ─── Identidad ───
const RAZON_SOCIAL = "Granja Avícola y Ganadería Rancho El Soñado LTDA.";
const LOGO_B64 = "data:image/jpeg;base64,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";
const IconoGallina = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <path d="M38 22 L45 34 M50 14 L53 33 M63 18 L60 34" stroke="#E23B2E" strokeWidth="8" strokeLinecap="round" />
    <ellipse cx="48" cy="62" rx="26" ry="32" transform="rotate(12 48 62)" stroke="#FFFDF6" strokeWidth="6" />
    <path d="M74 46 Q88 50 92 58 Q82 60 72 56 Z" fill="#E8940A" />
  </svg>
);

// ─── Materias primas y recetas (del archivo Pedido de Materia Prima) ───
const MP_LISTA = [
  { c: "MP001", n: "MAÍZ AMARILLO", prov: "AVIN", pres: 46 },
  { c: "MP003", n: "MAÍZ FINO", prov: "AVIN", pres: 46 },
  { c: "MP004", n: "HARINA DE SOYA", prov: "AVIN", pres: 46 },
  { c: "MP005", n: "ACEMITE", prov: "AVIN", pres: 46 },
  { c: "MP006", n: "ACEITE DE SOYA", prov: "AVIN", pres: 1 },
  { c: "MP007", n: "CARBONATO DE CALCIO", prov: "AVIN", pres: 50 },
  { c: "MP008", n: "CARB DE CALCIO 39%", prov: "AVIN", pres: 50 },
  { c: "MP009", n: "SAL", prov: "Coonaprosal", pres: 50 },
  { c: "MP013", n: "Núcleo Gortech", prov: "Gortech", pres: 22.7 },
  { c: "MP022", n: "H. DE COQUITO (Premium)", prov: "AVIN", pres: 46 },
  { c: "MP023", n: "LEVADURA", prov: "AVIN", pres: 1 },
  { c: "MP026", n: "BICARBONATO DE SODIO", prov: "AVIN", pres: 25 },
  { c: "MP028", n: "LIV-52", prov: "Agrokuvo", pres: 20 },
  { c: "MP029", n: "MONENSIN 7%", prov: "AVIN", pres: 15 },
  { c: "MP030", n: "TECNOVIT", prov: "Agrokuvo", pres: 20 },
  { c: "MP031", n: "MELAZA DE CAÑA", prov: "Dos Pinos", pres: 1 },
  { c: "MP033", n: "DDGS MAÍZ", prov: "AVIN", pres: 46 },
  { c: "MP035", n: "FOSFATO MONOCÁLCICO", prov: "AVIN", pres: 25 },
  { c: "MP036", n: "DL-METIONINA", prov: "AVIN", pres: 25 },
  { c: "MP037", n: "CL-COLINA", prov: "AVIN", pres: 25 },
  { c: "MP038", n: "PREM. GALLINAS TROPICAL", prov: "AVIN", pres: 25 },
  { c: "MP039", n: "L-LISINA", prov: "AVIN", pres: 25 },
  { c: "MP040", n: "MYCOFIX PLUS", prov: "AVIN", pres: 25 },
  { c: "MP041", n: "ISOLEUCINA", prov: "AVIN", pres: 1 },
  { c: "MP042", n: "L-VALINA", prov: "AVIN", pres: 25 },
  { c: "MP043", n: "TREONINA", prov: "AVIN", pres: 1 },
  { c: "MP044", n: "CLOSTAT", prov: "AVIN", pres: 1 },
  { c: "MP045", n: "ACTIGEN (MOS)", prov: "AVIN", pres: 1 },
  { c: "MP046", n: "ENRRAMIX", prov: "AVIN", pres: 1 },
  { c: "MP047", n: "L-TRIPTÓFANO", prov: "AVIN", pres: 1 },
  { c: "MP048", n: "BX POSTURA MÁXIMA", prov: "VYMISA", pres: 20 },
];

const RECETAS_MP = {
  "Impulsor": { MP001: .510954, MP004: .243609, MP005: .01, MP006: .038783, MP007: .067696, MP008: .028598, MP009: .003, MP022: .040924, MP023: .001, MP026: .00175, MP033: .035, MP035: .007033, MP036: .003207, MP037: .00175, MP038: .0015, MP039: .001196, MP040: .001, MP041: .000712, MP042: .000543, MP043: .000522, MP044: .0005, MP045: .000402, MP046: .000196, MP047: .00012 },
  "Fase 1": { MP001: .524875, MP004: .217415, MP005: .03, MP006: .025652, MP007: .067001, MP008: .027696, MP009: .003, MP022: .038946, MP023: .001, MP026: .002641, MP031: .03, MP033: .015, MP035: .005141, MP036: .002913, MP037: .00175, MP038: .0015, MP039: .001413, MP040: .001, MP042: .000554, MP043: .000587, MP044: .0005, MP045: .000402, MP046: .000196, MP047: .000152 },
  "Impulsor Gortech": { MP001: .63004, MP004: .22379, MP006: .013105, MP007: .078629, MP008: .03629, MP009: .003024, MP013: .015121 },
  // Hoja de fabricación oficial VYMISA/AVIN 18-08-2026 (Allix³, act. 19/8/2026) — fracción = kg/690
  "651 Impulsor VYMISA": { MP001: .521036, MP004: .252432, MP006: .031411, MP007: .0677, MP008: .029666, MP009: .003, MP022: .048486, MP026: .002128, MP033: .019802, MP035: .006258, MP036: .00346, MP037: .0015, MP039: .000808, MP040: .001, MP041: .00063, MP042: .000638, MP043: .000592, MP045: .0004, MP046: .0002, MP047: .000104, MP048: .01 },
  "Cría": { MP003: .623522, MP004: .217326, MP009: .021696, MP028: .008043, MP029: .001522, MP030: .021696, MP031: .106196 },
  "Desarrollo": { MP003: .65999, MP004: .259996, MP009: .017507, MP022: .044999, MP030: .017507 },
  "Engorde": { MP003: .475, MP004: .013507, MP009: .008, MP022: .411696, MP029: .000797, MP030: .008, MP031: .083 },
};
// Clasificación por báscula (proceso real de planta): 1 Macros · 2 Líquidos · 3 Medios · 4 Micros (= núcleo)
const BASCULA_MP = {
  MP001: 1, MP003: 1, MP004: 1, MP005: 1, MP022: 1, MP033: 1,
  MP006: 2, MP031: 2,
  MP007: 3, MP008: 3, MP009: 3,
};
const basculaDe = (c) => BASCULA_MP[c] || 4;
const NOMBRE_BASCULA = { 1: "BÁSCULA 1 — MACROS", 2: "BÁSCULA 2 — LÍQUIDOS", 3: "BÁSCULA 3 — MEDIOS", 4: "BÁSCULA 4 — MICROS (NÚCLEO)" };

// Recetas editables: kg por bache (mixer de 690 kg). Semilla derivada de los % del archivo.
const BACHE_KG_DEFAULT = 690;
const SEED_RECETAS = {
  bacheKg: BACHE_KG_DEFAULT,
  formulas: Object.fromEntries(Object.entries(RECETAS_MP).map(([n, r]) => [n, {
    uso: ["Cría", "Desarrollo", "Engorde"].includes(n) ? "Ganado" : "Aves",
    items: Object.fromEntries(Object.entries(r).map(([c, pct]) => [c, +(pct * BACHE_KG_DEFAULT).toFixed(2)])),
  }])),
};
const CATEGORIAS_INSUMOS = ["Vacunas", "Medicinas", "Vitaminas", "Protección Biológica", "Desinfección", "Otros"];
const SEED_INSUMOS = [
  { id: 1, nombre: "Interflox", categoria: "Medicinas", unidad: "ml", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 2, nombre: "Tylvax", categoria: "Medicinas", unidad: "sobres", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 3, nombre: "5x1 Desparasitante", categoria: "Medicinas", unidad: "ml", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 4, nombre: "Optimizer", categoria: "Vitaminas", unidad: "ml", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 5, nombre: "Aminovit", categoria: "Vitaminas", unidad: "ml", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 6, nombre: "Farvital", categoria: "Vitaminas", unidad: "ml", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 7, nombre: "Promotor L", categoria: "Vitaminas", unidad: "ml", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 8, nombre: "Calciphy", categoria: "Vitaminas", unidad: "ml", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 9, nombre: "Sanivir", categoria: "Desinfección", unidad: "ml", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 10, nombre: "Mevisan", categoria: "Desinfección", unidad: "ml", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 11, nombre: "Mevipow", categoria: "Desinfección", unidad: "g", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 12, nombre: "Yodo 2.5%", categoria: "Desinfección", unidad: "ml", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 13, nombre: "Sanivet", categoria: "Desinfección", unidad: "ml", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 14, nombre: "Viroguard", categoria: "Desinfección", unidad: "ml", saldo: 0, presentacion: "", dosis: "", proveedor: "" },
  { id: 15, nombre: "Vacuna Newcastle + Bronquitis (Ma5+Clon30)", categoria: "Vacunas", unidad: "frascos", saldo: 0, presentacion: "frasco 1000 dosis", dosis: "", proveedor: "Ciencias Pecuarias" },
];

const GANADO_SEMILLA = [
  { nombre: "Potrero 1 — Cría vacas", formula: "Cría", animales: 24, kgAnimal: 2.5 },
  { nombre: "Potrero 2 — Novillas", formula: "Desarrollo", animales: 0, kgAnimal: 1 },
  { nombre: "Potrero 3 — Terneros", formula: "Desarrollo", animales: 27, kgAnimal: 2 },
  { nombre: "Estabulados — Toros", formula: "Engorde", animales: 15, kgAnimal: 5 },
];

// Programa de vacunación ponedoras — Dr. Heiner Hernández Ávila, C.M.V #666 (por día de edad)
const PLAN_VACUNAS_ESTANDAR = [
  { id: 1, dia: 0, vacuna: "Marek + Gumboro (HVT-IBD) + RISP", cepa: "", via: "Subcutánea", proveedor: "Incubadora" },
  { id: 2, dia: 3, vacuna: "Salmonella (S. enteritidis) viva", cepa: "", via: "Al agua", proveedor: "Vetim" },
  { id: 3, dia: 12, vacuna: "Newcastle + Bronquitis", cepa: "Entérica + H120", via: "Al agua", proveedor: "Faryvet" },
  { id: 4, dia: 18, vacuna: "Gumboro", cepa: "Intermedia", via: "Al agua", proveedor: "Corpeco" },
  { id: 5, dia: 22, vacuna: "Salmonella", cepa: "Sub Unidades", via: "Al agua", proveedor: "Vetanco" },
  { id: 6, dia: 28, vacuna: "Bronquitis + Newcastle", cepa: "Ma5 + Clon 30", via: "Al agua", proveedor: "Ciencias Pecuarias" },
  { id: 7, dia: 35, vacuna: "Salmonella", cepa: "Sub Unidades", via: "Al agua", proveedor: "Vetanco" },
  { id: 8, dia: 45, vacuna: "Laringotraqueítis + Viruela", cepa: "Recombinante LT", via: "Ala", proveedor: "Faryvet" },
  { id: 9, dia: 45, vacuna: "Micoplasma", cepa: "Cefa F", via: "Ojo", proveedor: "Vetim" },
  { id: 10, dia: 63, vacuna: "Bronquitis + Newcastle", cepa: "Ma5 + Clon 30", via: "Al agua", proveedor: "Ciencias Pecuarias" },
  { id: 11, dia: 70, vacuna: "Coryza", cepa: "ABC", via: "Pechuga", proveedor: "Corpeco" },
  { id: 12, dia: 70, vacuna: "Encefalomielitis", cepa: "Calnek", via: "Ala", proveedor: "Corpeco" },
  { id: 13, dia: 90, vacuna: "Bronquitis + Newcastle", cepa: "Ma5 + Clon 30", via: "Al agua", proveedor: "Ciencias Pecuarias" },
  { id: 14, dia: 98, vacuna: "Oleosa cuádruple + Salmonella", cepa: "IBND + EDS + Coryza + Salmonella", via: "IM pechuga", proveedor: "Ciencias Pecuarias" },
];

const TRABAJOS = [
  "Lavar bebederos", "Sacudir felpas", "Sacudir nidos por dentro", "Fumigar la cama",
  "Lavado de estañones de agua", "Volteo de la cama", "Sacudir mallas", "Lavado de basureros",
  "Limpieza de ventiladores", "Limpiar malla recolección", "Lavado de aceras",
  "Botar gallinas muertas", "Enterrar huevo descartado", "Limpieza perimetral",
  "Lavado de caños", "Limpieza caja de registro", "Limpieza de trampas de ratas",
];

// La base de datos devuelve las filas sin orden garantizado — ordenamos por fecha (dd/mm/yyyy) descendente
const fechaVal = (f) => { const p = String(f || "").split("/"); return p.length === 3 ? Number(p[2]) * 10000 + Number(p[1]) * 100 + Number(p[0]) : 0; };
const ordenarPorFecha = (arr) => [...(arr || [])].sort((a, b) => (fechaVal(b.fecha) - fechaVal(a.fecha)) || ((Number(b.id) || 0) - (Number(a.id) || 0)));

const capturaVacia = () => ({
  tiquetes: [{ num: "", cartones: "", peso: "" }, { num: "", cartones: "", peso: "" }, { num: "", cartones: "", peso: "" }],
  quebrados: "", muertas: "", dx: "",
  fums: [{ producto: "", dosis: "", hora: "" }],
  meds: [{ producto: "", dosis: "", enfermedad: "", retiro: "" }],
  vits: [{ producto: "", dosis: "" }],
  alimento6am: "", alimento1pm: "", aguaL: "", obsAlimento: "", trabajos: {},
  chequeo: { cascara: "", consumoObs: "", aguaObs: "", cresta: "", heces: "", respiratorio: "", secrecion: "", comederos: "", ph: "", cloro: "", temp: "", humedad: "", luz: "", obs: "" },
});

// Storage: Supabase (src/storage.js)

// ─── UI básicos ─────────────────────────────────────────────────
function KPI({ etiqueta, valor, unidad, tono, sub }) {
  const colorValor = tono === "alerta" ? C.alerta : tono === "ok" ? C.verde : C.texto;
  return (
    <div style={{ background: C.superficie, border: `1px solid ${C.borde}`, borderRadius: 14, padding: "12px 14px", flex: "1 1 128px", minWidth: 128 }}>
      <div style={{ fontSize: 11.5, color: C.textoSuave, fontWeight: 500, marginBottom: 5 }}>{etiqueta}</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 23, fontWeight: 700, color: colorValor, lineHeight: 1 }}>
        {valor}<span style={{ fontSize: 13, fontWeight: 500, color: C.textoSuave, marginLeft: 4 }}>{unidad}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: C.textoSuave, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function BarraPostura({ actual, meta }) {
  const pct = Math.min(actual, 100);
  const brecha = (meta - actual).toFixed(1);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: "relative", height: 12, background: C.verdeSuave, borderRadius: 6 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${C.yema}, #F5B845)`, borderRadius: 6 }} />
        <div style={{ position: "absolute", left: `${Math.min(meta, 99)}%`, top: -3, height: 18, width: 2.5, background: C.verde, borderRadius: 2 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11.5, color: C.textoSuave }}>
        <span><b style={{ color: C.texto }}>{actual.toFixed(1)}%</b> postura</span>
        <span style={{ color: brecha > 0 ? C.alerta : C.verde, fontWeight: 500 }}>{brecha > 0 ? `−${brecha}` : `+${Math.abs(brecha)}`} pts vs tabla</span>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 16, border: `1.5px solid #E4E4DC`, borderRadius: 10, background: "#fff", fontFamily: "'Inter', sans-serif", outline: "none" };

function Campo({ etiqueta, mitad, tercio, ...props }) {
  // iPhone: el teclado decimal solo trae coma — convertimos a punto para que los números con decimales funcionen
  const esNum = props.type === "number";
  const extra = esNum ? {
    type: "text", inputMode: props.inputMode || "decimal",
    onChange: (e) => { e.target.value = e.target.value.replace(/,/g, "."); props.onChange && props.onChange(e); },
  } : {};
  return (
    <label style={{ display: "block", marginBottom: 12, flex: tercio ? "1 1 30%" : mitad ? "1 1 45%" : "1 1 100%", minWidth: tercio ? 96 : undefined }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5, color: C.texto }}>{etiqueta}</span>
      <input {...props} {...extra} style={inputStyle} />
    </label>
  );
}

function Seccion({ titulo, sub, children, num, accion }) {
  return (
    <div style={{ background: C.superficie, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
        {num && <span style={{ background: C.verde, color: "#fff", borderRadius: 8, fontSize: 12.5, padding: "2px 8px" }}>{num}</span>}
        <span style={{ flex: 1 }}>{titulo}</span>
        {accion}
      </div>
      {sub ? <div style={{ fontSize: 12.5, color: C.textoSuave, marginTop: 2, marginBottom: 10 }}>{sub}</div> : <div style={{ marginBottom: 10 }} />}
      {children}
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────
export default function App() {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [cargandoFondo, setCargandoFondo] = useState(false);
  const [vista, setVista] = useState("reporte");
  const [lotes, setLotes] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [pesajes, setPesajes] = useState([]);
  const [medicaciones, setMedicaciones] = useState([]);
  const [fumigaciones, setFumigaciones] = useState([]);
  const [bodegaMovs, setBodegaMovs] = useState([]);
  const [plantaMovs, setPlantaMovs] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [vacunas, setVacunas] = useState([]);
  const [enfermedades, setEnfermedades] = useState([]);
  const [necropsias, setNecropsias] = useState([]);
  const [planVac, setPlanVac] = useState([]);
  const [bitacora, setBitacora] = useState([]);
  const [costos, setCostos] = useState(SEED_COSTOS);
  const [guardado, setGuardado] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [galponActivo, setGalponActivo] = useState("G1");
  const suciosRef = useRef({}); // gallineros con ediciones locales sin guardar — el refresco en vivo no los toca
  const notaSuciaRef = useRef(false);
  const fechaCapturaRef = useRef(new Date().toISOString().slice(0, 10));
  const [completadoPor, setCompletadoPor] = useState("");
  const [capturas, setCapturas] = useState({});
  const [notaDia, setNotaDia] = useState("");

  // Bodega
  const [movBodega, setMovBodega] = useState({ comprado: "", vendGranja: "", destruido: "", regalado: "" });
  const [repartos, setRepartos] = useState([
    { nombre: "Andrés", salida: "", devBueno: "", devMalo: "" },
    { nombre: "Bryan", salida: "", devBueno: "", devMalo: "" },
  ]);
  const [obsInv, setObsInv] = useState("");
  const [ajusteBodega, setAjusteBodega] = useState("");
  const [fechaBodega, setFechaBodega] = useState(new Date().toISOString().slice(0, 10));
  const [nucleoInv, setNucleoInv] = useState({});
  const [cxp, setCxp] = useState({ facturas: [], pagos: [] });
  const [fCxpFac, setFCxpFac] = useState(null);
  const [abonando, setAbonando] = useState(null);
  const [fAbono, setFAbono] = useState({ monto: "", fecha: new Date().toISOString().slice(0, 10), medio: "Transferencia", ref: "" });
  const [kardex, setKardex] = useState([]);
  const [esAdmin, setEsAdmin] = useState(true);
  const [cfgAdmins, setCfgAdmins] = useState([]);
  const [nuevoAdmin, setNuevoAdmin] = useState("");
  const [favoritos, setFavoritos] = useState([]);
  const [mpInvHist, setMpInvHist] = useState([]);
  const [gestionFav, setGestionFav] = useState(null); // tipo: "fum" | "med" | "vit" — para borrar favoritos
  const [modalFav, setModalFav] = useState(null); // {tipo, idx, nombre, dosis, retiro}
  const [fNucleo, setFNucleo] = useState({ formula: "Impulsor", porciones: "", numNucleo: "", fecha: new Date().toISOString().slice(0, 10) });

  // Planta
  const [fBache, setFBache] = useState({ formula: "Impulsor", baches: "", kg: "", numBache: "", fecha: new Date().toISOString().slice(0, 10) });
  const [plantaCfg, setPlantaCfg] = useState({ inicialAves: SEED_PLANTA.saldoKg, inicialGanado: 0 });
  const [bodegaCfg, setBodegaCfg] = useState({ inicialCart: 128 });
  const [aperturaIns, setAperturaIns] = useState({});
  const [fServGan, setFServGan] = useState({ kg: "", detalle: "", formula: "", fecha: new Date().toISOString().slice(0, 10) });
  const [fAjPlanta, setFAjPlanta] = useState({ categoria: "Aves", saldoReal: "", fecha: new Date().toISOString().slice(0, 10) });
  const [fFactura, setFFactura] = useState({ proveedor: "", producto: "", monto: "", fecha: new Date().toISOString().slice(0, 10) });

  const [fPeso, setFPeso] = useState({ lote: "G1", pesos: "", fecha: new Date().toISOString().slice(0, 10) });
  const [excelPesajes, setExcelPesajes] = useState([]);
  const [excelAbierto, setExcelAbierto] = useState(-1);
  const [importandoPesajes, setImportandoPesajes] = useState(false);
  const [fVac, setFVac] = useState({ lote: "G1", vacuna: "", cepa: "", via: "", proveedor: "" });
  const [fechasAplicar, setFechasAplicar] = useState({});
  const [fechaCaptura, setFechaCaptura] = useState(new Date().toISOString().slice(0, 10));

  const construirCaptura = (l, dmy, regs, medsAll, fumsAll) => {
    const reg = regs.find(r => r.fecha === dmy && r.lote === l.id);
    if (!reg) return null;
    const medsG = medsAll.filter(m => m.fecha === dmy && m.galpon === l.galpon);
    const meds = medsG.filter(m => m.tipo === "Medicamento").map(m => ({ producto: m.producto, dosis: m.dosis || "", enfermedad: m.enfermedad || "", retiro: m.retiroDias ? String(m.retiroDias) : "" }));
    const vits = medsG.filter(m => m.tipo === "Vitamina").map(m => ({ producto: m.producto, dosis: m.dosis || "" }));
    const fums = fumsAll.filter(m => m.fecha === dmy && m.galpon === l.galpon).map(m => ({ producto: m.producto, dosis: m.dosis || "", hora: m.hora || "" }));
    const tiq = (reg.tiquetes || []).map(t => ({ num: t.num ?? "", cartones: String(t.cartones ?? ""), peso: String(t.peso ?? "") }));
    const base = capturaVacia();
    return {
      tiquetes: tiq.length ? tiq : base.tiquetes,
      quebrados: reg.quebrados ? String(reg.quebrados) : "",
      muertas: reg.muertas ? String(reg.muertas) : "", dx: reg.dx || "",
      fums: fums.length ? fums : base.fums,
      meds: meds.length ? meds : base.meds,
      vits: vits.length ? vits : base.vits,
      alimento6am: reg.alimento6am ? String(reg.alimento6am) : "",
      obsAlimento: reg.obsAlimento || "",
      alimento1pm: reg.alimento1pm ? String(reg.alimento1pm) : "",
      aguaL: reg.aguaL ? String(reg.aguaL) : "",
      trabajos: reg.trabajos || {},
      chequeo: { ...base.chequeo, ...(reg.chequeo || {}) },
    };
  };

  const cambiarFechaCaptura = (iso) => {
    setFechaCaptura(iso);
    fechaCapturaRef.current = iso;
    suciosRef.current = {};
    const dmy = iso.split("-").reverse().join("/");
    let cargados = 0;
    const nuevas = Object.fromEntries(lotes.map(l => {
      const c2 = construirCaptura(l, dmy, registros, medicaciones, fumigaciones);
      if (c2) cargados++;
      return [l.id, c2 || capturaVacia()];
    }));
    setCapturas(nuevas);
    if (cargados > 0) avisar(`✓ Se cargó lo guardado del ${dmy} (${cargados} gallinero(s)) — edita solo lo necesario`);
  };
  const [fNecFotos, setFNecFotos] = useState([]);
  const [fotosVista, setFotosVista] = useState({});
  const [printDoc, setPrintDoc] = useState(null);
  const [mpInv, setMpInv] = useState({});
  const [mpInvUltimo, setMpInvUltimo] = useState({});
  const [mpFechaInput, setMpFechaInput] = useState(new Date().toISOString().slice(0, 10)); // último conteo GUARDADO — se usa para calcular el pedido, aunque el formulario de arriba ya esté vacío
  const [mpFechaConteo, setMpFechaConteo] = useState("");
  const [mpResponsable, setMpResponsable] = useState("");
  const [mpConfig, setMpConfig] = useState({ cobertura: 11, minKg1: 5, ganado: GANADO_SEMILLA, formulaLote: {} });
  const [mpPedidos, setMpPedidos] = useState([]);
  const [fPedidoMP, setFPedidoMP] = useState({ fecha: new Date().toISOString().slice(0, 10), proveedor: "", nota: "", lineas: [{ mp: "", kg: "" }] });
  const [recetas, setRecetas] = useState(SEED_RECETAS);
  const [mpCat, setMpCat] = useState(MP_LISTA);
  const [fNuevaMP, setFNuevaMP] = useState({ n: "", prov: "", pres: "" });
  const [insumos, setInsumos] = useState(SEED_INSUMOS);
  const [insumosMovs, setInsumosMovs] = useState([]);
  const [fMovIns, setFMovIns] = useState({ tipo: "entrada", itemId: "", cantidad: "", detalle: "", fecha: new Date().toISOString().slice(0, 10) });
  const [fNuevoIns, setFNuevoIns] = useState({ nombre: "", categoria: "Medicinas", unidad: "ml", saldo: "", presentacion: "", dosis: "", proveedor: "" });
  const [recActiva, setRecActiva] = useState("Impulsor");
  const [fNuevaRec, setFNuevaRec] = useState({ nombre: "", uso: "Aves" });
  const [fIng, setFIng] = useState({ mp: "MP001", kg: "" });
  const [fEnf, setFEnf] = useState({ lote: "G1", enfermedad: "", tratamiento: "", estado: "En tratamiento" });
  const [fNec, setFNec] = useState({ lote: "G1", tipo: "Necropsia", laboratorio: "", hallazgos: "" });
  const [fPlan, setFPlan] = useState({ vacuna: "", cepa: "", via: "", proveedor: "", dia: "" });
  const [histFecha, setHistFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [histMes, setHistMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [formLote, setFormLote] = useState(null); // null = cerrado · objeto = creando/editando

  const guardarLote = async () => {
    if (!formLote.galpon || !formLote.raza || !formLote.nac) { avisar("⚠ Galpón, raza y fecha de nacimiento son obligatorios"); return; }
    setGuardando(true);
    let nuevos;
    const campos = {
      galpon: Number(formLote.galpon), lote: formLote.lote || "01", raza: formLote.raza, nac: formLote.nac,
      formula: formLote.formula || "", racionGAve: Number(formLote.racionGAve || 0),
      posturaIdeal: Number(formLote.posturaIdeal || 90), pesoMeta: Number(formLote.pesoMeta || 0),
      proveedor: formLote.proveedor || "", estadoProd: formLote.estadoProd || "Producción normal",
    };
    if (formLote.id) {
      nuevos = lotes.map(l => l.id === formLote.id ? { ...l, ...campos, avesIniciales: Number(formLote.avesIniciales || l.avesIniciales), aves: Number(formLote.aves ?? l.aves) } : l);
    } else {
      const id = `G${campos.galpon}L${campos.lote}-${Date.now().toString(36).slice(-4)}`;
      const avesIni = Number(formLote.avesIniciales || 0);
      nuevos = [...lotes, { id, ...campos, avesIniciales: avesIni, aves: avesIni, mortAcum: 0, acumHuevos: 0, acumAlimentoKg: 0, acumMasaKg: 0 }];
      setCapturas(c => ({ ...c, [id]: capturaVacia() }));
    }
    if (await escribir(K.lotes, nuevos)) { setLotes(nuevos); setFormLote(null); avisar("✓ Lote guardado"); }
    else avisar("⚠ No se pudo guardar el lote");
    setGuardando(false);
  };

  const [confirmar, setConfirmar] = useState(null);
  const pideConfirm = (clave, msg) => {
    if (confirmar === clave) { setConfirmar(null); return true; }
    setConfirmar(clave);
    avisar(msg);
    setTimeout(() => setConfirmar(c => (c === clave ? null : c)), 6000);
    return false;
  };

  const cerrarLote = async (id) => {
    if (!pideConfirm(`cerrar-${id}`, "⚠ Toca 'Cerrar lote' otra vez para confirmar — el historial se conserva")) return;
    const nuevos = lotes.map(l => l.id === id ? { ...l, estado: "cerrado", cerradoFecha: hoyStr() } : l);
    if (await escribir(K.lotes, nuevos)) { setLotes(nuevos); avisar("✓ Lote cerrado"); }
    else avisar("⚠ No se pudo guardar — revisa la señal e intenta de nuevo");
  };

  const reabrirLote = async (id) => {
    const nuevos = lotes.map(l => l.id === id ? { ...l, estado: "activo" } : l);
    if (await escribir(K.lotes, nuevos)) { setLotes(nuevos); avisar("✓ Lote reabierto"); }
  };

  const eliminarLote = async (id) => {
    if (!pideConfirm(`elimLote-${id}`, "⚠ Toca 'Eliminar' otra vez para BORRAR DEFINITIVAMENTE este lote")) return;
    const nuevos = lotes.filter(l => l.id !== id);
    if (await eliminarLotePorId(id)) { setLotes(nuevos); avisar("✓ Lote eliminado"); }
    else avisar("⚠ No se pudo eliminar el lote; revisa la conexión");
  };

  // ── Carga inicial ──
  // silencioso=true: se usa para refrescos en vivo por cambios de OTRAS personas.
  // En ese caso NO debe tapar la pantalla (cargando) ni bloquear el botón Guardar
  // (cargandoFondo) — solo debe traer los datos nuevos calladamente.
  const cargarTodo = async (primera, silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      // FASE 1: solo lo esencial para pintar la pantalla (2 lecturas)
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 12000));
      const [ls0, rs0] = await Promise.race([timeout, Promise.all([leer(K.lotes, null), leer(K.registros, null)])]);
      if (ls0 === null || rs0 === null) throw new Error("No se pudieron leer los lotes o registros");
      const siembras = [];
      const ls = ls0;
      const rs = rs0;
      setLotes(ls); setRegistros(ordenarPorFecha(rs));
      if (primera) setCapturas(Object.fromEntries(ls.map(l => [l.id, capturaVacia()])));
      setErrorCarga(false);
      if (!silencioso) { setCargando(false); setCargandoFondo(true); }           // ← la app ya se ve y se puede navegar

      // FASE 2: el resto en segundo plano (en paralelo)
      const [ps0, ms, fs, mv, pl, pcfg, bcfg, fa, va, en, ne, pv0, bi, cs, mi, mc, pedidos, rc0, mcat0, ins0, insMovs, nuc0, cxp0, kdx0, adm0, fav0, mih0] = await Promise.all([
        leer(K.pesajes, null), leer(K.meds, []), leer(K.fums, []), leer(K.movs, []), leer(K.planta, []),
        leer(K.plantaCfg, null), leer(K.bodegaCfg, null), leer(K.facturas, []), leer(K.vacunas, []),
        leer(K.enfermedades, []), leer(K.necropsias, []), leer(K.planVac, null), leer(K.bitacora, []),
        leer(K.costos, SEED_COSTOS), leer(K.mpInv, null), leer(K.mpConfig, null), leer(K.mpPedidos, []),
        leer(K.recetas, null), leer(K.mpCat, null), leer(K.insumos, null), leer(K.insumosMovs, []),
        leer(K.nucleo, {}), leer(K.cxp, null), leer(K.kardex, []), leer(K.admins, []), leer(K.favoritos, []), leer(K.mpInvHist, []),
      ]);
      if (ps0 === null) throw new Error("No se pudieron leer los pesajes");
      const ps = ps0;
      const pv = (pv0 && pv0.length) ? pv0 : (siembras.push(escribir(K.planVac, PLAN_VACUNAS_ESTANDAR)), PLAN_VACUNAS_ESTANDAR);
      let rc = rc0 ?? (siembras.push(escribir(K.recetas, SEED_RECETAS)), SEED_RECETAS);
      // Actualización a hoja oficial VYMISA 18/08/2026 — solo si sigue la versión anterior sin editar
      const v651 = rc.formulas?.["651 Impulsor VYMISA"];
      if (v651 && v651.items?.MP007 > 46.2 && v651.items?.MP007 < 46.3) {
        rc = { ...rc, formulas: { ...rc.formulas, "651 Impulsor VYMISA": JSON.parse(JSON.stringify(SEED_RECETAS.formulas["651 Impulsor VYMISA"])) } };
        siembras.push(escribir(K.recetas, rc));
      }
      const mcat = mcat0 ?? (siembras.push(escribir(K.mpCat, MP_LISTA)), MP_LISTA);
      let ins = ins0 ?? (siembras.push(escribir(K.insumos, SEED_INSUMOS)), SEED_INSUMOS);
      if (siembras.length) await Promise.all(siembras);
      ins = ins.map(it => ({ presentacion: "", dosis: "", proveedor: "", ...it, categoria: it.categoria === "Desinfectantes" ? "Desinfección" : it.categoria }));
      if (pcfg) setPlantaCfg(pcfg);
      if (bcfg) {
        setBodegaCfg(bcfg);
        if (bcfg.repartidores?.length && !mv.find(m2 => m2.fecha === hoyStr())) {
          setRepartos(bcfg.repartidores.map(n2 => ({ nombre: n2, salida: "", devBueno: "", devMalo: "" })));
        }
      }
      if (mi) { setMpInvUltimo(mi.items || {}); setMpFechaConteo(mi.fecha || ""); setMpResponsable(mi.responsable || ""); }
      if (mc) setMpConfig({ cobertura: 11, minKg1: 5, ganado: GANADO_SEMILLA, formulaLote: {}, ...mc });
      setMpPedidos(ordenarPorFecha(pedidos)); setRecetas(rc); setMpCat(mcat); setInsumos(ins); setInsumosMovs(ordenarPorFecha(insMovs));
      setPesajes(ordenarPorFecha(ps)); setMedicaciones(ordenarPorFecha(ms)); setFumigaciones(ordenarPorFecha(fs));
      setBodegaMovs(ordenarPorFecha(mv)); setPlantaMovs(ordenarPorFecha(pl)); setFacturas(ordenarPorFecha(fa)); setBitacora(ordenarPorFecha(bi)); setCostos(cs);
      setVacunas(ordenarPorFecha(va)); setEnfermedades(ordenarPorFecha(en)); setNecropsias(ordenarPorFecha(ne)); setPlanVac(pv);
      setNucleoInv(nuc0 || {});
      if (cxp0) setCxp({ facturas: [], pagos: [], notas: [], ...cxp0 });
      setKardex(ordenarPorFecha(kdx0 || []));
      setCfgAdmins(adm0 || []);
      setFavoritos(fav0 || []);
      setMpInvHist(ordenarPorFecha(mih0 || []));
      {
        const emailSesion = (typeof window !== "undefined" && window.__usuarioEmail || "").toLowerCase();
        if ((adm0 || []).length > 0 && emailSesion) setEsAdmin(adm0.map(x => x.toLowerCase()).includes(emailSesion));
      }
      const movHoy = mv.find(m => m.fecha === hoyStr());
      if (movHoy) {
        setMovBodega({ comprado: movHoy.comprado || "", vendGranja: movHoy.vendGranja || "", destruido: movHoy.destruido || "", regalado: movHoy.regalado || "" });
        if (movHoy.repartos) setRepartos(movHoy.repartos);
        setObsInv(movHoy.obs || "");
      }
      // Sincronizar el formulario de captura con lo que llegó de otros dispositivos,
      // SIN tocar los gallineros que este usuario está editando (marcados "sucios")
      {
        const dmy = (fechaCapturaRef.current || new Date().toISOString().slice(0, 10)).split("-").reverse().join("/");
        const rsOrd = ordenarPorFecha(rs);
        setCapturas(prev => {
          const nuevas = { ...prev };
          ls.forEach(l => {
            if (suciosRef.current[l.id]) return; // en edición local — no tocar
            const c2 = construirCaptura(l, dmy, rsOrd, ms, fs);
            nuevas[l.id] = c2 || prev[l.id] || capturaVacia();
          });
          return nuevas;
        });
        if (!notaSuciaRef.current) {
          const nota2 = (bi || []).find(b => b.fecha === dmy);
          setNotaDia(nota2 ? nota2.texto : "");
        }
      }
      setCargandoFondo(false); // no-op si silencioso (ya estaba en false)
    } catch { if (!silencioso) { setErrorCarga(true); setCargando(false); setCargandoFondo(false); } }
  };
  useEffect(() => { cargarTodo(true); }, []);

  // ── Actualización en vivo: si otra persona guarda algo en cualquier tabla
  // de la granja, esta pantalla se refresca sola EN SILENCIO (sin tapar la
  // pantalla ni bloquear tu propio botón Guardar) — así nadie necesita
  // acordarse de tocar ⟳ para ver los cambios de los demás.
  useEffect(() => {
    const tablasEnVivo = [
      "lotes", "registros", "pesajes", "medicaciones", "fumigaciones", "bodega_movs",
      "planta_movs", "facturas", "bitacora", "vacunas", "enfermedades", "necropsias",
      "plan_vacunas", "mp_pedidos", "insumos", "insumos_movs", "kardex", "mp_catalogo", "favoritos", "mp_inv_historial",
      "cxp_facturas", "cxp_pagos", "cxp_notas", "config",
    ];
    let temporizador = null;
    const pedirRefresco = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => cargarTodo(false, true), 1500);
    };
    const canal = supabase.channel("granja-en-vivo");
    tablasEnVivo.forEach((t) => {
      canal.on("postgres_changes", { event: "*", schema: "public", table: t }, pedirRefresco);
    });
    canal.subscribe();
    return () => { clearTimeout(temporizador); supabase.removeChannel(canal); };
  }, []);

  const avisar = (m) => { setGuardado(m); setTimeout(() => setGuardado(""), 3000); };

  // iPhone: el teclado decimal solo trae "," — la convertimos a "." en el instante en que se teclea,
  // antes de que React lea el valor, para que TODOS los campos numéricos acepten decimales
  useEffect(() => {
    const setterNativo = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const normalizar = (e) => {
      const el = e.target;
      if (el?.tagName === "INPUT" && el.getAttribute("inputmode") === "decimal" && el.value.includes(",")) {
        setterNativo.call(el, el.value.replace(/,/g, "."));
      }
    };
    document.addEventListener("input", normalizar, true);
    return () => document.removeEventListener("input", normalizar, true);
  }, []);

  // Navegación de captura: Enter → siguiente casilla · flechas ↑/↓ → anterior/siguiente (en campos de texto)
  useEffect(() => {
    const alTeclear = (e) => {
      const el = e.target;
      if (!el || el.tagName !== "INPUT" || el.type === "file" || el.type === "checkbox") return;
      const esTexto = el.type === "text" && !el.getAttribute("list");
      const avanzar = e.key === "Enter" || (esTexto && e.key === "ArrowDown");
      const retroceder = esTexto && e.key === "ArrowUp";
      if (!avanzar && !retroceder) return;
      const focusables = Array.from(document.querySelectorAll('input:not([type="file"]):not([type="checkbox"]):not([disabled]), select:not([disabled])'))
        .filter(x => x.offsetParent !== null);
      const i = focusables.indexOf(el);
      if (i === -1) return;
      const destino = focusables[i + (avanzar ? 1 : -1)];
      if (destino) { e.preventDefault(); destino.focus(); if (destino.select) destino.select(); }
    };
    document.addEventListener("keydown", alTeclear, true);
    return () => document.removeEventListener("keydown", alTeclear, true);
  }, []);

  // ── Totales captura ──
  const totalesGalpon = (c) => {
    if (!c) return { cartones: 0, huevos: 0, pesoKg: 0 };
    const cartones = c.tiquetes.reduce((s, t) => s + Number(t.cartones || 0), 0);
    const pesoKg = c.tiquetes.reduce((s, t) => s + Number(t.peso || 0), 0);
    return { cartones, huevos: cartones * HXC, pesoKg };
  };

  // ── Guardar control diario ──
  const guardarDia = async (soloLoteId = null) => {
    if (cargandoFondo) { avisar("⏳ Sincronizando datos — intenta en unos segundos"); return; }
    const soloLote = soloLoteId ? lotes.find(x => x.id === soloLoteId) : null;
    setGuardando(true);
    const fecha = (fechaCaptura || new Date().toISOString().slice(0, 10)).split("-").reverse().join("/");
    // Validación de tiquetes: duplicado en el MISMO formulario = error (bloquea);
    // coincidencia con el historial = advertencia con detalle, y el usuario decide si guarda igual
    {
      const enFormulario = [];
      lotes.forEach(l => {
        if (soloLoteId && l.id !== soloLoteId) return;
        (capturas[l.id]?.tiquetes || []).forEach(t => { if (t.num && t.cartones) enFormulario.push(String(t.num).trim()); });
      });
      const repetidoForm = enFormulario.find((n2, i) => enFormulario.indexOf(n2) !== i);
      if (repetidoForm) {
        avisar(`⚠ El tiquete #${repetidoForm} está repetido DENTRO de este formulario — corrige antes de guardar`);
        setGuardando(false); return;
      }
      let choque = null;
      for (const r of registros) {
        if (r.fecha === fecha) continue;
        const t = (r.tiquetes || []).find(x => enFormulario.includes(String(x.num).trim()));
        if (t) { const l2 = lotes.find(x => x.id === r.lote); choque = { num: String(t.num).trim(), fecha: r.fecha, galpon: l2?.galpon }; break; }
      }
      if (choque && confirmar !== "tiqDup") {
        setConfirmar("tiqDup");
        avisar(`⚠ El tiquete #${choque.num} ya se usó el ${String(choque.fecha).slice(0, 5)}${choque.galpon ? ` en G${choque.galpon}` : ""}. Si es correcto (talonario reinicia números), toca Guardar OTRA VEZ para guardar así.`);
        setTimeout(() => setConfirmar(c2 => c2 === "tiqDup" ? null : c2), 12000);
        setGuardando(false); return;
      }
      if (confirmar === "tiqDup") setConfirmar(null);
    }
    const nuevos = [];
    const reemplazados = [];
    // Edición sin duplicar: lo del día se reemplaza por lo que trae el formulario
    let nMeds = medicaciones.filter(m2 => m2.fecha !== fecha || (soloLote && m2.galpon !== soloLote.galpon));
    let nFums = fumigaciones.filter(f2 => f2.fecha !== fecha || (soloLote && f2.galpon !== soloLote.galpon));
    const esDelGalpon = (m2) => !soloLote || String(m2.detalle || "").endsWith(`G${soloLote.galpon}`);
    const movsAutoPrevios = insumosMovs.filter(m2 => m2.auto && m2.fecha === fecha && m2.tipo === "salida" && esDelGalpon(m2));
    let insumosBase = insumos.map(x => ({ ...x }));
    movsAutoPrevios.forEach(m2 => {
      const it = insumosBase.find(x => x.id === m2.itemId);
      if (it) it.saldo = +(Number(it.saldo) + Number(m2.cantidad)).toFixed(2);
    });
    const insumosMovsBase = insumosMovs.filter(m2 => !(m2.auto && m2.fecha === fecha && m2.tipo === "salida" && esDelGalpon(m2)));
    const nuevosLotes = lotes.map(l => {
      if (soloLoteId && l.id !== soloLoteId) return l;
      const c = capturas[l.id];
      const t = totalesGalpon(c);
      const alimTotal = Number(c?.alimento6am || 0) + Number(c?.alimento1pm || 0);
      if (t.huevos === 0 && !c?.muertas && !alimTotal) return l;
      // Edición: si ya existe registro de esa fecha para este lote, revertir sus efectos acumulados
      const previo = registros.find(r => r.fecha === fecha && r.lote === l.id);
      if (previo) {
        reemplazados.push(previo);
        const mPrev = Number(previo.muertas || 0);
        l = {
          ...l, aves: l.aves + mPrev, mortAcum: l.mortAcum - mPrev,
          acumHuevos: l.acumHuevos - previo.cartones * HXC,
          acumAlimentoKg: l.acumAlimentoKg - Number(previo.alimentoKg || 0),
          acumMasaKg: l.acumMasaKg - Number(previo.pesoKg || 0),
        };
      }
      nuevos.push({
        fecha, lote: l.id, cartones: +t.cartones.toFixed(2), quebrados: Number(c.quebrados || 0),
        pesoKg: +t.pesoKg.toFixed(1), muertas: Number(c.muertas || 0), dx: c.dx || "",
        alimentoKg: alimTotal, alimento6am: Number(c.alimento6am || 0), alimento1pm: Number(c.alimento1pm || 0), obsAlimento: c.obsAlimento || "",
        alimentoEsperadoKg: l.racionGAve && l.aves ? +((l.racionGAve * l.aves) / 1000).toFixed(1) : 0,
        aguaL: Number(c.aguaL || 0),
        chequeo: c.chequeo && Object.values(c.chequeo).some(v => v !== "") ? { ...c.chequeo } : null,
        por: completadoPor, tiquetes: c.tiquetes.filter(x => x.cartones), trabajos: c.trabajos,
      });
      c.meds.forEach(m2 => {
        if (m2.producto) nMeds = [{
          fecha, tipo: "Medicamento", producto: m2.producto, dosis: m2.dosis, enfermedad: m2.enfermedad,
          retiroDias: Number(m2.retiro || 0), retiroHasta: Number(m2.retiro || 0) > 0 ? sumarDias(fecha, m2.retiro) : "",
          galpon: l.galpon, loteId: l.id,
        }, ...nMeds];
      });
      c.vits.forEach(v2 => {
        if (v2.producto) nMeds = [{ fecha, tipo: "Vitamina", producto: v2.producto, dosis: v2.dosis, galpon: l.galpon }, ...nMeds];
      });
      c.fums.forEach(f => {
        if (f.producto) nFums = [{ fecha, producto: f.producto, dosis: f.dosis, hora: f.hora, galpon: l.galpon }, ...nFums];
      });
      const m = Number(c.muertas || 0);
      return {
        ...l, aves: l.aves - m, mortAcum: l.mortAcum + m,
        acumHuevos: l.acumHuevos + t.huevos,
        acumAlimentoKg: l.acumAlimentoKg + alimTotal,
        acumMasaKg: l.acumMasaKg + t.pesoKg,
      };
    });
    if (!nuevos.length && !notaDia) { setGuardando(false); return; }
    // Descuento automático de insumos: medicamentos, vitaminas y fumigaciones del día
    let insumosDia = insumosBase;
    const movsAuto = [];
    const descontarInsumo = (producto, dosis, origen) => {
      const item = buscarInsumo(insumosDia, producto);
      const cant = parseFloat(String(dosis || "").replace(",", "."));
      if (item && cant > 0) {
        item.saldo = +(item.saldo - cant).toFixed(2);
        movsAuto.push({ fecha, itemId: item.id, tipo: "salida", cantidad: cant, detalle: origen, por: completadoPor, auto: true });
      }
    };
    lotes.forEach(l => {
      if (soloLoteId && l.id !== soloLoteId) return;
      const c = capturas[l.id]; if (!c) return;
      c.meds.forEach(m2 => m2.producto && descontarInsumo(m2.producto, m2.dosis, `Medicación G${l.galpon}`));
      c.vits.forEach(v2 => v2.producto && descontarInsumo(v2.producto, v2.dosis, `Vitamina G${l.galpon}`));
      c.fums.forEach(f2 => f2.producto && descontarInsumo(f2.producto, f2.dosis, `Fumigación G${l.galpon}`));
    });
    if (movsAuto.length || movsAutoPrevios.length) {
      await escribir(K.insumos, insumosDia);
      const nm = [...movsAuto, ...insumosMovsBase];
      await escribir(K.insumosMovs, nm);
      setInsumos(insumosDia); setInsumosMovs(nm);
    }
    const nuevosRegistros = [...nuevos, ...registros.filter(r => !reemplazados.includes(r))]
      .sort((a, b) => aDate(b.fecha) - aDate(a.fecha));
    let nBitacora = bitacora;
    if (notaDia.trim()) nBitacora = [{ fecha, texto: notaDia.trim(), por: completadoPor }, ...bitacora];

    const ok1 = await escribir(K.registros, nuevosRegistros);
    const ok2 = await escribir(K.lotes, nuevosLotes);
    if (nMeds !== medicaciones) await escribir(K.meds, nMeds);
    if (nFums !== fumigaciones) await escribir(K.fums, nFums);
    if (nBitacora !== bitacora) await escribir(K.bitacora, nBitacora);

    if (ok1 && ok2) {
      setRegistros(ordenarPorFecha(nuevosRegistros)); setLotes(nuevosLotes); setMedicaciones(ordenarPorFecha(nMeds)); setFumigaciones(ordenarPorFecha(nFums)); setBitacora(nBitacora);
      // El formulario no se reconstruye tras guardar (lo que ves es lo guardado).
      // Los gallineros recién guardados quedan "limpios": el refresco en vivo ya puede sincronizarlos.
      if (soloLoteId) delete suciosRef.current[soloLoteId];
      else suciosRef.current = {};
      if (!soloLoteId || notaDia.trim()) notaSuciaRef.current = false;
      avisar(`✓ Control diario ${reemplazados.length ? "EDITADO" : "guardado"} (${fecha})${reemplazados.length ? " — se reemplazó lo anterior de esa fecha" : ""}`);
    } else avisar("⚠ No se pudo guardar. Revisa la conexión.");
    setGuardando(false);
  };

  // ── Bodega ──
  const activos = lotes.filter(l => l.estado !== "cerrado").sort((a, b) => Number(a.galpon) - Number(b.galpon));
  const regsHoy = registros.filter(r => r.fecha === hoyStr());
  const fechaB = (fechaBodega || new Date().toISOString().slice(0, 10)).split("-").reverse().join("/");
  const regsFechaB = registros.filter(r => r.fecha === fechaB);
  const producidoPorGalpon = activos.map(l => ({
    galpon: l.galpon, raza: l.raza,
    cartones: regsFechaB.filter(r => r.lote === l.id).reduce((s, r) => s + r.cartones, 0),
  }));
  const producidoHoyCart = producidoPorGalpon.reduce((s, g) => s + g.cartones, 0);
  const rutaNeta = repartos.reduce((s, r) => s + Number(r.salida || 0) - Number(r.devBueno || 0) - Number(r.devMalo || 0), 0);
  // Saldo base: el saldo final del día ANTERIOR más cercano a la fecha elegida
  const aperturaB = bodegaCfg.inicialFecha ? aDate(bodegaCfg.inicialFecha.split("-").reverse().join("/")) : null;
  const saldoBase = (() => {
    const previos = bodegaMovs.filter(m => aDate(m.fecha) < aDate(fechaB) && (!aperturaB || aDate(m.fecha) >= aperturaB));
    if (!previos.length) return Number(bodegaCfg.inicialCart || 0);
    return previos.reduce((mejor, m) => (!mejor || aDate(m.fecha) > aDate(mejor.fecha) ? m : mejor), null).saldoFinal;
  })();
  const guardarCfgBodega = async (cfg) => { if (cargandoFondo) { avisar("⏳ Sincronizando — espera unos segundos"); return; } setBodegaCfg(cfg); await escribir(K.bodegaCfg, cfg); };
  const cambiarFechaBodega = (iso) => {
    setFechaBodega(iso);
    const dmy = iso.split("-").reverse().join("/");
    const mov = bodegaMovs.find(m => m.fecha === dmy);
    if (mov) {
      setMovBodega({ comprado: mov.comprado || "", vendGranja: mov.vendGranja || "", destruido: mov.destruido || "", regalado: mov.regalado || "" });
      if (mov.repartos) setRepartos(mov.repartos.map(r => ({ ...r })));
      setObsInv(mov.obs || "");
    } else {
      setMovBodega({ comprado: "", vendGranja: "", destruido: "", regalado: "" });
      setRepartos((bodegaCfg.repartidores?.length ? bodegaCfg.repartidores : ["Andrés", "Bryan"]).map(n2 => ({ nombre: n2, salida: "", devBueno: "", devMalo: "" })));
      setObsInv("");
    }
    setAjusteBodega("");
  };
  const saldoCalculado = saldoBase + Number(movBodega.comprado || 0) + producidoHoyCart
    - rutaNeta - Number(movBodega.vendGranja || 0) - Number(movBodega.destruido || 0) - Number(movBodega.regalado || 0);
  const hayAjuste = ajusteBodega !== "" && !isNaN(Number(ajusteBodega));
  const saldoFinal = hayAjuste ? Number(ajusteBodega) : saldoCalculado;
  const difAjuste = hayAjuste ? +(Number(ajusteBodega) - saldoCalculado).toFixed(1) : 0;

  const guardarBodega = async () => {
    if (cargandoFondo) { avisar("⏳ Sincronizando datos — intenta en unos segundos"); return; }
    setGuardando(true);
    const nuevoMov = {
      fecha: fechaB, producido: +producidoHoyCart.toFixed(1),
      comprado: Number(movBodega.comprado || 0), vendGranja: Number(movBodega.vendGranja || 0),
      destruido: Number(movBodega.destruido || 0), regalado: Number(movBodega.regalado || 0),
      repartos: repartos.map(r => ({ ...r })), rutaNeta: +rutaNeta.toFixed(1),
      obs: obsInv, saldoFinal: +saldoFinal.toFixed(1),
      ajusteConteo: hayAjuste ? Number(ajusteBodega) : null, difAjuste: hayAjuste ? difAjuste : null,
    };
    // Reemplazar el de esa fecha y RECALCULAR EN CADENA todos los saldos (por si se editó un día pasado)
    let nuevos = [nuevoMov, ...bodegaMovs.filter(m => m.fecha !== fechaB)]
      .sort((a, b) => aDate(a.fecha) - aDate(b.fecha));
    let saldoCorrido = Number(bodegaCfg.inicialCart || 0);
    nuevos = nuevos.map(m => {
      if (aperturaB && aDate(m.fecha) < aperturaB) return m; // histórico previo a la apertura: no afecta la cadena
      const calc = saldoCorrido + Number(m.producido || 0) + Number(m.comprado || 0)
        - Number(m.rutaNeta || 0) - Number(m.vendGranja || 0) - Number(m.destruido || 0) - Number(m.regalado || 0);
      const fin = m.ajusteConteo != null ? Number(m.ajusteConteo) : +calc.toFixed(1);
      saldoCorrido = fin;
      return { ...m, saldoFinal: fin, difAjuste: m.ajusteConteo != null ? +(Number(m.ajusteConteo) - calc).toFixed(1) : null };
    }).reverse(); // más reciente primero, como siempre
    if (await escribir(K.movs, nuevos)) { setBodegaMovs(nuevos); setAjusteBodega(""); avisar(hayAjuste ? `✓ Bodega ajustada por conteo: ${Number(ajusteBodega)} cartones (${difAjuste > 0 ? "+" : ""}${difAjuste} vs calculado)` : "✓ Bodega actualizada"); }
    else avisar("⚠ No se pudo guardar la bodega");
    setGuardando(false);
  };

  // ── Planta de concentrado: dos categorías (Aves / Ganado) ──
  // inicial + entradas (baches) − salidas (servido) ± ajustes = inventario final
  const usoFormula = (f) => recetas.formulas[f]?.uso || "Aves";
  const movsPlanta = plantaMovs.map(m => m.tipo ? m : { ...m, tipo: "bache", categoria: usoFormula(m.formula) });
  const entregadoHoyKg = regsHoy.reduce((s, r) => s + Number(r.alimentoKg || 0), 0);
  const plantaHoy = movsPlanta.filter(m => m.fecha === hoyStr());
  const producidoPlantaHoy = plantaHoy.filter(m => m.tipo === "bache").reduce((s, m) => s + Number(m.kg || 0), 0);
  const aperturaP = plantaCfg.inicialFecha ? aDate(plantaCfg.inicialFecha.split("-").reverse().join("/")) : null;
  const desdeApertura = (fechaDmy) => !aperturaP || aDate(fechaDmy) >= aperturaP;
  const servidoAvesTotal = registros.filter(r => desdeApertura(r.fecha)).reduce((s, r) => s + Number(r.alimentoKg || 0), 0);
  const sumaMovs = (cat, tipo) => movsPlanta.filter(m => m.categoria === cat && m.tipo === tipo && desdeApertura(m.fecha)).reduce((s, m) => s + Number(m.kg || 0), 0);
  const saldoAves = Number(plantaCfg.inicialAves || 0) + sumaMovs("Aves", "bache") + sumaMovs("Aves", "ajuste") - servidoAvesTotal;
  const saldoGanado = Number(plantaCfg.inicialGanado || 0) + sumaMovs("Ganado", "bache") + sumaMovs("Ganado", "ajuste") - sumaMovs("Ganado", "servido");
  const saldoPlanta = saldoAves; // compatibilidad con alertas existentes

  const kgNucleoDe = (formula) => {
    const f = recetas.formulas[formula];
    if (!f) return 0;
    return Object.entries(f.items).reduce((a, [c, kg]) => a + (basculaDe(c) === 4 ? Number(kg || 0) : 0), 0);
  };

  const guardarBache = async () => {
    if (!fBache.kg && !fBache.baches) return;
    setGuardando(true);
    const nBaches = Number(fBache.baches || 0);
    const fechaBache = (fBache.fecha || new Date().toISOString().slice(0, 10)).split("-").reverse().join("/");
    const nuevo = [{ fecha: fechaBache, tipo: "bache", categoria: usoFormula(fBache.formula), formula: fBache.formula, baches: nBaches, kg: Number(fBache.kg || 0), numBache: (fBache.numBache || "").trim(), por: completadoPor }, ...plantaMovs];
    if (await escribir(K.planta, nuevo)) {
      // Descuento automático de porciones de núcleo (si la fórmula tiene micros)
      if (nBaches > 0) {
        const f2 = recetas.formulas[fBache.formula];
        if (f2) {
          const salidas = Object.entries(f2.items)
            .filter(([c2, kg]) => basculaDe(c2) !== 4 && Number(kg) > 0)
            .map(([c2, kg]) => ({ id: Date.now() + Math.random(), fecha: fechaBache, mp: c2, tipo: "salida", kg: +(Number(kg) * nBaches).toFixed(2), ref: `Bache ${fBache.formula} ×${nBaches}${fBache.numBache ? ` #${fBache.numBache}` : ""}` }));
          await registrarKardex(salidas);
        }
      }
      if (nBaches > 0 && kgNucleoDe(fBache.formula) > 0) {
        const invReal = await leer(K.nucleo, {});
        const inv = { ...invReal, [fBache.formula]: +((invReal[fBache.formula] || 0) - nBaches).toFixed(2) };
        await escribir(K.nucleo, inv); setNucleoInv(inv);
      }
      setPlantaMovs(nuevo); setFBache({ ...fBache, baches: "", kg: "", numBache: "", fecha: new Date().toISOString().slice(0, 10) });
      avisar(`✓ Bache registrado — concentrado ${usoFormula(fBache.formula)}`);
    } else avisar("⚠ No se pudo guardar");
    setGuardando(false);
  };

  const producirNucleo = async () => {
    if (cargandoFondo) { avisar("⏳ Sincronizando datos — espera unos segundos"); return; }
    const n = Number(fNucleo.porciones || 0);
    if (!n) return;
    const fechaNuc = (fNucleo.fecha || new Date().toISOString().slice(0, 10)).split("-").reverse().join("/");
    const invReal = await leer(K.nucleo, {});
    const inv = { ...invReal, [fNucleo.formula]: +((invReal[fNucleo.formula] || 0) + n).toFixed(2) };
    if (await escribir(K.nucleo, inv)) {
      const movNuc = [{ id: Date.now(), fecha: fechaNuc, tipo: "nucleo", categoria: usoFormula(fNucleo.formula), formula: fNucleo.formula, porciones: n, numNucleo: (fNucleo.numNucleo || "").trim(), por: completadoPor }, ...plantaMovs];
      if (await escribir(K.planta, movNuc)) setPlantaMovs(movNuc);
      const f2 = recetas.formulas[fNucleo.formula];
      if (f2) {
        const salidas = Object.entries(f2.items)
          .filter(([c2, kg]) => basculaDe(c2) === 4 && Number(kg) > 0)
          .map(([c2, kg]) => ({ id: Date.now() + Math.random(), fecha: fechaNuc, mp: c2, tipo: "salida", kg: +(Number(kg) * n).toFixed(3), ref: `Núcleo ${fNucleo.formula} ×${n}${fNucleo.numNucleo ? ` #${fNucleo.numNucleo}` : ""}` }));
        await registrarKardex(salidas);
      }
      setNucleoInv(inv); setFNucleo({ ...fNucleo, porciones: "", numNucleo: "", fecha: new Date().toISOString().slice(0, 10) }); avisar(`✓ Núcleo producido: ${n} porción(es) de ${fNucleo.formula} — kardex actualizado`);
    }
    else avisar("⚠ No se pudo guardar");
  };

  const guardarServidoGanado = async () => {
    if (!fServGan.kg) return;
    setGuardando(true);
    const nuevo = [{ fecha: (fServGan.fecha || new Date().toISOString().slice(0, 10)).split("-").reverse().join("/"), tipo: "servido", categoria: "Ganado", kg: Number(fServGan.kg), formula: fServGan.formula || "", detalle: fServGan.detalle || "", por: completadoPor }, ...plantaMovs];
    if (await escribir(K.planta, nuevo)) { setPlantaMovs(nuevo); setFServGan({ kg: "", detalle: "", formula: "", fecha: new Date().toISOString().slice(0, 10) }); avisar("✓ Servido a ganado registrado"); }
    else avisar("⚠ No se pudo guardar");
    setGuardando(false);
  };

  // Eliminar un movimiento de planta revirtiendo sus efectos (kardex, inventario de núcleo)
  const eliminarMovPlanta = async (m) => {
    const clave = `delplanta:${m.id}`;
    if (confirmar !== clave) { setConfirmar(clave); avisar("⚠ Toca × otra vez para ELIMINAR este movimiento — sus efectos se revierten"); setTimeout(() => setConfirmar(c2 => c2 === clave ? null : c2), 6000); return; }
    setConfirmar(null); setGuardando(true);
    const nuevo = plantaMovs.filter(x => x.id !== m.id);
    if (!(await escribir(K.planta, nuevo))) { avisar("⚠ No se pudo eliminar"); setGuardando(false); return; }
    setPlantaMovs(nuevo);
    const f2 = recetas.formulas[m.formula];
    if (m.tipo === "bache" && f2) {
      const nB = Number(m.baches || 0);
      const reversas = Object.entries(f2.items)
        .filter(([c2, kg]) => basculaDe(c2) !== 4 && Number(kg) > 0)
        .map(([c2, kg]) => ({ id: Date.now() + Math.random(), fecha: m.fecha, mp: c2, tipo: "entrada", kg: +(Number(kg) * nB).toFixed(2), ref: `Reversión bache ${m.formula} ×${nB}${m.numBache ? ` #${m.numBache}` : ""}` }));
      await registrarKardex(reversas);
      if (nB > 0 && kgNucleoDe(m.formula) > 0) {
        const invReal = await leer(K.nucleo, {});
        const inv = { ...invReal, [m.formula]: +((invReal[m.formula] || 0) + nB).toFixed(2) };
        if (await escribir(K.nucleo, inv)) setNucleoInv(inv);
      }
    }
    if (m.tipo === "nucleo" && f2) {
      const nP = Number(m.porciones || 0);
      const invReal = await leer(K.nucleo, {});
      const inv = { ...invReal, [m.formula]: +((invReal[m.formula] || 0) - nP).toFixed(2) };
      if (await escribir(K.nucleo, inv)) setNucleoInv(inv);
      const reversas = Object.entries(f2.items)
        .filter(([c2, kg]) => basculaDe(c2) === 4 && Number(kg) > 0)
        .map(([c2, kg]) => ({ id: Date.now() + Math.random(), fecha: m.fecha, mp: c2, tipo: "entrada", kg: +(Number(kg) * nP).toFixed(3), ref: `Reversión núcleo ${m.formula} ×${nP}${m.numNucleo ? ` #${m.numNucleo}` : ""}` }));
      await registrarKardex(reversas);
    }
    avisar("✓ Movimiento eliminado y efectos revertidos");
    setGuardando(false);
  };

  const eliminarFacturaPlanta = async (f) => {
    const clave = `delfacpl:${f.id || f.fecha + f.proveedor}`;
    if (confirmar !== clave) { setConfirmar(clave); avisar("⚠ Toca × otra vez para eliminar esta factura"); setTimeout(() => setConfirmar(c2 => c2 === clave ? null : c2), 6000); return; }
    setConfirmar(null);
    const nuevo = facturas.filter(x => x !== f && x.id !== f.id);
    if (await escribir(K.facturas, nuevo)) { setFacturas(nuevo); avisar("✓ Factura eliminada"); }
    else avisar("⚠ No se pudo eliminar");
  };

  const eliminarMovInsumo = async (m) => {
    const clave = `delins:${m.id}`;
    if (confirmar !== clave) { setConfirmar(clave); avisar(`⚠ Toca × otra vez para eliminar${m.tipo === "ajuste" ? " (el saldo actual no se recalcula)" : " — el saldo se revierte"}`); setTimeout(() => setConfirmar(c2 => c2 === clave ? null : c2), 6000); return; }
    setConfirmar(null);
    const nuevoMovs = insumosMovs.filter(x => x.id !== m.id);
    let nuevoIns = insumos;
    if (m.tipo === "entrada" || m.tipo === "salida") {
      nuevoIns = insumos.map(it => it.id === m.itemId ? { ...it, saldo: +(Number(it.saldo) + (m.tipo === "entrada" ? -1 : 1) * Number(m.cantidad)).toFixed(2) } : it);
    }
    const ok1 = await escribir(K.insumosMovs, nuevoMovs);
    const ok2 = nuevoIns === insumos ? true : await escribir(K.insumos, nuevoIns);
    if (ok1 && ok2) { setInsumosMovs(nuevoMovs); setInsumos(nuevoIns); avisar("✓ Movimiento eliminado"); }
    else avisar("⚠ No se pudo eliminar");
  };

  const guardarAjustePlanta = async () => {
    if (fAjPlanta.saldoReal === "") return;
    const actual = fAjPlanta.categoria === "Aves" ? saldoAves : saldoGanado;
    const delta = +(Number(fAjPlanta.saldoReal) - actual).toFixed(1);
    if (delta === 0) { avisar("✓ El saldo ya cuadra — sin ajuste necesario"); setFAjPlanta({ ...fAjPlanta, saldoReal: "" }); return; }
    const nuevo = [{ fecha: (fAjPlanta.fecha || new Date().toISOString().slice(0, 10)).split("-").reverse().join("/"), tipo: "ajuste", categoria: fAjPlanta.categoria, kg: delta, detalle: `Conteo físico: ${fAjPlanta.saldoReal} kg`, por: completadoPor }, ...plantaMovs];
    if (await escribir(K.planta, nuevo)) { setPlantaMovs(nuevo); setFAjPlanta({ ...fAjPlanta, saldoReal: "" }); avisar(`✓ Ajuste de ${delta > 0 ? "+" : ""}${delta} kg registrado`); }
    else avisar("⚠ No se pudo guardar");
  };

  const guardarCfgPlanta = async (cfg) => { if (cargandoFondo) { avisar("⏳ Sincronizando — espera unos segundos"); return; } setPlantaCfg(cfg); await escribir(K.plantaCfg, cfg); };

  const exportarTodoJSON = async () => {
    setGuardando(true);
    avisar("⏳ Recopilando todos los datos…");
    try {
      const claves = Object.values(K);
      const datos = {};
      for (const k of claves) datos[k] = await leer(k, null);
      for (const n2 of necropsias) {
        if (n2.numFotos > 0) datos[`granja2:necfoto:${n2.id}`] = await leer(`granja2:necfoto:${n2.id}`, []);
      }
      const blob = new Blob([JSON.stringify({ version: 1, exportado: new Date().toISOString(), datos }, null, 1)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `rancho-el-sonado-datos-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      avisar("✓ Respaldo completo descargado");
    } catch { avisar("⚠ No se pudo exportar — intenta de nuevo"); }
    setGuardando(false);
  };

  const guardarFactura = async () => {
    if (!fFactura.proveedor && !fFactura.producto) return;
    const nuevo = [{ ...fFactura, fecha: (fFactura.fecha || new Date().toISOString().slice(0, 10)).split("-").reverse().join("/") }, ...facturas];
    if (await escribir(K.facturas, nuevo)) { setFacturas(nuevo); setFFactura({ proveedor: "", producto: "", monto: "", fecha: new Date().toISOString().slice(0, 10) }); avisar("✓ Factura registrada"); }
    else avisar("⚠ No se pudo guardar");
  };

  const guardarPesaje = async () => {
    if (cargandoFondo) { avisar("⏳ Sincronizando datos — intenta en unos segundos"); return; }
    // Normalizar: comas de miles (1,850 → 1850) y comas decimales (1,85 → 1.85)
    const txt = fPeso.pesos.replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1");
    const nums = txt.split(/[\s;]+/).map(t => Number(t.replace(",", "."))).filter(n => !isNaN(n) && n > 0);
    if (!nums.length) { avisar("⚠ Digita los pesos en gramos separados por espacio o enter"); return; }
    // Detección de unidad: si el promedio es pequeño, vienen en kg → convertir a gramos
    const prom = nums.reduce((a, b) => a + b, 0) / nums.length;
    const enKg = prom < 10;
    const lista = enKg ? nums.map(n => Math.round(n * 1000)) : nums;
    const validos = lista.filter(n => n >= 200 && n <= 5000);
    const fuera = lista.length - validos.length;
    if (!validos.length) { avisar("⚠ Revisa lo digitado — acepto gramos (ej. 1850) o kilos (ej. 1.85)"); return; }
    const lote = lotes.find(l => l.id === fPeso.lote);
    if (!lote) { avisar("⚠ Elige el gallinero del pesaje"); return; }
    setGuardando(true);
    const fISO = fPeso.fecha || new Date().toISOString().slice(0, 10);
    const fechaDMY = fISO.split("-").reverse().join("/");
    if (pesajes.some(p => clavePesaje(p.lote, p.fecha) === clavePesaje(fPeso.lote, fISO))) {
      setGuardando(false);
      avisar("⚠ Ya existe un pesaje de este lote en esta fecha; no se modificó");
      return;
    }
    const [ny, nm, nd] = lote.nac.split("-").map(Number);
    const [py, pm, pd] = fISO.split("-").map(Number);
    const semanaPesaje = Math.floor((new Date(py, pm - 1, pd) - new Date(ny, nm - 1, nd)) / (7 * 86400000));
    const nuevo = [{ lote: fPeso.lote, semana: semanaPesaje, fecha: fechaDMY, pesos: validos, meta: Number(lote.pesoMeta) || 2000 }, ...pesajes];
    let ok = false;
    for (let i = 0; i < 3 && !ok; i++) {
      ok = await escribir(K.pesajes, nuevo);
      if (!ok) await new Promise(r => setTimeout(r, 900));
    }
    if (ok) { setPesajes(nuevo); setFPeso({ ...fPeso, pesos: "" }); avisar(`✓ Pesaje guardado: ${validos.length} aves${enKg ? " (kg convertidos a gramos)" : ""}${fuera ? ` · ${fuera} dato(s) fuera de rango ignorado(s)` : ""}`); }
    else avisar("⚠ Sin conexión con el almacenamiento — tus pesos siguen digitados, revisa la señal y toca Guardar otra vez");
    setGuardando(false);
  };

  const abrirExcelPesajes = async (archivo) => {
    if (!archivo) return;
    try {
      const datos = extraerPesajesExcel(await archivo.arrayBuffer());
      const asignados = datos.map(p => {
        const posibles = lotes.filter(l => String(l.galpon) === p.galpon && p.fecha >= l.nac &&
          (!p.nacimiento || p.nacimiento === l.nac) &&
          (!p.codigo || !l.lote || String(l.lote).padStart(2, "0") === p.codigo));
        return { ...p, lote: posibles.length === 1 ? posibles[0].id : "", incluir: posibles.length === 1 };
      });
      setExcelPesajes(asignados);
      setExcelAbierto(-1);
      avisar(asignados.length ? `✓ ${asignados.length} fechas encontradas; revisa y confirma` : "⚠ No encontré columnas de pesaje con fecha y muestra numerada");
    } catch (e) { console.error(e); avisar("⚠ No se pudo leer el archivo Excel"); }
  };

  const confirmarExcelPesajes = async () => {
    if (importandoPesajes || cargandoFondo) return;
    const claves = new Set(pesajes.map(p => clavePesaje(p.lote, p.fecha)));
    const seleccion = [];
    for (const p of excelPesajes.filter(x => x.incluir)) {
      if (!p.lote) { avisar("⚠ Asigna un lote a cada fecha antes de importar"); return; }
      if (p.fecha < lotes.find(l => l.id === p.lote)?.nac) { avisar(`⚠ ${p.fecha} es anterior al nacimiento del lote elegido`); return; }
      if (p.pesos.some(v => pesoEnGramos(v) == null)) { avisar(`⚠ Revisa pesos inválidos en ${p.hoja}, ${p.fecha}`); return; }
      const k = clavePesaje(p.lote, p.fecha);
      if (claves.has(k)) continue;
      claves.add(k);
      const lote = lotes.find(l => l.id === p.lote);
      const [ny, nm, nd] = lote.nac.split("-").map(Number);
      const [py, pm, pd] = p.fecha.split("-").map(Number);
      seleccion.push({ lote: p.lote, fecha: `${pd}/${pm}/${py}`, semana: Math.floor((new Date(py, pm - 1, pd) - new Date(ny, nm - 1, nd)) / (7 * 86400000)), pesos: p.pesos.map(pesoEnGramos), meta: Number(lote.pesoMeta) || 2000 });
    }
    if (!seleccion.length) { avisar("ℹ Todas estas fechas ya están registradas"); return; }
    setImportandoPesajes(true);
    try {
      const resultado = await agregarPesajesFaltantes(seleccion);
      const actual = await leer(K.pesajes, null);
      if (actual) setPesajes(ordenarPorFecha(actual));
      setExcelPesajes([]);
      avisar(`✓ ${resultado.agregados} pesajes nuevos; ${resultado.omitidos + excelPesajes.filter(x => x.incluir).length - seleccion.length} existentes omitidos`);
    } catch (e) {
      console.error(e);
      const actual = await leer(K.pesajes, null);
      if (actual) setPesajes(ordenarPorFecha(actual));
      avisar("⚠ Importación interrumpida. Revisa la conexión y vuelve a cargar el Excel; lo ya registrado se omitirá.");
    } finally { setImportandoPesajes(false); }
  };

  const guardarCostos = async (nuevos) => { setCostos(nuevos); await escribir(K.costos, nuevos); };

  // ── Editor de fórmulas (recetas por bache) ──
  const persistirRecetas = async (nuevo) => { setRecetas(nuevo); await escribir(K.recetas, nuevo); };
  const setKgIngrediente = (formula, mpc, kg) => {
    const f = recetas.formulas[formula];
    persistirRecetas({ ...recetas, formulas: { ...recetas.formulas, [formula]: { ...f, items: { ...f.items, [mpc]: kg === "" ? "" : Number(kg) } } } });
  };
  const quitarIngrediente = (formula, mpc) => {
    const f = recetas.formulas[formula];
    const items = { ...f.items }; delete items[mpc];
    persistirRecetas({ ...recetas, formulas: { ...recetas.formulas, [formula]: { ...f, items } } });
  };
  const agregarIngrediente = () => {
    if (!fIng.kg) return;
    const f = recetas.formulas[recActiva];
    if (f.items[fIng.mp] !== undefined) { avisar("⚠ Esa materia prima ya está en la fórmula — edita su cantidad"); return; }
    persistirRecetas({ ...recetas, formulas: { ...recetas.formulas, [recActiva]: { ...f, items: { ...f.items, [fIng.mp]: Number(fIng.kg) } } } });
    setFIng({ ...fIng, kg: "" });
  };
  const crearFormula = () => {
    const nombre = fNuevaRec.nombre.trim();
    if (!nombre) return;
    if (recetas.formulas[nombre]) { avisar("⚠ Ya existe una fórmula con ese nombre"); return; }
    persistirRecetas({ ...recetas, formulas: { ...recetas.formulas, [nombre]: { uso: fNuevaRec.uso, items: {} } } });
    setRecActiva(nombre); setFNuevaRec({ nombre: "", uso: fNuevaRec.uso });
    avisar(`✓ Fórmula "${nombre}" creada — agrega sus ingredientes`);
  };
  const eliminarFormula = (nombre) => {
    if (!pideConfirm(`elimF-${nombre}`, `⚠ Toca otra vez para eliminar la fórmula "${nombre}" definitivamente`)) return;
    const fs = { ...recetas.formulas }; delete fs[nombre];
    persistirRecetas({ ...recetas, formulas: fs });
    if (recActiva === nombre) setRecActiva(Object.keys(fs)[0] || "");
  };
  // ── Inventario de insumos y medicinas ──
  const buscarInsumo = (lista, texto) => {
    const t = (texto || "").toLowerCase().trim();
    if (!t) return null;
    return lista.find(it => {
      const n = it.nombre.toLowerCase();
      return t.includes(n) || n.includes(t) || t.split(/[\s/]+/).some(w => w.length > 3 && n.includes(w));
    });
  };
  const registrarMovInsumo = async (tipo, itemId, cantidad, detalle, fechaISO) => {
    const cant = Number(cantidad);
    if (!itemId || !cant) { avisar("⚠ Elige el insumo y la cantidad"); return; }
    const nuevoIns = insumos.map(it => it.id === Number(itemId)
      ? { ...it, saldo: tipo === "ajuste" ? cant : +(it.saldo + (tipo === "entrada" ? cant : -cant)).toFixed(2) }
      : it);
    const mov = { fecha: (fechaISO || new Date().toISOString().slice(0, 10)).split("-").reverse().join("/"), itemId: Number(itemId), tipo, cantidad: cant, detalle: detalle || "", por: completadoPor };
    const nuevosMovs = [mov, ...insumosMovs];
    const ok1 = await escribir(K.insumos, nuevoIns);
    const ok2 = await escribir(K.insumosMovs, nuevosMovs);
    if (ok1 && ok2) { setInsumos(nuevoIns); setInsumosMovs(nuevosMovs); setFMovIns({ tipo: "entrada", itemId: "", cantidad: "", detalle: "", fecha: new Date().toISOString().slice(0, 10) }); avisar("✓ Movimiento registrado"); }
    else avisar("⚠ No se pudo guardar");
  };
  const agregarInsumo = async () => {
    if (!fNuevoIns.nombre.trim()) return;
    const id = Math.max(0, ...insumos.map(i2 => i2.id)) + 1;
    const nuevo = [...insumos, { id, nombre: fNuevoIns.nombre.trim(), categoria: fNuevoIns.categoria, unidad: fNuevoIns.unidad, saldo: Number(fNuevoIns.saldo || 0), presentacion: fNuevoIns.presentacion.trim(), dosis: fNuevoIns.dosis.trim(), proveedor: fNuevoIns.proveedor.trim() }];
    if (await escribir(K.insumos, nuevo)) { setInsumos(nuevo); setFNuevoIns({ nombre: "", categoria: fNuevoIns.categoria, unidad: "ml", saldo: "", presentacion: "", dosis: "", proveedor: "" }); avisar("✓ Insumo agregado"); }
  };
  const guardarAperturaInsumos = async () => {
    const cambios = Object.entries(aperturaIns).filter(([, v]) => v !== "" && v != null);
    if (!cambios.length) { avisar("⚠ Digita al menos un saldo"); return; }
    setGuardando(true);
    const nuevoIns = insumos.map(it => {
      const v = aperturaIns[it.id];
      return v !== "" && v != null ? { ...it, saldo: Number(v) } : it;
    });
    const movs = cambios.map(([id, v]) => ({ fecha: hoyStr(), itemId: Number(id), tipo: "ajuste", cantidad: Number(v), detalle: "Balance inicial / conteo general", por: completadoPor }));
    const nuevosMovs = [...movs, ...insumosMovs];
    const ok1 = await escribir(K.insumos, nuevoIns);
    const ok2 = await escribir(K.insumosMovs, nuevosMovs);
    if (ok1 && ok2) { setInsumos(nuevoIns); setInsumosMovs(nuevosMovs); setAperturaIns({}); avisar(`✓ ${cambios.length} saldo(s) inicial(es) cargado(s)`); }
    else avisar("⚠ No se pudo guardar la apertura");
    setGuardando(false);
  };

  const actualizarInsumo = async (id, campo, valor) => {
    const nuevo = insumos.map(it => it.id === id ? { ...it, [campo]: valor } : it);
    setInsumos(nuevo); await escribir(K.insumos, nuevo);
  };
  const proveedoresIns = [...new Set(insumos.map(i2 => i2.proveedor).filter(Boolean))];

  const eliminarInsumo = async (it) => {
    if (!pideConfirm(`elimIns-${it.id}`, `⚠ Toca otra vez para eliminar ${it.nombre} del catálogo`)) return;
    const nuevo = insumos.filter(x => x.id !== it.id);
    if (await escribir(K.insumos, nuevo)) setInsumos(nuevo);
  };

  // ── Catálogo maestro de materias primas ──
  const persistirCat = async (nuevo) => { setMpCat(nuevo); await escribir(K.mpCat, nuevo); };
  const actualizarMP = (c, campo, valor) => {
    persistirCat(mpCat.map(m => m.c === c ? { ...m, [campo]: campo === "pres" ? (valor === "" ? "" : Number(valor)) : valor } : m));
  };
  const agregarMP = () => {
    if (!fNuevaMP.n.trim() || !fNuevaMP.pres) { avisar("⚠ Nombre y presentación son obligatorios"); return; }
    const nums = mpCat.map(m => Number(m.c.replace("MP", ""))).filter(n2 => !isNaN(n2));
    const c = `MP${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`;
    persistirCat([...mpCat, { c, n: fNuevaMP.n.trim().toUpperCase(), prov: fNuevaMP.prov.trim() || "—", pres: Number(fNuevaMP.pres) }]);
    setFNuevaMP({ n: "", prov: "", pres: "" });
    avisar(`✓ ${fNuevaMP.n.trim().toUpperCase()} agregada al catálogo (${c})`);
  };
  const eliminarMP = (mp) => {
    const enFormulas = Object.entries(recetas.formulas).filter(([, f]) => f.items[mp.c] !== undefined).map(([n2]) => n2);
    if (enFormulas.length) { avisar(`⚠ No se puede eliminar: ${mp.n} está en uso en ${enFormulas.join(", ")}`); return; }
    if (!pideConfirm(`elimMP-${mp.c}`, `⚠ Toca otra vez para eliminar ${mp.n} del catálogo`)) return;
    persistirCat(mpCat.filter(m => m.c !== mp.c));
  };
  const proveedoresCat = [...new Set(mpCat.map(m => m.prov).filter(Boolean))];

  const formulasAves = Object.entries(recetas.formulas).filter(([, f]) => f.uso === "Aves").map(([n]) => n);
  const formulasGanado = Object.entries(recetas.formulas).filter(([, f]) => f.uso === "Ganado").map(([n]) => n);
  const sumaBache = (f) => Object.values(f.items).reduce((a, b) => a + Number(b || 0), 0);

  // ── Pedido de Materia Prima ──
  const consumoAvesFormulas = {};
  const formulaDelLote = (l) => (recetas.formulas[l.formula] ? l.formula : null) || mpConfig.formulaLote[l.id] || "Impulsor";
  activos.forEach(l => {
    const f = formulaDelLote(l);
    const kgDia = l.racionGAve && l.aves ? (l.racionGAve * l.aves) / 1000 : 0;
    consumoAvesFormulas[f] = (consumoAvesFormulas[f] || 0) + kgDia;
  });
  const consumoGanadoFormulas = {};
  (mpConfig.ganado || []).forEach(g => {
    const kgDia = Number(g.animales || 0) * Number(g.kgAnimal || 0);
    if (kgDia > 0) consumoGanadoFormulas[g.formula] = (consumoGanadoFormulas[g.formula] || 0) + kgDia;
  });
  const consumoFormulas = { ...consumoAvesFormulas };
  Object.entries(consumoGanadoFormulas).forEach(([f, kg]) => { consumoFormulas[f] = (consumoFormulas[f] || 0) + kg; });

  const recibirPedidoMP = async (p) => {
    const clave = `recped:${p.id || p.fecha}`;
    if (confirmar !== clave) { setConfirmar(clave); avisar("⚠ Toca ✓ otra vez para marcar RECIBIDO — las materias primas entran al kardex"); setTimeout(() => setConfirmar(c2 => c2 === clave ? null : c2), 7000); return; }
    setConfirmar(null);
    const entradas = (p.lineas || []).filter(l2 => (l2.kg || 0) > 0 && l2.c)
      .map(l2 => ({ id: Date.now() + Math.random(), fecha: hoyStr(), mp: l2.c, tipo: "entrada", kg: +Number(l2.kg).toFixed(1), ref: `Pedido ${p.fecha}${p.proveedor ? ` · ${p.proveedor}` : ""}` }));
    await registrarKardex(entradas);
    const nuevos = mpPedidos.map(x => x === p || (p.id && x.id === p.id) ? { ...x, estado: "recibido", recibido: hoyStr() } : x);
    if (await escribir(K.mpPedidos, nuevos)) { setMpPedidos(nuevos); avisar(`✓ Pedido recibido — ${entradas.length} entrada(s) al kardex`); }
  };
  const eliminarPedidoMP = async (p) => {
    const clave = `delped:${p.id || p.fecha}`;
    if (confirmar !== clave) { setConfirmar(clave); avisar("⚠ Toca × otra vez para eliminar este pedido"); setTimeout(() => setConfirmar(c2 => c2 === clave ? null : c2), 6000); return; }
    setConfirmar(null);
    const nuevos = mpPedidos.filter(x => x !== p && (!p.id || x.id !== p.id));
    if (await escribir(K.mpPedidos, nuevos)) { setMpPedidos(nuevos); avisar("✓ Pedido eliminado"); }
  };
  const lineasPedido = mpCat.map(mp => {
    let kgDia = 0;
    Object.entries(consumoFormulas).forEach(([f, kgF]) => {
      const rec = recetas.formulas[f];
      if (!rec) return;
      const total = sumaBache(rec);
      const pct = total > 0 ? Number(rec.items[mp.c] || 0) / total : 0;
      kgDia += kgF * pct;
    });
    const proyKg = kgDia * Number(mpConfig.cobertura || 11);
    const inv = mpInvUltimo[mp.c] || {};
    const invKg = Number(inv.sacos || 0) * mp.pres + Number(inv.kg || 0);
    const faltaKg = Math.max(0, proyKg - invKg);
    let pedido = Math.ceil(faltaKg / mp.pres - 1e-9);
    if (mp.pres === 1 && pedido > 0) pedido = Math.max(Number(mpConfig.minKg1 || 5), pedido);
    return { ...mp, kgDia, proyKg, invKg, pedido, pedidoKg: pedido * mp.pres };
  });
  const pedidoPorProveedor = {};
  lineasPedido.filter(x => x.pedido > 0).forEach(x => {
    (pedidoPorProveedor[x.prov] = pedidoPorProveedor[x.prov] || []).push(x);
  });

  const guardarInventarioMP = async () => {
    const items = Object.fromEntries(Object.entries(mpInv).filter(([, v]) => (v?.sacos ?? "") !== "" || (v?.kg ?? "") !== ""));
    if (!Object.keys(items).length) { avisar("⚠ Digita al menos un dato del conteo"); return; }
    setGuardando(true);
    const fecha = (mpFechaInput || new Date().toISOString().slice(0, 10)).split("-").reverse().join("/");
    const doc = { fecha, responsable: mpResponsable, items };
    const registroHist = { id: Date.now(), fecha, responsable: mpResponsable, items };
    const nuevoHist = [registroHist, ...mpInvHist];
    const ok1 = await escribir(K.mpInv, doc);
    const ok2 = await escribir(K.mpInvHist, nuevoHist);
    if (ok1 && ok2) {
      setMpFechaConteo(fecha); setMpInvHist(ordenarPorFecha(nuevoHist)); setMpInvUltimo(items);
      setMpInv({}); // ← el apartado queda limpio, listo para el próximo conteo
      avisar(`✓ Conteo del ${fecha.slice(0, 5)} guardado en el historial — listo para generar el pedido`);
    } else avisar("⚠ No se pudo guardar el inventario");
    setGuardando(false);
  };

  const guardarConfigMP = async (cfg) => { setMpConfig(cfg); await escribir(K.mpConfig, cfg); };

  const textoPedidoProveedor = (prov, items) => {
    const totU = items.reduce((s2, x) => s2 + x.pedido, 0);
    const totKg = items.reduce((s2, x) => s2 + x.pedidoKg, 0);
    return `*PEDIDO — ${RAZON_SOCIAL.toUpperCase()}*\n` +
      `Proveedor: *${prov}*\nFecha del pedido: ${hoyStr()}\nEntrega: lunes\n\n` +
      items.map(x => `• ${x.n}: *${x.pedido} ${x.pres === 1 ? "kg" : "sacos"}*${x.pres !== 1 ? ` (${x.pres} kg c/u = ${x.pedidoKg.toFixed(0)} kg)` : ""}`).join("\n") +
      `\n\nTotal: ${totU} unidades · ${totKg.toFixed(0)} kg\nGracias.`;
  };

  const enviarWhatsApp = (prov, items) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(textoPedidoProveedor(prov, items))}`, "_blank");
  };

  const copiarPedido = async (prov, items) => {
    try { await navigator.clipboard.writeText(textoPedidoProveedor(prov, items).replace(/\*/g, "")); avisar("✓ Pedido copiado"); }
    catch { avisar("⚠ No se pudo copiar"); }
  };

  const registrarPedido = async () => {
    setGuardando(true);
    const doc = { id: Date.now(), fecha: hoyStr(), cobertura: mpConfig.cobertura, estado: "pendiente", lineas: lineasPedido.filter(x => x.pedido > 0).map(x => ({ c: x.c, n: x.n, prov: x.prov, pedido: x.pedido, kg: x.pedidoKg })) };
    const nuevos = [doc, ...mpPedidos.filter(m => m.fecha !== hoyStr())];
    if (await escribir(K.mpPedidos, nuevos)) { setMpPedidos(nuevos); avisar("✓ Pedido registrado en el historial"); }
    else avisar("⚠ No se pudo registrar");
    setGuardando(false);
  };

  // ── KPIs (solo lotes activos) ──
  const totalAves = activos.reduce((s, l) => s + l.aves, 0);
  const fechas = [...new Set(registros.map(r => r.fecha))];
  const ultDia = fechas[0] || "—";
  const regsUlt = registros.filter(r => r.fecha === ultDia);
  const huevosDia = regsUlt.reduce((s, r) => s + r.cartones * HXC, 0);
  const posturaDia = totalAves ? (huevosDia / totalAves) * 100 : 0;

  const f7 = fechas.slice(0, 7);
  const regs7 = registros.filter(r => f7.includes(r.fecha));
  const alim7 = regs7.reduce((s, r) => s + Number(r.alimentoKg || 0), 0);
  const masa7 = regs7.reduce((s, r) => s + Number(r.pesoKg || 0), 0);
  const huevos7 = regs7.reduce((s, r) => s + r.cartones * HXC, 0);
  const queb7 = regs7.reduce((s, r) => s + Number(r.quebrados || 0), 0);
  const conversion = masa7 > 0 ? alim7 / masa7 : 0;
  const convCarton = huevos7 > 0 ? alim7 / (huevos7 / HXC) : 0;
  const pctQueb = huevos7 + queb7 > 0 ? (queb7 / (huevos7 + queb7)) * 100 : 0;
  const pesoProm = huevos7 > 0 ? (masa7 * 1000) / huevos7 : 0;
  const consumoGAve = totalAves && f7.length ? (alim7 * 1000) / (totalAves * f7.length) : 0;

  const tendencia = fechas.slice(0, 14).reverse().map(f => {
    const rs = registros.filter(r => r.fecha === f);
    const h = rs.reduce((s, r) => s + r.cartones * HXC, 0);
    return { dia: f.slice(0, 5), postura: +((h / totalAves) * 100).toFixed(1) };
  });

  const statsPesaje = (p) => {
    const n = p.pesos.length;
    const prom = p.pesos.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(p.pesos.reduce((a, b) => a + (b - prom) ** 2, 0) / n);
    const dentro = p.pesos.filter(x => Math.abs(x - prom) <= prom * 0.1).length;
    return { prom, cv: (sd / prom) * 100, unif: (dentro / n) * 100, min: Math.min(...p.pesos), max: Math.max(...p.pesos) };
  };

  const aplicarVacuna = async (l, p2, fechaISO) => {
    const dmy = fechaISO ? fechaISO.split("-").reverse().join("/") : hoyStr();
    const nuevo = [{ lote: l.id, planId: p2.id, vacuna: p2.vacuna, cepa: p2.cepa, via: p2.via, proveedor: p2.proveedor, fecha: dmy, por: completadoPor }, ...vacunas];
    if (await escribir(K.vacunas, nuevo)) { setVacunas(nuevo); avisar(`✓ ${p2.vacuna} marcada como aplicada`); }
    else avisar("⚠ No se pudo guardar");
  };

  const desaplicarVacuna = async (loteId, planId) => {
    const nuevo = vacunas.filter(v => !(v.lote === loteId && v.planId === planId));
    if (await escribir(K.vacunas, nuevo)) { setVacunas(nuevo); avisar("✓ Aplicación deshecha"); }
  };

  const guardarVacuna = async () => {
    if (!fVac.vacuna) return;
    const nuevo = [{ ...fVac, fecha: hoyStr(), por: completadoPor }, ...vacunas];
    if (await escribir(K.vacunas, nuevo)) { setVacunas(nuevo); setFVac({ ...fVac, vacuna: "", cepa: "", via: "", proveedor: "" }); avisar("✓ Vacuna registrada"); }
    else avisar("⚠ No se pudo guardar");
  };

  const guardarEnfermedad = async () => {
    if (!fEnf.enfermedad) return;
    const nuevo = [{ ...fEnf, fecha: hoyStr(), id: Date.now() }, ...enfermedades];
    if (await escribir(K.enfermedades, nuevo)) { setEnfermedades(nuevo); setFEnf({ ...fEnf, enfermedad: "", tratamiento: "" }); avisar("✓ Diagnóstico registrado"); }
    else avisar("⚠ No se pudo guardar");
  };

  const marcarRecuperado = async (id) => {
    const nuevo = enfermedades.map(e => e.id === id ? { ...e, estado: "Recuperado", fechaAlta: hoyStr() } : e);
    if (await escribir(K.enfermedades, nuevo)) { setEnfermedades(nuevo); avisar("✓ Marcado como recuperado"); }
  };

  const guardarNecropsia = async () => {
    if (!fNec.hallazgos && !fNec.laboratorio) return;
    setGuardando(true);
    const id = Date.now();
    if (fNecFotos.length) await escribir(`granja2:necfoto:${id}`, fNecFotos);
    const nuevo = [{ ...fNec, fecha: hoyStr(), id, numFotos: fNecFotos.length }, ...necropsias];
    if (await escribir(K.necropsias, nuevo)) {
      setNecropsias(nuevo); setFNec({ ...fNec, laboratorio: "", hallazgos: "" }); setFNecFotos([]);
      avisar("✓ Resultado registrado" + (fNecFotos.length ? ` con ${fNecFotos.length} foto(s)` : ""));
    } else avisar("⚠ No se pudo guardar");
    setGuardando(false);
  };

  const agregarFotoNec = async (files) => {
    try {
      for (const f of Array.from(files).slice(0, 3 - fNecFotos.length)) {
        const data = await comprimirImagen(f);
        setFNecFotos(prev => prev.length < 3 ? [...prev, data] : prev);
      }
    } catch { avisar("⚠ No se pudo procesar la imagen"); }
  };

  const verFotosNec = async (nec) => {
    if (fotosVista[nec.id]) { setFotosVista(fv => { const c = { ...fv }; delete c[nec.id]; return c; }); return; }
    setFotosVista(fv => ({ ...fv, [nec.id]: "cargando" }));
    const fotos = await leer(`granja2:necfoto:${nec.id}`, []);
    setFotosVista(fv => ({ ...fv, [nec.id]: fotos }));
  };

  const guardarPlanVac = async () => {
    if (!fPlan.vacuna || fPlan.dia === "") return;
    const nuevo = [...planVac, { vacuna: fPlan.vacuna, cepa: fPlan.cepa || "", via: fPlan.via || "", proveedor: fPlan.proveedor || "", dia: Number(fPlan.dia), id: Date.now() }].sort((a, b) => a.dia - b.dia);
    if (await escribir(K.planVac, nuevo)) { setPlanVac(nuevo); setFPlan({ ...fPlan, vacuna: "", cepa: "", via: "", proveedor: "", dia: "" }); avisar("✓ Vacuna agregada al programa"); }
    else avisar("⚠ No se pudo guardar");
  };

  // Estado de una vacuna del programa para un lote dado
  const estadoVacunaLote = (l, pv) => {
    const { date, str } = fechaVacuna(l.nac, pv.dia);
    const reg = vacunas.find(v => v.lote === l.id && (v.planId === pv.id || (v.vacuna.toLowerCase().includes(pv.vacuna.toLowerCase().slice(0, 6)) && aDate(v.fecha) >= new Date(date.getTime() - 10 * 86400000))));
    const aplicada = !!reg;
    const dias = Math.round((date - hoyD) / 86400000);
    if (aplicada) return { estado: "aplicada", fecha: str, dias, fechaAplicada: reg.fecha };
    if (dias < -14) return { estado: "cubierta", fecha: str, dias };   // levante — aplicada por proveedor
    if (dias < 0) return { estado: "atrasada", fecha: str, dias };
    if (dias <= 7) return { estado: "próxima", fecha: str, dias };
    return { estado: "pendiente", fecha: str, dias };
  };

  const quitarPlanVac = async (id) => {
    const nuevo = planVac.filter(p2 => p2.id !== id);
    if (await escribir(K.planVac, nuevo)) { setPlanVac(nuevo); avisar("✓ Quitada del plan"); }
  };

  // Retiros de medicamento activos (huevo no comercializable)
  const hoyD = aDate(hoyStr());
  const retirosActivos = medicaciones.filter(m => m.retiroHasta && aDate(m.retiroHasta) >= hoyD);

  // ── Reporte dinámico ──
  const resumenDia = (f) => {
    const rs = registros.filter(r => r.fecha === f);
    if (!rs.length) return null;
    const huevos = rs.reduce((s, r) => s + r.cartones * HXC, 0);
    const alim = rs.reduce((s, r) => s + Number(r.alimentoKg || 0), 0);
    const masa = rs.reduce((s, r) => s + Number(r.pesoKg || 0), 0);
    const muertas = rs.reduce((s, r) => s + Number(r.muertas || 0), 0);
    const queb = rs.reduce((s, r) => s + Number(r.quebrados || 0), 0);
    return {
      cartones: huevos / HXC, postura: (huevos / totalAves) * 100,
      consumo: (alim * 1000) / totalAves, conv: masa > 0 ? alim / masa : 0,
      muertas, pctQueb: huevos + queb > 0 ? (queb / (huevos + queb)) * 100 : 0,
      pesoH: huevos > 0 ? (masa * 1000) / huevos : 0,
    };
  };
  const fHoy = fechas[0], fAyer = fechas[1];
  const dHoy = fHoy ? resumenDia(fHoy) : null;
  const dAyer = fAyer ? resumenDia(fAyer) : null;
  const mesDe = (f) => { const p = f.split("/"); return `${p[1]}/${p[2]}`; };
  let promMes = null, nombreMesAnt = "";
  if (fHoy) {
    const [, mm, yy] = fHoy.split("/").map(Number);
    const pm = mm === 1 ? 12 : mm - 1, py = mm === 1 ? yy - 1 : yy;
    nombreMesAnt = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][pm];
    const clave = `${String(pm).padStart(2, "0")}/${py}`;
    const fsMes = fechas.filter(f => mesDe(f) === clave);
    if (fsMes.length) {
      const ds = fsMes.map(resumenDia).filter(Boolean);
      const avg = (k) => ds.reduce((s, d) => s + d[k], 0) / ds.length;
      promMes = { cartones: avg("cartones"), postura: avg("postura"), consumo: avg("consumo"), conv: avg("conv"), muertas: avg("muertas"), pctQueb: avg("pctQueb"), pesoH: avg("pesoH"), dias: ds.length };
    }
  }
  const metaGenetica = totalAves ? activos.reduce((s, l) => s + l.posturaIdeal * l.aves, 0) / totalAves : 0;
  const decisiones = [];
  // Peso corporal vs tabla genética (crítico) — último pesaje por lote
  activos.forEach(l => {
    const pes = pesajes.find(p2 => p2.lote === l.id);
    if (!pes || !pes.pesos?.length) return;
    const prom = pes.pesos.reduce((a, b) => a + b, 0) / pes.pesos.length;
    const meta = Number(l.pesoMeta) || Number(pes.meta) || 0;
    if (meta > 0) {
      const brechaG = prom - meta;
      const brechaP = (brechaG / meta) * 100;
      if (brechaP <= -10) decisiones.push({ nivel: "rojo", texto: `PESO CRÍTICO Gallinero ${l.galpon}: ${prom.toFixed(0)} g vs ${meta} g de tabla (${brechaG.toFixed(0)} g, ${brechaP.toFixed(1)}%). Ave bajo peso no sostiene el pico — revisar ración, densidad del alimento y sanidad con el veterinario.` });
      else if (brechaP <= -4) decisiones.push({ nivel: "amarillo", texto: `Peso bajo tabla en Gallinero ${l.galpon}: ${prom.toFixed(0)} g vs ${meta} g (${brechaG.toFixed(0)} g, ${brechaP.toFixed(1)}%). Vigilar consumo y repetir pesaje en 2 semanas.` });
      else if (brechaP >= 8) decisiones.push({ nivel: "amarillo", texto: `Sobrepeso en Gallinero ${l.galpon}: ${prom.toFixed(0)} g vs ${meta} g (+${brechaG.toFixed(0)} g). Exceso de grasa también baja postura — revisar ración con el nutricionista.` });
    }
    const [pd2, pm2, py2] = pes.fecha.split("/").map(Number);
    const diasPesaje = Math.round((new Date() - new Date(py2, pm2 - 1, pd2)) / 86400000);
    if (diasPesaje > 21) decisiones.push({ nivel: "amarillo", texto: `Gallinero ${l.galpon}: el último pesaje tiene ${diasPesaje} días. Peso corporal es tu medida crítica — programar pesaje esta semana.` });
  });
  if (dHoy) {
    activos.forEach(l => {
      const r = registros.find(x => x.fecha === fHoy && x.lote === l.id);
      if (r) {
        const p = (r.cartones * HXC / l.aves) * 100;
        const brecha = l.posturaIdeal - p;
        if (brecha > 15) decisiones.push({ nivel: "rojo", texto: `Gallinero ${l.galpon} (${l.raza}): postura ${p.toFixed(1)}% — ${brecha.toFixed(0)} pts bajo la tabla. Revisar consumo, agua, sanidad y peso corporal.` });
        else if (brecha > 8) decisiones.push({ nivel: "amarillo", texto: `Gallinero ${l.galpon}: brecha de ${brecha.toFixed(0)} pts vs genética (${p.toFixed(1)}% vs ${l.posturaIdeal}%).` });
        const gAve = l.aves ? (Number(r.alimentoKg || 0) * 1000) / l.aves : 0;
        const espKg = Number(r.alimentoEsperadoKg || 0) || (l.racionGAve && l.aves ? (l.racionGAve * l.aves) / 1000 : 0);
        if (espKg > 0 && r.alimentoKg > 0) {
          const desvR = ((r.alimentoKg - espKg) / espKg) * 100;
          if (Math.abs(desvR) > 5) decisiones.push({ nivel: desvR > 0 ? "amarillo" : "rojo", texto: `Gallinero ${l.galpon}: se sirvieron ${r.alimentoKg} kg vs ${espKg.toFixed(1)} kg de ración definida (${desvR > 0 ? "+" : ""}${desvR.toFixed(1)}%). ${desvR > 0 ? "Posible desperdicio o sobrealimentación." : "Las aves comieron menos de lo definido — revisar salud, agua o calidad del alimento."}` });
        } else if (gAve > 125) decisiones.push({ nivel: "amarillo", texto: `Gallinero ${l.galpon}: consumo de ${gAve.toFixed(0)} g/ave/día — posible desperdicio o sobreconsumo.` });
      }
    });
    if (dAyer && dHoy.muertas > Math.max(3, dAyer.muertas * 2)) decisiones.push({ nivel: "rojo", texto: `Mortalidad de ${dHoy.muertas} aves, más del doble de ayer (${dAyer.muertas}). Revisar diagnósticos y considerar necropsia.` });
    if (dHoy.pctQueb > 3) decisiones.push({ nivel: "amarillo", texto: `Huevo quebrado en ${dHoy.pctQueb.toFixed(1)}% — sobre el 3%. Revisar calcio, recolección y manejo de cartones.` });
    if (dHoy.conv > 2.3) decisiones.push({ nivel: "amarillo", texto: `Conversión del día en ${dHoy.conv.toFixed(2)} kg/kg — el alimento está rindiendo poco.` });
    if (dAyer && dHoy.postura - dAyer.postura < -3) decisiones.push({ nivel: "rojo", texto: `La postura cayó ${(dAyer.postura - dHoy.postura).toFixed(1)} pts en un día. Verificar registro, agua, alimento y estrés.` });
    // Consumo de agua: caída >15% vs día anterior por gallinero
    activos.forEach(l => {
      const rH = registros.find(x => x.fecha === fHoy && x.lote === l.id);
      const rA = fAyer ? registros.find(x => x.fecha === fAyer && x.lote === l.id) : null;
      if (rH?.aguaL > 0 && rA?.aguaL > 0) {
        const caida = ((rA.aguaL - rH.aguaL) / rA.aguaL) * 100;
        if (caida > 15) decisiones.push({ nivel: "rojo", texto: `Gallinero ${l.galpon}: el consumo de agua cayó ${caida.toFixed(0)}% (${rH.aguaL} L vs ${rA.aguaL} L ayer). Las aves dejan de beber antes de dejar de comer — revisar salud y sistema de agua HOY.` });
      }
    });
    // Chequeo sanitario del día: hallazgos anormales agrupados por gallinero
    activos.forEach(l => {
      const rH = registros.find(x => x.fecha === fHoy && x.lote === l.id);
      const ch = rH?.chequeo;
      if (!ch) return;
      const hallazgos = []; let nivel = "amarillo";
      if (ch.cresta === "Pálida") hallazgos.push("cresta pálida (posible anemia/parásitos)");
      if (ch.cresta === "Morada/oscura") { hallazgos.push("cresta morada (URGENTE: posible problema circulatorio/respiratorio)"); nivel = "rojo"; }
      if (ch.respiratorio === "Sí") { hallazgos.push("sonidos respiratorios"); nivel = "rojo"; }
      if (ch.secrecion === "Sí") { hallazgos.push("secreción nasal"); nivel = "rojo"; }
      if (ch.heces === "Con sangre") { hallazgos.push("heces con sangre (posible coccidiosis)"); nivel = "rojo"; }
      if (ch.heces === "Diarrea") hallazgos.push("diarrea");
      if (ch.cascara === "Mala (frágil)") hallazgos.push("cáscara frágil (revisar calcio/fósforo)");
      if (ch.comederos === "Mala") hallazgos.push("mala distribución en comederos");
      if (ch.consumoObs && ch.consumoObs !== "Normal") hallazgos.push(`consumo de alimento: ${ch.consumoObs.toLowerCase()}`);
      if (ch.aguaObs === "Bajo") hallazgos.push("consumo de agua bajo");
      const t = Number(ch.temp);
      if (t > 29) { hallazgos.push(`temperatura ${t}°C (estrés calórico, meta 27–29)`); if (t >= 32) nivel = "rojo"; }
      else if (t > 0 && t < 27) hallazgos.push(`temperatura ${t}°C (bajo la meta 27–29)`);
      const ph = Number(ch.ph);
      if (ph > 0 && (ph < 5.5 || ph > 7.8)) hallazgos.push(`pH del agua ${ph} (fuera de rango)`);
      if (hallazgos.length) decisiones.push({ nivel, texto: `Chequeo Gallinero ${l.galpon}: ${hallazgos.join(" · ")}.` });
    });
    // Retiros de medicamento activos
    retirosActivos.forEach(m => {
      decisiones.push({ nivel: "rojo", texto: `Retiro activo en Gallinero ${m.galpon}: ${m.producto} — NO comercializar huevo de este gallinero hasta el ${m.retiroHasta}.` });
    });
    // Vacunas del programa: próximas (≤7 días) o atrasadas (≤14 días sin aplicar)
    activos.forEach(l => {
      planVac.forEach(p2 => {
        const ev = estadoVacunaLote(l, p2);
        if (ev.estado === "atrasada") decisiones.push({ nivel: "rojo", texto: `Vacuna ATRASADA en Gallinero ${l.galpon}: ${p2.vacuna}${p2.cepa ? ` (${p2.cepa})` : ""} estaba programada para el ${ev.fecha} (día ${p2.dia} de edad). Aplicar y registrar en Bienestar.` });
        else if (ev.estado === "próxima") decisiones.push({ nivel: "amarillo", texto: `Vacuna próxima en Gallinero ${l.galpon}: ${p2.vacuna}${p2.cepa ? ` (${p2.cepa})` : ""} — ${ev.dias === 0 ? "HOY" : `en ${ev.dias} día(s)`} (${ev.fecha}). Vía: ${p2.via || "—"} · Proveedor: ${p2.proveedor || "—"}.` });
      });
    });
    if (saldoAves < entregadoHoyKg * 2 && entregadoHoyKg > 0) decisiones.push({ nivel: "amarillo", texto: `Concentrado de aves en planta: ${saldoAves.toFixed(0)} kg — menos de 2 días de consumo. Programar producción de baches.` });
    if (saldoGanado < 0) decisiones.push({ nivel: "amarillo", texto: `El inventario de concentrado de ganado quedó en ${saldoGanado.toFixed(0)} kg (negativo) — revisar registros de baches o servido, o hacer ajuste por conteo.` });
  }

  const selectStyle = { ...inputStyle, marginBottom: 12 };
  const btnStyle = { width: "100%", padding: "14px", fontSize: 15.5, fontWeight: 600, background: C.verde, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif", opacity: guardando ? 0.6 : 1 };

  const tabs = [
    { id: "reporte", nombre: "Reporte" }, { id: "captura", nombre: "Control diario" },
    { id: "bodega", nombre: "Bodega" }, { id: "planta", nombre: "Planta" },
    { id: "pesaje", nombre: "Bienestar" }, { id: "insumos", nombre: "Insumos" },
    { id: "lotes", nombre: "Lotes" }, { id: "pedidomp", nombre: "Pedido MP" },
    { id: "formulas", nombre: "Fórmulas" },
    { id: "cxp", nombre: "Por Pagar" }, { id: "historial", nombre: "Historial" },
  ];

  if (cargando) return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: C.fondo, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: C.textoSuave }}>
      <style>{fuentes}</style>
      <img src={LOGO_B64} alt="Rancho El Soñado" style={{ width: 220, maxWidth: "70vw" }} />
      <div>Cargando datos de la granja…</div>
    </div>
  );

  if (errorCarga) return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: C.fondo, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 20, textAlign: "center" }}>
      <style>{fuentes}</style>
      <div style={{ fontSize: 15, color: C.alerta, fontWeight: 600 }}>No se pudieron cargar los datos</div>
      <div style={{ fontSize: 13, color: C.textoSuave, maxWidth: 320, lineHeight: 1.5 }}>La conexión con el almacenamiento no respondió. Revisa tu señal de internet y vuelve a intentar — tus datos están a salvo.</div>
      <button onClick={() => cargarTodo(true)} style={{ padding: "12px 24px", background: C.verde, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Reintentar</button>
    </div>
  );

  // ── Documento imprimible (pantalla limpia + window.print) ──
  // ── Cuentas por pagar ──
  const pagadoDe = (fid) => cxp.pagos.filter(pg => pg.facturaId === fid).reduce((a, pg) => a + Number(pg.monto || 0), 0);
  const notasDe = (fid) => (cxp.notas || []).filter(n2 => n2.facturaId === fid);
  const netoNotas = (fid) => notasDe(fid).reduce((a, n2) => a + (n2.tipo === "ND" ? 1 : -1) * Number(n2.monto || 0), 0);
  const saldoDe = (f) => +(Number(f.monto || 0) + netoNotas(f.id) - pagadoDe(f.id)).toFixed(2);
  const facturasAbiertas = cxp.facturas.filter(f => saldoDe(f) > 0.005).sort((a, b) => aDate(a.vence) - aDate(b.vence));
  const diasVence = (f) => Math.round((aDate(f.vence) - hoyD) / 86400000);
  const cxpTotal = facturasAbiertas.reduce((a, f) => a + saldoDe(f), 0);
  const cxpVencido = facturasAbiertas.filter(f => diasVence(f) < 0).reduce((a, f) => a + saldoDe(f), 0);
  const cxpProx7 = facturasAbiertas.filter(f => diasVence(f) >= 0 && diasVence(f) <= 7).reduce((a, f) => a + saldoDe(f), 0);
  const agingBucket = (f) => { const d = -diasVence(f); return d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : 3; };
  const colones = (n) => "₡" + Number(n).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // ── Kardex de materias primas (entradas por compra, salidas por producción, ajustes) ──
  const registrarKardex = async (movs) => {
    if (!movs.length) return true;
    const actual = await leer(K.kardex, []);
    const nuevo = [...movs, ...actual].slice(0, 4000);
    if (await escribir(K.kardex, nuevo)) { setKardex(nuevo); return true; }
    return false;
  };
  const BotonGuardaMini = () => (
    <button onClick={() => guardarDia(loteActivo?.id)} disabled={guardando} title={`Guardar este punto (guarda el Gallinero ${loteActivo?.galpon || ""})`}
      style={{ padding: "5px 11px", fontSize: 12, fontWeight: 600, background: C.verdeSuave, color: C.verde, border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
      💾 Guardar
    </button>
  );
  const dosisSugerida = (nombre, tipoFav) => {
    const ins = insumos.find(x => x.nombre === nombre);
    if (ins?.dosis) return ins.dosis;
    return favoritos.find(f2 => f2.tipo === tipoFav && f2.nombre === nombre)?.dosis || "";
  };
  const esConocido = (nombre, tipoFav) => !nombre || insumos.some(x => x.nombre === nombre) || favoritos.some(f2 => f2.tipo === tipoFav && f2.nombre === nombre);
  const guardarFavorito = async (tipoFav, nombre, dosis, retiro) => {
    const nuevo = [...favoritos.filter(f2 => !(f2.tipo === tipoFav && f2.nombre === nombre.trim())), { id: Date.now(), tipo: tipoFav, nombre: nombre.trim(), dosis: (dosis || "").trim(), retiro: (retiro || "").trim() }];
    if (await escribir(K.favoritos, nuevo)) { setFavoritos(nuevo); avisar(`⭐ "${nombre.trim()}" agregado al menú`); return true; }
    avisar("⚠ No se pudo guardar"); return false;
  };
  const borrarFavorito = async (id) => {
    const nuevo = favoritos.filter(f2 => f2.id !== id);
    if (await escribir(K.favoritos, nuevo)) { setFavoritos(nuevo); avisar("✓ Quitado del menú"); }
    else avisar("⚠ No se pudo guardar");
  };
  const retiroSugerido = (nombre) => favoritos.find(f2 => f2.tipo === "med" && f2.nombre === nombre)?.retiro || "";
  const kardexSaldo = (codigo) => kardex.reduce((a, m) => a + (m.mp === codigo ? (m.tipo === "salida" ? -1 : 1) * Number(m.kg || 0) : 0), 0);

  // Transaccional: SIEMPRE lee el valor real del storage antes de escribir (imposible pisar datos),
  // y respalda el estado anterior en cxpBak (deshacer de 1 nivel)
  const guardarCxp = async (delta) => {
    if (cargandoFondo) { avisar("⏳ Sincronizando datos — espera unos segundos e intenta de nuevo"); return false; }
    const actual = { facturas: [], pagos: [], notas: [], ...(await leer(K.cxp, {})) };
    await escribir("granja2:cxpBak", actual);
    const nuevo = delta(actual);
    if (await escribir(K.cxp, nuevo)) { setCxp(nuevo); return true; }
    avisar("⚠ No se pudo guardar"); return false;
  };

  // ── Auditoría de gestión: lo que NO está pasando ──
  const auditoria = [];
  const diasDesde = (dmy) => Math.round((hoyD - aDate(dmy)) / 86400000);
  // A. Trabajos diarios sin realizar (bioseguridad y mantenimiento)
  TRABAJOS.forEach((t, i) => {
    let peor = null;
    activos.forEach(l => {
      const regsL = registros.filter(r => r.lote === l.id);
      if (!regsL.length) return;
      const conTrabajo = regsL.find(r => r.trabajos && r.trabajos[i]);
      const dias = conTrabajo ? diasDesde(conTrabajo.fecha) : diasDesde(regsL[regsL.length - 1].fecha);
      const nunca = !conTrabajo;
      if (!peor || dias > peor.dias) peor = { l, dias, nunca };
    });
    if (peor && peor.dias >= 10) {
      auditoria.push({
        nivel: peor.dias >= 15 ? "rojo" : "amarillo",
        texto: `Tarea "${t}": ${peor.nunca ? `sin registro de realizarse desde que hay datos (${peor.dias} días)` : `${peor.dias} días sin realizarse`} en Gallinero ${peor.l.galpon}.`,
      });
    }
  });
  // B. Fumigación (protección biológica) por gallinero
  activos.forEach(l => {
    const ult = fumigaciones.find(m => m.galpon === l.galpon);
    if (!ult) { auditoria.push({ nivel: "amarillo", texto: `Gallinero ${l.galpon}: sin fumigaciones registradas aún.` }); return; }
    const dias = diasDesde(ult.fecha);
    if (dias >= 15) auditoria.push({ nivel: "rojo", texto: `Protección biológica: Gallinero ${l.galpon} lleva ${dias} días sin fumigación registrada (última: ${ult.fecha.slice(0, 5)}, ${ult.producto}).` });
    else if (dias >= 8) auditoria.push({ nivel: "amarillo", texto: `Gallinero ${l.galpon}: ${dias} días desde la última fumigación (${ult.producto}).` });
  });
  // C. Devoluciones de ruta anormales (huevo que regresa quebrado)
  {
    const mov = bodegaMovs[0];
    if (mov?.repartos?.length) {
      mov.repartos.forEach(r => {
        const sal = Number(r.salida || 0);
        if (sal <= 0) return;
        const devM = Number(r.devMalo || 0), devT = devM + Number(r.devBueno || 0);
        if ((devM / sal) * 100 > 5) auditoria.push({ nivel: "rojo", texto: `Ruta de ${r.nombre} (${mov.fecha.slice(0, 5)}): regresó ${devM} cartón(es) de huevo MALO — ${((devM / sal) * 100).toFixed(0)}% de la salida. Revisar empaque, manejo del camión o calidad de cáscara.` });
        else if ((devT / sal) * 100 > 12) auditoria.push({ nivel: "amarillo", texto: `Ruta de ${r.nombre}: devolución total de ${((devT / sal) * 100).toFixed(0)}% (${devT} de ${sal} cartones). Revisar demanda de la ruta.` });
      });
    }
  }
  // D. Gallineros sin captura reciente
  activos.forEach(l => {
    const ult = registros.find(r => r.lote === l.id);
    if (!ult) return;
    const dias = diasDesde(ult.fecha);
    if (dias >= 4) auditoria.push({ nivel: "rojo", texto: `Gallinero ${l.galpon}: ${dias} días SIN control diario registrado (último: ${ult.fecha.slice(0, 5)}). Sin datos no hay gestión.` });
    else if (dias >= 2) auditoria.push({ nivel: "amarillo", texto: `Gallinero ${l.galpon}: ${dias} días sin control diario (último: ${ult.fecha.slice(0, 5)}).` });
  });
  // E. Conteos físicos vencidos
  {
    const ultConteo = bodegaMovs.find(m => m.ajusteConteo != null);
    if (bodegaMovs.length > 5 && (!ultConteo || diasDesde(ultConteo.fecha) > 14)) {
      auditoria.push({ nivel: "amarillo", texto: `Bodega: ${ultConteo ? `${diasDesde(ultConteo.fecha)} días` : "nunca"} sin conteo físico de cartones. Programa un conteo para validar el saldo.` });
    }
    if (mpFechaConteo && diasDesde(mpFechaConteo) > 8) {
      auditoria.push({ nivel: "amarillo", texto: `Materias primas: el inventario tiene ${diasDesde(mpFechaConteo)} días (conteo del ${mpFechaConteo.slice(0, 5)}). El pedido del jueves necesita conteo fresco.` });
    }
  }
  // F0. Cuentas por pagar: vencidas y por vencer
  facturasAbiertas.forEach(f => {
    const d = diasVence(f);
    if (d < 0) auditoria.push({ nivel: "rojo", texto: `Factura VENCIDA hace ${-d} día(s): ${f.proveedor} #${f.numero || "s/n"} — saldo ${colones(saldoDe(f))} (vencía ${f.vence.slice(0, 5)}).` });
    else if (d <= 3) auditoria.push({ nivel: "amarillo", texto: `Factura por vencer en ${d === 0 ? "HOY" : d + " día(s)"}: ${f.proveedor} #${f.numero || "s/n"} — saldo ${colones(saldoDe(f))}.` });
  });
  // F. Quebrado estructural (promedio 7 días > 3%)
  {
    const rs7 = registros.slice(0, activos.length * 7);
    const h7 = rs7.reduce((a, r) => a + r.cartones * HXC, 0);
    const q7 = rs7.reduce((a, r) => a + Number(r.quebrados || 0), 0);
    if (h7 > 0 && (q7 / (h7 + q7)) * 100 > 3) {
      auditoria.push({ nivel: "rojo", texto: `Huevo quebrado promedio de la semana: ${((q7 / (h7 + q7)) * 100).toFixed(1)}% — arriba del 3% de forma sostenida. Ya no es un mal día: revisar calcio (cáscara), frecuencia de recolección y manejo en nidos.` });
    }
  }

  if (printDoc) {
    const l = printDoc.lote ? lotes.find(x => x.id === printDoc.lote) : null;
    const celda = { padding: "7px 6px", borderBottom: "1px solid #ccc", fontSize: 12.5, textAlign: "left", verticalAlign: "top" };
    const th = { ...celda, fontWeight: 700, borderBottom: "2px solid #333", fontSize: 11.5 };
    const abrirParaImprimir = () => { window.print(); };
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", background: "#fff", minHeight: "100vh", color: "#111", padding: "24px 20px", maxWidth: 800, margin: "0 auto" }}>
        <style>{fuentes + " @media print { .no-print { display: none !important } }"}</style>
        <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <button onClick={abrirParaImprimir} style={{ flex: 1, padding: "12px", fontSize: 15, fontWeight: 600, background: C.verde, color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" }}>🖨 Imprimir / Guardar PDF</button>
          <button onClick={() => setPrintDoc(null)} style={{ flex: 0.5, padding: "12px", fontSize: 15, fontWeight: 600, background: "#fff", color: "#555", border: "1.5px solid #ccc", borderRadius: 10, cursor: "pointer" }}>Cerrar</button>
        </div>
        <div id="print-area">
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <img src={LOGO_B64} alt="logo" style={{ width: 190 }} />
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, marginTop: 2 }}>{RAZON_SOCIAL}</div>
        </div>
        <div style={{ textAlign: "center", fontSize: 13, color: "#555", marginBottom: 16 }}>
          {printDoc.tipo === "vacunas" && `Reporte de vacunación — Gallinero ${l?.galpon} · ${l?.raza} · Lote ${l?.lote || ""}`}
          {printDoc.tipo === "medidas" && `Medidas de Producción — Gallinero ${l?.galpon} · ${l?.raza}`}
          {printDoc.tipo === "pesajes" && "Reporte de pesaje corporal — todos los gallineros"}
          {printDoc.tipo === "lotes" && "Estado de lotes — inventario y desempeño de parvadas"}
          {printDoc.tipo === "bodega" && "Movimiento de bodega de huevo"}
          {printDoc.tipo === "reporte" && `Reporte gerencial diario — ${hoyStr()}`}
          {printDoc.tipo === "bache" && `Checklist de producción de concentrado — ${printDoc.formula}`}
          {printDoc.tipo === "controldiario" && `Reporte diario de operación — ${printDoc.fecha}`}
          {printDoc.tipo === "cxp" && `Estado de Cuentas por Pagar — al ${hoyStr()}`}
          {printDoc.tipo === "nucleo" && `Checklist de producción de NÚCLEO — ${printDoc.formula}`}
          {printDoc.tipo === "enfermedades" && "Expediente de enfermedades y tratamientos"}
          {printDoc.tipo === "necropsias" && "Registro de necropsias y resultados de laboratorio"}
          {" · Emitido: "}{hoyStr()}
        </div>

        {printDoc.tipo === "vacunas" && l && (
          <>
            <div style={{ fontSize: 12.5, marginBottom: 10 }}>Nacimiento: {l.nac.split("-").reverse().join("/")} · Edad actual: {semanasDe(l.nac).toFixed(1)} semanas ({Math.floor(semanasDe(l.nac) * 7)} días) · Aves: {l.aves.toLocaleString()}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Día</th><th style={th}>Vacuna</th><th style={th}>Cepa</th><th style={th}>Vía</th><th style={th}>Proveedor</th><th style={th}>Programada</th><th style={th}>Aplicada</th></tr></thead>
              <tbody>
                {planVac.map(p2 => {
                  const ev = estadoVacunaLote(l, p2);
                  return (
                    <tr key={p2.id}>
                      <td style={celda}>{p2.dia}</td><td style={celda}>{p2.vacuna}</td><td style={celda}>{p2.cepa}</td>
                      <td style={celda}>{p2.via}</td><td style={celda}>{p2.proveedor}</td><td style={celda}>{ev.fecha}</td>
                      <td style={{ ...celda, fontWeight: 600 }}>{ev.estado === "aplicada" ? `✓ ${ev.fechaAplicada || ""}` : ev.estado === "cubierta" ? "Levante (proveedor)" : ev.estado.toUpperCase()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span>_______________________________<br />Responsable de granja</span>
              <span>_______________________________<br />Dr. Heiner Hernández Ávila · C.M.V #666</span>
            </div>
          </>
        )}

        {printDoc.tipo === "cxp" && (() => {
          const abiertas = cxp.facturas.filter(f => (Number(f.monto || 0) - cxp.pagos.filter(pg => pg.facturaId === f.id).reduce((a, pg) => a + Number(pg.monto || 0), 0)) > 0.005)
            .sort((a, b) => aDate(a.vence) - aDate(b.vence));
          const saldoF = (f) => Number(f.monto || 0) + (cxp.notas || []).filter(n2 => n2.facturaId === f.id).reduce((a, n2) => a + (n2.tipo === "ND" ? 1 : -1) * Number(n2.monto || 0), 0) - cxp.pagos.filter(pg => pg.facturaId === f.id).reduce((a, pg) => a + Number(pg.monto || 0), 0);
      const col = (n) => "₡" + Number(n).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const buck = (f) => { const d = Math.round((hoyD - aDate(f.vence)) / 86400000); return d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : 3; };
          const porProv2 = {};
          abiertas.forEach(f => { if (!porProv2[f.proveedor]) porProv2[f.proveedor] = [0, 0, 0, 0]; porProv2[f.proveedor][buck(f)] += saldoF(f); });
          return (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Antigüedad de saldos (aging)</div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
                <thead><tr><th style={th}>Proveedor</th><th style={th}>Corriente</th><th style={th}>1–30 d</th><th style={th}>31–60 d</th><th style={th}>+60 d</th><th style={th}>Total</th></tr></thead>
                <tbody>
                  {Object.entries(porProv2).map(([pv, b]) => (
                    <tr key={pv}>
                      <td style={{ ...celda, fontWeight: 600 }}>{pv}</td>
                      {[0, 1, 2, 3].map(i2 => <td key={i2} style={{ ...celda, textAlign: "right" }}>{b[i2] ? col(b[i2]) : "—"}</td>)}
                      <td style={{ ...celda, textAlign: "right", fontWeight: 700 }}>{col(b[0] + b[1] + b[2] + b[3])}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...celda, fontWeight: 700, borderTop: "2px solid #333" }}>TOTAL</td>
                    {[0, 1, 2, 3].map(i2 => <td key={i2} style={{ ...celda, textAlign: "right", fontWeight: 700, borderTop: "2px solid #333" }}>{col(Object.values(porProv2).reduce((a, b) => a + b[i2], 0))}</td>)}
                    <td style={{ ...celda, textAlign: "right", fontWeight: 700, borderTop: "2px solid #333" }}>{col(abiertas.reduce((a, f) => a + saldoF(f), 0))}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Detalle de facturas pendientes</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Proveedor</th><th style={th}>No.</th><th style={th}>Emisión</th><th style={th}>Vence</th><th style={th}>Categoría</th><th style={th}>Original</th><th style={th}>Saldo</th></tr></thead>
                <tbody>
                  {abiertas.map(f => (
                    <tr key={f.id}>
                      <td style={{ ...celda, fontWeight: 600 }}>{f.proveedor}</td>
                      <td style={celda}>{f.numero || "s/n"}</td>
                      <td style={celda}>{f.emision.slice(0, 5)}</td>
                      <td style={{ ...celda, fontWeight: aDate(f.vence) < hoyD ? 700 : 400 }}>{f.vence.slice(0, 5)}{aDate(f.vence) < hoyD ? " ⚠" : ""}</td>
                      <td style={celda}>{f.categoria}</td>
                      <td style={{ ...celda, textAlign: "right" }}>{col(f.monto)}</td>
                      <td style={{ ...celda, textAlign: "right", fontWeight: 700 }}>{col(saldoF(f))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span>_______________________________<br />Elaborado</span>
                <span>_______________________________<br />Gerencia / Contabilidad</span>
              </div>
            </>
          );
        })()}

        {printDoc.tipo === "controldiario" && (() => {
          const fSel2 = printDoc.fecha;
          const regsDia = registros.filter(r => r.fecha === fSel2);
          const medsDia = medicaciones.filter(m => m.fecha === fSel2);
          const fumsDia = fumigaciones.filter(m => m.fecha === fSel2);
          const notaDia2 = bitacora.find(b => b.fecha === fSel2);
          return (
            <>
              {regsDia.length === 0 && <div style={{ fontSize: 13.5 }}>Sin registros guardados para el {fSel2}.</div>}
              {regsDia.map((r, ri) => {
                const l2 = lotes.find(x => x.id === r.lote);
                if (!l2) return null;
                const huevos = r.cartones * HXC;
                const medsG = medsDia.filter(m => m.galpon === l2.galpon && m.tipo === "Medicamento");
                const vitsG = medsDia.filter(m => m.galpon === l2.galpon && m.tipo === "Vitamina");
                const fumsG = fumsDia.filter(m => m.galpon === l2.galpon);
                const ch = r.chequeo || {};
                const trabajosHechos = r.trabajos ? TRABAJOS.filter((_, i) => r.trabajos[i]) : [];
                return (
                  <div key={ri} style={{ marginBottom: 22, pageBreakInside: "avoid" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, background: "#eee", padding: "6px 10px", borderRadius: 6, marginBottom: 8 }}>
                      GALLINERO {l2.galpon} · {l2.raza} · {semanasDe(l2.nac).toFixed(1)} sem · {l2.aves.toLocaleString()} aves {r.por ? ` · Capturó: ${r.por}` : ""}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
                      <tbody>
                        <tr>
                          <td style={celda}><b>1. Producción:</b> {r.cartones} cartones = {huevos.toFixed(0)} huevos · {r.pesoKg} kg · Postura {l2.aves ? ((huevos / l2.aves) * 100).toFixed(1) : "—"}%</td>
                          <td style={celda}><b>2. Quebrado:</b> {r.quebrados}</td>
                        </tr>
                        <tr>
                          <td style={celda}><b>3. Mortalidad:</b> {r.muertas} ave(s){r.dx ? ` · Dx: ${r.dx}` : ""}</td>
                          <td style={celda}><b>Saldo aves:</b> {l2.aves.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td style={celda}><b>7. Alimento:</b> 6am {r.alimento6am || "—"} kg · 1pm {r.alimento1pm || "—"} kg · Total {r.alimentoKg} kg (esperado {r.alimentoEsperadoKg} kg)</td>
                          <td style={celda}><b>Agua:</b> {r.aguaL ? `${r.aguaL} L` : "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                    {(fumsG.length > 0 || medsG.length > 0 || vitsG.length > 0) && (
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
                        <tbody>
                          {fumsG.map((m, i) => <tr key={"f" + i}><td style={celda}><b>4. Fumigación:</b> {m.producto} · {m.dosis}{m.hora ? ` · ${m.hora}` : ""}</td></tr>)}
                          {medsG.map((m, i) => <tr key={"m" + i}><td style={celda}><b>5. Medicamento:</b> {m.producto} · {m.dosis}{m.enfermedad ? ` · Dx: ${m.enfermedad}` : ""}{m.retiroDias > 0 ? ` · RETIRO ${m.retiroDias} días (hasta ${m.retiroHasta})` : ""}</td></tr>)}
                          {vitsG.map((m, i) => <tr key={"v" + i}><td style={celda}><b>6. Vitamina:</b> {m.producto} · {m.dosis}</td></tr>)}
                        </tbody>
                      </table>
                    )}
                    {trabajosHechos.length > 0 && (
                      <div style={{ fontSize: 11.5, marginBottom: 8 }}><b>8. Trabajos realizados:</b> {trabajosHechos.map(t => `☑ ${t}`).join(" · ")}</div>
                    )}
                    {r.chequeo && (
                      <div style={{ fontSize: 11.5, marginBottom: 4 }}>
                        <b>9. Chequeo sanitario:</b> {[
                          ch.cascara && `Cáscara: ${ch.cascara}`, ch.cresta && `Cresta: ${ch.cresta}`,
                          ch.consumoObs && `Consumo obs.: ${ch.consumoObs}`, ch.aguaObs && `Agua obs.: ${ch.aguaObs}`,
                          ch.heces && `Heces: ${ch.heces}`, ch.respiratorio && `Respiratorio: ${ch.respiratorio}`,
                          ch.secrecion && `Secreción: ${ch.secrecion}`, ch.comederos && `Comederos: ${ch.comederos}`,
                          ch.ph && `pH: ${ch.ph}`, ch.cloro && `Cloro: ${ch.cloro} ppm`, ch.temp && `Temp: ${ch.temp}°C`,
                          ch.humedad && `Humedad: ${ch.humedad}%`, ch.luz && `Luz: ${ch.luz} h`, ch.obs && `Obs: ${ch.obs}`,
                        ].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                );
              })}
              {notaDia2 && <div style={{ fontSize: 12, marginBottom: 14 }}><b>Bitácora:</b> {notaDia2.texto} {notaDia2.por ? `(${notaDia2.por})` : ""}</div>}
              <div style={{ marginTop: 36, display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span>_______________________________<br />Encargado de granja</span>
                <span>_______________________________<br />Supervisión / Gerencia</span>
              </div>
            </>
          );
        })()}

        {(printDoc.tipo === "bache" || printDoc.tipo === "nucleo") && (() => {
          const f = recetas.formulas[printDoc.formula];
          if (!f) return <div>Fórmula no encontrada.</div>;
          const esc = (printDoc.tipo === "bache" ? Number(printDoc.kg || recetas.bacheKg) / recetas.bacheKg : Number(printDoc.baches || 1));
          const items = Object.entries(f.items).map(([c, kg]) => {
            const mp = mpCat.find(m => m.c === c) || { n: c, pres: 1 };
            return { c, mp, kg: Number(kg || 0) * esc, bascula: basculaDe(c) };
          }).filter(x => x.kg > 0);
          const filaMP = (x, conQ) => {
            const sacos = conQ && x.mp.pres > 1 ? Math.floor(x.kg / x.mp.pres) : 0;
            const rem = conQ && x.mp.pres > 1 ? x.kg - sacos * x.mp.pres : x.kg;
            return (
              <tr key={x.c}>
                <td style={{ ...celda, width: 26, fontSize: 15 }}>☐</td>
                <td style={celda}>{x.mp.n}</td>
                <td style={{ ...celda, fontWeight: 700, textAlign: "right" }}>{x.kg.toFixed(2)}</td>
                {conQ && <td style={{ ...celda, textAlign: "right" }}>{x.mp.pres > 1 ? sacos : "—"}</td>}
                {conQ && <td style={{ ...celda, textAlign: "right" }}>{x.mp.pres > 1 ? rem.toFixed(2) : "granel"}</td>}
              </tr>
            );
          };
          const cab = (conQ) => (
            <tr><th style={th}>✓</th><th style={th}>Materia prima</th><th style={{ ...th, textAlign: "right" }}>Peso (kg)</th>
              {conQ && <th style={{ ...th, textAlign: "right" }}>Sacos</th>}{conQ && <th style={{ ...th, textAlign: "right" }}>Kg remanentes</th>}</tr>
          );
          const kgNuc = items.filter(x => x.bascula === 4).reduce((a, x) => a + x.kg, 0);
          const total = items.reduce((a, x) => a + x.kg, 0);
          return (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, fontSize: 12.5 }}>
                <tbody>
                  <tr><td style={celda}><b>Fórmula:</b> {printDoc.formula}</td><td style={celda}><b>No. de lote:</b> ______________</td></tr>
                  <tr><td style={celda}><b>Fecha:</b> ______________</td><td style={celda}><b>Operador:</b> ______________</td></tr>
                  <tr><td style={celda}><b>Hora inicio:</b> ______________</td><td style={celda}><b>Hora fin:</b> ______________</td></tr>
                  <tr><td style={celda}><b>{printDoc.tipo === "bache" ? "Kg a producir" : "Para baches de concentrado"}:</b> {printDoc.tipo === "bache" ? `${(recetas.bacheKg * esc).toFixed(0)} kg` : `${esc} bache(s) → ${kgNuc.toFixed(2)} kg de núcleo`}</td><td style={celda}></td></tr>
                </tbody>
              </table>
              {printDoc.tipo === "bache" ? (
                <>
                  {[1, 2, 3].map(b => {
                    const its = items.filter(x => x.bascula === b);
                    if (!its.length) return null;
                    return (
                      <div key={b} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>{NOMBRE_BASCULA[b]}</div>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}><thead>{cab(true)}</thead><tbody>{its.map(x => filaMP(x, true))}</tbody></table>
                      </div>
                    );
                  })}
                  {kgNuc > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>{NOMBRE_BASCULA[4]}</div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>{cab(false)}</thead>
                        <tbody>
                          <tr><td style={{ ...celda, width: 26, fontSize: 15 }}>☐</td><td style={celda}><b>NÚCLEO {printDoc.formula.toUpperCase()}</b> (premezcla — ver hoja de núcleo)</td><td style={{ ...celda, fontWeight: 700, textAlign: "right" }}>{kgNuc.toFixed(2)}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 700, padding: "8px 4px", borderTop: "2px solid #333" }}>
                    <span>PESO TOTAL DE LA FÓRMULA</span><span>{total.toFixed(2)} kg</span>
                  </div>
                </>
              ) : (
                <>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
                    <thead>{cab(false)}</thead>
                    <tbody>{items.filter(x => x.bascula === 4).map(x => filaMP(x, false))}</tbody>
                  </table>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 700, padding: "8px 4px", borderTop: "2px solid #333" }}>
                    <span>TOTAL NÚCLEO ({esc} bache(s))</span><span>{kgNuc.toFixed(2)} kg</span>
                  </div>
                </>
              )}
              <div style={{ marginTop: 36, display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span>_______________________________<br />Elaborado por</span>
                <span>_______________________________<br />Supervisado por</span>
              </div>
            </>
          );
        })()}

        {printDoc.tipo === "reporte" && (() => {
          const avesTot = activos.reduce((a, x) => a + x.aves, 0);
          const colorNivel = { rojo: "#B3402A", amarillo: "#9A6605" };
          return (
            <>
              {!dHoy && <div style={{ fontSize: 13.5, marginBottom: 14 }}>Sin registro de producción para hoy — el reporte muestra el último estado disponible.</div>}
              {dHoy && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Resumen del día ({fHoy}) — {avesTot.toLocaleString()} aves en {activos.length} gallineros</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
                    <tbody>
                      <tr><td style={celda}>% de postura granja</td><td style={{ ...celda, fontWeight: 700, textAlign: "right" }}>{dHoy.postura.toFixed(1)}%</td>
                          <td style={celda}>Cartones producidos</td><td style={{ ...celda, fontWeight: 700, textAlign: "right" }}>{dHoy.cartones.toFixed(1)}</td></tr>
                      <tr><td style={celda}>Consumo (g/ave)</td><td style={{ ...celda, fontWeight: 700, textAlign: "right" }}>{dHoy.consumo.toFixed(0)}</td>
                          <td style={celda}>Peso prom. huevo</td><td style={{ ...celda, fontWeight: 700, textAlign: "right" }}>{dHoy.pesoH ? dHoy.pesoH.toFixed(1) + " g" : "—"}</td></tr>
                      <tr><td style={celda}>% quebrado</td><td style={{ ...celda, fontWeight: 700, textAlign: "right" }}>{dHoy.pctQueb.toFixed(1)}%</td>
                          <td style={celda}>Mortalidad del día</td><td style={{ ...celda, fontWeight: 700, textAlign: "right" }}>{dHoy.muertas}</td></tr>
                    </tbody>
                  </table>
                </>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Semáforo técnico por gallinero</div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
                <thead><tr><th style={th}>Gall.</th><th style={th}>Postura (vs tabla)</th><th style={th}>Consumo vs ración</th><th style={th}>Agua:alim</th><th style={th}>Mort. 7d</th><th style={th}>Peso vs tabla</th><th style={th}>Uniformidad</th></tr></thead>
                <tbody>
                  {activos.map(l2 => {
                    const regsL = registros.filter(r => r.lote === l2.id).slice(0, 7);
                    const rU = regsL[0];
                    const post = rU && l2.aves ? ((rU.cartones * HXC) / l2.aves) * 100 : null;
                    const dPost = post != null && l2.posturaIdeal ? post - l2.posturaIdeal : null;
                    const gReal = rU && Number(rU.alimentoKg || 0) > 0 && l2.aves ? (rU.alimentoKg * 1000) / l2.aves : null;
                    const dCons = gReal != null && l2.racionGAve > 0 ? ((gReal - l2.racionGAve) / l2.racionGAve) * 100 : null;
                    const ratio = rU && Number(rU.aguaL || 0) > 0 && Number(rU.alimentoKg || 0) > 0 ? rU.aguaL / rU.alimentoKg : null;
                    const m7 = regsL.reduce((a, r) => a + Number(r.muertas || 0), 0);
                    const pM7 = l2.aves ? (m7 / l2.aves) * 100 : null;
                    const pes = pesajes.find(p2 => p2.lote === l2.id);
                    const stP = pes ? statsPesaje(pes) : null;
                    const metaP = Number(l2.pesoMeta) || (pes ? Number(pes.meta) : 0) || 0;
                    const dPeso = stP && metaP ? ((stP.prom - metaP) / metaP) * 100 : null;
                    return (
                      <tr key={l2.id}>
                        <td style={{ ...celda, fontWeight: 700 }}>G{l2.galpon}</td>
                        <td style={celda}>{dPost != null ? `${post.toFixed(1)}% (${dPost > 0 ? "+" : ""}${dPost.toFixed(1)})` : "—"}</td>
                        <td style={celda}>{dCons != null ? `${dCons > 0 ? "+" : ""}${dCons.toFixed(0)}%` : "—"}</td>
                        <td style={celda}>{ratio != null ? ratio.toFixed(1) : "—"}</td>
                        <td style={celda}>{pM7 != null ? `${pM7.toFixed(2)}%` : "—"}</td>
                        <td style={celda}>{dPeso != null ? `${dPeso > 0 ? "+" : ""}${dPeso.toFixed(1)}%` : "—"}</td>
                        <td style={celda}>{stP ? `${stP.unif.toFixed(0)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Auditoría de gestión ({auditoria.length} hallazgo{auditoria.length === 1 ? "" : "s"})</div>
              {auditoria.length === 0 && <div style={{ fontSize: 12.5, marginBottom: 12 }}>✓ Sin hallazgos — tareas y controles al día.</div>}
              {auditoria.map((a, i) => (
                <div key={"au" + i} style={{ fontSize: 12, padding: "5px 0", borderBottom: "1px solid #ddd", lineHeight: 1.45 }}>
                  <b style={{ color: colorNivel[a.nivel] || "#333" }}>{a.nivel === "rojo" ? "🔴" : "🟡"}</b> {a.texto}
                </div>
              ))}
              <div style={{ fontSize: 13, fontWeight: 700, margin: "14px 0 6px" }}>Para decidir hoy ({decisiones.length} punto{decisiones.length === 1 ? "" : "s"})</div>
              {decisiones.length === 0 && <div style={{ fontSize: 12.5, marginBottom: 14 }}>✓ Sin alertas — operación dentro de parámetros.</div>}
              {decisiones.map((d, i) => (
                <div key={i} style={{ fontSize: 12, padding: "6px 0", borderBottom: "1px solid #ddd", lineHeight: 1.45 }}>
                  <b style={{ color: colorNivel[d.nivel] || "#333" }}>{d.nivel === "rojo" ? "🔴" : "🟡"}</b> {d.texto}
                </div>
              ))}
              <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span>_______________________________<br />Encargado de granja</span>
                <span>_______________________________<br />Gerencia</span>
              </div>
            </>
          );
        })()}

        {printDoc.tipo === "bodega" && (() => {
          const mov = bodegaMovs[0];
          const saldoPrevio = mov ? +(mov.saldoFinal - (mov.producido || 0) - (mov.comprado || 0) + (mov.rutaNeta || 0) + (mov.vendGranja || 0) + (mov.destruido || 0) + (mov.regalado || 0) - (mov.difAjuste || 0)).toFixed(1) : null;
          const fila = (nombre, val, signo) => (val != null && val !== 0) || signo === "=" ? (
            <tr><td style={celda}>{nombre} ({signo})</td><td style={{ ...celda, fontWeight: signo === "=" ? 700 : 600, textAlign: "right" }}>{Number(val).toFixed(1)}</td></tr>
          ) : null;
          return (
            <>
              {!mov && <div style={{ fontSize: 13.5 }}>Aún no hay movimientos de bodega guardados.</div>}
              {mov && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Movimiento del {mov.fecha} (en cartones)</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
                    <tbody>
                      {fila("Saldo inicial del día", saldoPrevio, "=")}
                      {fila("Huevo producido", mov.producido, "+")}
                      {fila("Huevo comprado", mov.comprado, "+")}
                      {fila("Salida neta a ruta", mov.rutaNeta, "−")}
                      {fila("Vendido en granja", mov.vendGranja, "−")}
                      {fila("Destruido / quebrado", mov.destruido, "−")}
                      {fila("Regalado", mov.regalado, "−")}
                      {mov.ajusteConteo != null && <tr><td style={celda}>Ajuste por conteo físico</td><td style={{ ...celda, fontWeight: 600, textAlign: "right" }}>{mov.ajusteConteo} ({mov.difAjuste > 0 ? "+" : ""}{mov.difAjuste})</td></tr>}
                      <tr><td style={{ ...celda, fontWeight: 700, borderTop: "2px solid #333" }}>SALDO FINAL EN BODEGA (=)</td><td style={{ ...celda, fontWeight: 700, textAlign: "right", borderTop: "2px solid #333" }}>{mov.saldoFinal}</td></tr>
                    </tbody>
                  </table>
                  {mov.repartos?.length > 0 && (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Detalle por repartidor</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
                        <thead><tr><th style={th}>Repartidor</th><th style={th}>Salida</th><th style={th}>Dev. bueno</th><th style={th}>Dev. malo</th><th style={th}>Neto</th></tr></thead>
                        <tbody>
                          {mov.repartos.map((r, i) => (
                            <tr key={i}>
                              <td style={{ ...celda, fontWeight: 600 }}>{r.nombre}</td>
                              <td style={celda}>{Number(r.salida || 0)}</td>
                              <td style={celda}>{Number(r.devBueno || 0)}</td>
                              <td style={celda}>{Number(r.devMalo || 0)}</td>
                              <td style={{ ...celda, fontWeight: 700 }}>{(Number(r.salida || 0) - Number(r.devBueno || 0) - Number(r.devMalo || 0)).toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                  {mov.obs && <div style={{ fontSize: 12.5, marginBottom: 14 }}><b>Observaciones:</b> {mov.obs}</div>}
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Últimos 7 días</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={th}>Fecha</th><th style={th}>Producido</th><th style={th}>Ruta neta</th><th style={th}>Saldo final</th></tr></thead>
                    <tbody>
                      {bodegaMovs.slice(0, 7).map((m2, i) => (
                        <tr key={i}>
                          <td style={celda}>{m2.fecha}</td>
                          <td style={celda}>{m2.producido ?? "—"}</td>
                          <td style={celda}>{m2.rutaNeta ?? "—"}</td>
                          <td style={{ ...celda, fontWeight: 600 }}>{m2.saldoFinal}{m2.ajusteConteo != null ? " *" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 10.5, color: "#555", marginTop: 4 }}>* día con ajuste por conteo físico</div>
                </>
              )}
              <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span>_______________________________<br />Responsable de bodega</span>
                <span>_______________________________<br />Gerencia</span>
              </div>
            </>
          );
        })()}

        {printDoc.tipo === "lotes" && (() => {
          const cerrados = lotes.filter(x => x.estado === "cerrado");
          return (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 18 }}>
                <thead><tr>
                  <th style={th}>Gallinero</th><th style={th}>Lote</th><th style={th}>Genética</th><th style={th}>Nacimiento</th>
                  <th style={th}>Edad</th><th style={th}>Aves vivas</th><th style={th}>Proveedor pollonas</th>
                </tr></thead>
                <tbody>
                  {activos.map(l2 => (
                    <tr key={l2.id}>
                      <td style={{ ...celda, fontWeight: 700 }}>G{l2.galpon}</td>
                      <td style={celda}>{l2.lote || "—"}</td>
                      <td style={celda}>{l2.raza}</td>
                      <td style={celda}>{l2.nac.split("-").reverse().join("/")}</td>
                      <td style={celda}>{semanasDe(l2.nac).toFixed(1)} sem</td>
                      <td style={{ ...celda, fontWeight: 700 }}>{l2.aves.toLocaleString()}</td>
                      <td style={celda}>{l2.proveedor || "—"}</td>
                    </tr>
                  ))}
                  <tr><td style={{ ...celda, fontWeight: 700 }} colSpan={5}>TOTAL</td><td style={{ ...celda, fontWeight: 700 }}>{activos.reduce((a, x) => a + x.aves, 0).toLocaleString()}</td><td style={celda}></td></tr>
                </tbody>
              </table>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Desempeño</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={th}>Gallinero</th><th style={th}>Postura</th><th style={th}>Meta tabla</th><th style={th}>Fórmula</th>
                  <th style={th}>Ración</th><th style={th}>Consumo real</th><th style={th}>Mort. día</th><th style={th}>Mort. 7d</th><th style={th}>Mort. acum.</th>
                </tr></thead>
                <tbody>
                  {activos.map(l2 => {
                    const regsL = registros.filter(r => r.lote === l2.id).slice(0, 30);
                    const ult = regsL[0];
                    const post = ult && l2.aves ? ((ult.cartones * HXC) / l2.aves) * 100 : null;
                    const gAveReal = ult && Number(ult.alimentoKg || 0) > 0 && l2.aves ? (Number(ult.alimentoKg) * 1000) / l2.aves : null;
                    const mDia = ult ? Number(ult.muertas || 0) : null;
                    const mSem = regsL.slice(0, 7).reduce((a, r) => a + Number(r.muertas || 0), 0);
                    const mortPct2 = ((l2.mortAcum / (l2.avesIniciales || 1)) * 100).toFixed(1);
                    return (
                      <tr key={l2.id}>
                        <td style={{ ...celda, fontWeight: 700 }}>G{l2.galpon}</td>
                        <td style={{ ...celda, fontWeight: 600 }}>{post != null ? `${post.toFixed(1)}%` : "—"}</td>
                        <td style={celda}>{l2.posturaIdeal ? `${l2.posturaIdeal}%` : "—"}</td>
                        <td style={celda}>{l2.formula || "—"}</td>
                        <td style={celda}>{l2.racionGAve ? `${l2.racionGAve} g/ave` : "—"}</td>
                        <td style={celda}>{gAveReal ? `${gAveReal.toFixed(0)} g/ave` : "—"}</td>
                        <td style={celda}>{mDia != null && l2.aves ? `${mDia} (${((mDia / l2.aves) * 100).toFixed(2)}%)` : "—"}</td>
                        <td style={celda}>{l2.aves ? `${mSem} (${((mSem / l2.aves) * 100).toFixed(2)}%)` : "—"}</td>
                        <td style={celda}>{l2.mortAcum} ({mortPct2}%)</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {cerrados.length > 0 && (
                <div style={{ fontSize: 11.5, color: "#555", marginTop: 12 }}>
                  Lotes cerrados: {cerrados.map(c2 => `G${c2.galpon} ${c2.lote || ""} (${c2.raza}, cerrado ${c2.cerradoFecha || "—"})`).join(" · ")}
                </div>
              )}
              <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span>_______________________________<br />Encargado de granja</span>
                <span>_______________________________<br />Gerencia</span>
              </div>
            </>
          );
        })()}

        {printDoc.tipo === "pesajes" && (() => {
          const filasP = activos.map(l2 => {
            const delLote = pesajes.filter(p2 => p2.lote === l2.id);
            const ult = delLote[0]; const ant = delLote[1];
            if (!ult) return null;
            const st = statsPesaje(ult);
            const stAnt = ant ? statsPesaje(ant) : null;
            const meta = Number(l2.pesoMeta) || Number(ult.meta) || 0;
            const rReal = registros.find(r => r.lote === l2.id && Number(r.alimentoKg || 0) > 0);
            const gAveReal = rReal && l2.aves ? (Number(rReal.alimentoKg) * 1000) / l2.aves : null;
            return { l2, ult, ant, st, stAnt, meta, gAveReal };
          }).filter(Boolean);
          return (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 18 }}>
                <thead><tr>
                  <th style={th}>Gallinero</th><th style={th}>Genética / Edad</th><th style={th}>Fecha (n aves)</th>
                  <th style={th}>Promedio</th><th style={th}>Meta tabla</th><th style={th}>Brecha</th>
                  <th style={th}>Uniformidad</th><th style={th}>CV</th><th style={th}>Vs pesaje anterior</th>
                </tr></thead>
                <tbody>
                  {filasP.map(({ l2, ult, ant, st, stAnt, meta }) => (
                    <tr key={l2.id}>
                      <td style={{ ...celda, fontWeight: 700 }}>G{l2.galpon}</td>
                      <td style={celda}>{l2.raza} · {semanasDe(l2.nac).toFixed(1)} sem</td>
                      <td style={celda}>{ult.fecha} ({ult.pesos.length})</td>
                      <td style={{ ...celda, fontWeight: 700 }}>{st.prom.toFixed(0)} g</td>
                      <td style={celda}>{meta ? `${meta} g` : "—"}</td>
                      <td style={{ ...celda, fontWeight: 600 }}>{meta ? `${(st.prom - meta) >= 0 ? "+" : ""}${(st.prom - meta).toFixed(0)} g (${(((st.prom - meta) / meta) * 100).toFixed(1)}%)` : "—"}</td>
                      <td style={celda}>{st.unif.toFixed(1)}% <span style={{ fontSize: 10.5 }}>(meta &gt;85%)</span></td>
                      <td style={celda}>{st.cv.toFixed(1)}%</td>
                      <td style={celda}>{ant ? `${stAnt.prom.toFixed(0)} g (${ant.fecha.slice(0, 5)}) → ${(st.prom - stAnt.prom) >= 0 ? "+" : ""}${(st.prom - stAnt.prom).toFixed(0)} g` : "primer pesaje"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Contexto de alimentación</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Gallinero</th><th style={th}>Aves vivas</th><th style={th}>Fórmula</th><th style={th}>Ración definida</th><th style={th}>Consumo real último día</th></tr></thead>
                <tbody>
                  {filasP.map(({ l2, gAveReal }) => (
                    <tr key={l2.id}>
                      <td style={{ ...celda, fontWeight: 700 }}>G{l2.galpon}</td>
                      <td style={celda}>{l2.aves.toLocaleString()}</td>
                      <td style={celda}>{l2.formula || "—"}</td>
                      <td style={celda}>{l2.racionGAve ? `${l2.racionGAve} g/ave` : "—"}</td>
                      <td style={celda}>{gAveReal ? `${gAveReal.toFixed(0)} g/ave` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", fontSize: 12, gap: 8, flexWrap: "wrap" }}>
                <span>____________________________<br />Encargado de granja</span>
                <span>____________________________<br />Dr. Heiner Hernández Ávila<br />C.M.V #666</span>
                <span>____________________________<br />Nutricionista</span>
              </div>
            </>
          );
        })()}

        {printDoc.tipo === "medidas" && l && (() => {
          const reg = registros.find(r => r.lote === l.id) || {};
          const ch = reg.chequeo || {};
          const huevos = (reg.cartones || 0) * 30;
          const pesoHuevo = huevos > 0 && reg.pesoKg > 0 ? (reg.pesoKg / huevos) * 1000 : null;
          const gAve = l.aves > 0 && reg.alimentoKg > 0 ? (reg.alimentoKg * 1000) / l.aves : null;
          const mlAve = l.aves > 0 && reg.aguaL > 0 ? (reg.aguaL * 1000) / l.aves : null;
          const pesUlt = pesajes.find(p2 => p2.lote === l.id);
          const promP = pesUlt ? pesUlt.pesos.reduce((a, b) => a + b, 0) / pesUlt.pesos.length : null;
          const unif = pesUlt && promP ? (pesUlt.pesos.filter(x => Math.abs(x - promP) <= 0.1 * promP).length / pesUlt.pesos.length) * 100 : null;
          const filas = [
            ["Edad del lote (semanas)", semanasDe(l.nac).toFixed(1), ""],
            ["Genética", l.raza, ""],
            ["Aves vivas", l.aves.toLocaleString(), ""],
            ["Mortalidad del día", reg.muertas ?? "—", "0–2 aves/1000"],
            ["% de postura", huevos > 0 ? `${((huevos / l.aves) * 100).toFixed(1)}%` : "—", l.metaPostura ? `${l.metaPostura}% (tabla)` : "Según tabla"],
            ["Huevos buenos", huevos > 0 ? (huevos - (reg.quebrados || 0)).toFixed(0) : "—", ""],
            ["Huevos quebrados", reg.quebrados ?? "—", "<3%"],
            ["Peso promedio del huevo (g)", pesoHuevo ? pesoHuevo.toFixed(1) : "—", "Según edad"],
            ["Consumo alimento (g/ave/día)", gAve ? gAve.toFixed(0) : "—", l.racionGAve ? `${l.racionGAve} g (ración)` : "Según tabla"],
            ["Consumo total alimento (kg)", reg.alimentoKg ?? "—", ""],
            ["Consumo de agua (ml/ave/día)", mlAve ? mlAve.toFixed(0) : "—", gAve ? `${(gAve * 1.8).toFixed(0)}–${(gAve * 2.2).toFixed(0)} (1.8–2.2× alimento)` : "1.8–2.2× alimento"],
            ["Peso corporal promedio (g)", promP ? promP.toFixed(0) : "—", "Según guía genética"],
            ["Uniformidad del lote (%)", unif ? unif.toFixed(1) : "—", ">85%"],
            ["Calidad de cáscara", ch.cascara || "—", "Buena"],
            ["Color de cresta", ch.cresta || "—", "Roja intensa"],
            ["Consumo alimento observado", ch.consumoObs || "—", "Normal"],
            ["Consumo agua observado", ch.aguaObs || "—", "Normal"],
            ["Consistencia de heces", ch.heces || "—", "Normal"],
            ["Sonidos respiratorios", ch.respiratorio || "—", "No"],
            ["Secreción nasal", ch.secrecion || "—", "No"],
            ["Uniformidad de comederos", ch.comederos || "—", "Buena"],
            ["pH del agua", ch.ph || "—", "6.0–7.5"],
            ["Cloro (ppm)", ch.cloro || "—", ""],
            ["Temperatura del galpón (°C)", ch.temp || "—", "27–29"],
            ["Humedad relativa (%)", ch.humedad || "—", "50–70"],
            ["Horas de luz", ch.luz || "—", "16 h"],
          ];
          return (
            <>
              <div style={{ fontSize: 12.5, marginBottom: 10 }}>Fecha del registro: {reg.fecha || hoyStr()} · Aves: {l.aves.toLocaleString()} · Nacimiento: {l.nac.split("-").reverse().join("/")}</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>KPI</th><th style={th}>Valor</th><th style={th}>Meta</th></tr></thead>
                <tbody>
                  {filas.map(([k, v, m], i) => (
                    <tr key={i}><td style={celda}>{k}</td><td style={{ ...celda, fontWeight: 600 }}>{v}</td><td style={celda}>{m}</td></tr>
                  ))}
                  {ch.obs && <tr><td style={celda}>Observaciones</td><td style={celda} colSpan={2}>{ch.obs}</td></tr>}
                </tbody>
              </table>
              <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span>_______________________________<br />Encargado de granja</span>
                <span>_______________________________<br />Dr. Heiner Hernández Ávila · C.M.V #666</span>
              </div>
            </>
          );
        })()}

        {printDoc.tipo === "enfermedades" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Fecha</th><th style={th}>Gallinero</th><th style={th}>Enfermedad</th><th style={th}>Tratamiento</th><th style={th}>Estado</th></tr></thead>
            <tbody>
              {enfermedades.map((e2, i) => {
                const le = lotes.find(x => x.id === e2.lote);
                return (
                  <tr key={i}>
                    <td style={celda}>{e2.fecha}</td><td style={celda}>G{le?.galpon ?? "?"}</td>
                    <td style={celda}>{e2.enfermedad}</td><td style={celda}>{e2.tratamiento}</td>
                    <td style={celda}>{e2.estado === "Recuperado" ? `Recuperado ${e2.fechaAlta || ""}` : e2.estado}</td>
                  </tr>
                );
              })}
              {enfermedades.length === 0 && <tr><td style={celda} colSpan={5}>Sin registros.</td></tr>}
            </tbody>
          </table>
        )}

        {printDoc.tipo === "necropsias" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Fecha</th><th style={th}>Gallinero</th><th style={th}>Tipo</th><th style={th}>Laboratorio</th><th style={th}>Hallazgos</th></tr></thead>
            <tbody>
              {necropsias.map((n2, i) => {
                const ln = lotes.find(x => x.id === n2.lote);
                return (
                  <tr key={i}>
                    <td style={celda}>{n2.fecha}</td><td style={celda}>G{ln?.galpon ?? "?"}</td>
                    <td style={celda}>{n2.tipo}</td><td style={celda}>{n2.laboratorio}</td>
                    <td style={celda}>{n2.hallazgos}{n2.numFotos ? ` (${n2.numFotos} foto(s) en la app)` : ""}</td>
                  </tr>
                );
              })}
              {necropsias.length === 0 && <tr><td style={celda} colSpan={5}>Sin registros.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      </div>
    );
  }

  const cap = capturas[galponActivo] || capturaVacia();
  const setCap = (cambios) => { suciosRef.current[galponActivo] = true; setCapturas({ ...capturas, [galponActivo]: { ...cap, ...cambios } }); };
  const tGal = totalesGalpon(cap);
  const loteActivo = lotes.find(l => l.id === galponActivo);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: C.fondo, minHeight: "100vh", color: C.texto }}>
      <style>{fuentes}</style>
      {modalFav && (
        <div onClick={() => setModalFav(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,24,0.55)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 18, padding: "22px 20px", boxShadow: "0 10px 40px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: C.verde, marginBottom: 4 }}>
              ➕ Nuevo producto de {modalFav.tipo === "fum" ? "fumigación" : modalFav.tipo === "med" ? "medicamento" : "vitamina"}
            </div>
            <div style={{ fontSize: 12.5, color: C.textoSuave, marginBottom: 14 }}>Queda guardado en el menú para todo el equipo, con su dosis para autorrellenar.</div>
            <Campo etiqueta="Nombre del producto" type="text" placeholder="ej. Virkon S" value={modalFav.nombre} onChange={e => setModalFav({ ...modalFav, nombre: e.target.value })} />
            <Campo etiqueta="Dosis sugerida (editable al usarla)" type="text" placeholder="ej. 25 g por bomba de 18 L" value={modalFav.dosis} onChange={e => setModalFav({ ...modalFav, dosis: e.target.value })} />
            {modalFav.tipo === "med" && <Campo etiqueta="Días de retiro del huevo (si aplica)" type="text" inputMode="numeric" placeholder="ej. 5" value={modalFav.retiro} onChange={e => setModalFav({ ...modalFav, retiro: e.target.value })} />}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button onClick={async () => {
                if (!modalFav.nombre.trim()) { avisar("⚠ Escribe el nombre del producto"); return; }
                if (await guardarFavorito(modalFav.tipo, modalFav.nombre, modalFav.dosis, modalFav.retiro)) {
                  const i2 = modalFav.idx;
                  if (modalFav.tipo === "fum" && cap?.fums?.[i2] != null) { const fs = [...cap.fums]; fs[i2] = { ...fs[i2], producto: modalFav.nombre.trim(), dosis: modalFav.dosis }; setCap({ fums: fs }); }
                  if (modalFav.tipo === "med" && cap?.meds?.[i2] != null) { const ms = [...cap.meds]; ms[i2] = { ...ms[i2], producto: modalFav.nombre.trim(), dosis: modalFav.dosis, retiro: modalFav.retiro }; setCap({ meds: ms }); }
                  if (modalFav.tipo === "vit" && cap?.vits?.[i2] != null) { const vs = [...cap.vits]; vs[i2] = { ...vs[i2], producto: modalFav.nombre.trim(), dosis: modalFav.dosis }; setCap({ vits: vs }); }
                  setModalFav(null);
                }
              }} style={{ ...btnStyle, flex: 1, marginTop: 0 }}>✓ Agregar al menú</button>
              <button onClick={() => setModalFav(null)} style={{ flex: "0 0 auto", padding: "12px 16px", fontSize: 14, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {gestionFav && (
        <div onClick={() => setGestionFav(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,24,0.55)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 18, padding: "22px 20px", boxShadow: "0 10px 40px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: C.verde, marginBottom: 4 }}>
              🗑 Quitar del menú de {gestionFav === "fum" ? "fumigación" : gestionFav === "med" ? "medicamentos" : "vitaminas"}
            </div>
            <div style={{ fontSize: 12.5, color: C.textoSuave, marginBottom: 14 }}>Esto solo quita la opción del menú desplegable — no borra ningún registro ya guardado.</div>
            {favoritos.filter(f2 => f2.tipo === gestionFav).length === 0 && (
              <div style={{ fontSize: 13, color: C.textoSuave, padding: "10px 0" }}>Todavía no hay productos agregados a este menú.</div>
            )}
            {favoritos.filter(f2 => f2.tipo === gestionFav).map(f2 => (
              <div key={f2.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: `1px solid ${C.borde}` }}>
                <span style={{ fontSize: 13.5 }}><b>{f2.nombre}</b>{f2.dosis ? <span style={{ color: C.textoSuave }}> · {f2.dosis}</span> : null}</span>
                <span onClick={() => borrarFavorito(f2.id)} style={{ cursor: "pointer", color: C.alerta, fontSize: 18, padding: "0 6px", fontWeight: 700 }} title="Quitar del menú">×</span>
              </div>
            ))}
            <button onClick={() => setGestionFav(null)} style={{ ...btnStyle, marginTop: 16, background: "#F1F1EA", color: C.texto }}>Cerrar</button>
          </div>
        </div>
      )}

      <header style={{ background: C.verde, padding: "16px 16px 0", color: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <IconoGallina size={30} />
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 19 }}>Rancho El Soñado</div>
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.75 }}>{totalAves.toLocaleString()} aves · 4 gallineros · último registro: {ultDia.slice(0, 5)} · v{VERSION_APP}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => cargarTodo(false)} title="Actualizar" style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 10, color: "#fff", padding: "9px 12px", fontSize: 16, cursor: "pointer", opacity: cargandoFondo ? 0.5 : 1 }}>{cargandoFondo ? "…" : "⟳"}</button>
              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "6px 12px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: "#F5B845" }}>{posturaDia.toFixed(1)}%</div>
                <div style={{ fontSize: 10, opacity: 0.75 }}>postura</div>
              </div>
            </div>
          </div>
          <nav style={{ display: "flex", gap: 2, marginTop: 12, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            {tabs.filter(t2 => esAdmin || t2.id !== "cxp").map(t => (
              <button key={t.id} onClick={() => setVista(t.id)} style={{
                padding: "9px 14px", fontSize: 13.5, fontWeight: 600, border: "none", cursor: "pointer",
                borderRadius: "9px 9px 0 0", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap",
                background: vista === t.id ? C.fondo : "transparent",
                color: vista === t.id ? C.verde : "rgba(255,255,255,0.7)",
              }}>{t.nombre}</button>
            ))}
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 880, margin: "0 auto", padding: 16 }}>
        {guardado && <div style={{ background: guardado.startsWith("⚠") ? C.alertaSuave : C.verdeSuave, color: guardado.startsWith("⚠") ? C.alerta : C.verde, fontWeight: 600, fontSize: 14, padding: "10px 14px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{guardado}</div>}

        {/* ══ CONTROL DIARIO ══ */}
        {vista === "captura" && (
          <>
            <button onClick={() => setPrintDoc({ tipo: "controldiario", fecha: (fechaCaptura || new Date().toISOString().slice(0, 10)).split("-").reverse().join("/") })}
              style={{ marginBottom: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif", width: "100%" }}>
              🖨 Imprimir reporte diario ({(fechaCaptura || "").split("-").reverse().join("/") || "hoy"})
            </button>
          </>
        )}
        {vista === "captura" && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label style={{ display: "block", marginBottom: 12, flex: "1 1 40%", minWidth: 150 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha del registro</span>
                <input type="date" value={fechaCaptura} onChange={e => cambiarFechaCaptura(e.target.value)} style={inputStyle} />
              </label>
              <Campo mitad etiqueta="Completado por" type="text" placeholder="Nombre de quien captura" value={completadoPor} onChange={e => setCompletadoPor(e.target.value)} />
            </div>
            {fechaCaptura !== new Date().toISOString().slice(0, 10) && (
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#9A6605", background: C.yemaSuave, borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>
                📅 Estás capturando para el {fechaCaptura.split("-").reverse().join("/")} — si esa fecha ya tiene datos, se reemplazarán (edición).
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {activos.map(l => {
                const lleno = totalesGalpon(capturas[l.id]).huevos > 0;
                return (
                  <button key={l.id} onClick={() => setGalponActivo(l.id)} style={{
                    flex: 1, padding: "10px 4px", borderRadius: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif",
                    border: galponActivo === l.id ? `2px solid ${C.verde}` : `1.5px solid ${C.borde}`,
                    background: galponActivo === l.id ? C.verdeSuave : C.superficie,
                  }}>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: C.verde }}>G{l.galpon}{lleno ? " ✓" : ""}</div>
                    <div style={{ fontSize: 9.5, color: C.textoSuave }}>{semanasDe(l.nac).toFixed(0)} sem</div>
                  </button>
                );
              })}
            </div>
            {loteActivo && <div style={{ fontSize: 12.5, color: C.textoSuave, marginBottom: 10, marginTop: -6 }}>
              Gallinero {loteActivo.galpon} · {loteActivo.raza} · nacidas {loteActivo.nac.split("-").reverse().join("/")} · <b>{semanasDe(loteActivo.nac).toFixed(1)} semanas</b> · {loteActivo.aves.toLocaleString()} aves
            </div>}

            <Seccion accion={<BotonGuardaMini />} num="1" titulo="Producción por tiquete" sub="Número de tiquete, cartones y peso (kg)">
              {cap.tiquetes.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <input type="text" inputMode="numeric" placeholder={`Tiquete #`} value={t.num}
                    onChange={e => { const ts = [...cap.tiquetes]; ts[i] = { ...t, num: e.target.value }; setCap({ tiquetes: ts }); }}
                    style={{ ...inputStyle, flex: 0.8 }} />
                  <input type="text" inputMode="decimal" placeholder="Cartones" value={t.cartones}
                    onChange={e => { const ts = [...cap.tiquetes]; ts[i] = { ...t, cartones: e.target.value }; setCap({ tiquetes: ts }); }}
                    style={{ ...inputStyle, flex: 1 }} />
                  <input type="text" inputMode="decimal" placeholder="Peso kg" value={t.peso}
                    onChange={e => { const ts = [...cap.tiquetes]; ts[i] = { ...t, peso: e.target.value }; setCap({ tiquetes: ts }); }}
                    style={{ ...inputStyle, flex: 1 }} />
                </div>
              ))}
              <button onClick={() => setCap({ tiquetes: [...cap.tiquetes, { num: "", cartones: "", peso: "" }] })}
                style={{ background: C.verdeSuave, color: C.verde, border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                + Agregar tiquete
              </button>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.verde, marginTop: 10 }}>
                Total: {tGal.cartones} cartones = {tGal.huevos.toLocaleString()} huevos · {tGal.pesoKg.toFixed(1)} kg
              </div>
            </Seccion>

            <Seccion accion={<BotonGuardaMini />} num="2" titulo="Huevo quebrado">
              <Campo etiqueta="Cantidad de huevos quebrados" type="text" inputMode="numeric" placeholder="ej. 45" value={cap.quebrados} onChange={e => setCap({ quebrados: e.target.value })} />
            </Seccion>

            <Seccion accion={<BotonGuardaMini />} num="3" titulo="Gallinas muertas" sub="El saldo se calcula solo: saldo inicial − muertas = saldo final">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Campo mitad etiqueta="Cantidad de muertas" type="text" inputMode="numeric" placeholder="ej. 1" value={cap.muertas} onChange={e => setCap({ muertas: e.target.value })} />
                <Campo mitad etiqueta="Diagnóstico de muerte" type="text" placeholder="ej. prolapso" value={cap.dx} onChange={e => setCap({ dx: e.target.value })} />
              </div>
              <div style={{ fontSize: 14, display: "grid", gap: 6, background: C.fondo, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Saldo inicial de gallinas (día anterior)</span><b>{(loteActivo?.aves || 0).toLocaleString()}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", color: C.alerta }}><span>(−) Gallinas muertas hoy</span><b>{Number(cap.muertas || 0)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.borde}`, paddingTop: 6 }}><b>Saldo final de gallinas (=)</b><b style={{ color: C.verde }}>{((loteActivo?.aves || 0) - Number(cap.muertas || 0)).toLocaleString()}</b></div>
              </div>
            </Seccion>

            <Seccion accion={<BotonGuardaMini />} num="4" titulo="Fumigación diaria" sub="Elige el producto del inventario de Insumos — la dosis sugerida es editable">
              <datalist id="ins-desinf">{insumos.filter(x => ["Desinfección", "Protección Biológica", "Otros"].includes(x.categoria)).map(x => <option key={x.id} value={x.nombre} />)}{favoritos.filter(f2 => f2.tipo === "fum").map(f2 => <option key={"fv" + f2.id} value={f2.nombre} />)}</datalist>
              <datalist id="ins-meds">{insumos.filter(x => ["Medicinas", "Vacunas", "Otros"].includes(x.categoria)).map(x => <option key={x.id} value={x.nombre} />)}{favoritos.filter(f2 => f2.tipo === "med").map(f2 => <option key={"fv" + f2.id} value={f2.nombre} />)}</datalist>
              <datalist id="ins-vits">{insumos.filter(x => ["Vitaminas", "Otros"].includes(x.categoria)).map(x => <option key={x.id} value={x.nombre} />)}{favoritos.filter(f2 => f2.tipo === "vit").map(f2 => <option key={"fv" + f2.id} value={f2.nombre} />)}</datalist>
              {cap.fums.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input type="text" list="ins-desinf" placeholder="Producto" value={f.producto}
                    onChange={e => { const fs = [...cap.fums]; fs[i] = { ...f, producto: e.target.value, dosis: f.dosis || dosisSugerida(e.target.value, "fum") }; setCap({ fums: fs }); }}
                    style={{ ...inputStyle, flex: 1.2 }} />
                  <input type="text" placeholder="Dosis" value={f.dosis}
                    onChange={e => { const fs = [...cap.fums]; fs[i] = { ...f, dosis: e.target.value }; setCap({ fums: fs }); }}
                    style={{ ...inputStyle, flex: 1 }} />
                  <input type="time" value={f.hora}
                    onChange={e => { const fs = [...cap.fums]; fs[i] = { ...f, hora: e.target.value }; setCap({ fums: fs }); }}
                    style={{ ...inputStyle, flex: 0.9 }} />
                  {<button onClick={() => setModalFav({ tipo: "fum", idx: i, nombre: f.producto || "", dosis: f.dosis || "", retiro: "" })} title="Agregar producto nuevo al menú" style={{ padding: "0 10px", fontSize: 15, background: C.verdeSuave, color: C.verde, border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>➕</button>}
                  {<button onClick={() => setGestionFav("fum")} title="Quitar productos del menú" style={{ padding: "0 10px", fontSize: 14, background: "#F1F1EA", color: C.textoSuave, border: "none", borderRadius: 10, cursor: "pointer" }}>🗑</button>}
                  <button onClick={() => setCap({ fums: cap.fums.length > 1 ? cap.fums.filter((_, j) => j !== i) : [{ producto: "", dosis: "", hora: "" }] })} title="Quitar" style={{ padding: "0 11px", fontSize: 15, background: "#F1F1EA", color: C.textoSuave, border: "none", borderRadius: 10, cursor: "pointer" }}>×</button>
                </div>
              ))}
              <button onClick={() => setCap({ fums: [...cap.fums, { producto: "", dosis: "", hora: "" }] })}
                style={{ background: C.verdeSuave, color: C.verde, border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                + Agregar fumigación
              </button>
            </Seccion>

            <Seccion accion={<BotonGuardaMini />} num="5" titulo="Medicamentos" sub="Incluye la enfermedad a tratar y los días de retiro del huevo (si aplica)">
              {cap.meds.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input type="text" list="ins-meds" placeholder="Medicamento" value={m.producto}
                    onChange={e => { const ms = [...cap.meds]; ms[i] = { ...m, producto: e.target.value, dosis: m.dosis || dosisSugerida(e.target.value, "med"), retiro: m.retiro || retiroSugerido(e.target.value) }; setCap({ meds: ms }); }}
                    style={{ ...inputStyle, flex: 1.1 }} />
                  <input type="text" placeholder="Dosis" value={m.dosis}
                    onChange={e => { const ms = [...cap.meds]; ms[i] = { ...m, dosis: e.target.value }; setCap({ meds: ms }); }}
                    style={{ ...inputStyle, flex: 0.8 }} />
                  <input type="text" placeholder="Enfermedad / diagnóstico" value={m.enfermedad}
                    onChange={e => { const ms = [...cap.meds]; ms[i] = { ...m, enfermedad: e.target.value }; setCap({ meds: ms }); }}
                    style={{ ...inputStyle, flex: 1.2 }} />
                  <input type="text" inputMode="numeric" placeholder="Retiro (días)" title="Días de retiro del huevo" value={m.retiro}
                    onChange={e => { const ms = [...cap.meds]; ms[i] = { ...m, retiro: e.target.value }; setCap({ meds: ms }); }}
                    style={{ ...inputStyle, flex: 0.7 }} />
                  {<button onClick={() => setModalFav({ tipo: "med", idx: i, nombre: m.producto || "", dosis: m.dosis || "", retiro: "" })} title="Agregar producto nuevo al menú" style={{ padding: "0 10px", fontSize: 15, background: C.verdeSuave, color: C.verde, border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>➕</button>}
                  {<button onClick={() => setGestionFav("med")} title="Quitar productos del menú" style={{ padding: "0 10px", fontSize: 14, background: "#F1F1EA", color: C.textoSuave, border: "none", borderRadius: 10, cursor: "pointer" }}>🗑</button>}
                  <button onClick={() => setCap({ meds: cap.meds.length > 1 ? cap.meds.filter((_, j) => j !== i) : [{ producto: "", dosis: "", enfermedad: "", retiro: "" }] })} title="Quitar" style={{ padding: "0 11px", fontSize: 15, background: "#F1F1EA", color: C.textoSuave, border: "none", borderRadius: 10, cursor: "pointer" }}>×</button>
                </div>
              ))}
              <button onClick={() => setCap({ meds: [...cap.meds, { producto: "", dosis: "", enfermedad: "" }] })}
                style={{ background: C.verdeSuave, color: C.verde, border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                + Agregar medicamento
              </button>
            </Seccion>

            <Seccion accion={<BotonGuardaMini />} num="6" titulo="Vitaminas" sub="Pueden ser varias">
              {cap.vits.map((v, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input type="text" list="ins-vits" placeholder="Vitamina / suplemento" value={v.producto}
                    onChange={e => { const vs = [...cap.vits]; vs[i] = { ...v, producto: e.target.value, dosis: v.dosis || dosisSugerida(e.target.value, "vit") }; setCap({ vits: vs }); }}
                    style={{ ...inputStyle, flex: 1.3 }} />
                  <input type="text" placeholder="Dosis" value={v.dosis}
                    onChange={e => { const vs = [...cap.vits]; vs[i] = { ...v, dosis: e.target.value }; setCap({ vits: vs }); }}
                    style={{ ...inputStyle, flex: 1 }} />
                  {<button onClick={() => setModalFav({ tipo: "vit", idx: i, nombre: v.producto || "", dosis: v.dosis || "", retiro: "" })} title="Agregar producto nuevo al menú" style={{ padding: "0 10px", fontSize: 15, background: C.verdeSuave, color: C.verde, border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>➕</button>}
                  {<button onClick={() => setGestionFav("vit")} title="Quitar productos del menú" style={{ padding: "0 10px", fontSize: 14, background: "#F1F1EA", color: C.textoSuave, border: "none", borderRadius: 10, cursor: "pointer" }}>🗑</button>}
                  <button onClick={() => setCap({ vits: cap.vits.length > 1 ? cap.vits.filter((_, j) => j !== i) : [{ producto: "", dosis: "" }] })} title="Quitar" style={{ padding: "0 11px", fontSize: 15, background: "#F1F1EA", color: C.textoSuave, border: "none", borderRadius: 10, cursor: "pointer" }}>×</button>
                </div>
              ))}
              <button onClick={() => setCap({ vits: [...cap.vits, { producto: "", dosis: "" }] })}
                style={{ background: C.verdeSuave, color: C.verde, border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                + Agregar vitamina
              </button>
            </Seccion>

            <Seccion accion={<BotonGuardaMini />} num="7" titulo="Consumo de alimento" sub={`Fórmula: ${loteActivo?.formula || ""}${loteActivo?.racionGAve ? ` · ración definida: ${loteActivo.racionGAve} g/ave/día (40% a las 6 am, 60% a la 1 pm)` : ""}`}>
              {(() => {
                const espDia = loteActivo?.racionGAve && loteActivo?.aves ? (loteActivo.racionGAve * loteActivo.aves) / 1000 : 0;
                const esp6 = espDia * 0.4, esp1 = espDia * 0.6;
                const real = Number(cap.alimento6am || 0) + Number(cap.alimento1pm || 0);
                const desv = espDia > 0 && real > 0 ? ((real - espDia) / espDia) * 100 : null;
                const gAveReal = loteActivo?.aves && real > 0 ? (real * 1000) / loteActivo.aves : 0;
                return (
                  <>
                    <label style={{ display: "block", marginBottom: 12 }}>
                      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>⚡ Consumo total del día (kg) — al salir de la casilla reparte solo: 40% a las 6 am, 60% a la 1 pm (editables)</span>
                      <input type="text" inputMode="decimal" placeholder="ej. 240 → llena 96 y 144" style={inputStyle}
                        onBlur={e => {
                          const tot = parseFloat(String(e.target.value).replace(",", "."));
                          if (!isNaN(tot) && tot > 0) { setCap({ alimento6am: String(+(tot * 0.4).toFixed(1)), alimento1pm: String(+(tot * 0.6).toFixed(1)) }); e.target.value = ""; }
                        }} />
                    </label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Campo mitad etiqueta={`Toma 6:00 am — servido real (kg)${esp6 ? ` · esperado ${esp6.toFixed(1)}` : ""}`} type="text" inputMode="decimal" placeholder={esp6 ? esp6.toFixed(1) : "kg"} value={cap.alimento6am} onChange={e => setCap({ alimento6am: e.target.value })} />
                      <Campo mitad etiqueta={`Toma 1:00 pm — servido real (kg)${esp1 ? ` · esperado ${esp1.toFixed(1)}` : ""}`} type="text" inputMode="decimal" placeholder={esp1 ? esp1.toFixed(1) : "kg"} value={cap.alimento1pm} onChange={e => setCap({ alimento1pm: e.target.value })} />
                    </div>
                    <Campo etiqueta="Observaciones del consumo" type="text" placeholder="ej. dejaron alimento en comederos, cambio de fórmula, calor fuerte…" value={cap.obsAlimento} onChange={e => setCap({ obsAlimento: e.target.value })} />
                    <div style={{ fontSize: 13.5, display: "grid", gap: 5, background: C.fondo, borderRadius: 10, padding: "10px 12px" }}>
                      {espDia > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Esperado del día</span><b>{espDia.toFixed(1)} kg · {loteActivo.racionGAve} g/ave</b></div>}
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Servido real</span><b>{real.toFixed(1)} kg{gAveReal ? ` · ${gAveReal.toFixed(0)} g/ave` : ""}</b></div>
                      {desv != null && <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.borde}`, paddingTop: 5, color: Math.abs(desv) > 5 ? C.alerta : C.verde }}>
                        <b>Diferencia vs ración</b><b>{desv > 0 ? "+" : ""}{desv.toFixed(1)}%{Math.abs(desv) > 5 ? " ⚠" : " ✓"}</b>
                      </div>}
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <Campo etiqueta="Consumo de agua del día (litros) — indicador temprano de salud" type="text" inputMode="decimal" placeholder="ej. 480" value={cap.aguaL} onChange={e => setCap({ aguaL: e.target.value })} />
                    </div>
                  </>
                );
              })()}
            </Seccion>

            <Seccion accion={<BotonGuardaMini />} num="8" titulo="Trabajos diarios" sub="Marca lo realizado en este gallinero">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "2px 16px" }}>
                {TRABAJOS.map((tr, i) => (
                  <label key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!cap.trabajos[i]} onChange={() => setCap({ trabajos: { ...cap.trabajos, [i]: !cap.trabajos[i] } })} style={{ width: 19, height: 19, accentColor: C.verde }} />
                    <span style={{ fontSize: 13.5, textDecoration: cap.trabajos[i] ? "line-through" : "none", color: cap.trabajos[i] ? C.textoSuave : C.texto }}>{tr}</span>
                  </label>
                ))}
              </div>
            </Seccion>

            <Seccion accion={<BotonGuardaMini />} num="9" titulo="Chequeo sanitario y ambiente" sub="Observación diaria del galpón — 2 minutos que detectan problemas antes que los números">
              {(() => {
                const ch = cap.chequeo || {};
                const setCh = (campo, v) => setCap({ chequeo: { ...ch, [campo]: v } });
                const Sel = ({ campo, etiqueta, ops }) => (
                  <label style={{ display: "block", marginBottom: 10, flex: "1 1 45%", minWidth: 130 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>{etiqueta}</span>
                    <select value={ch[campo] || ""} onChange={e => setCh(campo, e.target.value)} style={inputStyle}>
                      <option value="">— sin revisar —</option>
                      {ops.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                );
                return (
                  <>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Sel campo="cascara" etiqueta="Calidad de cáscara" ops={["Buena", "Regular", "Mala (frágil)"]} />
                      <Sel campo="cresta" etiqueta="Color de cresta" ops={["Roja intensa", "Pálida", "Morada/oscura"]} />
                      <Sel campo="consumoObs" etiqueta="Consumo alimento observado" ops={["Normal", "Bajo", "Seleccionan / botan"]} />
                      <Sel campo="aguaObs" etiqueta="Consumo agua observado" ops={["Normal", "Bajo", "Alto"]} />
                      <Sel campo="heces" etiqueta="Consistencia de heces" ops={["Normal", "Diarrea", "Con sangre"]} />
                      <Sel campo="respiratorio" etiqueta="Sonidos respiratorios" ops={["No", "Sí"]} />
                      <Sel campo="secrecion" etiqueta="Secreción nasal" ops={["No", "Sí"]} />
                      <Sel campo="comederos" etiqueta="Uniformidad de comederos" ops={["Buena", "Mala"]} />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Campo tercio etiqueta="pH del agua" type="text" inputMode="decimal" placeholder="ej. 6.5" value={ch.ph || ""} onChange={e => setCh("ph", e.target.value)} />
                      <Campo tercio etiqueta="Cloro (ppm)" type="text" placeholder="ej. 0.08" value={ch.cloro || ""} onChange={e => setCh("cloro", e.target.value)} />
                      <Campo tercio etiqueta="Temperatura °C" type="text" inputMode="decimal" placeholder="27–29" value={ch.temp || ""} onChange={e => setCh("temp", e.target.value)} />
                      <Campo tercio etiqueta="Humedad %" type="text" inputMode="numeric" placeholder="50–70" value={ch.humedad || ""} onChange={e => setCh("humedad", e.target.value)} />
                      <Campo tercio etiqueta="Horas de luz" type="text" inputMode="decimal" placeholder="16" value={ch.luz || ""} onChange={e => setCh("luz", e.target.value)} />
                    </div>
                    <Campo etiqueta="Observaciones del chequeo" type="text" placeholder="ej. tolvas llenas al fondo, poca actividad" value={ch.obs || ""} onChange={e => setCh("obs", e.target.value)} />
                    <button onClick={() => setPrintDoc({ tipo: "medidas", lote: galponActivo })} style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>🖨 Imprimir boleta de medidas de producción</button>
                  </>
                );
              })()}
            </Seccion>

            <Seccion titulo="Bitácora de novedades" sub="UNA sola para toda la granja — compartida entre los 3 galpones y guardada con cualquier botón Guardar">
              <textarea value={notaDia} onChange={e => { notaSuciaRef.current = true; setNotaDia(e.target.value); }} placeholder="ej. Se detectó gotera en G2, llegó pedido de maíz..." rows={3}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "'Inter', sans-serif" }} />
            </Seccion>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => guardarDia(loteActivo?.id)} disabled={guardando} style={{ ...btnStyle, flex: 1, background: C.verdeSuave, color: C.verde }}>{guardando ? "Guardando…" : `💾 Guardar solo Gallinero ${loteActivo?.galpon || ""}`}</button>
              <button onClick={() => guardarDia()} disabled={guardando} style={{ ...btnStyle, flex: 1.4 }}>{guardando ? "Guardando…" : "Guardar control diario completo"}</button>
            </div>
            <div style={{ fontSize: 12, color: C.textoSuave, textAlign: "center", marginTop: 8 }}>
              Guarda los 4 gallineros de una vez. El huevo pasa a Bodega y el consumo descuenta de Planta.
            </div>
          </>
        )}

        {/* ══ REPORTE ══ */}
        {vista === "reporte" && (
          <button onClick={() => setPrintDoc({ tipo: "reporte" })} style={{ marginBottom: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif", width: "100%" }}>🖨 Imprimir reporte gerencial</button>
        )}
        {vista === "reporte" && dHoy && (() => {
          const Delta = ({ hoy, contra, invertir, unidad = "", dec = 1 }) => {
            if (contra == null || !isFinite(contra)) return <span style={{ color: C.textoSuave }}>—</span>;
            const d = hoy - contra;
            const mejora = invertir ? d < 0 : d > 0;
            const igual = Math.abs(d) < 0.05;
            const color = igual ? C.textoSuave : mejora ? C.verde : C.alerta;
            return <span style={{ color, fontWeight: 600 }}>{igual ? "=" : `${d > 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(dec)}${unidad}`}</span>;
          };
          const filas = [
            { n: "Producción", v: `${dHoy.cartones.toFixed(1)} cart`, a: dAyer?.cartones, m: promMes?.cartones, hoy: dHoy.cartones, u: "" },
            { n: "% Postura", v: `${dHoy.postura.toFixed(1)}%`, a: dAyer?.postura, m: promMes?.postura, hoy: dHoy.postura, u: " pts" },
            { n: "Consumo", v: `${dHoy.consumo.toFixed(0)} g/ave`, a: dAyer?.consumo, m: promMes?.consumo, hoy: dHoy.consumo, u: " g", inv: true, dec: 0 },
            { n: "Conversión", v: dHoy.conv ? dHoy.conv.toFixed(2) : "—", a: dAyer?.conv, m: promMes?.conv, hoy: dHoy.conv, u: "", inv: true, dec: 2 },
            { n: "Mortalidad", v: `${dHoy.muertas} aves`, a: dAyer?.muertas, m: promMes?.muertas, hoy: dHoy.muertas, u: "", inv: true, dec: 0 },
            { n: "% Quebrado", v: `${dHoy.pctQueb.toFixed(1)}%`, a: dAyer?.pctQueb, m: promMes?.pctQueb, hoy: dHoy.pctQueb, u: " pts", inv: true },
            { n: "Peso huevo", v: dHoy.pesoH ? `${dHoy.pesoH.toFixed(1)} g` : "—", a: dAyer?.pesoH, m: promMes?.pesoH, hoy: dHoy.pesoH, u: " g" },
          ];
          const brechaGen = metaGenetica - dHoy.postura;
          const notasHoy = bitacora.filter(b => b.fecha === fHoy);
          return (
            <>
              <div style={{ background: C.verde, color: "#fff", borderRadius: 16, padding: 18, marginBottom: 14 }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>Reporte del día · {fHoy}</div>
                <div style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.6, opacity: 0.95 }}>
                  Se produjeron <b>{dHoy.cartones.toFixed(1)} cartones</b> con postura de <b>{dHoy.postura.toFixed(1)}%</b>
                  {dAyer && <> ({dHoy.postura >= dAyer.postura ? "▲" : "▼"} {Math.abs(dHoy.postura - dAyer.postura).toFixed(1)} pts vs ayer)</>},
                  a <b style={{ color: "#F5B845" }}>{brechaGen.toFixed(1)} pts</b> de la meta genética ({metaGenetica.toFixed(1)}%).
                  Mortalidad: <b>{dHoy.muertas}</b>. Quebrado: <b>{dHoy.pctQueb.toFixed(1)}%</b>. Concentrado en planta: <b>{saldoPlanta.toFixed(0)} kg</b>.
                </div>
              </div>

              <Seccion titulo="Comparativo" sub={`Hoy vs ayer${promMes ? ` y vs promedio de ${nombreMesAnt} (${promMes.dias} días)` : " · el mes anterior se activa al acumular datos"}`}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                    <thead>
                      <tr style={{ color: C.textoSuave, textAlign: "right", fontSize: 12 }}>
                        <th style={{ textAlign: "left", padding: "6px 4px" }}>Indicador</th>
                        <th style={{ padding: "6px 4px" }}>Hoy</th>
                        <th style={{ padding: "6px 4px" }}>vs ayer</th>
                        <th style={{ padding: "6px 4px" }}>vs {nombreMesAnt || "mes ant."}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${C.borde}`, textAlign: "right" }}>
                          <td style={{ textAlign: "left", padding: "9px 4px", fontWeight: 600 }}>{f.n}</td>
                          <td style={{ padding: "9px 4px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>{f.v}</td>
                          <td style={{ padding: "9px 4px" }}><Delta hoy={f.hoy} contra={f.a} invertir={f.inv} unidad={f.u} dec={f.dec ?? 1} /></td>
                          <td style={{ padding: "9px 4px" }}><Delta hoy={f.hoy} contra={f.m} invertir={f.inv} unidad={f.u} dec={f.dec ?? 1} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Seccion>

              <Seccion titulo="vs Genética — por gallinero" sub="Postura del día contra la tabla de la casa genética">
                {activos.map(l => {
                  const r = registros.find(x => x.fecha === fHoy && x.lote === l.id);
                  const p = r ? (r.cartones * HXC / l.aves) * 100 : null;
                  return (
                    <div key={l.id} style={{ padding: "8px 0", borderBottom: `1px solid ${C.borde}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: p != null ? 0 : 4 }}>
                        <b>Gallinero {l.galpon} · {l.raza} ({semanasDe(l.nac).toFixed(0)} sem){l.estadoProd && l.estadoProd !== "Producción normal" ? <span style={{ color: "#9A6605", fontWeight: 700 }}> · {l.estadoProd}</span> : null}</b>
                        {p == null && <span style={{ color: C.textoSuave }}>sin registro hoy</span>}
                      </div>
                      {p != null && <BarraPostura actual={p} meta={l.posturaIdeal} />}
                    </div>
                  );
                })}
              </Seccion>

              <Seccion titulo="⚖️ Peso corporal vs tabla genética" sub="Tu medida crítica — del último pesaje de cada gallinero">
                {activos.map(l => {
                  const pes = pesajes.find(p2 => p2.lote === l.id);
                  if (!pes || !pes.pesos?.length) return (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${C.borde}`, fontSize: 13.5 }}>
                      <b>Gallinero {l.galpon}</b><span style={{ color: C.textoSuave }}>sin pesaje registrado</span>
                    </div>
                  );
                  const prom = pes.pesos.reduce((a, b) => a + b, 0) / pes.pesos.length;
                  const meta = Number(l.pesoMeta) || Number(pes.meta) || 0;
                  const brechaG = meta ? prom - meta : null;
                  const brechaP = meta ? (brechaG / meta) * 100 : null;
                  const color = brechaP == null ? C.textoSuave : brechaP <= -10 ? C.alerta : brechaP <= -4 ? "#9A6605" : brechaP >= 8 ? "#9A6605" : C.verde;
                  const [pd2, pm2, py2] = pes.fecha.split("/").map(Number);
                  const dias = Math.round((new Date() - new Date(py2, pm2 - 1, pd2)) / 86400000);
                  return (
                    <div key={l.id} style={{ padding: "9px 0", borderBottom: `1px solid ${C.borde}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, flexWrap: "wrap", gap: 4 }}>
                        <b>Gallinero {l.galpon} · {l.raza}</b>
                        <span style={{ fontSize: 12, color: C.textoSuave }}>pesaje {pes.fecha.slice(0, 5)} · {pes.pesos.length} aves{dias > 21 ? " ⚠ viejo" : ""}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 3 }}>
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>{prom.toFixed(0)} g</span>
                        {meta > 0
                          ? <b style={{ color, fontSize: 13.5 }}>{brechaG >= 0 ? "+" : ""}{brechaG.toFixed(0)} g vs tabla ({brechaP >= 0 ? "+" : ""}{brechaP.toFixed(1)}%) · meta {meta} g</b>
                          : <span style={{ fontSize: 12.5, color: C.textoSuave }}>define el peso meta en Lotes para comparar</span>}
                      </div>
                    </div>
                  );
                })}
              </Seccion>

              <Seccion titulo="Para decidir hoy" sub={decisiones.length ? "Generado automáticamente con los datos del día" : ""}>
                {decisiones.length === 0 && <div style={{ fontSize: 14, color: C.verde, fontWeight: 500 }}>✓ Sin alertas — el día se comportó dentro de los rangos esperados.</div>}
                {decisiones.map((d, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "10px 12px", background: d.nivel === "rojo" ? C.alertaSuave : C.yemaSuave, borderRadius: 10, marginBottom: 8, fontSize: 13.5, lineHeight: 1.5 }}>
                    <span>{d.nivel === "rojo" ? "🔴" : "🟡"}</span>
                    <span>{d.texto}</span>
                  </div>
                ))}
              </Seccion>

              {notasHoy.length > 0 && (
                <Seccion titulo="Bitácora del día">
                  {notasHoy.map((n, i) => (
                    <div key={i} style={{ fontSize: 13.5, padding: "9px 12px", background: C.fondo, borderRadius: 10, marginBottom: 6, lineHeight: 1.5 }}>
                      {n.texto}{n.por && <span style={{ color: C.textoSuave }}> — {n.por}</span>}
                    </div>
                  ))}
                </Seccion>
              )}
            </>
          );
        })()}
        {vista === "reporte" && !dHoy && (
          <Seccion titulo="Reporte del día">
            <div style={{ fontSize: 14, color: C.textoSuave }}>Aún no hay registros. Captura el control diario y el reporte se genera solo.</div>
          </Seccion>
        )}

        {/* ══ BODEGA ══ */}
        {vista === "bodega" && (
          <>
            {retirosActivos.length > 0 && (
              <div style={{ background: C.alertaSuave, border: `1px solid #EBC0B5`, borderRadius: 14, padding: "12px 15px", marginBottom: 12, fontSize: 13.5, lineHeight: 1.5 }}>
                <b>🔴 Retiro de medicamento activo:</b> {retirosActivos.map(m => `G${m.galpon} (${m.producto}) hasta ${m.retiroHasta}`).join(" · ")}. No comercializar huevo de esos gallineros.
              </div>
            )}
            <button onClick={() => setPrintDoc({ tipo: "bodega" })} style={{ marginBottom: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif", width: "100%" }}>🖨 Imprimir movimiento de bodega</button>
            <label style={{ display: "block", marginBottom: 10 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha del movimiento de bodega</span>
              <input type="date" value={fechaBodega} onChange={e => cambiarFechaBodega(e.target.value)} style={inputStyle} />
            </label>
            {fechaBodega !== new Date().toISOString().slice(0, 10) && (
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#9A6605", background: C.yemaSuave, borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>
                📅 Estás en la bodega del {fechaB} — al guardar se {bodegaMovs.some(m => m.fecha === fechaB) ? "editará ese día y se recalcularán los saldos siguientes" : "creará ese día y se recalculará la cadena de saldos"}.
              </div>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <KPI etiqueta="Saldo inicial" valor={saldoBase.toFixed(1)} unidad="cart" sub={`Al abrir el ${fechaB.slice(0, 5)}`} />
              <KPI etiqueta="Entradas (+)" valor={(producidoHoyCart + Number(movBodega.comprado || 0)).toFixed(1)} unidad="cart" tono="ok" sub={`Producido ${producidoHoyCart.toFixed(1)}${Number(movBodega.comprado || 0) > 0 ? ` + comprado ${Number(movBodega.comprado).toFixed(1)}` : ""}`} />
              <KPI etiqueta="Salidas (−)" valor={(rutaNeta + Number(movBodega.vendGranja || 0) + Number(movBodega.destruido || 0) + Number(movBodega.regalado || 0)).toFixed(1)} unidad="cart" tono={rutaNeta > 0 ? "alerta" : undefined} sub={`Ruta neta ${rutaNeta.toFixed(1)}${(Number(movBodega.vendGranja || 0) + Number(movBodega.destruido || 0) + Number(movBodega.regalado || 0)) > 0 ? ` + otras ${(Number(movBodega.vendGranja || 0) + Number(movBodega.destruido || 0) + Number(movBodega.regalado || 0)).toFixed(1)}` : ""}`} />
              <KPI etiqueta="Saldo proyectado" valor={saldoFinal.toFixed(1)} unidad="cart" sub={hayAjuste ? "Fijado por conteo físico" : "= inicial + entradas − salidas"} />
            </div>

            <Seccion num="1" titulo="Huevo producido por gallinero" sub={`Automático desde el Control diario del ${fechaB}`}>
              {producidoPorGalpon.map(g => (
                <div key={g.galpon} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${C.borde}`, fontSize: 14 }}>
                  <span><b>Gallinero {g.galpon}</b> <span style={{ color: C.textoSuave, fontSize: 12 }}>· {g.raza}</span></span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: g.cartones > 0 ? C.verde : C.textoSuave }}>
                    {g.cartones > 0 ? `${g.cartones.toFixed(1)} cart` : "sin registro"}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 14.5 }}>
                <b>Total granja</b>
                <b style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.verde }}>{producidoHoyCart.toFixed(1)} cartones</b>
              </div>
            </Seccion>

            <Seccion num="2" titulo="Salida a ruta por repartidor" sub="Salida menos devoluciones = salida neta de ruta">
              {repartos.map((r, i) => {
                const neto = Number(r.salida || 0) - Number(r.devBueno || 0) - Number(r.devMalo || 0);
                return (
                  <div key={i} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: i === 0 ? `1px solid ${C.borde}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <input type="text" value={r.nombre} placeholder="Nombre del repartidor"
                        onChange={e => {
                          const rs = [...repartos]; rs[i] = { ...r, nombre: e.target.value }; setRepartos(rs);
                          guardarCfgBodega({ ...bodegaCfg, repartidores: rs.map(x => x.nombre) });
                        }}
                        style={{ ...inputStyle, flex: 1, padding: "8px 10px", fontSize: 14, fontWeight: 700 }} />
                      <span style={{ color: C.verde, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>neto {neto.toFixed(1)}</span>
                      <button onClick={() => {
                        const rs = repartos.filter((_, j) => j !== i); setRepartos(rs);
                        guardarCfgBodega({ ...bodegaCfg, repartidores: rs.map(x => x.nombre) });
                      }} style={{ padding: "5px 9px", fontSize: 12, background: "transparent", color: C.textoSuave, border: `1px solid ${C.borde}`, borderRadius: 7, cursor: "pointer" }}>×</button>
                    </div>
                    {(() => {
                      // Buscar cada número de tiquete en la producción registrada (Control diario)
                      const nums = String(r.tiq || "").trim().split(/[\s,;]+/).filter(Boolean);
                      const buscarTiquete = (num) => {
                        for (const reg of registros) {
                          const t = (reg.tiquetes || []).find(x => String(x.num).trim() === num);
                          if (t) { const l2 = lotes.find(x => x.id === reg.lote); return { cartones: Number(t.cartones || 0), peso: Number(t.peso || 0), fecha: reg.fecha, galpon: l2?.galpon }; }
                        }
                        return null;
                      };
                      const yaSalio = (num) => bodegaMovs.some(mv => (mv.repartos || []).some(rp => (rp.tiquetesDet || []).some(td => String(td.num) === num)));
                      const det = nums.map(num => { const info = buscarTiquete(num); return { num, ...info, hallado: !!info, repetido: info && yaSalio(num) }; });
                      const hallados = det.filter(d => d.hallado);
                      const totalCart = hallados.reduce((a, d) => a + d.cartones, 0);
                      const totalKg = hallados.reduce((a, d) => a + d.peso, 0);
                      return (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: C.textoSuave, marginBottom: 3 }}>
                            Tiquetes que se lleva — NÚMEROS separados por espacio: el sistema busca cada tiquete y suma sus cartones
                          </span>
                          <input type="text" placeholder="ej. 4521 4522 4530" value={r.tiq || ""}
                            onChange={e => {
                              const crudo = e.target.value;
                              const ns2 = crudo.trim().split(/[\s,;]+/).filter(Boolean);
                              const dets = ns2.map(num => { const info = buscarTiquete(num); return info ? { num, cartones: info.cartones, peso: info.peso } : null; }).filter(Boolean);
                              const tot = dets.reduce((a, d) => a + d.cartones, 0);
                              const rs = [...repartos];
                              rs[i] = { ...r, tiq: crudo, tiquetesDet: dets, ...(dets.length ? { salida: String(+tot.toFixed(1)) } : {}) };
                              setRepartos(rs);
                            }}
                            style={{ ...inputStyle, marginBottom: 4, padding: "8px 10px", fontSize: 13.5, background: hallados.length ? C.verdeSuave : C.superficie }} />
                          {det.length > 0 && (
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                              {det.map((d, j) => (
                                <span key={j} style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 10,
                                  background: !d.hallado ? "#FBEAE6" : d.repetido ? C.yemaSuave : C.verdeSuave,
                                  color: !d.hallado ? C.alerta : d.repetido ? "#9A6605" : C.verde }}>
                                  #{d.num}{d.hallado ? `: ${d.cartones} cart` + (d.peso ? ` · ${d.peso.toFixed(1)} kg` : "") + ` (G${d.galpon} ${String(d.fecha).slice(0, 5)})` : ": no existe en producción"}{d.repetido ? " ⚠ ya salió antes" : ""}
                                </span>
                              ))}
                              {hallados.length > 0 && (
                                <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: C.verde, color: "#fff" }}>
                                  Σ {hallados.length} tiq · {totalCart.toFixed(1)} cart{totalKg > 0 ? ` · ${totalKg.toFixed(1)} kg` : ""} → Salida
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="text" inputMode="decimal" placeholder="Salida" value={r.salida} onChange={e => { const rs = [...repartos]; rs[i] = { ...r, salida: e.target.value }; setRepartos(rs); }} style={{ ...inputStyle, flex: 1 }} />
                      <input type="text" inputMode="decimal" placeholder="Dev. bueno" value={r.devBueno} onChange={e => { const rs = [...repartos]; rs[i] = { ...r, devBueno: e.target.value }; setRepartos(rs); }} style={{ ...inputStyle, flex: 1 }} />
                      <input type="text" inputMode="decimal" placeholder="Dev. malo" value={r.devMalo} onChange={e => { const rs = [...repartos]; rs[i] = { ...r, devMalo: e.target.value }; setRepartos(rs); }} style={{ ...inputStyle, flex: 1 }} />
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setRepartos([...repartos, { nombre: "", tiq: "", tiquetesDet: [], salida: "", devBueno: "", devMalo: "" }])}
                style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>+ Agregar repartidor</button>
            </Seccion>

            <Seccion num="3" titulo="Otros movimientos del día" sub="Solo si aplica — en cartones">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Campo mitad etiqueta="Huevo comprado (+)" type="text" inputMode="decimal" placeholder="0" value={movBodega.comprado} onChange={e => setMovBodega({ ...movBodega, comprado: e.target.value })} />
                <Campo mitad etiqueta="Vendido en granja (−)" type="text" inputMode="decimal" placeholder="0" value={movBodega.vendGranja} onChange={e => setMovBodega({ ...movBodega, vendGranja: e.target.value })} />
                <Campo mitad etiqueta="Destruido/quebrado en bodega (−)" type="text" inputMode="decimal" placeholder="0" value={movBodega.destruido} onChange={e => setMovBodega({ ...movBodega, destruido: e.target.value })} />
                <Campo mitad etiqueta="Regalado / salida gratis (−)" type="text" inputMode="decimal" placeholder="0" value={movBodega.regalado} onChange={e => setMovBodega({ ...movBodega, regalado: e.target.value })} />
              </div>
            </Seccion>

            <Seccion num="4" titulo="Cierre del día" sub="Revisa el movimiento completo, ajusta si contaste, y guarda">
              <div style={{ fontSize: 14, marginBottom: 12, display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Saldo inicial del día (=)</span><b>{saldoBase.toFixed(1)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", color: C.verde }}><span>Huevo producido (+)</span><b>{producidoHoyCart.toFixed(1)}</b></div>
                {Number(movBodega.comprado || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: C.verde }}><span>Comprado (+)</span><b>{Number(movBodega.comprado).toFixed(1)}</b></div>}
                <div style={{ display: "flex", justifyContent: "space-between", color: C.alerta }}><span>Salida neta a ruta (−)</span><b>{rutaNeta.toFixed(1)}</b></div>
                {Number(movBodega.vendGranja || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: C.alerta }}><span>Vendido en granja (−)</span><b>{Number(movBodega.vendGranja).toFixed(1)}</b></div>}
                {Number(movBodega.destruido || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: C.alerta }}><span>Destruido (−)</span><b>{Number(movBodega.destruido).toFixed(1)}</b></div>}
                {Number(movBodega.regalado || 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: C.alerta }}><span>Regalado (−)</span><b>{Number(movBodega.regalado).toFixed(1)}</b></div>}
              </div>
              <Campo etiqueta={`Ajuste / conteo físico — cartones reales (calculado: ${saldoCalculado.toFixed(1)})`} type="text" inputMode="decimal" placeholder="Déjalo vacío si no contaste hoy" value={ajusteBodega} onChange={e => setAjusteBodega(e.target.value)} />
              {hayAjuste && <div style={{ fontSize: 12.5, color: difAjuste === 0 ? C.verde : "#9A6605", marginTop: -6, marginBottom: 10 }}>
                {difAjuste === 0 ? "✓ El conteo coincide con lo calculado" : `El saldo se fijará en ${Number(ajusteBodega)} cartones — diferencia de ${difAjuste > 0 ? "+" : ""}${difAjuste} vs lo calculado (quedará registrada)`}
              </div>}
              <Campo etiqueta="Observaciones del día" type="text" placeholder="Opcional" value={obsInv} onChange={e => setObsInv(e.target.value)} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "10px 12px", background: C.yemaSuave, borderRadius: 10, marginBottom: 12 }}>
                <b>Saldo final en bodega (=)</b><b style={{ color: C.verde }}>{saldoFinal.toFixed(1)} cartones</b>
              </div>
              <button onClick={guardarBodega} disabled={guardando} style={btnStyle}>{guardando ? "Guardando…" : "Guardar movimiento del día"}</button>
              <div style={{ fontSize: 12, color: C.textoSuave, textAlign: "center", marginTop: 8 }}>Si guardas otra vez hoy, se actualiza (no se duplica)</div>
            </Seccion>

            <Seccion titulo="Apertura de bodega — saldo inicial" sub="El punto de arranque oficial: desde esta fecha corren los balances; lo anterior queda como histórico sin afectar">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Campo mitad etiqueta="Cartones iniciales" type="text" inputMode="decimal" placeholder="ej. 1470" value={bodegaCfg.inicialCart}
                  onChange={e => guardarCfgBodega({ ...bodegaCfg, inicialCart: e.target.value })} />
                <label style={{ display: "block", marginBottom: 12, flex: "1 1 45%", minWidth: 140 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha de apertura</span>
                  <input type="date" value={bodegaCfg.inicialFecha || ""} onChange={e => guardarCfgBodega({ ...bodegaCfg, inicialFecha: e.target.value })} style={inputStyle} />
                </label>
              </div>
              {bodegaCfg.inicialFecha && <div style={{ fontSize: 12.5, color: C.verde, fontWeight: 600 }}>✓ La bodega abre el {bodegaCfg.inicialFecha.split("-").reverse().join("/")} con {bodegaCfg.inicialCart || 0} cartones.</div>}
            </Seccion>

            {bodegaMovs.length > 0 && (
              <Seccion titulo="Historial de bodega">
                {bodegaMovs.slice(0, 10).map((m, i) => (
                  <div key={i} style={{ fontSize: 13, padding: "9px 12px", background: C.fondo, borderRadius: 10, marginBottom: 6, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                    <span><b>{m.fecha.slice(0, 5)}</b> · +{m.producido} prod · −{(m.rutaNeta || 0).toFixed(1)} ruta</span>
                    <b style={{ color: C.verde }}>= {m.saldoFinal} cart{m.ajusteConteo != null && <span style={{ color: "#9A6605", fontWeight: 600 }}> (conteo{m.difAjuste ? ` ${m.difAjuste > 0 ? "+" : ""}${m.difAjuste}` : ""})</span>}</b>
                  </div>
                ))}
              </Seccion>
            )}
          </>
        )}

        {/* ══ PLANTA DE CONCENTRADO ══ */}
        {vista === "planta" && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <KPI etiqueta="Concentrado AVES" valor={saldoAves.toFixed(0)} unidad="kg" tono={saldoAves < entregadoHoyKg * 2 && entregadoHoyKg > 0 ? "alerta" : "ok"} sub={`${(saldoAves / 1000).toFixed(2)} ton`} />
              <KPI etiqueta="Concentrado GANADO" valor={saldoGanado.toFixed(0)} unidad="kg" tono={saldoGanado < 0 ? "alerta" : "ok"} sub={`${(saldoGanado / 1000).toFixed(2)} ton`} />
              <KPI etiqueta="Producido hoy" valor={producidoPlantaHoy.toFixed(0)} unidad="kg" sub={`${plantaHoy.filter(m => m.tipo === "bache").reduce((s, m) => s + Number(m.baches || 0), 0)} baches`} />
            </div>
            <div style={{ fontSize: 12, color: C.textoSuave, marginBottom: 12, padding: "0 2px" }}>
              Esquema por categoría: inventario inicial + baches producidos − servido (aves automático del Control diario · ganado se digita aquí) ± ajustes = inventario final.
            </div>

            <Seccion titulo="A. Registrar baches producidos" sub="La categoría (Aves/Ganado) se asigna sola según el uso de la fórmula">
              <select value={fBache.formula} onChange={e => setFBache({ ...fBache, formula: e.target.value })} style={selectStyle}>
                {Object.keys(recetas.formulas).map(f => <option key={f} value={f}>{f} — {usoFormula(f)}</option>)}
              </select>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Campo mitad etiqueta={`Cantidad de baches (mixer ${recetas.bacheKg} kg)`} type="text" inputMode="numeric" placeholder="ej. 2" value={fBache.baches} onChange={e => setFBache({ ...fBache, baches: e.target.value, kg: e.target.value ? String(Number(e.target.value) * recetas.bacheKg) : fBache.kg })} />
                <Campo mitad etiqueta="Kilogramos totales" type="text" inputMode="decimal" placeholder="ej. 1380" value={fBache.kg} onChange={e => setFBache({ ...fBache, kg: e.target.value })} />
                <Campo mitad etiqueta="No. de bache (control de planta)" type="text" placeholder="ej. B-0245" value={fBache.numBache} onChange={e => setFBache({ ...fBache, numBache: e.target.value })} />
                <label style={{ display: "block", marginBottom: 12, flex: "1 1 45%", minWidth: 140 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha del bache</span>
                  <input type="date" value={fBache.fecha} onChange={e => setFBache({ ...fBache, fecha: e.target.value })} style={inputStyle} />
                </label>
              </div>
              <button onClick={guardarBache} disabled={guardando} style={btnStyle}>Registrar producción</button>
              <button onClick={() => setPrintDoc({ tipo: "bache", formula: fBache.formula, kg: fBache.kg || recetas.bacheKg })}
                style={{ marginTop: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif", width: "100%" }}>
                🖨 Imprimir checklist del bache (básculas 1–4)
              </button>
            </Seccion>

            <Seccion titulo="Núcleo — premezcla de micros (báscula 4)" sub="Produce porciones por adelantado; cada bache de concentrado descuenta 1 porción automáticamente">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                {Object.entries(recetas.formulas).filter(([n2]) => kgNucleoDe(n2) > 0).map(([n2]) => {
                  const disp = nucleoInv[n2] || 0;
                  return (
                    <div key={n2} style={{ flex: "1 1 130px", background: disp < 2 ? C.alertaSuave : C.fondo, borderRadius: 12, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11.5, color: C.textoSuave }}>{n2} · {kgNucleoDe(n2).toFixed(1)} kg/bache</div>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: disp < 0 ? C.alerta : C.texto }}>{disp} porciones</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <select value={fNucleo.formula} onChange={e => setFNucleo({ ...fNucleo, formula: e.target.value })} style={{ ...inputStyle, flex: "1 1 40%", marginBottom: 12 }}>
                  {Object.keys(recetas.formulas).filter(n2 => kgNucleoDe(n2) > 0).map(n2 => <option key={n2}>{n2}</option>)}
                </select>
                <Campo mitad etiqueta="Porciones producidas (1 = un bache de concentrado)" type="text" inputMode="numeric" placeholder="ej. 10" value={fNucleo.porciones} onChange={e => setFNucleo({ ...fNucleo, porciones: e.target.value })} />
                <Campo mitad etiqueta="No. de producción de núcleo" type="text" placeholder="ej. N-012" value={fNucleo.numNucleo} onChange={e => setFNucleo({ ...fNucleo, numNucleo: e.target.value })} />
                <label style={{ display: "block", marginBottom: 12, flex: "1 1 45%", minWidth: 140 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha de producción</span>
                  <input type="date" value={fNucleo.fecha} onChange={e => setFNucleo({ ...fNucleo, fecha: e.target.value })} style={inputStyle} />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={producirNucleo} style={{ ...btnStyle, flex: 1 }}>Registrar núcleo producido</button>
                <button onClick={() => setPrintDoc({ tipo: "nucleo", formula: fNucleo.formula, baches: fNucleo.porciones || 1 })}
                  style={{ flex: 1, padding: "12px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                  🖨 Imprimir hoja de núcleo
                </button>
              </div>
            </Seccion>

            <Seccion titulo="B. Servido a ganado" sub="El consumo del ganado se digita aquí (el de aves sale solo del Control diario)">
              <label style={{ display: "block", marginBottom: 12, maxWidth: 220 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha del servido</span>
                <input type="date" value={fServGan.fecha} onChange={e => setFServGan({ ...fServGan, fecha: e.target.value })} style={inputStyle} />
              </label>
              <select value={fServGan.formula} onChange={e => setFServGan({ ...fServGan, formula: e.target.value })} style={selectStyle}>
                <option value="">Tipo de concentrado (opcional)</option>
                {Object.keys(recetas.formulas).filter(f => usoFormula(f) === "Ganado").map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Campo mitad etiqueta="Kg servidos hoy" type="text" inputMode="decimal" placeholder="ej. 189" value={fServGan.kg} onChange={e => setFServGan({ ...fServGan, kg: e.target.value })} />
                <Campo mitad etiqueta="Detalle / corral" type="text" placeholder="ej. Potreros + toros" value={fServGan.detalle} onChange={e => setFServGan({ ...fServGan, detalle: e.target.value })} />
              </div>
              <button onClick={guardarServidoGanado} disabled={guardando} style={btnStyle}>Registrar servido a ganado</button>
            </Seccion>

            <Seccion titulo="C. Ajuste por conteo físico" sub="Cuenta el concentrado real y la app registra la diferencia">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ display: "block", marginBottom: 12, flex: "1 1 40%" }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Categoría</span>
                  <select value={fAjPlanta.categoria} onChange={e => setFAjPlanta({ ...fAjPlanta, categoria: e.target.value })} style={inputStyle}>
                    <option>Aves</option><option>Ganado</option>
                  </select>
                </label>
                <Campo mitad etiqueta={`Saldo real contado (app: ${(fAjPlanta.categoria === "Aves" ? saldoAves : saldoGanado).toFixed(0)} kg)`} type="text" inputMode="decimal" placeholder="kg" value={fAjPlanta.saldoReal} onChange={e => setFAjPlanta({ ...fAjPlanta, saldoReal: e.target.value })} />
                <label style={{ display: "block", marginBottom: 12, flex: "1 1 30%", minWidth: 140 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha del conteo</span>
                  <input type="date" value={fAjPlanta.fecha} onChange={e => setFAjPlanta({ ...fAjPlanta, fecha: e.target.value })} style={inputStyle} />
                </label>
              </div>
              <button onClick={guardarAjustePlanta} style={btnStyle}>Registrar ajuste</button>
            </Seccion>

            <Seccion titulo="D. Productos y facturas recibidas">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Campo tercio etiqueta="Proveedor" type="text" placeholder="ej. AVIN" value={fFactura.proveedor} onChange={e => setFFactura({ ...fFactura, proveedor: e.target.value })} />
                <Campo tercio etiqueta="Producto" type="text" placeholder="ej. Maíz 2 ton" value={fFactura.producto} onChange={e => setFFactura({ ...fFactura, producto: e.target.value })} />
                <Campo tercio etiqueta="Monto ₡" type="text" inputMode="decimal" placeholder="0" value={fFactura.monto} onChange={e => setFFactura({ ...fFactura, monto: e.target.value })} />
                <label style={{ display: "block", marginBottom: 12, flex: "1 1 30%", minWidth: 140 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha</span>
                  <input type="date" value={fFactura.fecha} onChange={e => setFFactura({ ...fFactura, fecha: e.target.value })} style={inputStyle} />
                </label>
              </div>
              <button onClick={guardarFactura} style={btnStyle}>Registrar factura</button>
              <div style={{ marginTop: 12 }}>
                {facturas.slice(0, 6).map((f, i) => (
                  <div key={i} style={{ fontSize: 13, padding: "9px 12px", background: C.fondo, borderRadius: 10, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                    <span><b>{f.fecha.slice(0, 5)}</b> · {f.proveedor} — {f.producto}</span>
                    {f.monto && <b>₡{Number(f.monto).toLocaleString()}</b>}
                    <button onClick={() => eliminarFacturaPlanta(f)} title="Eliminar" style={{ padding: "0 9px", fontSize: 14, background: "transparent", color: C.textoSuave, border: "none", borderRadius: 8, cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </div>
            </Seccion>

            {movsPlanta.length > 0 && (
              <Seccion titulo="Historial de movimientos">
                {movsPlanta.slice(0, 10).map((m, i) => (
                  <div key={i} style={{ fontSize: 13, padding: "9px 12px", background: C.fondo, borderRadius: 10, marginBottom: 6, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span><b>{m.fecha.slice(0, 5)}</b> · {m.categoria} — {m.tipo === "bache" ? `${m.baches} bache(s) de ${m.formula}${m.numBache ? ` · #${m.numBache}` : ""}` : m.tipo === "nucleo" ? `Núcleo ${m.formula} · ${m.porciones} porción(es)${m.numNucleo ? ` · #${m.numNucleo}` : ""}` : m.tipo === "servido" ? `Servido${m.formula ? ` de ${m.formula}` : ""}${m.detalle ? ` (${m.detalle})` : ""}` : `Ajuste${m.detalle ? ` (${m.detalle})` : ""}`}</span>
                    <b style={{ color: m.tipo === "bache" ? C.verde : m.tipo === "nucleo" ? C.texto : m.tipo === "servido" ? C.alerta : "#9A6605" }}>{m.tipo === "nucleo" ? `${m.porciones} porc.` : `${m.tipo === "bache" ? "+" : m.tipo === "servido" ? "−" : m.kg > 0 ? "+" : ""}${m.kg} kg`}</b>
                    <button onClick={() => eliminarMovPlanta(m)} title="Eliminar (revierte efectos)" style={{ padding: "0 9px", fontSize: 14, background: confirmar === `delplanta:${m.id}` ? "#FBEAE6" : "transparent", color: confirmar === `delplanta:${m.id}` ? C.alerta : C.textoSuave, border: "none", borderRadius: 8, cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </Seccion>
            )}

            <Seccion titulo="Apertura de planta — inventario inicial" sub="Desde la fecha de apertura corren los balances; baches y consumos anteriores quedan como histórico sin afectar">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Campo tercio etiqueta="Inicial AVES (kg)" type="text" inputMode="decimal" value={plantaCfg.inicialAves} onChange={e => guardarCfgPlanta({ ...plantaCfg, inicialAves: e.target.value })} />
                <Campo tercio etiqueta="Inicial GANADO (kg)" type="text" inputMode="decimal" value={plantaCfg.inicialGanado} onChange={e => guardarCfgPlanta({ ...plantaCfg, inicialGanado: e.target.value })} />
                <label style={{ display: "block", marginBottom: 12, flex: "1 1 30%", minWidth: 130 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha de apertura</span>
                  <input type="date" value={plantaCfg.inicialFecha || ""} onChange={e => guardarCfgPlanta({ ...plantaCfg, inicialFecha: e.target.value })} style={inputStyle} />
                </label>
              </div>
              {plantaCfg.inicialFecha && <div style={{ fontSize: 12.5, color: C.verde, fontWeight: 600 }}>✓ La planta abre el {plantaCfg.inicialFecha.split("-").reverse().join("/")} con {plantaCfg.inicialAves || 0} kg (aves) y {plantaCfg.inicialGanado || 0} kg (ganado).</div>}
            </Seccion>
          </>
        )}

        {/* ══ PEDIDO MATERIA PRIMA ══ */}
        {vista === "pedidomp" && (
          <>
            <Seccion titulo="📦 Kardex de materias primas" sub="Perpetuo: entradas por facturas − salidas por baches y núcleo = saldo teórico, conciliado contra tu conteo físico">
              {kardex.length === 0 && <div style={{ fontSize: 13, color: C.textoSuave }}>Aún sin movimientos — se llena solo con las facturas (PDF con líneas) y la producción registrada.</div>}
              {kardex.length > 0 && (() => {
                const codigos = [...new Set(kardex.map(m2 => m2.mp))];
                return (
                  <>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 520 }}>
                        <thead><tr style={{ color: C.textoSuave, fontSize: 11, textAlign: "right" }}>
                          <th style={{ textAlign: "left", padding: "5px 4px" }}>Materia prima</th>
                          <th style={{ padding: "5px 4px" }}>Entradas</th><th style={{ padding: "5px 4px" }}>Salidas</th>
                          <th style={{ padding: "5px 4px" }}>Saldo kardex</th><th style={{ padding: "5px 4px" }}>Conteo físico</th><th style={{ padding: "5px 4px" }}>Diferencia</th>
                        </tr></thead>
                        <tbody>
                          {codigos.map(c2 => {
                            const mp = mpCat.find(m2 => m2.c === c2) || { n: c2 };
                            const ent = kardex.filter(m2 => m2.mp === c2 && m2.tipo !== "salida").reduce((a, m2) => a + Number(m2.kg || 0), 0);
                            const sal = kardex.filter(m2 => m2.mp === c2 && m2.tipo === "salida").reduce((a, m2) => a + Number(m2.kg || 0), 0);
                            const teorico = ent - sal;
                            const invF = mpInvUltimo[c2];
                            const fisico = invF && (invF.sacos || invF.kg) ? Number(invF.sacos || 0) * (mp.pres || 1) + Number(invF.kg || 0) : null;
                            const dif = fisico != null ? fisico - teorico : null;
                            return (
                              <tr key={c2} style={{ borderTop: `1px solid ${C.borde}`, textAlign: "right" }}>
                                <td style={{ textAlign: "left", padding: "8px 4px", fontWeight: 600 }}>{mp.n}</td>
                                <td style={{ padding: "8px 4px", color: C.verde }}>{ent.toFixed(1)}</td>
                                <td style={{ padding: "8px 4px", color: C.alerta }}>{sal.toFixed(1)}</td>
                                <td style={{ padding: "8px 4px", fontWeight: 700 }}>{teorico.toFixed(1)} kg</td>
                                <td style={{ padding: "8px 4px" }}>{fisico != null ? `${fisico.toFixed(1)} kg` : "—"}</td>
                                <td style={{ padding: "8px 4px", fontWeight: 700, color: dif == null ? C.textoSuave : Math.abs(dif) <= Math.max(5, Math.abs(teorico) * 0.03) ? C.verde : "#9A6605" }}>{dif != null ? `${dif > 0 ? "+" : ""}${dif.toFixed(1)}` : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ fontSize: 11.5, color: C.textoSuave, marginTop: 6 }}>Diferencia = conteo físico − saldo kardex. Positiva: hay más de lo esperado (falta registrar facturas). Negativa: merma o consumo sin registrar.</div>
                    <details style={{ marginTop: 10 }}>
                      <summary style={{ fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Últimos movimientos del kardex</summary>
                      {kardex.slice(0, 20).map(m2 => (
                        <div key={m2.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${C.borde}`, flexWrap: "wrap" }}>
                          <span>{m2.fecha.slice(0, 5)} · <b>{(mpCat.find(x => x.c === m2.mp) || { n: m2.mp }).n}</b> · {m2.ref}</span>
                          <b style={{ color: m2.tipo === "salida" ? C.alerta : C.verde }}>{m2.tipo === "salida" ? "−" : "+"}{Number(m2.kg).toFixed(1)} kg</b>
                        </div>
                      ))}
                    </details>
                  </>
                );
              })()}
            </Seccion>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <KPI etiqueta="Consumo diario total" valor={Object.values(consumoFormulas).reduce((a, b) => a + b, 0).toFixed(0)} unidad="kg" sub="Aves (desde Lotes) + ganado" />
              <KPI etiqueta="Cobertura" valor={mpConfig.cobertura} unidad="días" sub="Jueves → lunes de entrega" />
              <KPI etiqueta="Último conteo" valor={mpFechaConteo ? mpFechaConteo.slice(0, 5) : "—"} unidad="" sub={mpResponsable || "sin responsable"} />
            </div>

            <Seccion titulo="1 · Consumo proyectado" sub="Las aves se calculan solas desde Lotes (aves vivas × ración). Asigna la fórmula de receta de cada lote.">
              {activos.map(l => {
                const kgDia = l.racionGAve && l.aves ? (l.racionGAve * l.aves) / 1000 : 0;
                return (
                  <div key={l.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ flex: "1 1 150px", fontSize: 13.5 }}><b>G{l.galpon}</b> · {l.aves.toLocaleString()} aves · <b>{l.racionGAve || 0} g/ave</b> · {kgDia.toFixed(0)} kg/día</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: recetas.formulas[l.formula] ? C.verde : C.alerta, background: recetas.formulas[l.formula] ? C.verdeSuave : C.alertaSuave, padding: "6px 12px", borderRadius: 16 }}>
                      {formulaDelLote(l)}{!recetas.formulas[l.formula] && " (asigna la fórmula en Lotes)"}
                    </span>
                  </div>
                );
              })}
              <div style={{ fontSize: 13.5, fontWeight: 700, margin: "12px 0 8px", color: C.verde }}>Ganado</div>
              {(mpConfig.ganado || []).map((g, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 110px", fontSize: 12.5 }}>{g.nombre}</span>
                  <select value={g.formula} onChange={e => { const gs = [...mpConfig.ganado]; gs[i] = { ...g, formula: e.target.value }; guardarConfigMP({ ...mpConfig, ganado: gs }); }}
                    style={{ ...inputStyle, flex: "0 1 110px", padding: "8px 8px", fontSize: 13 }}>
                    {formulasGanado.map(f => <option key={f}>{f}</option>)}
                  </select>
                  <input type="text" inputMode="numeric" title="Animales" placeholder="# anim" value={g.animales}
                    onChange={e => { const gs = [...mpConfig.ganado]; gs[i] = { ...g, animales: e.target.value }; guardarConfigMP({ ...mpConfig, ganado: gs }); }}
                    style={{ ...inputStyle, flex: "0 1 84px", padding: "8px 10px", fontSize: 14 }} />
                  <input type="text" inputMode="decimal" title="kg por animal" placeholder="kg/anim" value={g.kgAnimal}
                    onChange={e => { const gs = [...mpConfig.ganado]; gs[i] = { ...g, kgAnimal: e.target.value }; guardarConfigMP({ ...mpConfig, ganado: gs }); }}
                    style={{ ...inputStyle, flex: "0 1 84px", padding: "8px 10px", fontSize: 14 }} />
                  <b style={{ fontSize: 13, color: C.verde, flex: "0 0 62px", textAlign: "right" }}>{(Number(g.animales || 0) * Number(g.kgAnimal || 0)).toFixed(0)} kg</b>
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "flex-end" }}>
                <Campo mitad etiqueta="Días de cobertura" type="text" inputMode="numeric" value={mpConfig.cobertura}
                  onChange={e => guardarConfigMP({ ...mpConfig, cobertura: e.target.value })} />
              </div>
            </Seccion>

            <Seccion titulo="2 · Inventario físico" sub="El encargado cuenta el jueves: sacos completos + saldo suelto en kg de cada materia prima">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label style={{ display: "block", marginBottom: 12, flex: "1 1 30%", minWidth: 140 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha del conteo</span>
                  <input type="date" value={mpFechaInput} onChange={e => setMpFechaInput(e.target.value)} style={inputStyle} />
                </label>
                <Campo mitad etiqueta="Responsable del conteo" type="text" placeholder="Nombre" value={mpResponsable} onChange={e => setMpResponsable(e.target.value)} />
              </div>
              {mpCat.map(mp => {
                const inv = mpInv[mp.c] || {};
                return (
                  <div key={mp.c} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                    <span style={{ flex: "1 1 140px", fontSize: 12, lineHeight: 1.3 }}><b>{mp.n}</b><br /><span style={{ color: C.textoSuave, fontSize: 10.5 }}>{mp.c} · {mp.pres === 1 ? "por kg" : `saco ${mp.pres} kg`} · {mp.prov}</span></span>
                    {mp.pres !== 1 && <input type="text" inputMode="numeric" placeholder="Sacos" value={inv.sacos ?? ""}
                      onChange={e => setMpInv({ ...mpInv, [mp.c]: { ...inv, sacos: e.target.value } })}
                      style={{ ...inputStyle, flex: "0 1 80px", padding: "8px 9px", fontSize: 14 }} />}
                    <input type="text" inputMode="decimal" placeholder={mp.pres === 1 ? "Kg" : "Saldo kg"} value={inv.kg ?? ""}
                      onChange={e => setMpInv({ ...mpInv, [mp.c]: { ...inv, kg: e.target.value } })}
                      style={{ ...inputStyle, flex: "0 1 92px", padding: "8px 9px", fontSize: 14 }} />
                  </div>
                );
              })}
              <button onClick={guardarInventarioMP} disabled={guardando} style={{ ...btnStyle, marginTop: 8 }}>Guardar inventario del conteo</button>
              {mpInvHist.length > 0 && (
                <details style={{ marginTop: 14 }}>
                  <summary style={{ fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>📋 Historial de conteos ({mpInvHist.length})</summary>
                  {mpInvHist.map(h => (
                    <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12.5, padding: "8px 2px", borderBottom: `1px solid ${C.borde}`, flexWrap: "wrap" }}>
                      <span><b>{String(h.fecha).slice(0, 5)}</b> · {h.responsable || "sin responsable"} · {Object.keys(h.items || {}).length} materias primas contadas</span>
                      <span style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { setMpInv(h.items || {}); setMpResponsable(h.responsable || ""); avisar(`✓ Conteo del ${String(h.fecha).slice(0, 5)} cargado en el formulario — puedes editarlo y guardar de nuevo`); }}
                          style={{ fontSize: 11.5, padding: "4px 10px", background: C.verdeSuave, color: C.verde, border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Ver / reusar</button>
                        <span onClick={async () => {
                          if (!pideConfirm(`borrarConteo-${h.id}`, "⚠ Toca otra vez para borrar este conteo del historial")) return;
                          const nuevo = mpInvHist.filter(x => x.id !== h.id);
                          if (await escribir(K.mpInvHist, nuevo)) { setMpInvHist(nuevo); avisar("✓ Conteo borrado del historial"); }
                        }} style={{ cursor: "pointer", color: C.alerta, fontSize: 15, padding: "0 4px" }} title="Borrar este conteo">×</span>
                      </span>
                    </div>
                  ))}
                </details>
              )}
            </Seccion>

            <Seccion titulo="3 · Pedido calculado" sub={`Consumo × ${mpConfig.cobertura} días − inventario, redondeado a presentación completa (mín. ${mpConfig.minKg1} kg en granel)`}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ color: C.textoSuave, fontSize: 11, textAlign: "right" }}>
                      <th style={{ textAlign: "left", padding: "5px 4px" }}>Materia prima</th>
                      <th style={{ padding: "5px 4px" }}>Proy. kg</th>
                      <th style={{ padding: "5px 4px" }}>Inv. kg</th>
                      <th style={{ padding: "5px 4px" }}>PEDIDO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineasPedido.filter(x => x.kgDia > 0 || x.invKg > 0).map(x => (
                      <tr key={x.c} style={{ borderTop: `1px solid ${C.borde}`, textAlign: "right", background: x.pedido > 0 ? C.yemaSuave : "transparent" }}>
                        <td style={{ textAlign: "left", padding: "7px 4px", fontWeight: 500 }}>{x.n}</td>
                        <td style={{ padding: "7px 4px" }}>{x.proyKg.toFixed(0)}</td>
                        <td style={{ padding: "7px 4px" }}>{x.invKg.toFixed(0)}</td>
                        <td style={{ padding: "7px 4px", fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{x.pedido > 0 ? `${x.pedido} ${x.pres === 1 ? "kg" : "sc"}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Seccion>

            <Seccion titulo="4 · Registrar pedido realizado" sub="El pedido que colocaste al proveedor — al marcarlo recibido, las materias primas entran solas al kardex">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label style={{ display: "block", marginBottom: 12, flex: "1 1 30%", minWidth: 140 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha del pedido</span>
                  <input type="date" value={fPedidoMP.fecha} onChange={e => setFPedidoMP({ ...fPedidoMP, fecha: e.target.value })} style={inputStyle} />
                </label>
                <Campo mitad etiqueta="Proveedor" type="text" placeholder="ej. VYMISA" value={fPedidoMP.proveedor} onChange={e => setFPedidoMP({ ...fPedidoMP, proveedor: e.target.value })} />
              </div>
              {fPedidoMP.lineas.map((l2, i2) => (
                <div key={i2} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <select value={l2.mp} onChange={e => { const ls = [...fPedidoMP.lineas]; ls[i2] = { ...l2, mp: e.target.value }; setFPedidoMP({ ...fPedidoMP, lineas: ls }); }} style={{ ...inputStyle, flex: 1.4, marginBottom: 0 }}>
                    <option value="">— Materia prima —</option>
                    {mpCat.map(m => <option key={m.c} value={m.c}>{m.n}</option>)}
                  </select>
                  <input type="text" inputMode="decimal" placeholder="kg" value={l2.kg} onChange={e => { const ls = [...fPedidoMP.lineas]; ls[i2] = { ...l2, kg: e.target.value }; setFPedidoMP({ ...fPedidoMP, lineas: ls }); }} style={{ ...inputStyle, flex: 0.7, marginBottom: 0 }} />
                  <button onClick={() => setFPedidoMP({ ...fPedidoMP, lineas: fPedidoMP.lineas.length > 1 ? fPedidoMP.lineas.filter((_, j) => j !== i2) : [{ mp: "", kg: "" }] })} style={{ padding: "0 11px", fontSize: 15, background: "#F1F1EA", color: C.textoSuave, border: "none", borderRadius: 10, cursor: "pointer" }}>×</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setFPedidoMP({ ...fPedidoMP, lineas: [...fPedidoMP.lineas, { mp: "", kg: "" }] })} style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>+ Línea</button>
                <button onClick={async () => {
                  const ls = fPedidoMP.lineas.filter(l2 => l2.mp && Number(l2.kg) > 0);
                  if (!ls.length) { avisar("⚠ Agrega al menos una materia prima con kilos"); return; }
                  const doc = { id: Date.now(), fecha: fPedidoMP.fecha.split("-").reverse().join("/"), proveedor: fPedidoMP.proveedor.trim(), nota: fPedidoMP.nota, manual: true, estado: "pendiente", lineas: ls.map(l2 => ({ c: l2.mp, n: (mpCat.find(m => m.c === l2.mp) || {}).n, kg: Number(l2.kg) })) };
                  const nuevos = [doc, ...mpPedidos];
                  if (await escribir(K.mpPedidos, nuevos)) { setMpPedidos(nuevos); setFPedidoMP({ fecha: new Date().toISOString().slice(0, 10), proveedor: "", nota: "", lineas: [{ mp: "", kg: "" }] }); avisar("✓ Pedido registrado — pendiente de recibir"); }
                }} style={{ ...btnStyle, flex: 1, marginTop: 0 }}>Registrar pedido</button>
              </div>
            </Seccion>

            <Seccion titulo="5 · Historial de pedidos" sub="Pendientes y recibidos — al recibir, el kardex se alimenta solo">
              {mpPedidos.length === 0 && <div style={{ fontSize: 13, color: C.textoSuave }}>Sin pedidos registrados todavía.</div>}
              {mpPedidos.slice(0, 8).map((p, i2) => (
                <div key={p.id || i2} style={{ padding: "10px 12px", background: C.fondo, borderRadius: 10, marginBottom: 7, fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span><b>{p.fecha}</b>{p.proveedor ? ` · ${p.proveedor}` : ""}{p.manual ? "" : " · calculado"}</span>
                    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 10, background: p.estado === "recibido" ? C.verdeSuave : C.yemaSuave, color: p.estado === "recibido" ? C.verde : "#9A6605" }}>{p.estado === "recibido" ? `✓ recibido ${p.recibido ? p.recibido.slice(0, 5) : ""}` : "pendiente"}</span>
                      {p.estado !== "recibido" && <button onClick={() => recibirPedidoMP(p)} style={{ padding: "4px 10px", fontSize: 12, fontWeight: 600, background: C.verde, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>✓ Recibido</button>}
                      <button onClick={() => eliminarPedidoMP(p)} style={{ padding: "2px 8px", fontSize: 13, background: "transparent", color: C.textoSuave, border: "none", cursor: "pointer" }}>×</button>
                    </span>
                  </div>
                  <div style={{ color: C.textoSuave, marginTop: 4 }}>{(p.lineas || []).map(l2 => `${l2.n || l2.c}: ${(l2.kg ?? l2.pedidoKg ?? 0)} kg`).join(" · ")}</div>
                </div>
              ))}
            </Seccion>

            <Seccion titulo="4 · Pedido por proveedor" sub="Envía cada orden por WhatsApp o cópiala">
              {Object.keys(pedidoPorProveedor).length === 0 && <div style={{ fontSize: 13.5, color: C.verde, fontWeight: 500 }}>✓ Con el inventario actual no hace falta pedir nada.</div>}
              {Object.entries(pedidoPorProveedor).map(([prov, items]) => (
                <div key={prov} style={{ border: `1px solid ${C.borde}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <b style={{ fontSize: 15 }}>{prov}</b>
                    <span style={{ fontSize: 12.5, color: C.textoSuave }}>{items.reduce((s2, x) => s2 + x.pedido, 0)} unid · {items.reduce((s2, x) => s2 + x.pedidoKg, 0).toFixed(0)} kg</span>
                  </div>
                  {items.map(x => (
                    <div key={x.c} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                      <span>{x.n}</span><b>{x.pedido} {x.pres === 1 ? "kg" : `sacos (${x.pedidoKg.toFixed(0)} kg)`}</b>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => enviarWhatsApp(prov, items)} style={{ flex: 1, padding: "11px", fontSize: 13.5, fontWeight: 600, background: "#25D366", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>📱 Enviar por WhatsApp</button>
                    <button onClick={() => copiarPedido(prov, items)} style={{ flex: 0.6, padding: "11px", fontSize: 13.5, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Copiar</button>
                  </div>
                </div>
              ))}
              {Object.keys(pedidoPorProveedor).length > 0 &&
                <button onClick={registrarPedido} disabled={guardando} style={btnStyle}>Registrar este pedido en el historial</button>}
              {mpPedidos.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.textoSuave, marginBottom: 6 }}>Pedidos anteriores</div>
                  {mpPedidos.slice(0, 5).map((pd, i) => (
                    <div key={i} style={{ fontSize: 13, padding: "8px 12px", background: C.fondo, borderRadius: 10, marginBottom: 5 }}>
                      <b>{pd.fecha.slice(0, 5)}</b> — {pd.lineas.length} materias primas · {pd.lineas.reduce((s2, x) => s2 + x.kg, 0).toFixed(0)} kg
                    </div>
                  ))}
                </div>
              )}
            </Seccion>
          </>
        )}

        {/* ══ FÓRMULAS ══ */}
        {vista === "formulas" && (() => {
          const f = recetas.formulas[recActiva];
          const total = f ? sumaBache(f) : 0;
          const dif = total - recetas.bacheKg;
          return (
            <>
              <Seccion titulo="Fórmulas de concentrado" sub={`Definidas en kg por bache — capacidad del mixer: ${recetas.bacheKg} kg. Todo el cálculo de consumo y pedido sale de aquí.`}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  {Object.entries(recetas.formulas).map(([n, f2]) => (
                    <button key={n} onClick={() => setRecActiva(n)} style={{
                      padding: "8px 13px", fontSize: 13, fontWeight: 600, borderRadius: 20, cursor: "pointer", fontFamily: "'Inter', sans-serif",
                      border: recActiva === n ? `2px solid ${C.verde}` : `1.5px solid ${C.borde}`,
                      background: recActiva === n ? C.verdeSuave : C.superficie, color: recActiva === n ? C.verde : C.texto,
                    }}>{n} <span style={{ fontWeight: 400, fontSize: 11, color: C.textoSuave }}>({f2.uso})</span></button>
                  ))}
                </div>
              </Seccion>

              {f && (
                <Seccion titulo={`${recActiva} — kg por bache`} sub={`Uso: ${f.uso}`}>
                  {Object.entries(f.items).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0)).map(([mpc, kg]) => {
                    const mp = mpCat.find(m => m.c === mpc);
                    const pct = total > 0 ? (Number(kg || 0) / total) * 100 : 0;
                    return (
                      <div key={mpc} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <span style={{ flex: "1 1 140px", fontSize: 12.5, lineHeight: 1.3 }}><b>{mp?.n || mpc}</b><br /><span style={{ fontSize: 10.5, color: C.textoSuave }}>{pct.toFixed(2)}% de la mezcla</span></span>
                        <input type="text" inputMode="decimal" step="0.01" value={kg}
                          onChange={e => setKgIngrediente(recActiva, mpc, e.target.value)}
                          style={{ ...inputStyle, flex: "0 1 100px", padding: "8px 10px", fontSize: 14 }} />
                        <span style={{ fontSize: 12, color: C.textoSuave, flex: "0 0 18px" }}>kg</span>
                        <button onClick={() => quitarIngrediente(recActiva, mpc)} style={{ padding: "6px 9px", fontSize: 13, background: "transparent", color: C.alerta, border: `1px solid ${C.borde}`, borderRadius: 8, cursor: "pointer" }}>×</button>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "10px 12px", background: Math.abs(dif) <= 2 ? C.verdeSuave : C.yemaSuave, borderRadius: 10, marginTop: 8 }}>
                    <b>Total del bache</b>
                    <b style={{ color: Math.abs(dif) <= 2 ? C.verde : "#9A6605" }}>{total.toFixed(2)} kg {Math.abs(dif) > 2 ? `(${dif > 0 ? "+" : ""}${dif.toFixed(1)} vs ${recetas.bacheKg})` : "✓"}</b>
                  </div>

                  <div style={{ fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px", color: C.verde }}>Agregar ingrediente</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select value={fIng.mp} onChange={e => setFIng({ ...fIng, mp: e.target.value })} style={{ ...inputStyle, flex: 1.4 }}>
                      {mpCat.filter(m => f.items[m.c] === undefined).map(m => <option key={m.c} value={m.c}>{m.n} ({m.prov})</option>)}
                    </select>
                    <input type="text" inputMode="decimal" placeholder="kg" value={fIng.kg} onChange={e => setFIng({ ...fIng, kg: e.target.value })} style={{ ...inputStyle, flex: 0.5 }} />
                    <button onClick={agregarIngrediente} style={{ padding: "10px 14px", fontSize: 13.5, fontWeight: 600, background: C.verde, color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>+</button>
                  </div>

                  <button onClick={() => eliminarFormula(recActiva)} style={{ marginTop: 16, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, background: "transparent", color: C.alerta, border: `1.5px solid ${C.borde}`, borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Eliminar esta fórmula</button>
                </Seccion>
              )}

              <Seccion titulo="Crear fórmula nueva" sub="Del nutricionista — se define en kg por bache del mixer">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Campo mitad etiqueta="Nombre de la fórmula" type="text" placeholder="ej. Postura F2" value={fNuevaRec.nombre} onChange={e => setFNuevaRec({ ...fNuevaRec, nombre: e.target.value })} />
                  <label style={{ display: "block", marginBottom: 12, flex: "1 1 45%" }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Uso</span>
                    <select value={fNuevaRec.uso} onChange={e => setFNuevaRec({ ...fNuevaRec, uso: e.target.value })} style={inputStyle}>
                      <option>Aves</option><option>Ganado</option>
                    </select>
                  </label>
                </div>
                <button onClick={crearFormula} style={btnStyle}>Crear fórmula</button>
                <div style={{ marginTop: 12 }}>
                  <Campo mitad etiqueta="Capacidad del mixer (kg por bache)" type="text" inputMode="numeric" value={recetas.bacheKg}
                    onChange={e => persistirRecetas({ ...recetas, bacheKg: Number(e.target.value || BACHE_KG_DEFAULT) })} />
                </div>
              </Seccion>

              <Seccion titulo="Catálogo de materias primas" sub="La lista maestra que alimenta fórmulas, inventario y pedido — nombre, presentación y proveedor editables">
                {mpCat.map(mp => {
                  const enUso = Object.values(recetas.formulas).some(f2 => f2.items[mp.c] !== undefined);
                  return (
                    <div key={mp.c} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 7, flexWrap: "wrap" }}>
                      <span style={{ flex: "0 0 46px", fontSize: 10.5, color: C.textoSuave }}>{mp.c}</span>
                      <input type="text" value={mp.n} onChange={e => actualizarMP(mp.c, "n", e.target.value)}
                        style={{ ...inputStyle, flex: "2 1 130px", padding: "8px 9px", fontSize: 13 }} />
                      <input type="text" inputMode="decimal" title="Presentación kg/unidad" value={mp.pres} onChange={e => actualizarMP(mp.c, "pres", e.target.value)}
                        style={{ ...inputStyle, flex: "0 1 64px", padding: "8px 8px", fontSize: 13 }} />
                      <input list="provs" type="text" value={mp.prov} onChange={e => actualizarMP(mp.c, "prov", e.target.value)}
                        style={{ ...inputStyle, flex: "1 1 90px", padding: "8px 9px", fontSize: 13 }} />
                      <button onClick={() => eliminarMP(mp)} title={enUso ? "En uso en fórmulas" : "Eliminar"}
                        style={{ padding: "6px 9px", fontSize: 13, background: "transparent", color: enUso ? C.borde : C.alerta, border: `1px solid ${C.borde}`, borderRadius: 8, cursor: "pointer" }}>×</button>
                    </div>
                  );
                })}
                <datalist id="provs">{proveedoresCat.map(pv => <option key={pv} value={pv} />)}</datalist>
                <div style={{ fontSize: 11.5, color: C.textoSuave, margin: "4px 0 12px" }}>Columnas: código · nombre · presentación (kg por saco o unidad; usa 1 para granel) · proveedor. Las materias en uso en fórmulas no se pueden eliminar.</div>

                <div style={{ fontSize: 13.5, fontWeight: 700, margin: "6px 0 8px", color: C.verde }}>Agregar materia prima nueva</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Campo tercio etiqueta="Nombre" type="text" placeholder="ej. AFRECHO DE TRIGO" value={fNuevaMP.n} onChange={e => setFNuevaMP({ ...fNuevaMP, n: e.target.value })} />
                  <Campo tercio etiqueta="Presentación (kg/unidad)" type="text" inputMode="decimal" placeholder="ej. 46 (o 1)" value={fNuevaMP.pres} onChange={e => setFNuevaMP({ ...fNuevaMP, pres: e.target.value })} />
                  <label style={{ display: "block", marginBottom: 12, flex: "1 1 30%", minWidth: 96 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Proveedor</span>
                    <input list="provs" type="text" placeholder="ej. AVIN" value={fNuevaMP.prov} onChange={e => setFNuevaMP({ ...fNuevaMP, prov: e.target.value })} style={inputStyle} />
                  </label>
                </div>
                <button onClick={agregarMP} style={btnStyle}>Agregar al catálogo</button>
              </Seccion>
            </>
          );
        })()}

        {/* ══ INSUMOS Y MEDICINAS ══ */}
        {vista === "insumos" && (() => {
          const agotados = insumos.filter(it => it.saldo <= 0);
          return (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <KPI etiqueta="Insumos en catálogo" valor={insumos.length} unidad="" />
                <KPI etiqueta="Agotados o en cero" valor={agotados.length} unidad="" tono={agotados.length ? "alerta" : "ok"} />
                <KPI etiqueta="Movimientos registrados" valor={insumosMovs.length} unidad="" />
              </div>

              <Seccion titulo="⚡ Balance inicial / conteo general" sub="Digita el saldo real de los productos que tengas hoy y guarda todo de una vez — cada carga queda registrada como movimiento">
                {CATEGORIAS_INSUMOS.map(cat => {
                  const items = insumos.filter(it => it.categoria === cat);
                  if (!items.length) return null;
                  return (
                    <div key={cat} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.verde, padding: "4px 0" }}>{cat}</div>
                      {items.map(it => (
                        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <span style={{ flex: 1, fontSize: 13 }}>{it.nombre} <span style={{ fontSize: 11, color: C.textoSuave }}>(actual: {it.saldo} {it.unidad})</span></span>
                          <input type="text" inputMode="decimal" placeholder={`${it.unidad}`} value={aperturaIns[it.id] ?? ""}
                            onChange={e => setAperturaIns({ ...aperturaIns, [it.id]: e.target.value })}
                            style={{ ...inputStyle, flex: "0 1 96px", padding: "8px 9px", fontSize: 14 }} />
                        </div>
                      ))}
                    </div>
                  );
                })}
                <button onClick={guardarAperturaInsumos} disabled={guardando} style={btnStyle}>Guardar balances iniciales</button>
                <div style={{ fontSize: 11.5, color: C.textoSuave, marginTop: 6 }}>Solo se actualizan los que tengan un número digitado; los demás quedan igual. Sirve también para conteos generales futuros.</div>
              </Seccion>

              <Seccion titulo="Inventario por categoría" sub="Saldo inicial + compras − salidas del control diario = saldo actual. Las salidas se descuentan solas al guardar el día.">
                {CATEGORIAS_INSUMOS.map(cat => {
                  const items = insumos.filter(it => it.categoria === cat);
                  if (!items.length) return null;
                  return (
                    <div key={cat} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.verde, padding: "6px 0" }}>{cat}</div>
                      {items.map(it => (
                        <div key={it.id} style={{ padding: "9px 10px", background: it.saldo <= 0 ? C.alertaSuave : C.fondo, borderRadius: 10, marginBottom: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <input type="text" value={it.nombre} onChange={e => actualizarInsumo(it.id, "nombre", e.target.value)}
                              style={{ ...inputStyle, flex: 1, padding: "7px 9px", fontSize: 13.5, fontWeight: 600, background: C.superficie }} />
                            <b style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14.5, whiteSpace: "nowrap", color: it.saldo <= 0 ? C.alerta : C.texto }}>{it.saldo} {it.unidad}</b>
                            <button onClick={() => eliminarInsumo(it)} style={{ padding: "4px 8px", fontSize: 12, background: "transparent", color: C.textoSuave, border: `1px solid ${C.borde}`, borderRadius: 7, cursor: "pointer" }}>×</button>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <input type="text" placeholder="Presentación (ej. galón 3.785 L)" title="Presentación" value={it.presentacion || ""}
                              onChange={e => actualizarInsumo(it.id, "presentacion", e.target.value)}
                              style={{ ...inputStyle, flex: "1 1 30%", minWidth: 100, padding: "6px 8px", fontSize: 12, background: C.superficie }} />
                            <input type="text" placeholder="Dosis (ej. 1 ml/L agua)" title="Dosis a utilizar" value={it.dosis || ""}
                              onChange={e => actualizarInsumo(it.id, "dosis", e.target.value)}
                              style={{ ...inputStyle, flex: "1 1 30%", minWidth: 100, padding: "6px 8px", fontSize: 12, background: C.superficie }} />
                            <input list="provsIns" type="text" placeholder="Proveedor" title="Proveedor" value={it.proveedor || ""}
                              onChange={e => actualizarInsumo(it.id, "proveedor", e.target.value)}
                              style={{ ...inputStyle, flex: "1 1 26%", minWidth: 86, padding: "6px 8px", fontSize: 12, background: C.superficie }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </Seccion>

              <datalist id="provsIns">{proveedoresIns.map(pv => <option key={pv} value={pv} />)}</datalist>
              <Seccion titulo="Registrar movimiento" sub="Entrada por compra (con # de factura), salida manual, o ajuste por conteo físico">
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {[["entrada", "+ Entrada"], ["salida", "− Salida"], ["ajuste", "Ajuste"]].map(([t, lbl]) => (
                    <button key={t} onClick={() => setFMovIns({ ...fMovIns, tipo: t })} style={{
                      flex: 1, padding: "10px", fontSize: 13.5, fontWeight: 600, borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif",
                      border: fMovIns.tipo === t ? `2px solid ${C.verde}` : `1.5px solid ${C.borde}`,
                      background: fMovIns.tipo === t ? C.verdeSuave : C.superficie, color: fMovIns.tipo === t ? C.verde : C.texto,
                    }}>{lbl}</button>
                  ))}
                </div>
                <select value={fMovIns.itemId} onChange={e => setFMovIns({ ...fMovIns, itemId: e.target.value })} style={selectStyle}>
                  <option value="">— Elegir insumo —</option>
                  {CATEGORIAS_INSUMOS.map(cat => insumos.filter(i2 => i2.categoria === cat).map(i2 =>
                    <option key={i2.id} value={i2.id}>{cat}: {i2.nombre} (saldo {i2.saldo} {i2.unidad})</option>))}
                </select>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Campo mitad etiqueta={fMovIns.tipo === "ajuste" ? "Saldo real contado" : "Cantidad"} type="text" inputMode="decimal" placeholder="0" value={fMovIns.cantidad} onChange={e => setFMovIns({ ...fMovIns, cantidad: e.target.value })} />
                  <Campo mitad etiqueta={fMovIns.tipo === "entrada" ? "Factura / proveedor" : "Motivo / detalle"} type="text" placeholder="opcional" value={fMovIns.detalle} onChange={e => setFMovIns({ ...fMovIns, detalle: e.target.value })} />
                  <label style={{ display: "block", marginBottom: 12, flex: "1 1 30%", minWidth: 140 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha</span>
                    <input type="date" value={fMovIns.fecha} onChange={e => setFMovIns({ ...fMovIns, fecha: e.target.value })} style={inputStyle} />
                  </label>
                </div>
                <button onClick={() => registrarMovInsumo(fMovIns.tipo, fMovIns.itemId, fMovIns.cantidad, fMovIns.detalle, fMovIns.fecha)} disabled={guardando} style={btnStyle}>Registrar movimiento</button>

                {insumosMovs.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.textoSuave, marginBottom: 6 }}>Últimos movimientos</div>
                    {insumosMovs.slice(0, 10).map((m, i) => {
                      const it = insumos.find(x => x.id === m.itemId);
                      const colores = { entrada: C.verde, salida: C.alerta, ajuste: "#9A6605" };
                      return (
                        <div key={i} style={{ fontSize: 12.5, padding: "7px 11px", background: C.fondo, borderRadius: 9, marginBottom: 5, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <span><b>{m.fecha.slice(0, 5)}</b> · {it?.nombre || "?"} {m.detalle && <span style={{ color: C.textoSuave }}>· {m.detalle}{m.auto ? " (auto)" : ""}</span>}</span>
                          <b style={{ color: colores[m.tipo] }}>{m.tipo === "entrada" ? "+" : m.tipo === "salida" ? "−" : "="}{m.cantidad} {it?.unidad}</b>
                          <button onClick={() => eliminarMovInsumo(m)} title="Eliminar" style={{ padding: "0 9px", fontSize: 14, background: confirmar === `delins:${m.id}` ? "#FBEAE6" : "transparent", color: confirmar === `delins:${m.id}` ? C.alerta : C.textoSuave, border: "none", borderRadius: 8, cursor: "pointer" }}>×</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Seccion>

              <Seccion titulo="Agregar insumo al catálogo" sub="Escribe el nombre TAL CUAL lo anotan en el control diario para que el descuento automático lo reconozca">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Campo mitad etiqueta="Nombre del producto" type="text" placeholder="ej. Respinorm" value={fNuevoIns.nombre} onChange={e => setFNuevoIns({ ...fNuevoIns, nombre: e.target.value })} />
                  <label style={{ display: "block", marginBottom: 12, flex: "1 1 45%" }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Categoría</span>
                    <select value={fNuevoIns.categoria} onChange={e => setFNuevoIns({ ...fNuevoIns, categoria: e.target.value })} style={inputStyle}>
                      {CATEGORIAS_INSUMOS.map(c2 => <option key={c2}>{c2}</option>)}
                    </select>
                  </label>
                  <label style={{ display: "block", marginBottom: 12, flex: "1 1 45%" }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Unidad</span>
                    <select value={fNuevoIns.unidad} onChange={e => setFNuevoIns({ ...fNuevoIns, unidad: e.target.value })} style={inputStyle}>
                      <option>ml</option><option>g</option><option>L</option><option>kg</option><option>frascos</option><option>sobres</option><option>dosis</option><option>unidades</option>
                    </select>
                  </label>
                  <Campo mitad etiqueta="Saldo inicial" type="text" inputMode="decimal" placeholder="0" value={fNuevoIns.saldo} onChange={e => setFNuevoIns({ ...fNuevoIns, saldo: e.target.value })} />
                  <Campo tercio etiqueta="Presentación" type="text" placeholder="ej. galón 3.785 L" value={fNuevoIns.presentacion} onChange={e => setFNuevoIns({ ...fNuevoIns, presentacion: e.target.value })} />
                  <Campo tercio etiqueta="Dosis a utilizar" type="text" placeholder="ej. 1 ml/L agua" value={fNuevoIns.dosis} onChange={e => setFNuevoIns({ ...fNuevoIns, dosis: e.target.value })} />
                  <label style={{ display: "block", marginBottom: 12, flex: "1 1 30%", minWidth: 96 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Proveedor</span>
                    <input list="provsIns" type="text" placeholder="ej. Vetim" value={fNuevoIns.proveedor} onChange={e => setFNuevoIns({ ...fNuevoIns, proveedor: e.target.value })} style={inputStyle} />
                  </label>
                </div>
                <button onClick={agregarInsumo} style={btnStyle}>Agregar insumo</button>
              </Seccion>
            </>
          );
        })()}

        {/* ══ KPIs ══ */}
        {vista === "reporte" && (() => {
          // KPIs avícolas del día que faltaban: masa de huevo y ratio agua:alimento
          const avesTot = activos.reduce((a, l) => a + l.aves, 0);
          const kgHuevoHoy = regsHoy.reduce((a, r) => a + Number(r.pesoKg || 0), 0);
          const masaHuevo = avesTot > 0 && kgHuevoHoy > 0 ? (kgHuevoHoy * 1000) / avesTot : null;
          const aguaHoy = regsHoy.reduce((a, r) => a + Number(r.aguaL || 0), 0);
          const alimHoy = regsHoy.reduce((a, r) => a + Number(r.alimentoKg || 0), 0);
          const ratioAgua = aguaHoy > 0 && alimHoy > 0 ? aguaHoy / alimHoy : null;
          const mort7 = activos.reduce((a, l) => a + registros.filter(r => r.lote === l.id).slice(0, 7).reduce((x, r) => x + Number(r.muertas || 0), 0), 0);
          const mort7Pct = avesTot > 0 ? (mort7 / avesTot) * 100 : 0;
          return (
            <>
              <Seccion titulo="🔍 Auditoría de gestión" sub="Tareas sin realizar, patrones anómalos y controles vencidos — lo que NO está pasando">
                {auditoria.length === 0 && <div style={{ fontSize: 13.5, color: C.verde, fontWeight: 600 }}>✓ Gestión al día — sin hallazgos de auditoría.</div>}
                {auditoria.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 9, padding: "9px 12px", background: a.nivel === "rojo" ? C.alertaSuave : C.yemaSuave, borderRadius: 10, marginBottom: 6, fontSize: 13, lineHeight: 1.5 }}>
                    <span>{a.nivel === "rojo" ? "🔴" : "🟡"}</span><span>{a.texto}</span>
                  </div>
                ))}
              </Seccion>

              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: C.verde, margin: "18px 0 10px", borderTop: `2px solid ${C.borde}`, paddingTop: 16 }}>📊 KPIs técnicos de la granja</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                <KPI etiqueta="Masa de huevo" valor={masaHuevo ? masaHuevo.toFixed(1) : "—"} unidad="g/ave/día" tono={masaHuevo && masaHuevo < 45 ? "alerta" : "ok"} sub="Meta en pico: 55–60" />
                <KPI etiqueta="Agua : alimento" valor={ratioAgua ? ratioAgua.toFixed(1) : "—"} unidad=": 1" tono={ratioAgua && (ratioAgua < 1.6 || ratioAgua > 2.6) ? "alerta" : "ok"} sub="Sano: 1.8–2.2" />
                <KPI etiqueta="Mortalidad 7d granja" valor={mort7Pct.toFixed(2)} unidad="%" tono={mort7Pct > 0.35 ? "alerta" : "ok"} sub={`${mort7} aves`} />
              </div>

              <Seccion titulo="Semáforo técnico por gallinero" sub="Todas las variables críticas cruzadas — verde bien · ámbar vigilar · rojo actuar">
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
                    <thead>
                      <tr style={{ color: C.textoSuave, fontSize: 11, textAlign: "right" }}>
                        <th style={{ textAlign: "left", padding: "5px 4px" }}>Gall.</th>
                        <th style={{ padding: "5px 4px" }}>Postura vs tabla</th>
                        <th style={{ padding: "5px 4px" }}>Consumo vs ración</th>
                        <th style={{ padding: "5px 4px" }}>Agua:alim</th>
                        <th style={{ padding: "5px 4px" }}>Mort. 7d</th>
                        <th style={{ padding: "5px 4px" }}>Peso vs tabla</th>
                        <th style={{ padding: "5px 4px" }}>Uniform.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activos.map(l => {
                        const regsL = registros.filter(r => r.lote === l.id).slice(0, 7);
                        const rU = regsL[0];
                        const post = rU && l.aves ? ((rU.cartones * HXC) / l.aves) * 100 : null;
                        const dPost = post != null && l.posturaIdeal ? post - l.posturaIdeal : null;
                        const cPost = dPost == null ? C.textoSuave : dPost <= -15 ? C.alerta : dPost <= -8 ? "#9A6605" : C.verde;
                        const gReal = rU && Number(rU.alimentoKg || 0) > 0 && l.aves ? (rU.alimentoKg * 1000) / l.aves : null;
                        const dCons = gReal != null && l.racionGAve > 0 ? ((gReal - l.racionGAve) / l.racionGAve) * 100 : null;
                        const cCons = dCons == null ? C.textoSuave : dCons < -5 ? C.alerta : Math.abs(dCons) > 5 ? "#9A6605" : C.verde;
                        const ratio = rU && Number(rU.aguaL || 0) > 0 && Number(rU.alimentoKg || 0) > 0 ? rU.aguaL / rU.alimentoKg : null;
                        const cAgua = ratio == null ? C.textoSuave : ratio < 1.6 || ratio > 2.6 ? "#9A6605" : C.verde;
                        const m7 = regsL.reduce((a, r) => a + Number(r.muertas || 0), 0);
                        const pM7 = l.aves ? (m7 / l.aves) * 100 : null;
                        const cM7 = pM7 == null ? C.textoSuave : pM7 > 0.7 ? C.alerta : pM7 > 0.35 ? "#9A6605" : C.verde;
                        const pes = pesajes.find(p2 => p2.lote === l.id);
                        const stP = pes ? statsPesaje(pes) : null;
                        const metaP = Number(l.pesoMeta) || (pes ? Number(pes.meta) : 0) || 0;
                        const dPeso = stP && metaP ? ((stP.prom - metaP) / metaP) * 100 : null;
                        const cPeso = dPeso == null ? C.textoSuave : dPeso <= -10 ? C.alerta : dPeso <= -4 || dPeso >= 8 ? "#9A6605" : C.verde;
                        const cUnif = !stP ? C.textoSuave : stP.unif < 80 ? C.alerta : stP.unif < 85 ? "#9A6605" : C.verde;
                        const celd = { padding: "8px 4px", textAlign: "right", fontWeight: 600 };
                        return (
                          <tr key={l.id} style={{ borderTop: `1px solid ${C.borde}` }}>
                            <td style={{ padding: "8px 4px", fontWeight: 700 }}>G{l.galpon}</td>
                            <td style={{ ...celd, color: cPost }}>{dPost != null ? `${post.toFixed(1)}% (${dPost > 0 ? "+" : ""}${dPost.toFixed(1)})` : "—"}</td>
                            <td style={{ ...celd, color: cCons }}>{dCons != null ? `${dCons > 0 ? "+" : ""}${dCons.toFixed(0)}%` : "—"}</td>
                            <td style={{ ...celd, color: cAgua }}>{ratio != null ? ratio.toFixed(1) : "—"}</td>
                            <td style={{ ...celd, color: cM7 }}>{pM7 != null ? `${pM7.toFixed(2)}%` : "—"}</td>
                            <td style={{ ...celd, color: cPeso }}>{dPeso != null ? `${dPeso > 0 ? "+" : ""}${dPeso.toFixed(1)}%` : "—"}</td>
                            <td style={{ ...celd, color: cUnif }}>{stP ? `${stP.unif.toFixed(0)}%` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Seccion>
            </>
          );
        })()}
        {vista === "reporte" && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <KPI etiqueta="% Postura" valor={posturaDia.toFixed(1)} unidad="%" tono={posturaDia < 80 ? "alerta" : "ok"} sub={`${huevosDia.toLocaleString()} huevos · Est.: ≥85%`} />
              <KPI etiqueta="Conversión (7d)" valor={conversion ? conversion.toFixed(2) : "—"} unidad="kg/kg" tono={conversion > 2.2 ? "alerta" : "ok"} sub="Est. industria: ≤2.2" />
              <KPI etiqueta="Conv. por cartón (7d)" valor={convCarton ? convCarton.toFixed(2) : "—"} unidad="kg" tono={convCarton > 4.6 ? "alerta" : "ok"} sub="Est.: 4.1–4.6 kg/cartón" />
              <KPI etiqueta="Consumo (7d)" valor={consumoGAve.toFixed(0)} unidad="g/ave" tono={consumoGAve > 120 || (consumoGAve > 0 && consumoGAve < 100) ? "alerta" : "ok"} sub="Est. café adulta: 105–120 g" />
              <KPI etiqueta="% Quebrado (7d)" valor={pctQueb.toFixed(1)} unidad="%" tono={pctQueb > 3 ? "alerta" : "ok"} sub={`Vendibles: ${(100 - pctQueb).toFixed(1)}% · Est.: <3%`} />
              <KPI etiqueta="Peso prom. huevo" valor={pesoProm ? pesoProm.toFixed(1) : "—"} unidad="g" tono={pesoProm > 0 && pesoProm < 55 ? "alerta" : "ok"} sub="Est. adultas: 58–66 g" />
            </div>

            <Seccion titulo="Postura — últimos 14 días" sub="Desde los controles diarios">
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <LineChart data={tendencia} margin={{ top: 5, right: 8, bottom: 0, left: -22 }}>
                    <XAxis dataKey="dia" tick={{ fontSize: 10.5, fill: C.textoSuave }} tickLine={false} axisLine={{ stroke: C.borde }} interval={2} />
                    <YAxis domain={[50, 100]} tick={{ fontSize: 10.5, fill: C.textoSuave }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => [`${v}%`, "Postura"]} contentStyle={{ borderRadius: 10, border: `1px solid ${C.borde}`, fontSize: 13 }} />
                    <ReferenceLine y={metaGenetica} stroke={C.verde} strokeDasharray="5 4" strokeWidth={1.5} />
                    <Line type="monotone" dataKey="postura" stroke={C.yema} strokeWidth={2.5} dot={{ r: 2.5, fill: C.yema }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Seccion>

            <Seccion titulo="Indicadores por lote — con estándar de industria" sub="HAA: huevos por ave alojada · Pico: máximo % de postura alcanzado (promedio 7d) · Persist.: postura actual vs pico">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 620 }}>
                  <thead>
                    <tr style={{ color: C.textoSuave, textAlign: "right", fontSize: 11.5 }}>
                      <th style={{ textAlign: "left", padding: "6px 4px" }}>Lote</th>
                      <th style={{ padding: "6px 4px" }}>HAA</th>
                      <th style={{ padding: "6px 4px" }}>Viabilidad<br /><span style={{ fontWeight: 400 }}>est. &gt;94%</span></th>
                      <th style={{ padding: "6px 4px" }}>Conv. lote<br /><span style={{ fontWeight: 400 }}>est. ≤2.2</span></th>
                      <th style={{ padding: "6px 4px" }}>PICO<br /><span style={{ fontWeight: 400 }}>est. 92–96%</span></th>
                      <th style={{ padding: "6px 4px" }}>Persist.<br /><span style={{ fontWeight: 400 }}>vs pico</span></th>
                      <th style={{ padding: "6px 4px" }}>₡ alim/cartón</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activos.map(l => {
                      const haa = l.acumHuevos / l.avesIniciales;
                      const viab = (l.aves / l.avesIniciales) * 100;
                      const convLote = l.acumMasaKg > 0 ? l.acumAlimentoKg / l.acumMasaKg : 0;
                      const costoKg = Number(costos[l.formula] || 0);
                      const costoCarton = costoKg > 0 && l.acumHuevos > 0 ? (l.acumAlimentoKg * costoKg) / (l.acumHuevos / HXC) : 0;
                      // Pico: máximo de la media móvil 7d de postura en el histórico del lote
                      const regsL = registros.filter(r => r.lote === l.id);
                      let pico = null, picoIdx = -1;
                      for (let i = 0; i + 7 <= regsL.length || (i === 0 && regsL.length > 0); i++) {
                        const ven = regsL.slice(i, i + 7);
                        if (!ven.length) break;
                        const pm = ven.reduce((a, r) => a + (r.cartones * HXC), 0) / ven.length / l.aves * 100;
                        if (pico == null || pm > pico) { pico = pm; picoIdx = i; }
                        if (i + 7 > regsL.length) break;
                      }
                      const rU = regsL[0];
                      const postAct = rU && l.aves ? ((rU.cartones * HXC) / l.aves) * 100 : null;
                      const persist = pico != null && postAct != null ? postAct - pico : null;
                      const cPico = pico == null ? C.textoSuave : pico >= 90 ? C.verde : pico >= 82 ? "#9A6605" : C.alerta;
                      const cPers = persist == null ? C.textoSuave : persist >= -6 ? C.verde : persist >= -12 ? "#9A6605" : C.alerta;
                      return (
                        <tr key={l.id} style={{ borderTop: `1px solid ${C.borde}`, textAlign: "right" }}>
                          <td style={{ textAlign: "left", padding: "9px 4px", fontWeight: 600 }}>G{l.galpon}<div style={{ fontSize: 11, color: C.textoSuave, fontWeight: 400 }}>{l.raza} · {semanasDe(l.nac).toFixed(0)} sem</div></td>
                          <td style={{ padding: "9px 4px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>{haa.toFixed(1)}</td>
                          <td style={{ padding: "9px 4px", color: viab < 94 ? (viab < 88 ? C.alerta : "#9A6605") : C.verde, fontWeight: 600 }}>{viab.toFixed(1)}%</td>
                          <td style={{ padding: "9px 4px", color: !convLote ? C.textoSuave : convLote > 2.2 ? C.alerta : C.verde, fontWeight: 600 }}>{convLote ? convLote.toFixed(2) : "—"}</td>
                          <td style={{ padding: "9px 4px", color: cPico, fontWeight: 700 }}>{pico != null ? `${pico.toFixed(1)}%` : "—"}</td>
                          <td style={{ padding: "9px 4px", color: cPers, fontWeight: 600 }}>{persist != null ? `${persist > 0 ? "+" : ""}${persist.toFixed(1)} pts` : "—"}</td>
                          <td style={{ padding: "9px 4px" }}>{costoCarton ? `₡${costoCarton.toFixed(0)}` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Seccion>

            <Seccion titulo="Economía — margen sobre alimento (IOFC)" sub="El indicador que une lo técnico con la plata: ingreso del huevo menos costo del alimento">
              {(() => {
                const precioCart = Number(costos._precioVenta || 0);
                const rsU = ultDia ? registros.filter(r => r.fecha === ultDia) : [];
                let costoAlimDia = 0, hayCostos = false;
                rsU.forEach(r => {
                  const ll = lotes.find(x => x.id === r.lote);
                  const ck = Number(costos[ll?.formula] || 0);
                  if (ck > 0) { hayCostos = true; costoAlimDia += Number(r.alimentoKg || 0) * ck; }
                });
                const cartDia = rsU.reduce((a, r) => a + Number(r.cartones || 0), 0);
                const ingreso = precioCart > 0 ? cartDia * precioCart : 0;
                const iofc = ingreso > 0 && hayCostos ? ingreso - costoAlimDia : null;
                const iofcCart = iofc != null && cartDia > 0 ? iofc / cartDia : null;
                return (
                  <>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                      <Campo mitad etiqueta="Precio de venta ₡ por cartón" type="text" inputMode="decimal" placeholder="ej. 1800" value={costos._precioVenta ?? ""}
                        onChange={e => setCostos({ ...costos, _precioVenta: e.target.value })} onBlur={() => guardarCostos(costos)} />
                    </div>
                    {iofc != null ? (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                        <KPI etiqueta="Margen s/ alimento (día)" valor={`₡${iofc.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} unidad="" tono={iofc > 0 ? "ok" : "alerta"} sub={`Ingreso ₡${ingreso.toLocaleString(undefined, { maximumFractionDigits: 0 })} − alimento ₡${costoAlimDia.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                        <KPI etiqueta="Margen por cartón" valor={`₡${iofcCart.toFixed(0)}`} unidad="" tono={iofcCart > 0 ? "ok" : "alerta"} sub="Sobre costo de alimento" />
                      </div>
                    ) : (
                      <div style={{ fontSize: 12.5, color: C.textoSuave, marginBottom: 12 }}>Llena el precio de venta y los costos ₡/kg de abajo para activar el margen.</div>
                    )}
                  </>
                );
              })()}
            </Seccion>

            <Seccion titulo="Costo del concentrado (₡ por kg)" sub="Llénalo para activar el KPI de ₡ alimento por cartón y el margen">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {Object.keys(recetas.formulas).map(f => (
                  <label key={f} style={{ flex: "1 1 30%", minWidth: 130 }}>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{f} <span style={{ color: C.textoSuave, fontWeight: 400 }}>({recetas.formulas[f].uso})</span></span>
                    <input type="text" inputMode="decimal" placeholder="₡/kg" value={costos[f] ?? ""}
                      onChange={e => setCostos({ ...costos, [f]: e.target.value })}
                      onBlur={() => guardarCostos(costos)}
                      style={inputStyle} />
                  </label>
                ))}
              </div>
            </Seccion>
          </>
        )}

        {/* ══ HISTORIAL ══ */}
        {vista === "cxp" && (() => {
          const provsConocidos = [...new Set([...mpCat.map(m => m.prov).filter(Boolean), ...insumos.map(i2 => i2.proveedor).filter(Boolean), ...cxp.facturas.map(f => f.proveedor)])];
          const porProv = {};
          facturasAbiertas.forEach(f => {
            if (!porProv[f.proveedor]) porProv[f.proveedor] = [0, 0, 0, 0];
            porProv[f.proveedor][agingBucket(f)] += saldoDe(f);
          });
          const pagadas = cxp.facturas.filter(f => saldoDe(f) <= 0.005);
          return (
            <>
              <button onClick={() => setPrintDoc({ tipo: "cxp" })} style={{ marginBottom: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif", width: "100%" }}>🖨 Imprimir estado de cuentas por pagar</button>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <KPI etiqueta="Total por pagar" valor={colones(cxpTotal)} unidad="" tono={cxpVencido > 0 ? "alerta" : "ok"} sub={`${facturasAbiertas.length} factura(s) abierta(s)`} />
                <KPI etiqueta="Vencido" valor={colones(cxpVencido)} unidad="" tono={cxpVencido > 0 ? "alerta" : "ok"} />
                <KPI etiqueta="Vence en 7 días" valor={colones(cxpProx7)} unidad="" />
              </div>

              <Seccion titulo="Registrar factura recibida" sub="El documento del proveedor entra aquí el día que llega">
                {!fCxpFac && <button onClick={() => setFCxpFac({ tipo: "Factura", refId: "", proveedor: "", numero: "", emision: new Date().toISOString().slice(0, 10), vence: new Date().toISOString().slice(0, 10), monto: "", categoria: "Materia prima", detalle: "" })} style={btnStyle}>+ Nuevo documento (factura / NC / ND)</button>}
                {fCxpFac && (
                  <>
                    <label style={{ display: "block", marginBottom: 12 }}>
                      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Tipo de documento</span>
                      <select value={fCxpFac.tipo || "Factura"} onChange={e => setFCxpFac({ ...fCxpFac, tipo: e.target.value })} style={inputStyle}>
                        <option value="Factura">Factura (aumenta la deuda)</option>
                        <option value="ND">Nota de Débito (aumenta la deuda: intereses, fletes, ajustes)</option>
                        <option value="NC">Nota de Crédito (disminuye la deuda: devoluciones, descuentos)</option>
                      </select>
                    </label>
                    {(fCxpFac.tipo === "NC" || fCxpFac.tipo === "ND") && (
                      <label style={{ display: "block", marginBottom: 12 }}>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Aplicar a la factura</span>
                        <select value={fCxpFac.refId} onChange={e => setFCxpFac({ ...fCxpFac, refId: e.target.value })} style={inputStyle}>
                          <option value="">— Elige la factura afectada —</option>
                          {facturasAbiertas.map(f2 => <option key={f2.id} value={f2.id}>{f2.proveedor} #{f2.numero || "s/n"} — saldo {colones(saldoDe(f2))}</option>)}
                        </select>
                      </label>
                    )}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <label style={{ display: "block", marginBottom: 12, flex: "1 1 45%", minWidth: 150, ...(fCxpFac.tipo !== "Factura" ? { display: "none" } : {}) }}>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Proveedor</span>
                        <input list="provs-cxp" value={fCxpFac.proveedor} onChange={e => setFCxpFac({ ...fCxpFac, proveedor: e.target.value })} style={inputStyle} placeholder="Nombre del proveedor" />
                        <datalist id="provs-cxp">{provsConocidos.map(p2 => <option key={p2} value={p2} />)}</datalist>
                      </label>
                      <Campo mitad etiqueta="No. de factura" type="text" placeholder="ej. 00123" value={fCxpFac.numero} onChange={e => setFCxpFac({ ...fCxpFac, numero: e.target.value })} />
                      <label style={{ display: "block", marginBottom: 12, flex: "1 1 45%", minWidth: 140 }}>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha de emisión</span>
                        <input type="date" value={fCxpFac.emision} onChange={e => setFCxpFac({ ...fCxpFac, emision: e.target.value })} style={inputStyle} />
                      </label>
                      <label style={{ display: "block", marginBottom: 12, flex: "1 1 45%", minWidth: 140, ...(fCxpFac.tipo && fCxpFac.tipo !== "Factura" ? { display: "none" } : {}) }}>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha de vencimiento</span>
                        <input type="date" value={fCxpFac.vence} onChange={e => setFCxpFac({ ...fCxpFac, vence: e.target.value })} style={inputStyle} />
                      </label>
                      <Campo mitad etiqueta="Monto total ₡" type="text" inputMode="decimal" placeholder="ej. 850000" value={fCxpFac.monto} onChange={e => setFCxpFac({ ...fCxpFac, monto: e.target.value })} />
                      <label style={{ display: "block", marginBottom: 12, flex: "1 1 45%", minWidth: 140, ...(fCxpFac.tipo && fCxpFac.tipo !== "Factura" ? { display: "none" } : {}) }}>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Categoría</span>
                        <select value={fCxpFac.categoria} onChange={e => setFCxpFac({ ...fCxpFac, categoria: e.target.value })} style={inputStyle}>
                          {["Materia prima", "Insumos y medicamentos", "Pollonas", "Servicios", "Mantenimiento", "Otros"].map(c2 => <option key={c2}>{c2}</option>)}
                        </select>
                      </label>
                    </div>
                    <Campo etiqueta="Detalle (opcional)" type="text" placeholder="ej. Maíz 200 qq + soya 80 qq" value={fCxpFac.detalle} onChange={e => setFCxpFac({ ...fCxpFac, detalle: e.target.value })} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={async () => {
                        const tipo = fCxpFac.tipo || "Factura";
                        if (tipo === "Factura") {
                          if (!fCxpFac.proveedor || !Number(fCxpFac.monto)) { avisar("⚠ Proveedor y monto son obligatorios"); return; }
                          const nueva = { id: Date.now(), proveedor: fCxpFac.proveedor.trim(), numero: fCxpFac.numero.trim(), emision: fCxpFac.emision.split("-").reverse().join("/"), vence: fCxpFac.vence.split("-").reverse().join("/"), monto: Number(fCxpFac.monto), categoria: fCxpFac.categoria, detalle: fCxpFac.detalle, registrada: hoyStr() };
                          if (await guardarCxp(c3 => ({ ...c3, facturas: [nueva, ...c3.facturas] }))) { setFCxpFac(null); avisar("✓ Factura registrada"); }
                        } else {
                          const fRef = cxp.facturas.find(x => String(x.id) === String(fCxpFac.refId));
                          if (!fRef) { avisar("⚠ Elige la factura a la que aplica la nota"); return; }
                          const m2 = Number(fCxpFac.monto || 0);
                          if (m2 <= 0) { avisar("⚠ Ingresa el monto de la nota"); return; }
                          if (tipo === "NC" && m2 > saldoDe(fRef) + 0.01) { avisar(`⚠ La NC (${colones(m2)}) supera el saldo de la factura (${colones(saldoDe(fRef))})`); return; }
                          const nota = { id: Date.now(), tipo, facturaId: fRef.id, numero: fCxpFac.numero.trim(), fecha: fCxpFac.emision.split("-").reverse().join("/"), monto: m2, detalle: fCxpFac.detalle, por: completadoPor };
                          if (await guardarCxp(c3 => ({ ...c3, notas: [nota, ...(c3.notas || [])] }))) {
                            setFCxpFac(null);
                            avisar(`✓ ${tipo === "NC" ? "Nota de Crédito" : "Nota de Débito"} aplicada a ${fRef.proveedor} #${fRef.numero || "s/n"} — nuevo saldo ${colones(saldoDe(fRef) + (tipo === "ND" ? m2 : -m2))}`);
                          }
                        }
                      }} style={{ ...btnStyle, flex: 1 }}>{(fCxpFac.tipo || "Factura") === "Factura" ? "Guardar factura" : fCxpFac.tipo === "NC" ? "Aplicar Nota de Crédito" : "Aplicar Nota de Débito"}</button>
                      <button onClick={() => setFCxpFac(null)} style={{ flex: "0 0 auto", padding: "12px 16px", fontSize: 14, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer" }}>Cancelar</button>
                    </div>
                  </>
                )}
              </Seccion>

              <Seccion titulo="Facturas pendientes — por proveedor" sub="Lista consecutiva con acumulado; el saldo corre factura a factura">
                {facturasAbiertas.length === 0 && <div style={{ fontSize: 13.5, color: C.verde, fontWeight: 600 }}>✓ Sin cuentas por pagar — todo al día.</div>}
                {(() => {
                  const grupos = {};
                  facturasAbiertas.forEach(f => { (grupos[f.proveedor] = grupos[f.proveedor] || []).push(f); });
                  return Object.entries(grupos).map(([pv, fs]) => {
                    const totalProv = fs.reduce((a, f) => a + saldoDe(f), 0);
                    let acum = 0;
                    return (
                      <div key={pv} style={{ background: C.superficie, border: `1px solid ${C.borde}`, borderRadius: 14, padding: "12px 12px 6px", marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          <b style={{ fontSize: 15 }}>{pv}</b>
                          <span style={{ fontSize: 13 }}>{fs.length} factura(s) · <b style={{ color: C.verde }}>{colones(totalProv)}</b></span>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
                            <thead>
                              <tr style={{ color: C.textoSuave, fontSize: 11, textAlign: "right" }}>
                                <th style={{ textAlign: "left", padding: "4px 4px" }}>No. factura</th>
                                <th style={{ padding: "4px 4px" }}>Vence</th>
                                <th style={{ padding: "4px 4px" }}>Últ. pago</th>
                                <th style={{ padding: "4px 4px" }}>Saldo</th>
                                <th style={{ padding: "4px 4px" }}>Acumulado</th>
                                <th style={{ padding: "4px 4px" }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {fs.map(f => {
                                const d = diasVence(f); const sal = saldoDe(f); const pag = pagadoDe(f.id);
                                acum += sal;
                                const acumFila = acum;
                                const pagosF = cxp.pagos.filter(pg => pg.facturaId === f.id);
                                const ultPago = pagosF.length ? pagosF[0].fecha.slice(0, 5) : "—";
                                const cV = d < 0 ? C.alerta : d <= 7 ? "#9A6605" : C.texto;
                                return (
                                  <React.Fragment key={f.id}>
                                    <tr style={{ borderTop: `1px solid ${C.borde}`, textAlign: "right" }}>
                                      <td style={{ textAlign: "left", padding: "9px 4px", fontWeight: 600 }}>
                                        #{f.numero || "s/n"}
                                        <div style={{ fontSize: 10.5, color: C.textoSuave, fontWeight: 400 }}>{f.categoria}{pag > 0 ? ` · abonado ${colones(pag)}` : ""}{notasDe(f.id).map(n2 => ` · ${n2.tipo} #${n2.numero || "s/n"} ${n2.tipo === "ND" ? "+" : "−"}${colones(n2.monto)}`).join("")}</div>
                                      </td>
                                      <td style={{ padding: "9px 4px", color: cV, fontWeight: 700, whiteSpace: "nowrap" }}>{f.vence.slice(0, 5)}{d < 0 ? ` (${-d}d)` : ""}</td>
                                      <td style={{ padding: "9px 4px", whiteSpace: "nowrap" }}>{ultPago}</td>
                                      <td style={{ padding: "9px 4px", fontWeight: 700, whiteSpace: "nowrap" }}>{colones(sal)}</td>
                                      <td style={{ padding: "9px 4px", fontWeight: 700, color: C.verde, whiteSpace: "nowrap" }}>{colones(acumFila)}</td>
                                      <td style={{ padding: "9px 4px", whiteSpace: "nowrap" }}>
                                        <button onClick={() => { setAbonando(abonando === f.id ? null : f.id); setFAbono({ monto: String(sal), fecha: new Date().toISOString().slice(0, 10), medio: "Transferencia", ref: "" }); }}
                                          style={{ padding: "6px 10px", fontSize: 12, fontWeight: 600, background: C.verde, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>💸 Pago</button>
                                        <button onClick={async () => {
                                          if (confirmar !== `delfac${f.id}`) { setConfirmar(`delfac${f.id}`); avisar("⚠ Toca otra vez para ELIMINAR la factura y sus pagos"); setTimeout(() => setConfirmar(c2 => c2 === `delfac${f.id}` ? null : c2), 6000); return; }
                                          setConfirmar(null);
                                          await guardarCxp(c3 => ({ ...c3, facturas: c3.facturas.filter(x => x.id !== f.id), pagos: c3.pagos.filter(x => x.facturaId !== f.id), notas: (c3.notas || []).filter(x => x.facturaId !== f.id) }));
                                          avisar("✓ Factura eliminada");
                                        }} style={{ marginLeft: 4, padding: "6px 8px", fontSize: 12, background: confirmar === `delfac${f.id}` ? C.alerta : "#F1F1EA", color: confirmar === `delfac${f.id}` ? "#fff" : C.textoSuave, border: "none", borderRadius: 8, cursor: "pointer" }}>🗑</button>
                                      </td>
                                    </tr>
                                    {abonando === f.id && (
                                      <tr><td colSpan={6} style={{ padding: "4px 0 10px" }}>
                                        <div style={{ background: C.fondo, borderRadius: 10, padding: 10, textAlign: "left" }}>
                                          {f.detalle && <div style={{ fontSize: 11.5, color: C.textoSuave, marginBottom: 6 }}>{f.detalle} · original {colones(f.monto)}</div>}
                                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                            <Campo mitad etiqueta={`Monto del pago (saldo: ${colones(sal)})`} type="text" inputMode="decimal" value={fAbono.monto} onChange={e => setFAbono({ ...fAbono, monto: e.target.value })} />
                                            <label style={{ display: "block", marginBottom: 12, flex: "1 1 45%", minWidth: 130 }}>
                                              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha del pago</span>
                                              <input type="date" value={fAbono.fecha} onChange={e => setFAbono({ ...fAbono, fecha: e.target.value })} style={inputStyle} />
                                            </label>
                                            <label style={{ display: "block", marginBottom: 12, flex: "1 1 45%", minWidth: 130 }}>
                                              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Medio de pago</span>
                                              <select value={fAbono.medio} onChange={e => setFAbono({ ...fAbono, medio: e.target.value })} style={inputStyle}>
                                                {["Transferencia", "SINPE Móvil", "Efectivo", "Cheque", "Tarjeta", "Otro"].map(m2 => <option key={m2}>{m2}</option>)}
                                              </select>
                                            </label>
                                            <Campo mitad etiqueta="Referencia / comprobante" type="text" placeholder="ej. Nº transf. 45821" value={fAbono.ref} onChange={e => setFAbono({ ...fAbono, ref: e.target.value })} />
                                          </div>
                                          <div style={{ display: "flex", gap: 8 }}>
                                            <button onClick={async () => {
                                              const m2 = Number(fAbono.monto || 0);
                                              if (m2 <= 0) { avisar("⚠ Ingresa el monto del pago"); return; }
                                              if (m2 > sal + 0.01) { avisar(`⚠ El pago (${colones(m2)}) supera el saldo (${colones(sal)})`); return; }
                                              const pago = { id: Date.now(), facturaId: f.id, fecha: fAbono.fecha.split("-").reverse().join("/"), monto: m2, medio: fAbono.medio, ref: fAbono.ref, por: completadoPor };
                                              if (await guardarCxp(c3 => ({ ...c3, pagos: [pago, ...c3.pagos] }))) {
                                                setAbonando(null);
                                                avisar(m2 >= sal - 0.01 ? `✓ Factura de ${f.proveedor} PAGADA por completo` : `✓ Abono registrado — queda saldo de ${colones(sal - m2)}`);
                                              }
                                            }} style={{ ...btnStyle, flex: 1 }}>Confirmar pago</button>
                                            <button onClick={() => setAbonando(null)} style={{ flex: "0 0 auto", padding: "12px 16px", fontSize: 14, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer" }}>Cancelar</button>
                                          </div>
                                        </div>
                                      </td></tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  });
                })()}
              </Seccion>

              <Seccion titulo="Antigüedad de saldos por proveedor" sub="El clásico aging: corriente · 1–30 · 31–60 · +60 días de vencido">
                {Object.keys(porProv).length === 0 && <div style={{ fontSize: 13, color: C.textoSuave }}>Sin saldos abiertos.</div>}
                {Object.keys(porProv).length > 0 && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 480 }}>
                      <thead><tr style={{ color: C.textoSuave, fontSize: 11, textAlign: "right" }}>
                        <th style={{ textAlign: "left", padding: "5px 4px" }}>Proveedor</th><th style={{ padding: "5px 4px" }}>Corriente</th><th style={{ padding: "5px 4px" }}>1–30</th><th style={{ padding: "5px 4px" }}>31–60</th><th style={{ padding: "5px 4px" }}>+60</th><th style={{ padding: "5px 4px" }}>Total</th>
                      </tr></thead>
                      <tbody>
                        {Object.entries(porProv).map(([pv, b]) => (
                          <tr key={pv} style={{ borderTop: `1px solid ${C.borde}`, textAlign: "right" }}>
                            <td style={{ textAlign: "left", padding: "8px 4px", fontWeight: 600 }}>{pv}</td>
                            <td style={{ padding: "8px 4px" }}>{b[0] ? colones(b[0]) : "—"}</td>
                            <td style={{ padding: "8px 4px", color: b[1] ? "#9A6605" : undefined }}>{b[1] ? colones(b[1]) : "—"}</td>
                            <td style={{ padding: "8px 4px", color: b[2] ? C.alerta : undefined }}>{b[2] ? colones(b[2]) : "—"}</td>
                            <td style={{ padding: "8px 4px", color: b[3] ? C.alerta : undefined, fontWeight: b[3] ? 700 : 400 }}>{b[3] ? colones(b[3]) : "—"}</td>
                            <td style={{ padding: "8px 4px", fontWeight: 700 }}>{colones(b[0] + b[1] + b[2] + b[3])}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: `2px solid ${C.texto}`, textAlign: "right" }}>
                          <td style={{ textAlign: "left", padding: "8px 4px", fontWeight: 700 }}>TOTAL</td>
                          {[0, 1, 2, 3].map(i2 => <td key={i2} style={{ padding: "8px 4px", fontWeight: 700 }}>{colones(Object.values(porProv).reduce((a, b) => a + b[i2], 0))}</td>)}
                          <td style={{ padding: "8px 4px", fontWeight: 700 }}>{colones(cxpTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </Seccion>

              {(pagadas.length > 0 || cxp.pagos.length > 0) && (
                <Seccion titulo="Historial de pagos" sub="Los últimos movimientos — el detalle completo vive en la exportación">
                  {[...cxp.pagos.map(pg => ({ ...pg, _t: "Pago" })), ...(cxp.notas || []).map(n2 => ({ ...n2, _t: n2.tipo }))]
                    .sort((a, b) => b.id - a.id).slice(0, 14).map(mv => {
                    const f = cxp.facturas.find(x => x.id === mv.facturaId);
                    const et = mv._t === "Pago" ? mv.medio : mv._t === "NC" ? "Nota de Crédito" : "Nota de Débito";
                    const colM = mv._t === "ND" ? C.alerta : C.verde;
                    return (
                      <div key={mv._t + mv.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "7px 0", borderBottom: `1px solid ${C.borde}`, flexWrap: "wrap" }}>
                        <span>{mv.fecha.slice(0, 5)} · <b>{f?.proveedor || "—"}</b> #{f?.numero || "s/n"} · {et}{mv.ref ? ` (${mv.ref})` : ""}</span>
                        <b style={{ color: colM }}>{mv._t === "ND" ? "+" : "−"}{colones(mv.monto)}</b>
                      </div>
                    );
                  })}
                </Seccion>
              )}
            </>
          );
        })()}

        {vista === "historial" && (() => {
          const aDMY = (iso) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
          const fSel = aDMY(histFecha);
          const rsDia = registros.filter(r => r.fecha === fSel);
          const movDia = bodegaMovs.find(m => m.fecha === fSel);
          const medsDia = medicaciones.filter(m => m.fecha === fSel);
          const fumsDia = fumigaciones.filter(m => m.fecha === fSel);
          const bitDia = bitacora.filter(b => b.fecha === fSel);
          const plantaDia = plantaMovs.filter(m => m.fecha === fSel);

          const [anioM, mesM] = histMes.split("-");
          const claveMes = `${mesM}/${anioM}`;
          const nombreMes = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][Number(mesM)];
          const fechasMes = fechas.filter(f => mesDe(f) === claveMes);
          const rsMes = registros.filter(r => fechasMes.includes(r.fecha));
          const resMesLote = lotes.map(l => {
            const rs = rsMes.filter(r => r.lote === l.id);
            const cart = rs.reduce((s, r) => s + r.cartones, 0);
            const alim = rs.reduce((s, r) => s + Number(r.alimentoKg || 0), 0);
            const masa = rs.reduce((s, r) => s + Number(r.pesoKg || 0), 0);
            const muertas = rs.reduce((s, r) => s + Number(r.muertas || 0), 0);
            const dias = new Set(rs.map(r => r.fecha)).size;
            return { l, cart, huevos: cart * HXC, alim, muertas, dias, conv: masa > 0 ? alim / masa : 0, postura: dias && l.aves ? (cart * HXC / (l.aves * dias)) * 100 : 0 };
          });
          const totMes = {
            cart: resMesLote.reduce((s, x) => s + x.cart, 0),
            alim: resMesLote.reduce((s, x) => s + x.alim, 0),
            muertas: resMesLote.reduce((s, x) => s + x.muertas, 0),
          };

          const exportar = () => {
            try {
              const wb = XLSX.utils.book_new();
              const filasProd = (rsMes.length ? rsMes : registros).map(r => ({
                Fecha: r.fecha, Gallinero: r.lote, Cartones: r.cartones, Huevos: r.cartones * HXC,
                "Peso (kg)": r.pesoKg, Quebrados: r.quebrados, Muertas: r.muertas, Diagnóstico: r.dx,
                "Alimento 6am (kg)": r.alimento6am ?? "", "Alimento 1pm (kg)": r.alimento1pm ?? "",
                "Alimento total (kg)": r.alimentoKg, "Capturado por": r.por,
              }));
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasProd), "Produccion");
              const filasBod = bodegaMovs.filter(m => !rsMes.length || mesDe(m.fecha) === claveMes).map(m => ({
                Fecha: m.fecha, "Producido": m.producido, "Comprado": m.comprado, "Ruta neta": m.rutaNeta,
                "Vendido granja": m.vendGranja, "Destruido": m.destruido, "Regalado": m.regalado, "Saldo final": m.saldoFinal, Observaciones: m.obs,
              }));
              if (filasBod.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasBod), "Bodega");
              const filasMed = medicaciones.filter(m => !rsMes.length || mesDe(m.fecha) === claveMes).map(m => ({
                Fecha: m.fecha, Tipo: m.tipo || "Medicamento", Gallinero: m.galpon, Producto: m.producto, Dosis: m.dosis, "Enfermedad tratada": m.enfermedad || "",
              }));
              if (filasMed.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasMed), "Medicacion");
              const filasVac = vacunas.map(v => { const lv = lotes.find(x => x.id === v.lote); return { Fecha: v.fecha, Gallinero: lv ? `G${lv.galpon}` : v.lote, Vacuna: v.vacuna, Cepa: v.cepa || "", Vía: v.via || "", Proveedor: v.proveedor || "", "Registrado por": v.por || "" }; });
              if (filasVac.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasVac), "Vacunacion");
              const filasEnf = enfermedades.map(e2 => { const le = lotes.find(x => x.id === e2.lote); return { Fecha: e2.fecha, Gallinero: le ? `G${le.galpon}` : e2.lote, Enfermedad: e2.enfermedad, Tratamiento: e2.tratamiento || "", Estado: e2.estado, "Fecha alta": e2.fechaAlta || "" }; });
              if (filasEnf.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasEnf), "Enfermedades");
              const filasNec = necropsias.map(n2 => { const ln = lotes.find(x => x.id === n2.lote); return { Fecha: n2.fecha, Gallinero: ln ? `G${ln.galpon}` : n2.lote, Tipo: n2.tipo, Laboratorio: n2.laboratorio || "", Hallazgos: n2.hallazgos || "", Fotos: n2.numFotos || 0 }; });
              if (filasNec.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasNec), "Necropsias");
              const filasIns = insumosMovs.map(m => { const it = insumos.find(x => x.id === m.itemId); return { Fecha: m.fecha, Insumo: it?.nombre || "", Categoría: it?.categoria || "", Tipo: m.tipo, Cantidad: m.cantidad, Unidad: it?.unidad || "", Presentación: it?.presentacion || "", Dosis: it?.dosis || "", Proveedor: it?.proveedor || "", Detalle: m.detalle || "", Automático: m.auto ? "Sí" : "" }; });
              if (filasIns.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasIns), "Insumos");
              XLSX.writeFile(wb, `RanchoElSonado_${claveMes.replace("/", "-")}.xlsx`);
              avisar("✓ Excel exportado");
            } catch { avisar("⚠ No se pudo exportar"); }
          };

          return (
            <>
              <Seccion titulo="Consultar un día" sub="Elige la fecha para ver el día completo">
                <input type="date" value={histFecha} onChange={e => setHistFecha(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
              <button onClick={() => setPrintDoc({ tipo: "controldiario", fecha: aDMY(histFecha) })}
                style={{ marginTop: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif", width: "100%" }}>
                🖨 Imprimir reporte diario de esta fecha
              </button>
                {rsDia.length === 0 && <div style={{ fontSize: 13.5, color: C.textoSuave }}>Sin registros para el {fSel}.</div>}
                {rsDia.length > 0 && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ color: C.textoSuave, textAlign: "right", fontSize: 12 }}>
                          <th style={{ textAlign: "left", padding: "6px 4px" }}>Gallinero</th>
                          <th style={{ padding: "6px 4px" }}>Cartones</th>
                          <th style={{ padding: "6px 4px" }}>Quebrados</th>
                          <th style={{ padding: "6px 4px" }}>Muertas</th>
                          <th style={{ padding: "6px 4px" }}>Alimento kg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rsDia.map((r, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${C.borde}`, textAlign: "right" }}>
                            <td style={{ textAlign: "left", padding: "8px 4px", fontWeight: 600 }}>{r.lote}{r.dx && <div style={{ fontSize: 11, color: C.alerta, fontWeight: 400 }}>Dx: {r.dx}</div>}</td>
                            <td style={{ padding: "8px 4px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>{r.cartones}</td>
                            <td style={{ padding: "8px 4px" }}>{r.quebrados}</td>
                            <td style={{ padding: "8px 4px", color: r.muertas > 3 ? C.alerta : C.texto }}>{r.muertas}</td>
                            <td style={{ padding: "8px 4px" }}>{r.alimentoKg}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {movDia && <div style={{ fontSize: 13, marginTop: 10, padding: "9px 12px", background: C.fondo, borderRadius: 10 }}>
                  <b>Bodega:</b> +{movDia.producido} producido · −{(movDia.rutaNeta || 0).toFixed(1)} ruta · saldo final <b style={{ color: C.verde }}>{movDia.saldoFinal} cart</b>
                </div>}
                {plantaDia.map((p, i) => <div key={i} style={{ fontSize: 13, marginTop: 6, padding: "9px 12px", background: C.fondo, borderRadius: 10 }}><b>Planta:</b> {p.baches} bache(s) de {p.formula} · {p.kg} kg</div>)}
                {fumsDia.map((f, i) => <div key={i} style={{ fontSize: 13, marginTop: 6, padding: "9px 12px", background: C.fondo, borderRadius: 10 }}><b>Fumigación G{f.galpon}:</b> {f.producto} · {f.dosis} {f.hora && `· ${f.hora}`}</div>)}
                {medsDia.map((m, i) => <div key={i} style={{ fontSize: 13, marginTop: 6, padding: "9px 12px", background: C.fondo, borderRadius: 10 }}><b>{m.tipo || "Medicamento"} G{m.galpon}:</b> {m.producto} · {m.dosis}{m.enfermedad && ` · trata: ${m.enfermedad}`}</div>)}
                {bitDia.map((b, i) => <div key={i} style={{ fontSize: 13, marginTop: 6, padding: "9px 12px", background: C.yemaSuave, borderRadius: 10 }}><b>Bitácora:</b> {b.texto}</div>)}
              </Seccion>

              <Seccion titulo="Resumen mensual" sub="Consolidado del mes por gallinero">
                <input type="month" value={histMes} onChange={e => setHistMes(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
                {fechasMes.length === 0 && <div style={{ fontSize: 13.5, color: C.textoSuave }}>Sin registros en {nombreMes} {anioM}.</div>}
                {fechasMes.length > 0 && (
                  <>
                    <div style={{ fontSize: 12.5, color: C.textoSuave, marginBottom: 8 }}>{nombreMes} {anioM} · {fechasMes.length} días con registro</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ color: C.textoSuave, textAlign: "right", fontSize: 12 }}>
                            <th style={{ textAlign: "left", padding: "6px 4px" }}>Gallinero</th>
                            <th style={{ padding: "6px 4px" }}>Cartones</th>
                            <th style={{ padding: "6px 4px" }}>% Post. prom</th>
                            <th style={{ padding: "6px 4px" }}>Muertas</th>
                            <th style={{ padding: "6px 4px" }}>Alimento kg</th>
                            <th style={{ padding: "6px 4px" }}>Conv.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resMesLote.map((x, i) => (
                            <tr key={i} style={{ borderTop: `1px solid ${C.borde}`, textAlign: "right" }}>
                              <td style={{ textAlign: "left", padding: "8px 4px", fontWeight: 600 }}>G{x.l.galpon}</td>
                              <td style={{ padding: "8px 4px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>{x.cart.toFixed(1)}</td>
                              <td style={{ padding: "8px 4px" }}>{x.postura ? `${x.postura.toFixed(1)}%` : "—"}</td>
                              <td style={{ padding: "8px 4px" }}>{x.muertas}</td>
                              <td style={{ padding: "8px 4px" }}>{x.alim.toFixed(0)}</td>
                              <td style={{ padding: "8px 4px" }}>{x.conv ? x.conv.toFixed(2) : "—"}</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: `2px solid ${C.verde}`, textAlign: "right", fontWeight: 700 }}>
                            <td style={{ textAlign: "left", padding: "8px 4px" }}>TOTAL</td>
                            <td style={{ padding: "8px 4px", fontFamily: "'Space Grotesk', sans-serif" }}>{totMes.cart.toFixed(1)}</td>
                            <td style={{ padding: "8px 4px" }}>—</td>
                            <td style={{ padding: "8px 4px" }}>{totMes.muertas}</td>
                            <td style={{ padding: "8px 4px" }}>{totMes.alim.toFixed(0)}</td>
                            <td style={{ padding: "8px 4px" }}>—</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                <button onClick={exportar} style={{ ...btnStyle, marginTop: 14 }}>
                  Exportar {fechasMes.length ? `${nombreMes} ${anioM}` : "todo"} a Excel
                </button>
                <button onClick={exportarTodoJSON} disabled={guardando} style={{ ...btnStyle, background: "#F1F1EA", color: C.texto, marginTop: 8 }}>
                  💾 Exportar TODOS los datos (respaldo / migración)
                </button>
                <label style={{ display: "block", marginTop: 8 }}>
                  <span style={{ ...btnStyle, background: "#F1F1EA", color: C.texto, display: "block", textAlign: "center", cursor: "pointer" }}>📥 Importar respaldo JSON</span>
                  <input type="file" accept="application/json" style={{ display: "none" }}
                    onChange={async e => {
                      const file = e.target.files?.[0]; e.target.value = "";
                      if (!file) return;
                      if (cargandoFondo) { avisar("⏳ Sincronizando — espera unos segundos"); return; }
                      if (confirmar !== "importar") { setConfirmar("importar"); avisar("⚠ Esto SOBREESCRIBE los datos actuales con el respaldo — vuelve a elegir el archivo para confirmar"); setTimeout(() => setConfirmar(c2 => c2 === "importar" ? null : c2), 15000); return; }
                      setConfirmar(null); setGuardando(true); avisar("⏳ 1/3 Respaldando lo actual…");
                      try {
                        const previo = {};
                        for (const k of Object.values(K)) previo[k] = await leer(k, null);
                        await escribir("granja2:preImport", { fecha: new Date().toISOString(), datos: previo });
                        const doc = JSON.parse(await file.text());
                        const datos = doc.datos || doc;
                        const entradas = Object.entries(datos).filter(([, v]) => v !== null && v !== undefined);
                        let ok = 0, mal = [];
                        for (let i2 = 0; i2 < entradas.length; i2++) {
                          const [k, v] = entradas[i2];
                          avisar(`⏳ 2/3 Importando ${i2 + 1}/${entradas.length}…`);
                          if (await escribir(k, v)) ok++; else mal.push(k.replace("granja2:", ""));
                        }
                        // Verificación: releer una clave testigo de la nube y comparar
                        avisar("⏳ 3/3 Verificando en la nube…");
                        let verificado = true;
                        if (entradas.length) {
                          const [kT, vT] = entradas[0];
                          const enNube = await leer(kT, null);
                          verificado = JSON.stringify(enNube) === JSON.stringify(vT);
                        }
                        if (mal.length || !verificado) {
                          avisar(`⚠ Importación INCOMPLETA: ${ok}/${entradas.length} guardados${mal.length ? ` — fallaron: ${mal.slice(0, 4).join(", ")}` : ""}${!verificado ? " — la verificación en la nube no coincide" : ""}. NO recargues: intenta de nuevo o avisa a Claude.`);
                        } else {
                          avisar(`✓ ${ok} conjuntos importados y verificados en la nube — recargando…`);
                          setTimeout(() => { try { location.reload(); } catch {} }, 1600);
                        }
                      } catch { avisar("⚠ Archivo inválido — usa el JSON exportado por la app"); }
                      setGuardando(false);
                    }} />
                </label>
                {esAdmin && (
                  <div style={{ marginTop: 14, padding: 12, background: C.yemaSuave, borderRadius: 12, border: `1.5px solid ${C.yema}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🔧 Migración a base de datos v6</div>
                    <div style={{ fontSize: 11.5, color: C.textoSuave, marginBottom: 8 }}>
                      Se hace UNA sola vez, después de correr <b>supabase_v2.sql</b> en Supabase. Copia todo lo que hoy vive en la tabla vieja hacia las tablas nuevas, sin borrar nada de la vieja. Es seguro tocarlo más de una vez: si una tabla nueva ya tiene datos, se salta.
                    </div>
                    <button onClick={async () => {
                      if (confirmar !== "migrarv6") { setConfirmar("migrarv6"); avisar("⚠ Esto copiará tus datos a las tablas nuevas — toca otra vez para confirmar"); setTimeout(() => setConfirmar(c2 => c2 === "migrarv6" ? null : c2), 15000); return; }
                      setConfirmar(null); setGuardando(true);
                      try {
                        const resumen = await migrarDesdeV1((msg) => avisar(`⏳ ${msg}`));
                        const partes = [];
                        if (resumen.migradas.length) partes.push(`✓ Copiadas: ${resumen.migradas.join(", ")}`);
                        if (resumen.saltadas.length) partes.push(`— Ya existían (sin tocar): ${resumen.saltadas.join(", ")}`);
                        if (resumen.errores.length) partes.push(`⚠ Con error: ${resumen.errores.join(" | ")}`);
                        alert(partes.join("\n\n") || "No había nada que migrar.");
                        if (!resumen.errores.length) { avisar("✓ Migración completa — recargando…"); setTimeout(() => { try { location.reload(); } catch {} }, 1600); }
                        else avisar("⚠ La migración terminó con errores — revisa el detalle arriba");
                      } catch (e) {
                        alert(`⚠ No se pudo migrar: ${e.message}`);
                      }
                      setGuardando(false);
                    }} disabled={guardando} style={{ ...btnStyle, background: C.yema, color: "#fff" }}>
                      🔧 Migrar datos a la base de datos v6
                    </button>
                  </div>
                )}
                {esAdmin && (
                  <div style={{ marginTop: 14, padding: 12, background: C.fondo, borderRadius: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>👑 Administradores</div>
                    <div style={{ fontSize: 11.5, color: C.textoSuave, marginBottom: 8 }}>Solo los correos de esta lista ven la parte económica (Por Pagar). Lista vacía = todos son administradores.</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {cfgAdmins.map(a2 => (
                        <span key={a2} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 16, background: C.verdeSuave, color: C.verde, fontWeight: 600 }}>
                          {a2} <span onClick={async () => { const l2 = cfgAdmins.filter(x => x !== a2); if (await escribir(K.admins, l2)) { setCfgAdmins(l2); avisar("✓ Administrador quitado"); } else avisar("⚠ No se pudo guardar"); }} style={{ cursor: "pointer", marginLeft: 4 }}>×</span>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="email" placeholder="correo@ejemplo.com" value={nuevoAdmin} onChange={e => setNuevoAdmin(e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
                      <button onClick={async () => {
                        const em = nuevoAdmin.trim().toLowerCase();
                        if (!em || !em.includes("@")) { avisar("⚠ Escribe un correo válido"); return; }
                        if (cfgAdmins.includes(em)) { avisar("— Ya está en la lista"); return; }
                        const l2 = [...cfgAdmins, em];
                        if (await escribir(K.admins, l2)) { setCfgAdmins(l2); setNuevoAdmin(""); avisar("✓ Administrador agregado"); } else avisar("⚠ No se pudo guardar — revisa la conexión con la base de datos");
                      }} style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, background: C.verde, color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" }}>+ Agregar</button>
                    </div>
                  </div>
                )}
                <button onClick={async () => {
                  if (confirmar !== "undoimport") { setConfirmar("undoimport"); avisar("⚠ Restaura TODO al estado previo a la última importación — toca otra vez para confirmar"); setTimeout(() => setConfirmar(c2 => c2 === "undoimport" ? null : c2), 8000); return; }
                  setConfirmar(null); setGuardando(true);
                  const bak = await leer("granja2:preImport", null);
                  if (!bak?.datos) { avisar("— No hay respaldo de importación previa"); setGuardando(false); return; }
                  let n = 0;
                  for (const [k, v] of Object.entries(bak.datos)) { if (v !== null && v !== undefined) { await escribir(k, v); n++; } }
                  avisar(`✓ Restaurado el estado previo a la importación (${n} conjuntos) — recarga la app`);
                  setGuardando(false);
                }} style={{ ...btnStyle, background: "#F1F1EA", color: C.texto, marginTop: 8 }}>↩ Deshacer la última importación</button>
                <button onClick={async () => {
                  if (confirmar !== "undocxp") { setConfirmar("undocxp"); avisar("⚠ Restaura Por Pagar al estado ANTERIOR al último cambio — toca otra vez para confirmar"); setTimeout(() => setConfirmar(c2 => c2 === "undocxp" ? null : c2), 8000); return; }
                  setConfirmar(null);
                  const bak = await leer("granja2:cxpBak", null);
                  if (!bak) { avisar("— No hay respaldo de Por Pagar todavía"); return; }
                  if (await escribir(K.cxp, bak)) { setCxp({ facturas: [], pagos: [], notas: [], ...bak }); avisar("✓ Por Pagar restaurado al estado anterior"); }
                }} style={{ ...btnStyle, background: "#F1F1EA", color: C.texto, marginTop: 8 }}>↩ Deshacer último cambio en Por Pagar</button>
                <div style={{ fontSize: 12, color: C.textoSuave, textAlign: "center", marginTop: 8 }}>
                  Genera un .xlsx con producción, bodega y medicación — útil para tu contador o respaldo
                </div>
              </Seccion>
            </>
          );
        })()}

        {/* ══ LOTES ══ */}
        {vista === "lotes" && (
          <>
            <button onClick={() => setPrintDoc({ tipo: "lotes" })} style={{ marginBottom: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif", width: "100%" }}>🖨 Imprimir estado de lotes</button>
            {!formLote && (
              <button onClick={() => setFormLote({ galpon: "", lote: "", raza: "", nac: "", avesIniciales: "", formula: Object.keys(costos)[0] || "", racionGAve: "", posturaIdeal: "", pesoMeta: "", proveedor: "" })}
                style={{ ...btnStyle, marginBottom: 14 }}>+ Crear lote nuevo</button>
            )}

            {formLote && (
              <Seccion titulo={formLote.id ? "Editar lote" : "Nuevo lote"} sub="Galpón, raza y fecha de nacimiento son obligatorios">
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Campo tercio etiqueta="Gallinero #" type="text" inputMode="numeric" placeholder="ej. 1" value={formLote.galpon} onChange={e => setFormLote({ ...formLote, galpon: e.target.value })} />
                  <Campo tercio etiqueta="Lote #" type="text" placeholder="ej. 03" value={formLote.lote} onChange={e => setFormLote({ ...formLote, lote: e.target.value })} />
                  <Campo tercio etiqueta="Raza / línea" type="text" placeholder="ej. ISA Brown" value={formLote.raza} onChange={e => setFormLote({ ...formLote, raza: e.target.value })} />
                  <Campo mitad etiqueta="Fecha de nacimiento" type="date" value={formLote.nac} onChange={e => setFormLote({ ...formLote, nac: e.target.value })} />
                  <Campo mitad etiqueta="Aves alojadas (iniciales)" type="text" inputMode="numeric" placeholder="ej. 2400" value={formLote.avesIniciales} onChange={e => setFormLote({ ...formLote, avesIniciales: e.target.value })} />
                  {formLote.id && <Campo mitad etiqueta="Aves actuales (corrección)" type="text" inputMode="numeric" value={formLote.aves} onChange={e => setFormLote({ ...formLote, aves: e.target.value })} />}
                  <Campo mitad etiqueta="Proveedor de pollonas" type="text" placeholder="opcional" value={formLote.proveedor} onChange={e => setFormLote({ ...formLote, proveedor: e.target.value })} />
                  <label style={{ display: "block", marginBottom: 12, flex: "1 1 45%", minWidth: 150 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Estado productivo</span>
                    <select value={formLote.estadoProd || "Producción normal"} onChange={e => setFormLote({ ...formLote, estadoProd: e.target.value })} style={inputStyle}>
                      <option>Producción normal</option>
                      <option>Pelecha (muda)</option>
                      <option>En tratamiento</option>
                      <option>Levante / pre-postura</option>
                      <option>Estrés (calor, manejo, susto)</option>
                    </select>
                  </label>
                </div>
                {formLote.nac && <div style={{ fontSize: 13, color: C.verde, fontWeight: 600, marginBottom: 10 }}>Edad actual: {semanasDe(formLote.nac).toFixed(1)} semanas</div>}

                <div style={{ fontSize: 13.5, fontWeight: 700, margin: "6px 0 8px", color: C.verde }}>Alimentación</div>
                <label style={{ display: "block", marginBottom: 12 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Tipo de concentrado a servir</span>
                  <select value={formLote.formula} onChange={e => setFormLote({ ...formLote, formula: e.target.value })} style={inputStyle}>
                    <option value="">— elegir fórmula —</option>
                    {formulasAves.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <datalist id="formulas">{Object.keys(costos).map(f => <option key={f} value={f} />)}</datalist>
                </label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Campo mitad etiqueta="Ración a servir (g/ave/día)" type="text" inputMode="decimal" placeholder="ej. 115" value={formLote.racionGAve} onChange={e => setFormLote({ ...formLote, racionGAve: e.target.value })} />
                </div>
                {Number(formLote.racionGAve) > 0 && Number(formLote.aves || formLote.avesIniciales) > 0 && (() => {
                  const avesN = Number(formLote.aves || formLote.avesIniciales);
                  const kgDia = (Number(formLote.racionGAve) * avesN) / 1000;
                  return <div style={{ fontSize: 13, color: C.textoSuave, marginBottom: 10, marginTop: -6 }}>
                    Con {avesN.toLocaleString()} aves ≈ <b>{kgDia.toFixed(1)} kg/día</b> · 6 am (40%): {(kgDia * 0.4).toFixed(1)} kg · 1 pm (60%): {(kgDia * 0.6).toFixed(1)} kg
                  </div>;
                })()}

                <div style={{ fontSize: 13.5, fontWeight: 700, margin: "6px 0 8px", color: C.verde }}>Metas de la tabla genética</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Campo mitad etiqueta="% postura ideal (semana actual)" type="text" inputMode="decimal" placeholder="ej. 92" value={formLote.posturaIdeal} onChange={e => setFormLote({ ...formLote, posturaIdeal: e.target.value })} />
                  <Campo mitad etiqueta="Peso corporal meta (g)" type="text" inputMode="numeric" placeholder="ej. 2050" value={formLote.pesoMeta} onChange={e => setFormLote({ ...formLote, pesoMeta: e.target.value })} />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={guardarLote} disabled={guardando} style={{ ...btnStyle, flex: 1 }}>{formLote.id ? "Guardar cambios" : "Crear lote"}</button>
                  <button onClick={() => setFormLote(null)} style={{ ...btnStyle, flex: 0.5, background: "#fff", color: C.textoSuave, border: `1.5px solid ${C.borde}` }}>Cancelar</button>
                </div>
              </Seccion>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
              {activos.map(l => {
                const ult = registros.find(r => r.lote === l.id);
                const postura = ult ? (ult.cartones * HXC / l.aves) * 100 : 0;
                const mortPct = ((l.mortAcum / (l.avesIniciales || 1)) * 100).toFixed(1);
                return (
                  <div key={l.id} style={{ background: C.superficie, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 17 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div>
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: C.verde }}>Gallinero {l.galpon} · Lote {l.lote || ""}</div>
                        <div style={{ fontSize: 12, color: C.textoSuave }}>{l.raza} · nac. {l.nac.split("-").reverse().join("/")} · <b>{semanasDe(l.nac).toFixed(1)} sem</b></div>
                        {l.estadoProd && l.estadoProd !== "Producción normal" && <div style={{ display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 12, background: C.yemaSuave, color: "#9A6605" }}>⚠ {l.estadoProd}</div>}
                        {l.proveedor && <div style={{ fontSize: 11.5, color: C.textoSuave }}>Pollonas: {l.proveedor}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>{l.aves.toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: C.textoSuave }}>aves</div>
                      </div>
                    </div>
                    <BarraPostura actual={postura} meta={l.posturaIdeal} />
                    <div style={{ display: "flex", gap: 7, marginTop: 11, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11.5, padding: "4px 9px", borderRadius: 20, background: C.yemaSuave, color: "#9A6605", fontWeight: 500 }}>
                        {l.formula || "sin fórmula"}{l.racionGAve ? ` · ${l.racionGAve} g/ave` : ""}
                      </span>
                      {(() => {
                        const rUlt = registros.find(r => r.lote === l.id && Number(r.alimentoKg || 0) > 0);
                        if (!rUlt || !l.aves) return null;
                        const gAveReal = (Number(rUlt.alimentoKg) * 1000) / l.aves;
                        const desv = l.racionGAve > 0 ? ((gAveReal - l.racionGAve) / l.racionGAve) * 100 : null;
                        const color = desv == null ? C.verde : Math.abs(desv) <= 5 ? C.verde : desv < 0 ? C.alerta : "#9A6605";
                        const fondo = desv == null || Math.abs(desv) <= 5 ? C.verdeSuave : desv < 0 ? C.alertaSuave : C.yemaSuave;
                        return (
                          <span style={{ fontSize: 11.5, padding: "4px 9px", borderRadius: 20, background: fondo, color, fontWeight: 600 }}>
                            Consumo real: {gAveReal.toFixed(0)} g/ave{desv != null ? ` (${desv > 0 ? "+" : ""}${desv.toFixed(0)}% vs ración)` : ""}
                          </span>
                        );
                      })()}
                      <span style={{ fontSize: 11.5, padding: "4px 9px", borderRadius: 20, background: "#F1F1EA", color: C.textoSuave, fontWeight: 500 }}>
                        Mort. acum. {l.mortAcum} ({mortPct}%)
                      </span>
                      {(() => {
                        const regsLote = registros.filter(r => r.lote === l.id).slice(0, 30);
                        const rUlt = regsLote[0];
                        const mDia = rUlt ? Number(rUlt.muertas || 0) : null;
                        const pDia = mDia != null && l.aves > 0 ? (mDia / l.aves) * 100 : null;
                        // Semana: últimos 7 registros (7 días de captura)
                        const uls7 = regsLote.slice(0, 7);
                        const mSem = uls7.reduce((a, r) => a + Number(r.muertas || 0), 0);
                        const pSem = uls7.length && l.aves > 0 ? (mSem / l.aves) * 100 : null;
                        const cDia = pDia == null ? C.textoSuave : pDia > 0.2 ? C.alerta : pDia > 0.1 ? "#9A6605" : C.verde;
                        const cSem = pSem == null ? C.textoSuave : pSem > 0.7 ? C.alerta : pSem > 0.35 ? "#9A6605" : C.verde;
                        return (
                          <>
                            <span style={{ fontSize: 11.5, padding: "4px 9px", borderRadius: 20, background: "#F1F1EA", color: cDia, fontWeight: 600 }}>
                              Mort. día: {pDia != null ? `${mDia} (${pDia.toFixed(2)}%)` : "—"}
                            </span>
                            <span style={{ fontSize: 11.5, padding: "4px 9px", borderRadius: 20, background: "#F1F1EA", color: cSem, fontWeight: 600 }}>
                              Mort. 7d: {pSem != null ? `${mSem} (${pSem.toFixed(2)}%)` : "—"}
                            </span>
                          </>
                        );
                      })()}

                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
                      <button onClick={() => setFormLote({ ...l })} style={{ flex: 1, padding: "10px", fontSize: 13.5, fontWeight: 600, background: C.verdeSuave, color: C.verde, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Editar</button>
                      <button onClick={() => cerrarLote(l.id)} style={{ flex: 1, padding: "10px", fontSize: 13.5, fontWeight: 600, background: "#fff", color: C.alerta, border: `1.5px solid ${C.borde}`, borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Cerrar lote</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {lotes.some(l => l.estado === "cerrado") && (
              <Seccion titulo="Lotes cerrados" sub="Su historial se conserva en Historial y en los registros">
                {lotes.filter(l => l.estado === "cerrado").map(l => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.borde}`, fontSize: 13.5, flexWrap: "wrap", gap: 8 }}>
                    <span><b>Gallinero {l.galpon} · Lote {l.lote || ""}</b> · {l.raza} · cerrado {l.cerradoFecha || ""} · HAA final {(l.acumHuevos / (l.avesIniciales || 1)).toFixed(0)}</span>
                    <span style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => reabrirLote(l.id)} style={{ padding: "7px 12px", fontSize: 12.5, fontWeight: 600, background: C.verdeSuave, color: C.verde, border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Reabrir</button>
                      <button onClick={() => eliminarLote(l.id)} style={{ padding: "7px 12px", fontSize: 12.5, fontWeight: 600, background: C.alertaSuave, color: C.alerta, border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Eliminar</button>
                    </span>
                  </div>
                ))}
              </Seccion>
            )}
          </>
        )}

        {/* ══ BIENESTAR ANIMAL ══ */}
        {vista === "pesaje" && (
          <>
            <Seccion titulo="Pesaje de la parvada" sub="Usualmente 200 aves por gallinero — pega o escribe los pesos en gramos, separados por coma, espacio o salto de línea">
              <select value={fPeso.lote} onChange={e => setFPeso({ ...fPeso, lote: e.target.value })} style={selectStyle}>
                {activos.map(l => <option key={l.id} value={l.id}>Gallinero {l.galpon} — {l.raza} ({semanasDe(l.nac).toFixed(0)} sem)</option>)}
              </select>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fecha del pesaje</span>
                <input type="date" value={fPeso.fecha} onChange={e => setFPeso({ ...fPeso, fecha: e.target.value })} style={inputStyle} />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                  Pesos de la muestra (g) — llevas {fPeso.pesos.split(/[\s,]+/).filter(x => Number(x) > 0).length} aves
                </span>
                <textarea rows={4} placeholder="En gramos (1880 1920 1850…) o en kilos (1.88 1.92 1.85…)" value={fPeso.pesos}
                  onChange={e => setFPeso({ ...fPeso, pesos: e.target.value })}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "'Inter', sans-serif" }} />
              </label>
              <button onClick={guardarPesaje} style={btnStyle}>Calcular y guardar pesaje</button>
              <label style={{ display: "block", marginTop: 12, fontSize: 13, fontWeight: 600 }}>
                Importar historial de pesajes desde Excel (.xlsx / .xls)
                <input type="file" accept=".xlsx,.xls" onChange={e => { abrirExcelPesajes(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "block", marginTop: 7, maxWidth: "100%" }} />
              </label>
              {!!excelPesajes.length && <div style={{ marginTop: 14, padding: 12, background: C.fondo, borderRadius: 10 }}>
                <b>Vista previa · {excelPesajes.length} fechas detectadas</b>
                <p style={{ fontSize: 12.5, color: C.textoSuave }}>Selecciona las fechas y revisa el lote y los pesos. Las fechas sin lote histórico quedan excluidas. Una fecha ya registrada se omite; nunca se reemplaza.</p>
                <div style={{ maxHeight: 430, overflowY: "auto" }}>
                  {excelPesajes.map((p, i) => {
                    const duplicado = p.lote && (pesajes.some(v => clavePesaje(v.lote, v.fecha) === clavePesaje(p.lote, p.fecha)) || excelPesajes.findIndex((v, j) => j < i && v.lote && clavePesaje(v.lote, v.fecha) === clavePesaje(p.lote, p.fecha)) !== -1);
                    const invalidos = p.pesos.filter(v => pesoEnGramos(v) == null).length;
                    return <div key={`${p.hoja}-${p.columna}-${i}`} style={{ padding: "9px 0", borderBottom: `1px solid ${C.borde}`, fontSize: 12.5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <label><input type="checkbox" checked={!!p.incluir} onChange={e => setExcelPesajes(actual => actual.map((x, j) => j === i ? { ...x, incluir: e.target.checked } : x))} /> Incluir</label>
                        <span>{p.hoja} · {p.columna} · <b>{p.fecha}</b> · {p.pesos.length} aves</span>
                        <select aria-label={`Lote para ${p.hoja} ${p.fecha}`} value={p.lote} onChange={e => setExcelPesajes(actual => actual.map((x, j) => j === i ? { ...x, lote: e.target.value, incluir: !!e.target.value } : x))} style={{ ...selectStyle, width: "auto", margin: 0, padding: 5 }}>
                          <option value="">Elegir lote</option>
                          {lotes.map(l => <option key={l.id} value={l.id}>G{l.galpon} · {l.lote || l.id} · {l.nac}</option>)}
                        </select>
                        <span style={{ color: duplicado || invalidos ? C.alerta : C.verde }}>{!p.incluir ? "Excluido" : duplicado ? "Ya existe: omitir" : invalidos ? `${invalidos} inválido(s)` : "Nuevo"}</span>
                        <button type="button" onClick={() => setExcelAbierto(excelAbierto === i ? -1 : i)} style={{ cursor: "pointer" }}>{excelAbierto === i ? "Cerrar" : "Revisar / editar"}</button>
                      </div>
                      {excelAbierto === i && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(95px, 1fr))", gap: 7, marginTop: 9 }}>
                        {p.pesos.map((v, j) => <label key={j}>Ave {j + 1}<input aria-label={`Ave ${j + 1}`} value={v} onChange={e => setExcelPesajes(actual => actual.map((x, k) => k === i ? { ...x, pesos: x.pesos.map((n, z) => z === j ? e.target.value : n) } : x))} style={{ ...inputStyle, padding: 5, borderColor: pesoEnGramos(v) == null ? C.alerta : C.borde }} /></label>)}
                      </div>}
                    </div>;
                  })}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button disabled={importandoPesajes} onClick={confirmarExcelPesajes} style={btnStyle}>{importandoPesajes ? "Guardando…" : "Confirmar y agregar faltantes"}</button>
                  <button disabled={importandoPesajes} onClick={() => setExcelPesajes([])}>Cancelar</button>
                </div>
              </div>}
              <button onClick={() => setPrintDoc({ tipo: "pesajes" })} style={{ marginTop: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif", width: "100%" }}>🖨 Imprimir reporte de pesajes (Dr. / nutricionista)</button>
            </Seccion>

            {activos.map(l => {
              const delLote = pesajes.filter(p => p.lote === l.id);
              const ult = delLote[0];
              if (!ult) return null;
              const ant = delLote[1];
              const st = statsPesaje(ult);
              const meta = Number(l.pesoMeta) || Number(ult.meta) || 0;
              const brechaG = meta > 0 ? st.prom - meta : null;
              const brechaP = meta > 0 ? (brechaG / meta) * 100 : null;
              const colorMeta = brechaP == null ? C.textoSuave : brechaP <= -10 ? C.alerta : brechaP <= -4 ? "#9A6605" : brechaP >= 8 ? "#9A6605" : C.verde;
              const stAnt = ant ? statsPesaje(ant) : null;
              const gan = stAnt ? st.prom - stAnt.prom : null;
              const colorGan = gan == null ? C.textoSuave : gan >= 0 ? C.verde : C.alerta;
              return (
                <div key={l.id} style={{ background: C.superficie, border: `1px solid ${C.borde}`, borderRadius: 16, padding: 16, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 4 }}>
                    <b style={{ fontSize: 14.5 }}>Gallinero {l.galpon} · Sem {ult.semana} · {ult.fecha.slice(0, 5)}</b>
                    <span style={{ fontSize: 12, color: C.textoSuave }}>{ult.pesos.length} aves pesadas</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <KPI etiqueta="Promedio" valor={st.prom.toFixed(0)} unidad="g" tono={brechaP != null && brechaP <= -4 ? "alerta" : "ok"} />
                    <KPI etiqueta="Uniformidad ±10%" valor={st.unif.toFixed(0)} unidad="%" tono={st.unif < 80 ? "alerta" : "ok"} sub={`CV ${st.cv.toFixed(1)}% · ${st.min}–${st.max} g`} />
                  </div>
                  <div style={{ display: "grid", gap: 6, marginTop: 10, fontSize: 13.5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 11px", background: C.fondo, borderRadius: 10 }}>
                      <span>Vs tabla genética{meta ? ` (${meta} g)` : ""}</span>
                      {meta > 0
                        ? <b style={{ color: colorMeta }}>{brechaG >= 0 ? "+" : ""}{brechaG.toFixed(0)} g ({brechaP >= 0 ? "+" : ""}{brechaP.toFixed(1)}%)</b>
                        : <span style={{ color: C.textoSuave, fontSize: 12.5 }}>define el peso meta en Lotes</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 11px", background: C.fondo, borderRadius: 10 }}>
                      <span>Vs pesaje anterior{ant ? ` (${ant.fecha.slice(0, 5)}, sem ${ant.semana}: ${stAnt.prom.toFixed(0)} g)` : ""}</span>
                      {ant
                        ? <b style={{ color: colorGan }}>{gan >= 0 ? "+" : ""}{gan.toFixed(0)} g {gan >= 0 ? "▲" : "▼"}</b>
                        : <span style={{ color: C.textoSuave, fontSize: 12.5 }}>primer pesaje registrado</span>}
                    </div>
                  </div>
                </div>
              );
            })}

            <Seccion titulo="Vacunación — programa y aplicación" sub="Plan del Dr. Heiner Hernández Ávila (C.M.V #666) por día de edad. Marca cada vacuna aplicada con su fecha.">
              <button onClick={() => setPrintDoc({ tipo: "vacunas", lote: fVac.lote })} style={{ marginBottom: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>🖨 Imprimir reporte de vacunación</button>
              <select value={fVac.lote} onChange={e => setFVac({ ...fVac, lote: e.target.value })} style={selectStyle}>
                {activos.map(l => <option key={l.id} value={l.id}>Gallinero {l.galpon} — {l.raza} ({semanasDe(l.nac).toFixed(0)} sem · {Math.floor(semanasDe(l.nac) * 7)} días)</option>)}
              </select>
              {(() => {
                const l = lotes.find(x => x.id === fVac.lote);
                if (!l) return null;
                const colores = { aplicada: C.verde, atrasada: C.alerta, próxima: "#9A6605", pendiente: C.textoSuave, cubierta: C.textoSuave };
                const etiquetas = { aplicada: "✓ APLICADA", atrasada: "ATRASADA", próxima: "PRÓXIMA", pendiente: "PENDIENTE", cubierta: "LEVANTE" };
                return planVac.map(p2 => {
                  const ev = estadoVacunaLote(l, p2);
                  const clave = `${l.id}-${p2.id}`;
                  const defISO = ev.dias < 0 ? ev.fecha.split("/").reverse().join("-") : new Date().toISOString().slice(0, 10);
                  return (
                    <div key={p2.id} style={{ borderTop: `1px solid ${C.borde}`, padding: "10px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>Día {p2.dia} — {p2.vacuna}{p2.cepa ? ` · ${p2.cepa}` : ""}</span>
                        <b style={{ fontSize: 12, color: colores[ev.estado] }}>{etiquetas[ev.estado]}{ev.estado === "aplicada" && ev.fechaAplicada ? ` ${ev.fechaAplicada.slice(0, 5)}` : ""}</b>
                      </div>
                      <div style={{ fontSize: 12, color: C.textoSuave, marginBottom: 6 }}>
                        Vía: {p2.via || "—"} · Proveedor: {p2.proveedor || "—"} · Programada: {ev.fecha}
                      </div>
                      {ev.estado === "aplicada" ? (
                        <button onClick={() => desaplicarVacuna(l.id, p2.id)} style={{ padding: "6px 11px", fontSize: 12, fontWeight: 600, background: "transparent", color: C.textoSuave, border: `1px solid ${C.borde}`, borderRadius: 8, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Deshacer</button>
                      ) : (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="date" value={fechasAplicar[clave] ?? defISO}
                            onChange={e => setFechasAplicar({ ...fechasAplicar, [clave]: e.target.value })}
                            style={{ ...inputStyle, flex: 1, padding: "8px 10px", fontSize: 14 }} />
                          <button onClick={() => aplicarVacuna(l, p2, fechasAplicar[clave] ?? defISO)}
                            style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, background: C.verde, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>
                            Marcar aplicada
                          </button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}

              <div style={{ fontSize: 13.5, fontWeight: 700, margin: "16px 0 8px", color: C.verde }}>Agregar vacuna al programa</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Campo tercio etiqueta="Día de edad" type="text" inputMode="numeric" placeholder="ej. 120" value={fPlan.dia} onChange={e => setFPlan({ ...fPlan, dia: e.target.value })} />
                <Campo tercio etiqueta="Vacuna" type="text" placeholder="ej. Newcastle refuerzo" value={fPlan.vacuna} onChange={e => setFPlan({ ...fPlan, vacuna: e.target.value })} />
                <Campo tercio etiqueta="Cepa" type="text" placeholder="opcional" value={fPlan.cepa} onChange={e => setFPlan({ ...fPlan, cepa: e.target.value })} />
                <Campo mitad etiqueta="Vía de aplicación" type="text" placeholder="ej. al agua" value={fPlan.via} onChange={e => setFPlan({ ...fPlan, via: e.target.value })} />
                <Campo mitad etiqueta="Proveedor" type="text" placeholder="opcional" value={fPlan.proveedor} onChange={e => setFPlan({ ...fPlan, proveedor: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={guardarPlanVac} style={{ ...btnStyle, flex: 1 }}>Agregar al programa</button>
              </div>
              <div style={{ fontSize: 12, color: C.textoSuave, marginTop: 8 }}>
                Para quitar una vacuna del programa del doctor, avísame y la removemos — así evitamos borrados accidentales del plan oficial.
              </div>
            </Seccion>

            <Seccion titulo="Expediente médico — Enfermedades y tratamientos" sub="Diagnósticos por gallinero con su tratamiento y estado">
              <button onClick={() => setPrintDoc({ tipo: "enfermedades" })} style={{ marginBottom: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>🖨 Imprimir expediente</button>
              <select value={fEnf.lote} onChange={e => setFEnf({ ...fEnf, lote: e.target.value })} style={selectStyle}>
                {activos.map(l => <option key={l.id} value={l.id}>Gallinero {l.galpon} — {l.raza}</option>)}
              </select>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Campo mitad etiqueta="Enfermedad diagnosticada" type="text" placeholder="ej. coriza infecciosa" value={fEnf.enfermedad} onChange={e => setFEnf({ ...fEnf, enfermedad: e.target.value })} />
                <Campo mitad etiqueta="Tratamiento brindado" type="text" placeholder="ej. Interflox 200 ml, 5 días" value={fEnf.tratamiento} onChange={e => setFEnf({ ...fEnf, tratamiento: e.target.value })} />
              </div>
              <button onClick={guardarEnfermedad} style={btnStyle}>Registrar diagnóstico</button>
              <div style={{ marginTop: 12 }}>
                {enfermedades.slice(0, 10).map((e2, i) => {
                  const l = lotes.find(x => x.id === e2.lote);
                  const activoTx = e2.estado !== "Recuperado";
                  return (
                    <div key={i} style={{ fontSize: 13, padding: "10px 12px", background: activoTx ? C.alertaSuave : C.fondo, borderRadius: 10, marginBottom: 6, lineHeight: 1.5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                        <span><b>{e2.fecha.slice(0, 5)} · G{l?.galpon ?? "?"}</b> — {e2.enfermedad}{e2.tratamiento && ` · Tx: ${e2.tratamiento}`}</span>
                        {activoTx
                          ? <button onClick={() => marcarRecuperado(e2.id)} style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600, background: C.verdeSuave, color: C.verde, border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Marcar recuperado</button>
                          : <span style={{ color: C.verde, fontWeight: 600, fontSize: 12.5 }}>✓ Recuperado {e2.fechaAlta ? e2.fechaAlta.slice(0, 5) : ""}</span>}
                      </div>
                    </div>
                  );
                })}
                {enfermedades.length === 0 && <div style={{ fontSize: 13, color: C.textoSuave }}>Sin diagnósticos registrados.</div>}
              </div>
            </Seccion>

            <Seccion titulo="Necropsias y laboratorio" sub="Resultados de necropsias, coprológicos, bromatológicos y otros análisis">
              <button onClick={() => setPrintDoc({ tipo: "necropsias" })} style={{ marginBottom: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>🖨 Imprimir registro</button>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select value={fNec.lote} onChange={e => setFNec({ ...fNec, lote: e.target.value })} style={{ ...inputStyle, flex: "1 1 45%", marginBottom: 12 }}>
                  {activos.map(l => <option key={l.id} value={l.id}>G{l.galpon} — {l.raza}</option>)}
                </select>
                <select value={fNec.tipo} onChange={e => setFNec({ ...fNec, tipo: e.target.value })} style={{ ...inputStyle, flex: "1 1 45%", marginBottom: 12 }}>
                  <option>Necropsia</option><option>Coprológico</option><option>Bromatológico (alimento)</option>
                  <option>Serología</option><option>Bacteriología</option><option>Otro análisis</option>
                </select>
              </div>
              <Campo etiqueta="Laboratorio / veterinario" type="text" placeholder="ej. LANASEVE, Dr. ..." value={fNec.laboratorio} onChange={e => setFNec({ ...fNec, laboratorio: e.target.value })} />
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Hallazgos / resultado</span>
                <textarea rows={3} placeholder="Resumen de los hallazgos" value={fNec.hallazgos} onChange={e => setFNec({ ...fNec, hallazgos: e.target.value })}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "'Inter', sans-serif" }} />
              </label>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>Fotos (hasta 3 — se comprimen automáticamente)</span>
                <input type="file" accept="image/*" multiple onChange={e => { agregarFotoNec(e.target.files); e.target.value = ""; }} style={{ fontSize: 14 }} />
                {fNecFotos.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {fNecFotos.map((f, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <img src={f} alt={`foto ${i + 1}`} style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.borde}` }} />
                        <button onClick={() => setFNecFotos(fNecFotos.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, background: C.alerta, color: "#fff", border: "none", fontSize: 12, cursor: "pointer" }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </label>
              <button onClick={guardarNecropsia} disabled={guardando} style={btnStyle}>Registrar resultado</button>
              <div style={{ marginTop: 12 }}>
                {necropsias.slice(0, 8).map((n2, i) => {
                  const l = lotes.find(x => x.id === n2.lote);
                  return (
                    <div key={i} style={{ fontSize: 13, padding: "10px 12px", background: C.fondo, borderRadius: 10, marginBottom: 6, lineHeight: 1.5 }}>
                      <b>{n2.fecha.slice(0, 5)} · G{l?.galpon ?? "?"} · {n2.tipo}</b>{n2.laboratorio && ` · ${n2.laboratorio}`}
                      <div style={{ color: C.textoSuave }}>{n2.hallazgos}</div>
                      {n2.numFotos > 0 && (
                        <button onClick={() => verFotosNec(n2)} style={{ marginTop: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600, background: C.verdeSuave, color: C.verde, border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                          {fotosVista[n2.id] ? "Ocultar fotos" : `📷 Ver ${n2.numFotos} foto(s)`}
                        </button>
                      )}
                      {fotosVista[n2.id] === "cargando" && <div style={{ fontSize: 12, color: C.textoSuave, marginTop: 6 }}>Cargando fotos…</div>}
                      {Array.isArray(fotosVista[n2.id]) && (
                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                          {fotosVista[n2.id].map((f, j) => <img key={j} src={f} alt={`foto ${j + 1}`} style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.borde}` }} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {necropsias.length === 0 && <div style={{ fontSize: 13, color: C.textoSuave }}>Sin resultados registrados.</div>}
              </div>
            </Seccion>
          </>
        )}
      </main>

      <footer style={{ textAlign: "center", padding: "8px 16px 22px", fontSize: 11.5, color: C.textoSuave, lineHeight: 1.5 }}>
        Formato: Reporte Diario de Operación · Datos compartidos — todo el equipo ve y edita la misma información.<br />
        Usa ⟳ para traer lo último guardado. · Versión {VERSION_APP} — 04/09/2026
      </footer>
    </div>
  );
}
