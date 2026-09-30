import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { leer, escribir, leerBodegaActual, agregarPesajesFaltantes, actualizarPesajePorId, eliminarPesajePorId, agregarRespaldoFaltante, detectarFechasRespaldo, reemplazarFechasRespaldo, eliminarLotePorId, leerCorreccionesProduccion, corregirProduccion, corregirDetallePlanta } from "./storage";
import { cargarBaseConReintentos } from "./cargaInicial";
import { REFERENCIAS_RAZAS, claveRaza, referenciaRaza, valorCentral } from "./referenciasRazas";
import { extraerPesajesExcel, fechaPesajeISO, clavePesaje, pesoEnGramos } from "./bienestarImport";
import { supabase } from "./supabase";
import { proximaTarea, diasHastaTarea, leerTareasProgramadas, guardarTareaProgramada, eliminarTareaProgramada } from "./tareasProgramadas";
import { actividadesDelDia, pendientesDeAuditoria, tareasManualesDelReporte } from "./reporteActividades";
import { planServidoGanado } from "./servidoGanado";
import logoOficial from "./assets/logo-oficial.png";
import { PERIODOS_HISTORIAL, fechaHistorialISO, filtrarHistorial, snapshotBodega, elegirMovimientoBodega, reconstruirBodega, movimientoBodegaParaReporte } from "./historial";
import { CambiosBodega, ResumenMovimientoBodega } from "./presentacionBodega";
import { nombreVisible, nombreResponsableSesion } from "./nombresUsuarios";
import { saldosFormulasDesdeConteo, deltaConteoFormula } from "./inventarioFormulas";
import { saltosTiquetes, tiquetesDelDia, observacionesCaptura, excepcionesOperacion, csvAuditoria } from "./mejorasUX";
import { filtroPlantaInicial, filtrarMovimientosPlanta } from "./plantaHistorial";
import { Campo } from "./components/Campo";
import { ModalDialog } from "./components/ModalDialog";
import { MatrizQueFaltaHoy } from "./features/captura/MatrizQueFaltaHoy";
import { ModalPegarTiquetes } from "./features/captura/ModalPegarTiquetes";
import { numeroMaxDosDecimales as f2Dec, numeroDosDecimales as n2Dec } from "./formatoNumeros";
import { baseDeRegistro, registroCambioDesdeBase } from "./concurrencia";
import { resolverVistaSegura, vistasPermitidas } from "./permisos";
import { DEFAULT_PREFERENCES, completarOrdenNavegacion, normalizarPreferencias, ordenarPorPreferencia } from "./preferences";
import { eliminarBorrador, guardarBorrador, guardarPreferencias, leerBorrador, leerPreferencias } from "./preferencesStorage";
import { alertaEstaSuprimida, claveAlerta, ultimoEventoAlerta, ordenarEventosAlertas } from "./alertasRevision";
import "./v10.css";

const PreferenciasView = lazy(() => import("./views/PreferenciasView"));
const AdministracionView = lazy(() => import("./views/AdministracionView"));

// ─── Tokens ─────────────────────────────────────────────────────
const C = {
  fondo: "var(--v10-bg-soft, #F6F6F1)", superficie: "var(--v10-surface, #FFFFFF)",
  control: "var(--v10-control, #F1F1EA)", fondoElevado: "var(--v10-surface-alt, #F8F8F4)",
  verde: "var(--v10-green, #14432A)", verdeSuave: "var(--v10-green-soft, #E7EFE8)",
  yema: "var(--v10-amber, #E8940A)", yemaSuave: "var(--v10-amber-soft, #FDF3E0)",
  alerta: "var(--v10-danger, #C4442A)", alertaSuave: "var(--v10-danger-soft, #FBEAE6)",
  texto: "var(--v10-text, #1C1F1A)", textoSuave: "var(--v10-muted, #6B7266)", borde: "var(--v10-border, #E4E4DC)",
};
const btnStyle = { padding: "14px", fontSize: 15.5, fontWeight: 600, background: C.verde, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" };
const fuentes = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');`;
const HXC = 30;
const VERSION_APP = "10.0";
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
  advAjustes: "granja2:advertenciasAjustes",
  nombresUsuarios: "granja2:nombresUsuarios",
  plantillasTarea: "granja2:plantillasTarea",
};

const hoyStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

const semanaEnFecha = (nac, fecha = hoyISO()) => {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : fechaPesajeISO(fecha);
  if (!iso || !nac) return NaN;
  const inicio = Date.parse(`${nac}T00:00:00Z`);
  const fin = Date.parse(`${iso}T00:00:00Z`);
  return fin >= inicio ? (fin - inicio) / (7 * 86400000) : NaN;
};
const fichaLote = (l, fecha) => referenciaRaza(l.raza, semanaEnFecha(l.nac, fecha));
const metaPosturaLote = (l, fecha) => {
  const ficha = fichaLote(l, fecha);
  return claveRaza(l.raza) ? valorCentral(ficha?.postura) : Number(l.posturaIdeal) || null;
};
const metaPesoLote = (l, fecha, pesaje) => {
  const ficha = fichaLote(l, fecha);
  return claveRaza(l.raza) ? valorCentral(ficha?.peso) : Number(l.pesoMeta) || Number(pesaje?.meta) || null;
};

const SEED_COSTOS = { "Postura F1": "", "Ponedora 18+": "", "Impulsor": "" };
const SEED_PLANTA = { saldoKg: 3850 };

// ─── Identidad ───
const RAZON_SOCIAL = "Granja Avícola y Ganadería Rancho El Soñado LTDA.";
const MarcaRancho = ({ impresion = false }) => (
  <img src={logoOficial} alt="Logo oficial de Granja Avícola Rancho El Soñado" style={{ display: "block", width: impresion ? 190 : 108, height: "auto", margin: impresion ? "0 auto" : undefined, background: "white", borderRadius: impresion ? 0 : 6 }} />
);

// ─── Materias primas y recetas (del archivo Pedido de Materia Prima) ───
const MP_LISTA = [
  { c: "MP001", n: "MAÍZ AMARILLO", prov: "AVIN", pres: 46 },
  { c: "MP003", n: "MAÍZ FINO", prov: "AVIN", pres: 46 },
  { c: "MP004", n: "HARINA DE SOYA", prov: "AVIN", pres: 46 },
  { c: "MP005", n: "ACEMITE", prov: "AVIN", pres: 46 },
  { c: "MP006", n: "ACEITE DE SOYA", prov: "AVIN", pres: 1 },
  { c: "MP007", n: "CARBONATO DE CALCIO 39% GRUESO", prov: "AVIN", pres: 50 },
  { c: "MP008", n: "CARB DE CALCIO 39%", prov: "AVIN", pres: 50 },
  { c: "MP009", n: "SAL", prov: "Coonaprosal", pres: 46 },
  { c: "MP013", n: "Núcleo Gortech", prov: "Gortech", pres: 22.7 },
  { c: "MP022", n: "H. DE COQUITO (Presion) (4-3-25 EV)", prov: "AVIN", pres: 46 },
  { c: "MP023", n: "LEVADURA", prov: "AVIN", pres: 1 },
  { c: "MP026", n: "BICARBONATO DE SODIO", prov: "AVIN", pres: 25 },
  { c: "MP028", n: "LIV-52", prov: "Agrokuvo", pres: 20 },
  { c: "MP029", n: "MONENSIN 7%", prov: "AVIN", pres: 15 },
  { c: "MP030", n: "TECNOVIT", prov: "Agrokuvo", pres: 20 },
  { c: "MP031", n: "MELAZA DE CAÑA", prov: "Dos Pinos", pres: 1 },
  { c: "MP033", n: "DDGS MAIZ", prov: "AVIN", pres: 46 },
  { c: "MP035", n: "FOSFATO MONOCÁLCICO", prov: "AVIN", pres: 25 },
  { c: "MP036", n: "DL-METIONINA", prov: "AVIN", pres: 25 },
  { c: "MP037", n: "CL-COLINA", prov: "AVIN", pres: 25 },
  { c: "MP038", n: "PREM. GALLINAS TROW NUTRITION", prov: "AVIN", pres: 25 },
  { c: "MP039", n: "L-LISINA", prov: "AVIN", pres: 25 },
  { c: "MP040", n: "MYCOFIX PLUS", prov: "AVIN", pres: 25 },
  { c: "MP041", n: "ISOLEUCINA", prov: "AVIN", pres: 1 },
  { c: "MP042", n: "L-VALINA", prov: "AVIN", pres: 25 },
  { c: "MP043", n: "TREONINA", prov: "AVIN", pres: 1 },
  { c: "MP044", n: "CLOSTAT", prov: "AVIN", pres: 1 },
  { c: "MP045", n: "ACTIGEN (MOS)", prov: "AVIN", pres: 1 },
  { c: "MP046", n: "ENRRAMIX", prov: "AVIN", pres: 1 },
  { c: "MP047", n: "L-TRIPTOFANO", prov: "AVIN", pres: 1 },
  { c: "MP048", n: "BX POSTURA MÁXIMA PRODUCCIÓN", prov: "VYMISA", pres: 20 },
];

// Catálogo oficial del formato físico de inventario. Se conserva el código
// como llave de recetas y movimientos, pero el nombre y la presentación se
// muestran exactamente como en la hoja de conteo de la granja.
const normalizarCatalogoMateriaPrima = (catalogo) => {
  const actual = Array.isArray(catalogo) ? catalogo : [];
  const porCodigo = new Map(actual.map(item => [item.c, item]));
  const oficiales = MP_LISTA.map(ref => {
    const guardado = porCodigo.get(ref.c);
    return guardado ? { ...guardado, c: ref.c, n: ref.n, pres: ref.pres } : { ...ref };
  });
  const oficialesSet = new Set(MP_LISTA.map(item => item.c));
  return [...oficiales, ...actual.filter(item => item?.c && !oficialesSet.has(item.c))];
};

const RECETAS_MP = {
  "Impulsor": { MP001: .510954, MP004: .243609, MP005: .01, MP006: .038783, MP007: .067696, MP008: .028598, MP009: .003, MP022: .040924, MP023: .001, MP026: .00175, MP033: .035, MP035: .007033, MP036: .003207, MP037: .00175, MP038: .0015, MP039: .001196, MP040: .001, MP041: .000712, MP042: .000543, MP043: .000522, MP044: .0005, MP045: .000402, MP046: .000196, MP047: .00012 },
  "Fase 1": { MP001: .524875, MP004: .217415, MP005: .03, MP006: .025652, MP007: .067001, MP008: .027696, MP009: .003, MP022: .038946, MP023: .001, MP026: .002641, MP031: .03, MP033: .015, MP035: .005141, MP036: .002913, MP037: .00175, MP038: .0015, MP039: .001413, MP040: .001, MP042: .000554, MP043: .000587, MP044: .0005, MP045: .000402, MP046: .000196, MP047: .000152 },
  "Impulsor Gortech": { MP001: .63004, MP004: .22379, MP006: .013105, MP007: .078629, MP008: .03629, MP009: .003024, MP013: .015121 },
  "651 Impulsor VYMISA": { MP001: .521036, MP004: .252432, MP006: .031411, MP007: .0677, MP008: .029666, MP009: .003, MP022: .048486, MP026: .002128, MP033: .019802, MP035: .006258, MP036: .00346, MP037: .0015, MP039: .000808, MP040: .001, MP041: .00063, MP042: .000638, MP043: .000592, MP045: .0004, MP046: .0002, MP047: .000104, MP048: .01 },
  "Cría": { MP003: .623522, MP004: .217326, MP009: .021696, MP028: .008043, MP029: .001522, MP030: .021696, MP031: .106196 },
  "Desarrollo": { MP003: .65999, MP004: .259996, MP009: .017507, MP022: .044999, MP030: .017507 },
  "Engorde": { MP003: .475, MP004: .013507, MP009: .008, MP022: .411696, MP029: .000797, MP030: .008, MP031: .083 },
};
const BASCULA_MP = {
  MP001: 1, MP003: 1, MP004: 1, MP005: 1, MP022: 1, MP033: 1,
  MP006: 2, MP031: 2,
  MP007: 3, MP008: 3, MP009: 3,
};
const basculaDe = (c) => BASCULA_MP[c] || 4;
const NOMBRE_BASCULA = { 1: "BÁSCULA 1 — MACROS", 2: "BÁSCULA 2 — LÍQUIDOS", 3: "BÁSCULA 3 — MEDIOS", 4: "BÁSCULA 4 — MICROS (NÚCLEO)" };

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
  const brecha = meta == null ? null : +(meta - actual).toFixed(1);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: "relative", height: 12, background: C.verdeSuave, borderRadius: 6 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${C.yema}, #F5B845)`, borderRadius: 6 }} />
        {meta != null && <div style={{ position: "absolute", left: `${Math.min(meta, 99)}%`, top: -3, height: 18, width: 2.5, background: C.verde, borderRadius: 2 }} />}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11.5, color: C.textoSuave }}>
        <span><b style={{ color: C.texto }}>{actual.toFixed(1)}%</b> postura</span>
        <span style={{ color: brecha == null ? C.textoSuave : brecha > 0 ? C.alerta : C.verde, fontWeight: 500 }}>{brecha == null ? "sin dato de postura para esta semana" : `${brecha > 0 ? `−${brecha}` : `+${Math.abs(brecha)}`} pts vs tabla`}</span>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 16, border: `1.5px solid #E4E4DC`, borderRadius: 10, background: "#fff", fontFamily: "'Inter', sans-serif", outline: "none" };

// ── Campo mejorado con Unidades Fijas (Punto 14) y Validación Inline (Puntos 12, 13) ──
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

const filtroVacio = () => ({ texto: "", lote: "", desde: "", hasta: "", estado: "", orden: "desc" });
const filtrarLista = (filas, f) => filas.filter(x => {
  const q = f.texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const fecha = fechaPesajeISO(x.fecha);
  const texto = `${x.texto || ""} ${fecha ? fecha.split("-").reverse().join("/") : ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return (!q || texto.includes(q)) && (!f.lote || x.lote === f.lote) &&
    (!f.desde || fecha >= f.desde) && (!f.hasta || fecha <= f.hasta) && (!f.estado || x.estado === f.estado);
}).sort((a, b) => f.orden === "asc" ? fechaPesajeISO(a.fecha).localeCompare(fechaPesajeISO(b.fecha)) : fechaPesajeISO(b.fecha).localeCompare(fechaPesajeISO(a.fecha)));

function FiltrosLista({ filtro, setFiltro, lotes, estados = [], total, visibles }) {
  const [avanzados, setAvanzados] = useState(false);
  const cambiar = (k, v) => setFiltro(f => ({ ...f, [k]: v }));
  return <div style={{ padding: 10, background: C.fondo, borderRadius: 10, margin: "10px 0", fontSize: 12.5 }}>
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
      <input aria-label="Buscar por palabra, hoja o fecha" placeholder="Buscar palabra, galera, hoja o fecha…" value={filtro.texto} onChange={e => cambiar("texto", e.target.value)} style={{ ...inputStyle, flex: "1 1 210px" }} />
      <button type="button" onClick={() => setAvanzados(v => !v)}>{avanzados ? "Menos filtros" : "+ Filtros"}</button>
      <button type="button" onClick={() => setFiltro(filtroVacio())}>Limpiar</button>
      <span>{visibles} de {total}</span>
    </div>
    {avanzados && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      <label>Galera / lote<select value={filtro.lote} onChange={e => cambiar("lote", e.target.value)} style={inputStyle}><option value="">Todas</option>{lotes.map(l => <option key={l.id} value={l.id}>G{l.galpon} · {l.lote || l.id}</option>)}</select></label>
      <label>Desde<input type="date" value={filtro.desde} onChange={e => cambiar("desde", e.target.value)} style={inputStyle} /></label>
      <label>Hasta<input type="date" value={filtro.hasta} onChange={e => cambiar("hasta", e.target.value)} style={inputStyle} /></label>
      {!!estados.length && <label>Estado<select value={filtro.estado} onChange={e => cambiar("estado", e.target.value)} style={inputStyle}><option value="">Todos</option>{estados.map(x => <option key={x} value={x}>{x}</option>)}</select></label>}
      <label>Orden<select value={filtro.orden} onChange={e => cambiar("orden", e.target.value)} style={inputStyle}><option value="desc">Más recientes</option><option value="asc">Más antiguos</option></select></label>
    </div>}
  </div>;
}

// ── Componente Matriz "Qué falta hoy" (Punto 11) ──
// ── Componente Modal para Pegar Tiquetes desde Excel (Punto 22) ──
function MigasPan({ vista, tabs, gruposMenu, lotes, galponActivo, fechaCaptura, fechaBodega, subBodega, subReporte, subPlanta, subPedidoMP, subFormulas, subInsumos, subPesaje, subHistorial, recActiva, fPeso, histFecha, irA, avisar }) {
  if (vista === "inicio") return null;

  const tabActual = tabs.find(t => t.id === vista) || { nombre: vista };
  const grupoActual = gruposMenu.find(g => g.ids.includes(vista));

  let subdetalle = null;
  if (vista === "captura") {
    const l = lotes.find(x => x.id === galponActivo);
    subdetalle = `Galpón ${l?.galpon || galponActivo || "1"} · ${fechaCaptura ? fechaCaptura.split("-").reverse().join("/") : "Hoy"}`;
  } else if (vista === "bodega") {
    const nombresSubBodega = { producido: "Huevo producido", ruta: "Salida a ruta", otros: "Otros movimientos", cierre: "Cierre del día", historial: "Historial", apertura: "Apertura", todo: "Todo" };
    const nomSub = nombresSubBodega[subBodega] || "Movimiento";
    subdetalle = `${nomSub} · ${fechaBodega ? fechaBodega.split("-").reverse().join("/") : "Hoy"}`;
  } else if (vista === "reporte") {
    subdetalle = ({ resumen: "Resumen", comparativo: "Comparativo", decisiones: "Decisiones", bitacora: "Bitácora", auditoria: "Auditoría", kpis: "KPIs técnicos", economia: "Economía", todo: "Ver todo" })[subReporte] || "Ver todo";
  } else if (vista === "planta") {
    const nomSub = { baches: "Baches producidos", nucleo: "Núcleo", ganado: "Servido a ganado", ajustes: "Conteo y ajustes", facturas: "Facturas MP", historial: "Historial", apertura: "Apertura", todo: "Todo" }[subPlanta] || "Planta";
    subdetalle = nomSub;
  } else if (vista === "pedidomp") {
    const nomSub = { kardex: "Kardex MP", consumo: "Consumo proyectado", inventario: "Conteo físico", calculado: "Pedido calculado", proveedor: "Orden proveedor", pedidos: "Historial", todo: "Todo" }[subPedidoMP] || "Materia Prima";
    subdetalle = nomSub;
  } else if (vista === "formulas") {
    const nomSub = { recetas: `Fórmulas (${recActiva || "activas"})`, nueva: "Crear fórmula", catalogo: "Catálogo MP", todo: "Todo" }[subFormulas] || "Fórmulas";
    subdetalle = nomSub;
  } else if (vista === "insumos") {
    const nomSub = { catalogo: "Inventario por categoría", conteo: "Conteo general", movimiento: "Registrar movimiento", nuevo: "Agregar insumo", todo: "Todo" }[subInsumos] || "Insumos";
    subdetalle = nomSub;
  } else if (vista === "pesaje") {
    const nomSub = { pesajes: "Pesajes de parvada", histpesajes: "Buscar / corregir", vacunas: "Vacunación", enfermedades: "Expediente médico", necropsias: "Necropsias", todo: "Todo" }[subPesaje] || "Bienestar";
    subdetalle = nomSub;
  } else if (vista === "historial") {
    const nomSub = { dia: `Día ${histFecha ? histFecha.split("-").reverse().join("/") : "Consulta"}`, mes: "Resumen mensual", correcciones: "Correcciones", todo: "Todo" }[subHistorial] || "Historial";
    subdetalle = nomSub;
  }

  const copiarEnlace = () => {
    try {
      const url = window.location.href;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url);
      } else {
        const inp = document.createElement("input");
        inp.value = url;
        document.body.appendChild(inp);
        inp.select();
        document.execCommand("copy");
        document.body.removeChild(inp);
      }
      avisar?.("✓ Enlace directo copiado al portapapeles");
    } catch {
      avisar?.("⚠ No se pudo copiar el enlace");
    }
  };

  return (    <nav className="v10-breadcrumbs" aria-label="Ruta de navegación">
      <div className="v10-breadcrumbs-trail">
        <button type="button" className="v10-breadcrumbs-crumb" onClick={() => irA("inicio")}>
          Inicio
        </button>
        {grupoActual && (
          <>
            <span className="v10-breadcrumbs-sep">›</span>
            <span style={{ color: C.textoSuave }}>{grupoActual.nombre}</span>
          </>
        )}
        <span className="v10-breadcrumbs-sep">›</span>
        <button
          type="button"
          className={`v10-breadcrumbs-crumb ${!subdetalle ? "v10-breadcrumbs-current" : ""}`}
          onClick={() => irA(vista)}
        >
          {tabActual.nombre}
        </button>
        {subdetalle && (
          <>
            <span className="v10-breadcrumbs-sep">›</span>
            <span className="v10-breadcrumbs-current">{subdetalle}</span>
          </>
        )}
      </div>
      <button
        type="button"
        className="v10-copy-link-btn"
        onClick={copiarEnlace}
        title="Copiar enlace directo a esta vista"
      >
        🔗 Copiar enlace
      </button>
    </nav>
  );
}



function BarraSubmenu({ subsecciones, activo, onChange }) {
  return (
    <div className="v10-subnav" style={{ display: "flex", gap: 7, overflowX: "auto", padding: "4px 2px 14px", marginBottom: 14, borderBottom: `1px solid ${C.borde}` }}>
      {subsecciones.map(sub => (
        <button
          key={sub.id}
          type="button"
          onClick={() => onChange(sub.id)}
          style={{
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 20,
            cursor: "pointer",
            whiteSpace: "nowrap",
            border: activo === sub.id ? `2px solid ${C.verde}` : `1.5px solid ${C.borde}`,
            background: activo === sub.id ? C.verdeSuave : C.superficie,
            color: activo === sub.id ? C.verde : C.texto,
            fontFamily: "'Inter', sans-serif",
            transition: "all 0.15s ease",
          }}
        >
          {sub.icono} {sub.nombre}
        </button>
      ))}
    </div>
  );
}

export default function App({ onCerrarSesion }) {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [cargandoFondo, setCargandoFondo] = useState(false);
  const leerHashRuta = () => {
    if (typeof window === "undefined" || !window.location.hash) return null;
    const raw = window.location.hash.replace(/^#\/?/, "");
    if (!raw) return null;
    const [ruta, queryStr] = raw.split("?");
    const params = new URLSearchParams(queryStr || "");
    return { ruta, params };
  };
  const rutaInicialExplicitaRef = useRef(typeof window !== "undefined" && !!window.location.hash);
  const [vista, setVista] = useState(() => {
    const h = leerHashRuta();
    if (h && h.ruta) return h.ruta;
    return localStorage.getItem(`rancho:ultimaVista:${window.__usuarioEmail || "local"}`) || "inicio";
  });
  const [busquedaGlobal, setBusquedaGlobal] = useState("");
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [menuMovil, setMenuMovil] = useState(false);
  const [salidaPendiente, setSalidaPendiente] = useState(null);
  // Consulta de historial con captura pendiente: antes de cambiar de sección
  // guardamos una copia local para que consultar nunca borre lo que se estaba
  // digitando. La copia es por usuario y no modifica los datos compartidos.
  const [consultaHistorialPendiente, setConsultaHistorialPendiente] = useState(null);
  const [accesoDenegado, setAccesoDenegado] = useState(null);
  const [modalPegarTiquetes, setModalPegarTiquetes] = useState(false);
  const [preferencias, setPreferencias] = useState(DEFAULT_PREFERENCES);
  const [preferenciasCargadas, setPreferenciasCargadas] = useState(false);
  const [guardandoPreferencias, setGuardandoPreferencias] = useState(false);
  const [configOrganizacion, setConfigOrganizacion] = useState({ nombre: "Rancho El Soñado" });
  const vistaInicialAplicadaRef = useRef(false);
  useEffect(() => { localStorage.setItem(`rancho:ultimaVista:${window.__usuarioEmail || "local"}`, vista); }, [vista]);
  useEffect(() => {
    let activo = true;
    leerPreferencias().then(p => { if (activo) { setPreferencias(p); setPreferenciasCargadas(true); } });
    return () => { activo = false; };
  }, []);
  useEffect(() => {
    const actualizar = e => setConfigOrganizacion(v => ({ ...v, ...(e.detail || {}) }));
    supabase.from("organization_settings").select("settings").eq("id", "rancho").maybeSingle().then(({ data }) => { if (data?.settings) actualizar({ detail: data.settings }); });
    addEventListener("rancho:organization-settings", actualizar);
    return () => removeEventListener("rancho:organization-settings", actualizar);
  }, []);
  useEffect(() => {
    const atajo = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setBuscadorAbierto(true); } if (e.key === "Escape") { setBuscadorAbierto(false); setMenuMovil(false); setModalPegarTiquetes(false); } };
    addEventListener("keydown", atajo); return () => removeEventListener("keydown", atajo);
  }, []);
  const [lotes, setLotes] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [pesajes, setPesajes] = useState([]);
  const [medicaciones, setMedicaciones] = useState([]);
  const [fumigaciones, setFumigaciones] = useState([]);
  const [bodegaMovs, setBodegaMovs] = useState([]);
  const [plantaMovs, setPlantaMovs] = useState([]);
  const [filtroPlanta, setFiltroPlanta] = useState(filtroPlantaInicial);
  const [editarDetallePlanta, setEditarDetallePlanta] = useState(null);
  const [motivoDetallePlanta, setMotivoDetallePlanta] = useState("");
  const [facturas, setFacturas] = useState([]);
  const [vacunas, setVacunas] = useState([]);
  const [enfermedades, setEnfermedades] = useState([]);
  const [necropsias, setNecropsias] = useState([]);
  const [planVac, setPlanVac] = useState([]);
  const [bitacora, setBitacora] = useState([]);
  const [costos, setCostos] = useState(SEED_COSTOS);
  const [guardado, setGuardado] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Advertencias ajustadas / eliminadas
  const [advAjustes, setAdvAjustes] = useState([]);
  const [modalAdv, setModalAdv] = useState(null);

  const [galponActivo, setGalponActivo] = useState("G1");
  const suciosRef = useRef({});
  // Conserva la versión exacta que cada formulario tenía al empezar a editarse.
  // Realtime puede refrescar la pantalla, pero esta base no cambia hasta guardar
  // o descartar: así nunca se pisa silenciosamente el trabajo de otra persona.
  const basesEdicionRef = useRef({});
  const notaSuciaRef = useRef(false);
  const fechaCapturaRef = useRef(hoyISO());
  const [completadoPor, setCompletadoPor] = useState("");
  const [capturas, setCapturas] = useState({});
  const [borradorDisponible, setBorradorDisponible] = useState(null);
  const [pasosBodega, setPasosBodega] = useState({ salidas: false, devoluciones: false, conteo: false });
  const [revisionGuardado, setRevisionGuardado] = useState(null);
  const [estadoSync, setEstadoSync] = useState("Sincronizado");
  const [filtroExcepciones, setFiltroExcepciones] = useState("Todas");
  const [conflictoEdicion, setConflictoEdicion] = useState("");
  useEffect(() => {
    const actualizar = () => setEstadoSync(navigator.onLine ? "Sincronizado" : "Sin conexión");
    const sincronizar = e => setEstadoSync(e.detail);
    addEventListener("online", actualizar); addEventListener("offline", actualizar);
    addEventListener("granja:sync", sincronizar);
    actualizar(); return () => { removeEventListener("online", actualizar); removeEventListener("offline", actualizar); removeEventListener("granja:sync", sincronizar); };
  }, []);
  const [notaDia, setNotaDia] = useState("");

  // Bodega
  const [movBodega, setMovBodega] = useState({ comprado: "", vendGranja: "", destruido: "", regalado: "" });
  const [repartos, setRepartos] = useState([
    { nombre: "Andrés", salida: "", devBueno: "", devMalo: "" },
    { nombre: "Bryan", salida: "", devBueno: "", devMalo: "" },
  ]);
  const [obsInv, setObsInv] = useState("");
  const [ajusteBodega, setAjusteBodega] = useState("");
  const [bodegaBorradorConsulta, setBodegaBorradorConsulta] = useState(null);
  const bodegaBorradorCargadoRef = useRef(false);
    const [subPlanta, setSubPlanta] = useState("baches");
  const [subPedidoMP, setSubPedidoMP] = useState("kardex");
  const [subFormulas, setSubFormulas] = useState("recetas");
  const [subInsumos, setSubInsumos] = useState("catalogo");
  const [subRevision, setSubRevision] = useState("alertas");
  const [subPesaje, setSubPesaje] = useState("resumen");
  const [subHistorial, setSubHistorial] = useState("dia");
  const [subReporte, setSubReporte] = useState("todo");
  const [editarAjustePlanta, setEditarAjustePlanta] = useState(null);
  const [subBodega, setSubBodega] = useState("producido");
  const [fechaBodega, setFechaBodega] = useState(hoyISO());
  const [movBodegaId, setMovBodegaId] = useState(null);
  const fechaBodegaRef = useRef(hoyISO());
  const movBodegaIdRef = useRef(null);
  const movBodegaOriginalRef = useRef(null);
  const [motivoEdicionBodega, setMotivoEdicionBodega] = useState("");
  const [periodosHistorial, setPeriodosHistorial] = useState(() => { try { return JSON.parse(localStorage.getItem(`rancho:periodos:${window.__usuarioEmail || "local"}`) || "{}"); } catch { return {}; } });
  useEffect(() => { localStorage.setItem(`rancho:periodos:${window.__usuarioEmail || "local"}`, JSON.stringify(periodosHistorial)); }, [periodosHistorial]);
  const [nucleoInv, setNucleoInv] = useState({});
  const [cxp, setCxp] = useState({ facturas: [], pagos: [] });
  const [fCxpFac, setFCxpFac] = useState(null);
  const [abonando, setAbonando] = useState(null);
  const [fAbono, setFAbono] = useState({ monto: "", fecha: hoyISO(), medio: "Transferencia", ref: "" });
  const [kardex, setKardex] = useState([]);
  const [fAjMP, setFAjMP] = useState({ mp: "", saldoReal: "", fecha: hoyISO(), responsable: "", motivo: "Conciliación con conteo físico" });
  const [editarAjusteMP, setEditarAjusteMP] = useState(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [miRol, setMiRol] = useState("cargando");
  const [usuariosRoles, setUsuariosRoles] = useState([]);
  const [correoInvitacion, setCorreoInvitacion] = useState("");
  const [rolInvitacion, setRolInvitacion] = useState("encargado");
  const [gestionUsuarios, setGestionUsuarios] = useState(false);
  const [cfgAdmins, setCfgAdmins] = useState([]);
  const [nombresUsuarios, setNombresUsuarios] = useState({});
  const [correoNombre, setCorreoNombre] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [nuevoAdmin, setNuevoAdmin] = useState("");
  const [favoritos, setFavoritos] = useState([]);
  const [mpInvHist, setMpInvHist] = useState([]);
  const [gestionFav, setGestionFav] = useState(null);
  const [modalFav, setModalFav] = useState(null);
  const [fNucleo, setFNucleo] = useState({ formula: "Impulsor", porciones: "", numNucleo: "", fecha: hoyISO() });

  // Planta
  const [fBache, setFBache] = useState({ formula: "Impulsor", baches: "", kg: "", numBache: "", fecha: hoyISO() });
  const [plantaCfg, setPlantaCfg] = useState({ inicialAves: SEED_PLANTA.saldoKg, inicialGanado: 0 });
  const [bodegaCfg, setBodegaCfg] = useState({ inicialCart: 128 });
  const [aperturaIns, setAperturaIns] = useState({});
  const [fServGan, setFServGan] = useState({ kg: "", detalle: "", formula: "", grupoKey: "", fecha: hoyISO() });
  const [fAjPlanta, setFAjPlanta] = useState({ categoria: "Aves", formula: "", saldoReal: "", fecha: hoyISO(), responsable: "" });
  const [racionesGanado, setRacionesGanado] = useState({});
  const [fFactura, setFFactura] = useState({ proveedor: "", producto: "", monto: "", fecha: hoyISO() });

  const [fPeso, setFPeso] = useState({ lote: "G1", pesos: "", fecha: hoyISO() });
  const [excelPesajes, setExcelPesajes] = useState([]);
  const [excelAbierto, setExcelAbierto] = useState(-1);
  const [importandoPesajes, setImportandoPesajes] = useState(false);
  const [conflictosPesaje, setConflictosPesaje] = useState(null);
  const [conflictosRespaldo, setConflictosRespaldo] = useState(null);
  const [filtroExcel, setFiltroExcel] = useState(filtroVacio);
  const [filtroHistPesajes, setFiltroHistPesajes] = useState(filtroVacio);
  const [filtroConfPesajes, setFiltroConfPesajes] = useState(filtroVacio);
  const [filtroConfRespaldo, setFiltroConfRespaldo] = useState(filtroVacio);
  const [editarPesaje, setEditarPesaje] = useState(null);
  const [pesajeEliminar, setPesajeEliminar] = useState(null);
  const [tareasProgramadas, setTareasProgramadas] = useState([]);
  const [formTarea, setFormTarea] = useState({ nombre: "", lote: "", inicio: hoyISO(), repeticion: "dias", cadaDias: 22, diasSemana: [5] });
  const [deshacerTarea, setDeshacerTarea] = useState(null);
  const [plantillasTarea, setPlantillasTarea] = useState([]);
  const [guardandoTarea, setGuardandoTarea] = useState(false);
  const [fVac, setFVac] = useState({ lote: "G1", vacuna: "", cepa: "", via: "", proveedor: "" });
  const [fechasAplicar, setFechasAplicar] = useState({});
  const [fechaCaptura, setFechaCaptura] = useState(hoyISO());
  useEffect(() => {
    if (!preferenciasCargadas) return;
    leerBorrador(fechaCaptura, preferencias.borradores.almacenamiento).then(b => {
      const vigente = b?.fecha === fechaCaptura && Date.now() - b.guardadoEl < 7 * 86400000 ? b : null;
      if (vigente && preferencias.borradores.recuperarAutomaticamente) {
        suciosRef.current = Object.fromEntries(Object.keys(vigente.capturas || {}).map(id => [id, true]));
        basesEdicionRef.current = vigente.bases || {};
        setCapturas(v => ({ ...v, ...vigente.capturas }));
        if (vigente.nota) { notaSuciaRef.current = true; setNotaDia(vigente.nota); }
      } else setBorradorDisponible(vigente);
    });
  }, [preferenciasCargadas, preferencias.borradores.almacenamiento]);
  useEffect(() => {
    if (vista !== "captura") return;
    const revisar = async () => {
      if (!Object.keys(suciosRef.current).length) return;
      const actuales = await leer(K.registros, null);
      if (!actuales) return;
      const fecha = fechaCaptura.split("-").reverse().join("/");
      const cambia = Object.keys(suciosRef.current).some(id => {
        const clave = `${fechaCaptura}|${id}`;
        const r = Object.prototype.hasOwnProperty.call(basesEdicionRef.current, clave)
          ? basesEdicionRef.current[clave]
          : registros.find(x => x.fecha === fecha && x.lote === id) || null;
        const a = actuales.find(x => x.fecha === fecha && x.lote === id);
        return registroCambioDesdeBase(r, a);
      });
      setConflictoEdicion(cambia ? "Otro dispositivo cambió esta fecha. Revisa y actualiza antes de guardar." : "");
    };
    const timer = setInterval(revisar, 30000);
    return () => clearInterval(timer);
  }, [vista, fechaCaptura, registros]);

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

  const cambiarFechaCaptura = async (iso) => {
    setFechaCaptura(iso);
    fechaCapturaRef.current = iso;
    suciosRef.current = {};
    basesEdicionRef.current = {};
    const dmy = iso.split("-").reverse().join("/");
    let cargados = 0;
    const nuevas = Object.fromEntries(lotes.map(l => {
      const c2 = construirCaptura(l, dmy, registros, medicaciones, fumigaciones);
      if (c2) cargados++;
      return [l.id, c2 || capturaVacia()];
    }));
    setCapturas(nuevas);
    try {
      const borrador = await leerBorrador(iso, preferencias.borradores.almacenamiento);
      const vigente = borrador?.fecha === iso && Date.now() - borrador.guardadoEl < 7 * 86400000 ? borrador : null;
      if (vigente && preferencias.borradores.recuperarAutomaticamente) {
        suciosRef.current = Object.fromEntries(Object.keys(vigente.capturas || {}).map(id => [id, true]));
        basesEdicionRef.current = vigente.bases || {};
        setCapturas(v => ({ ...v, ...vigente.capturas }));
        if (vigente.nota) { notaSuciaRef.current = true; setNotaDia(vigente.nota); }
        setBorradorDisponible(null);
      } else setBorradorDisponible(vigente);
    } catch { setBorradorDisponible(null); }
    if (cargados > 0) avisar(`✓ Se cargó lo guardado del ${dmy} (${cargados} gallinero(s)) — edita solo lo necesario`);
  };
  useEffect(() => {
    if (!preferencias.borradores.autoguardado || (!Object.keys(suciosRef.current).length && !notaSuciaRef.current)) return;
    const timer = setTimeout(() => {
      guardarBorrador(fechaCaptura, { fecha: fechaCaptura, capturas: Object.fromEntries(Object.keys(suciosRef.current).map(id => [id, capturas[id]])), bases: basesEdicionRef.current, nota: notaSuciaRef.current ? notaDia : "", guardadoEl: Date.now() }, preferencias.borradores.almacenamiento)
        .catch(() => setEstadoSync("Borrador local"));
    }, preferencias.borradores.intervaloSegundos * 1000);
    return () => clearTimeout(timer);
  }, [capturas, notaDia, fechaCaptura, preferencias.borradores]);
  const [fNecFotos, setFNecFotos] = useState([]);
  const [fotosVista, setFotosVista] = useState({});
  const [printDoc, setPrintDoc] = useState(null);
  const [elegirReporteActividades, setElegirReporteActividades] = useState(false);
  const [tareasManualesReporte, setTareasManualesReporte] = useState("");
  const [alcanceReporteActividades, setAlcanceReporteActividades] = useState("");
  const [mpInv, setMpInv] = useState({});
  const [mpHistorialAbierto, setMpHistorialAbierto] = useState(false);
  const [mpHistorialDetalle, setMpHistorialDetalle] = useState(null);
  const [mpHistorialEdicion, setMpHistorialEdicion] = useState({});
  const [mpHistorialFechaEditada, setMpHistorialFechaEditada] = useState("");
  const [mpHistorialResponsableEditado, setMpHistorialResponsableEditado] = useState("");
  const [mpHistorialEditando, setMpHistorialEditando] = useState(false);
  const [mpLimpiarPendiente, setMpLimpiarPendiente] = useState(false);
  const [mpBorradorConsulta, setMpBorradorConsulta] = useState(null);
  const mpBorradorCargadoRef = useRef(false);
  const [mpInvUltimo, setMpInvUltimo] = useState({});
  const [mpFechaInput, setMpFechaInput] = useState(hoyISO());
  const [mpFechaConteo, setMpFechaConteo] = useState("");
  const [mpResponsable, setMpResponsable] = useState("");
  const [mpConfig, setMpConfig] = useState({ cobertura: 11, minKg1: 5, ganado: GANADO_SEMILLA, formulaLote: {} });
  const [mpPedidos, setMpPedidos] = useState([]);
  const [fPedidoMP, setFPedidoMP] = useState({ fecha: hoyISO(), proveedor: "", nota: "", lineas: [{ mp: "", kg: "" }] });
  const [recetas, setRecetas] = useState(SEED_RECETAS);
  const [mpCat, setMpCat] = useState(MP_LISTA);
  const [fNuevaMP, setFNuevaMP] = useState({ n: "", prov: "", pres: "" });
  const [insumos, setInsumos] = useState(SEED_INSUMOS);
  const [insumosMovs, setInsumosMovs] = useState([]);
  const [fMovIns, setFMovIns] = useState({ tipo: "entrada", itemId: "", cantidad: "", detalle: "", fecha: hoyISO() });
  const [fNuevoIns, setFNuevoIns] = useState({ nombre: "", categoria: "Medicinas", unidad: "ml", saldo: "", presentacion: "", dosis: "", proveedor: "" });
  const [recActiva, setRecActiva] = useState("Impulsor");
  const [fNuevaRec, setFNuevaRec] = useState({ nombre: "", uso: "Aves" });
  const [fIng, setFIng] = useState({ mp: "MP001", kg: "" });
  const [fEnf, setFEnf] = useState({ lote: "G1", enfermedad: "", tratamiento: "", estado: "En tratamiento" });
  const [fNec, setFNec] = useState({ lote: "G1", tipo: "Necropsia", laboratorio: "", hallazgos: "" });
  const [fPlan, setFPlan] = useState({ vacuna: "", cepa: "", via: "", proveedor: "", dia: "" });
  useEffect(() => {
    if (!preferenciasCargadas || mpBorradorCargadoRef.current) return;
    mpBorradorCargadoRef.current = true;
    leerBorrador("consulta-materia-prima", "local").then(borrador => {
      const vigente = borrador?.tipo === "materia-prima-inventario" && Date.now() - Number(borrador.guardadoEl || 0) < 7 * 86400000
        ? borrador
        : null;
      if (vigente) setMpBorradorConsulta(vigente);
    }).catch(() => {});
  }, [preferenciasCargadas]);
  useEffect(() => {
    if (!preferenciasCargadas || bodegaBorradorCargadoRef.current) return;
    bodegaBorradorCargadoRef.current = true;
    leerBorrador("consulta-bodega", "local").then(borrador => {
      const vigente = borrador?.tipo === "bodega" && Date.now() - Number(borrador.guardadoEl || 0) < 7 * 86400000
        ? borrador
        : null;
      if (vigente) setBodegaBorradorConsulta(vigente);
    }).catch(() => {});
  }, [preferenciasCargadas]);
  const [histFecha, setHistFecha] = useState(() => hoyISO());
  const [histMes, setHistMes] = useState(() => hoyISO().slice(0, 7));