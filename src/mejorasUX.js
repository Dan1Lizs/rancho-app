import { fechaHistorialISO } from "./historial.js";
import { movimientosConFechaFutura } from "./plantaHistorial.js";

export function saltosTiquetes(tiquetes) {
  const nums = [...new Set(tiquetes.map(t => String(t.num || "").trim()).filter(x => /^\d+$/.test(x)).map(Number))].sort((a, b) => a - b);
  if (nums.length < 2 || nums.at(-1) - nums[0] > 200) return [];
  const presentes = new Set(nums);
  return Array.from({ length: nums.at(-1) - nums[0] - 1 }, (_, i) => nums[0] + i + 1).filter(n => !presentes.has(n));
}

// El talonario es común a todos los gallineros. Los formularios editados
// sustituyen su registro guardado; el resto se toma de la fecha elegida.
export function tiquetesDelDia(capturas, registros, fecha, editados = []) {
  const cambios = new Set(editados);
  const guardados = registros.filter(r => r.fecha === fecha && !cambios.has(r.lote));
  const conRegistro = new Set(guardados.map(r => r.lote));
  return [
    ...guardados.flatMap(r => r.tiquetes || []),
    ...Object.entries(capturas).filter(([id]) => cambios.has(id) || !conRegistro.has(id)).flatMap(([, c]) => c?.tiquetes || []),
  ];
}

export function observacionesCaptura(capturas, lotes, tiquetesGlobales = []) {
  const avisos = [];
  const saltos = saltosTiquetes(tiquetesGlobales);
  if (saltos.length) avisos.push(`En la fecha, entre todos los gallineros, faltan números de tiquete ${saltos.slice(0, 12).join(", ")}${saltos.length > 12 ? "…" : ""}`);
  for (const l of lotes) {
    const c = capturas[l.id]; if (!c) continue;
    const tiquetes = (c.tiquetes || []).filter(t => t.num || t.cartones || t.peso);
    if (tiquetes.some(t => !t.num || !Number(t.cartones) || !Number(t.peso))) avisos.push(`G${l.galpon}: hay tiquetes incompletos`);
    for (const t of tiquetes) if (Number(t.cartones) > 0 && Number(t.peso) > 0) {
      const kgCart = Number(t.peso) / Number(t.cartones);
      if (kgCart < 1 || kgCart > 3) avisos.push(`G${l.galpon}: tiquete #${t.num} (${kgCart.toFixed(2)} kg/cartón), revisa peso y cartones`);
    }
  }
  return avisos;
}

export function excepcionesOperacion({ registros, lotes, saldoAves, saldoGanado, saldosAvesFormula, saldosGanadoFormula, bodegaMovs, retirosActivos, tareas, plantaMovs = [], hoy = new Date() }) {
  const hallazgos = [];
  const grupos = new Map();
  for (const r of registros) {
    const k = `${r.fecha}|${r.lote}`;
    grupos.set(k, (grupos.get(k) || 0) + 1);
  }
  for (const [k, n] of grupos) if (n > 1) {
    const [fecha, lote] = k.split("|");
    hallazgos.push({ tipo: "Duplicado", texto: `${fecha} · ${lote} tiene ${n} controles`, destino: { vista: "historial", fecha: fechaHistorialISO(fecha), lote } });
  }
  for (const [nombre, saldo] of [["Aves", saldoAves], ["Ganado", saldoGanado]]) {
    if (saldo < 0) hallazgos.push({ tipo: "Saldo negativo", texto: `Concentrado ${nombre}: ${saldo.toFixed(1)} kg`, destino: { vista: "planta", categoria: nombre } });
  }
  for (const [categoria, saldos, total] of [["Aves", saldosAvesFormula, saldoAves], ["Ganado", saldosGanadoFormula, saldoGanado]]) {
    if (!saldos) continue;
    for (const [nombre, kg] of Object.entries(saldos)) if (kg != null && kg < 0) {
      hallazgos.push({ tipo: "Saldo negativo", texto: `${categoria} · ${nombre}: ${kg.toFixed(1)} kg`, destino: { vista: "planta", categoria, formula: nombre } });
    }
    const resto = total - Object.values(saldos).reduce((s, n) => s + Number(n || 0), 0);
    if (Math.abs(resto) > 0.11) {
      hallazgos.push({ tipo: "Sin conciliar", texto: `${categoria}: ${resto.toFixed(1)} kg sin distribuir o con diferencia`, destino: { vista: "planta", categoria } });
    }
  }
  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const fecha = `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  for (const m of movimientosConFechaFutura(plantaMovs, iso)) {
    const movimiento = m.tipo || "bache";
    const descripcion = [movimiento, m.formula].filter(Boolean).join(" ");
    hallazgos.push({
      tipo: "Fecha futura",
      texto: `Planta: ${descripcion || "movimiento"} · ${m.fecha}${m.kg != null ? ` · ${Number(m.kg).toFixed(2)} kg` : ""} — posterior a hoy`,
      destino: { vista: "planta", sub: "historial", categoria: m.categoria || "", formula: m.formula || "", id: m.id, fecha: fechaHistorialISO(m.fecha) },
    });
  }
  for (const l of lotes.filter(x => x.estado !== "cerrado")) if (!registros.some(r => r.fecha === fecha && r.lote === l.id)) {
    hallazgos.push({ tipo: "Pendiente", texto: `G${l.galpon}: falta control de hoy`, destino: { vista: "captura", fecha: iso, lote: l.id } });
  }
  for (const m of retirosActivos) {
    const lote = lotes.find(l => String(l.id) === String(m.lote)) || lotes.find(l => String(l.galpon) === String(m.galpon));
    hallazgos.push({ tipo: "Retiro", texto: `G${m.galpon}: ${m.producto} hasta ${m.retiroHasta}`, destino: { vista: "captura", fecha: fechaHistorialISO(m.fecha) || iso, lote: lote?.id } });
  }
  for (const t of tareas) if (t.vence && t.vence < iso) {
    hallazgos.push({ tipo: "Tarea atrasada", texto: t.nombre, destino: { vista: "captura", fecha: iso, lote: t.lote || "" } });
  }
  const ultimo = bodegaMovs[0];
  if (ultimo && fechaHistorialISO(ultimo.fecha) < iso) {
    hallazgos.push({ tipo: "Bodega", texto: `Último cierre: ${ultimo.fecha}`, destino: { vista: "bodega", fecha: fechaHistorialISO(ultimo.fecha), id: ultimo.id } });
  }
  return hallazgos;
}

export function csvAuditoria(filas) {
  const celda = v => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return "Fecha,Área,Acción,Responsable,Motivo,Antes,Después\r\n" + filas.map(f => [f.fecha, f.area, f.accion, f.responsable, f.motivo, f.antes, f.despues].map(celda).join(",")).join("\r\n");
}
