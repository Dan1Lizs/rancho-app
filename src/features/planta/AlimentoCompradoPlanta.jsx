import React, { useMemo, useState } from "react";
import { calcularSaldoAlimentoComprado, convertirAkg, esConsumoAlimentoComprado, TIPOS_MOVIMIENTO_COMPRADO } from "../../alimentoComprado.js";
import { fechaHistorialISO } from "../../historial.js";

const control = { width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid var(--v10-border, #d7ded5)", borderRadius: 9, background: "var(--v10-control, #f1f1ea)", color: "var(--v10-text, #1c1f1a)", font: "inherit" };
const field = { display: "grid", gap: 4, flex: "1 1 170px", fontSize: 12, fontWeight: 600 };
const btn = { padding: "9px 13px", border: 0, borderRadius: 9, color: "#fff", background: "var(--v10-green, #14432a)", fontWeight: 700, cursor: "pointer" };
const hoyISO = () => { const hoy = new Date(); return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`; };
const dmy = iso => iso ? iso.split("-").reverse().join("/") : "";
const idNuevo = () => globalThis.crypto?.randomUUID?.() || `compra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function AlimentoCompradoPlanta({
  productos = [], movimientos = [], registros = [], estadoInventario = { cerrado: false, historial: [] }, responsable = "", puedeAdministrar = false,
  onRegistrarMovimiento, onCambiarEstado, onAbrirFormulas,
}) {
  const [productoId, setProductoId] = useState("");
  const [unidadCompra, setUnidadCompra] = useState("presentacion");
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [proveedor, setProveedor] = useState("");
  const [loteProveedor, setLoteProveedor] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [detalle, setDetalle] = useState("");
  const [fechaConteo, setFechaConteo] = useState(hoyISO());
  const [saldoReal, setSaldoReal] = useState("");
  const [motivo, setMotivo] = useState("Conteo físico");
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const cerrado = Boolean(estadoInventario?.cerrado);
  const activos = productos.filter(producto => producto.activo !== false);
  const productoSeleccionado = activos.find(producto => String(producto.id) === String(productoId)) || activos[0];
  const movimientosComprados = useMemo(() => movimientos.filter(movimiento => TIPOS_MOVIMIENTO_COMPRADO.has(movimiento.tipo)), [movimientos]);
  const movimientosKardex = useMemo(() => [
    ...movimientosComprados.map(movimiento => ({ ...movimiento, tipoKardex: movimiento.tipo })),
    ...registros.filter(registro => esConsumoAlimentoComprado(registro) && registro.productoCompradoId)
      .map((registro, indice) => ({
        id: `consumo-${registro.id ?? `${registro.fecha}-${registro.lote}-${indice}`}`,
        tipo: "consumo_comprado", tipoKardex: "consumo_comprado", fecha: registro.fecha,
        registradoEl: registro.registradoEl || "", productoCompradoId: registro.productoCompradoId,
        productoCompradoNombre: registro.alimentoCompradoNombre || registro.formulaConcentrado,
        loteId: registro.lote, kg: -Math.abs(Number(registro.alimentoKg ?? (Number(registro.alimento6am || 0) + Number(registro.alimento1pm || 0)))),
      })),
  ].sort((a, b) => fechaHistorialISO(b.fecha).localeCompare(fechaHistorialISO(a.fecha))
    || String(b.registradoEl || "").localeCompare(String(a.registradoEl || ""))), [movimientosComprados, registros]);
  const existencia = producto => calcularSaldoAlimentoComprado(producto.id, hoyISO(), movimientosComprados, registros);
  const cantidadKg = productoSeleccionado && cantidad !== ""
    ? convertirAkg(cantidad, unidadCompra === "kg" ? "kg" : productoSeleccionado.unidad, productoSeleccionado.kgPorUnidad)
    : null;

  const registrarCompra = async () => {
    if (cerrado) { setMensaje("El inventario temporal está cerrado. Reactívalo para registrar compras."); return; }
    const producto = productoSeleccionado;
    const kg = cantidadKg;
    if (!producto || kg == null || kg <= 0 || !fecha) { setMensaje("Elige el producto e indica una cantidad válida mayor que cero."); return; }
    if (fecha > hoyISO()) { setMensaje("No se pueden registrar compras con fecha futura."); return; }
    if (vencimiento && vencimiento < fecha) { setMensaje("La fecha de vencimiento no puede ser anterior a la compra."); return; }
    const movimiento = {
      id: idNuevo(), tipo: "compra_comprado", categoria: "Comprado", fecha: dmy(fecha), registradoEl: new Date().toISOString(),
      productoCompradoId: producto.id, productoCompradoNombre: producto.nombre, kg,
      cantidadUnidades: Number(String(cantidad).replace(",", ".")), unidadCompra: unidadCompra === "kg" ? "kg" : producto.unidad,
      kgPorUnidad: unidadCompra === "kg" ? 1 : Number(producto.kgPorUnidad || 1),
      proveedor: proveedor.trim() || producto.proveedor || "", loteProveedor: loteProveedor.trim(), vencimiento,
      responsable: responsable.trim(), por: responsable.trim(), detalle: detalle.trim(),
    };
    setGuardando(true); setMensaje("");
    try {
      await onRegistrarMovimiento(movimiento);
      setCantidad(""); setProveedor(""); setLoteProveedor(""); setVencimiento(""); setDetalle("");
      setMensaje(`Compra registrada: ${kg.toFixed(2)} kg de ${producto.nombre}.`);
    } catch (error) { setMensaje(error?.message || "No se pudo registrar la compra."); }
    finally { setGuardando(false); }
  };

  const registrarConteo = async () => {
    if (cerrado) { setMensaje("El inventario temporal está cerrado."); return; }
    const producto = productoSeleccionado;
    const real = Number(String(saldoReal).replace(",", "."));
    if (!producto || saldoReal === "" || !Number.isFinite(real) || real < 0) { setMensaje("Indica el producto y un saldo físico válido, incluyendo 0 si está vacío."); return; }
    if (fechaConteo > hoyISO()) { setMensaje("No se puede contar inventario con fecha futura."); return; }
    const anterior = calcularSaldoAlimentoComprado(producto.id, fechaConteo, movimientosComprados, registros);
    const delta = +(real - anterior).toFixed(2);
    if (Math.abs(delta) < 0.005) { setMensaje("El conteo coincide con el saldo del sistema; no hace falta un ajuste."); return; }
    const movimiento = {
      id: idNuevo(), tipo: "ajuste_comprado", categoria: "Comprado", fecha: dmy(fechaConteo), registradoEl: new Date().toISOString(),
      productoCompradoId: producto.id, productoCompradoNombre: producto.nombre, kg: delta, saldoAnteriorKg: anterior, saldoRealKg: real,
      responsable: responsable.trim(), por: responsable.trim(), detalle: motivo.trim() || "Conteo físico",
    };
    setGuardando(true); setMensaje("");
    try {
      await onRegistrarMovimiento(movimiento);
      setSaldoReal(""); setMensaje(`Ajuste guardado: ${delta > 0 ? "+" : ""}${delta.toFixed(2)} kg.`);
    } catch (error) { setMensaje(error?.message || "No se pudo guardar el ajuste físico."); }
    finally { setGuardando(false); }
  };

  const cambiarCierre = async (nuevoCerrado) => {
    setGuardando(true); setMensaje("");
    try {
      await onCambiarEstado({
        ...estadoInventario,
        cerrado: nuevoCerrado,
        cerradoEl: nuevoCerrado ? new Date().toISOString() : null,
        cerradoPor: nuevoCerrado ? responsable : "",
        historial: [...(estadoInventario?.historial || []), { accion: nuevoCerrado ? "cerrar" : "reabrir", fechaHora: new Date().toISOString(), por: responsable }],
      });
      setConfirmarCierre(false);
      setMensaje(nuevoCerrado ? "Apartado cerrado. El kardex, los saldos y el historial se conservaron." : "Apartado reactivado.");
    } catch (error) { setMensaje(error?.message || "No se pudo actualizar el estado del apartado."); }
    finally { setGuardando(false); }
  };

  return (
    <section style={{ background: "var(--v10-surface, #fff)", border: "1px solid var(--v10-border, #d7ded5)", borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div><h3 style={{ margin: 0, color: "var(--v10-green, #14432a)" }}>Alimento comprado · inventario temporal</h3><p style={{ margin: "4px 0 10px", fontSize: 12.5, color: "var(--v10-muted, #667064)" }}>Kardex independiente en kg. Solo descuenta el consumo de los lotes vinculados desde Fórmulas; no afecta el concentrado producido en Planta.</p></div>
        {puedeAdministrar && <button type="button" disabled={guardando} onClick={() => cerrado ? cambiarCierre(false) : confirmarCierre ? cambiarCierre(true) : setConfirmarCierre(true)} style={{ padding: "7px 11px", border: "1px solid var(--v10-border, #d7ded5)", borderRadius: 8, background: cerrado ? "var(--v10-green-soft, #e7efe8)" : "transparent", color: cerrado ? "var(--v10-green, #14432a)" : "var(--v10-danger, #c4442a)", fontWeight: 700, cursor: "pointer" }}>{cerrado ? "Reabrir apartado" : confirmarCierre ? "Confirmar cierre" : "Cerrar apartado temporal"}</button>}
      </div>
      {cerrado && <div role="status" style={{ padding: 10, borderRadius: 9, background: "var(--v10-control, #f1f1ea)", marginBottom: 12, fontSize: 12.5 }}>Este apartado está cerrado. No se aceptan nuevas compras ni ajustes; los movimientos, consumos e inventario histórico permanecen disponibles. Un administrador o encargado puede reabrirlo.</div>}
      {confirmarCierre && !cerrado && <div role="alert" style={{ padding: 10, borderRadius: 9, background: "var(--v10-amber-soft, #fdf3e0)", marginBottom: 12, fontSize: 12.5 }}>El cierre no borra el inventario. Saldo que quedará archivado: <b>{productoSeleccionado ? `${existencia(productoSeleccionado).toFixed(2)} kg de ${productoSeleccionado.nombre}` : "sin productos"}</b>. <button type="button" onClick={() => setConfirmarCierre(false)} style={{ marginLeft: 5, border: 0, background: "transparent", color: "var(--v10-green, #14432a)", textDecoration: "underline", fontWeight: 700, cursor: "pointer" }}>Cancelar cierre</button></div>}
      {!activos.length && <div style={{ padding: 12, background: "var(--v10-control, #f1f1ea)", borderRadius: 10, marginBottom: 12, fontSize: 13 }}>No hay alimentos activos en el catálogo. Créalo primero en <button type="button" onClick={onAbrirFormulas} style={{ border: 0, padding: 0, background: "transparent", color: "var(--v10-green, #14432a)", textDecoration: "underline", fontWeight: 700, cursor: "pointer" }}>Fórmulas → Alimento comprado</button>.</div>}
      {activos.length > 0 && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginBottom: 12 }}>
          {productos.map(producto => { const saldo = existencia(producto); return <div key={producto.id} style={{ padding: 11, borderRadius: 10, background: "var(--v10-control, #f1f1ea)", border: "1px solid var(--v10-border, #d7ded5)" }}><div style={{ fontSize: 12, color: "var(--v10-muted, #667064)" }}>{producto.nombre} · {producto.etapa || "General"}{producto.activo === false ? " · Archivado" : ""}</div><b style={{ fontSize: 18, color: saldo < 0 ? "var(--v10-danger, #c4442a)" : "var(--v10-green, #14432a)" }}>{saldo.toFixed(2)} kg</b><div style={{ fontSize: 11, color: "var(--v10-muted, #667064)" }}>{producto.unidad} · {Number(producto.kgPorUnidad || 1)} kg por presentación</div></div>; })}
        </div>
        {!cerrado && <>
          <div style={{ padding: 13, borderRadius: 11, background: "var(--v10-green-soft, #e7efe8)", marginBottom: 12 }}>
            <b style={{ display: "block", marginBottom: 8 }}>Registrar compra recibida</b>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <label style={field}>Producto<select style={control} value={productoSeleccionado?.id || ""} onChange={event => setProductoId(event.target.value)}>{activos.map(producto => <option key={producto.id} value={producto.id}>{producto.nombre}</option>)}</select></label>
              <label style={field}>Unidad recibida<select style={control} value={unidadCompra} onChange={event => setUnidadCompra(event.target.value)}><option value="presentacion">{productoSeleccionado?.unidad || "Presentación"} ({Number(productoSeleccionado?.kgPorUnidad || 1)} kg)</option><option value="kg">Kilogramos</option></select></label>
              <label style={field}>Cantidad<input style={control} type="number" min="0.01" step="0.01" value={cantidad} onChange={event => setCantidad(event.target.value)} placeholder={unidadCompra === "kg" ? "kg" : "sacos"} /></label>
              <label style={field}>Fecha recibida<input style={control} type="date" max={hoyISO()} value={fecha} onChange={event => setFecha(event.target.value)} /></label>
              <label style={field}>Proveedor<input style={control} value={proveedor} onChange={event => setProveedor(event.target.value)} placeholder={productoSeleccionado?.proveedor || "Proveedor"} /></label>
              <label style={field}>Lote del proveedor<input style={control} value={loteProveedor} onChange={event => setLoteProveedor(event.target.value)} placeholder="opcional" /></label>
              <label style={field}>Vencimiento<input style={control} type="date" value={vencimiento} onChange={event => setVencimiento(event.target.value)} /></label>
              <label style={field}>Factura / observación<input style={control} value={detalle} onChange={event => setDetalle(event.target.value)} placeholder="opcional" /></label>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 8 }}><span style={{ fontSize: 12 }}>Equivalencia que entrará al kardex: <b>{cantidadKg == null ? "—" : `${cantidadKg.toFixed(2)} kg`}</b></span><button type="button" disabled={guardando} onClick={registrarCompra} style={btn}>{guardando ? "Guardando…" : "Registrar compra"}</button></div>
          </div>
          <div style={{ padding: 13, borderRadius: 11, background: "var(--v10-control, #f1f1ea)", marginBottom: 12 }}>
            <b style={{ display: "block", marginBottom: 8 }}>Ajuste por conteo físico</b>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <label style={field}>Producto<select style={control} value={productoSeleccionado?.id || ""} onChange={event => setProductoId(event.target.value)}>{activos.map(producto => <option key={producto.id} value={producto.id}>{producto.nombre}</option>)}</select></label>
              <label style={field}>Saldo real contado (kg)<input style={control} type="number" min="0" step="0.01" value={saldoReal} onChange={event => setSaldoReal(event.target.value)} placeholder={productoSeleccionado ? existencia(productoSeleccionado).toFixed(2) : "0"} /></label>
              <label style={field}>Fecha del conteo<input style={control} type="date" max={hoyISO()} value={fechaConteo} onChange={event => setFechaConteo(event.target.value)} /></label>
              <label style={field}>Motivo<input style={control} value={motivo} onChange={event => setMotivo(event.target.value)} /></label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8, fontSize: 12 }}><span>Saldo calculado: <b>{productoSeleccionado ? `${calcularSaldoAlimentoComprado(productoSeleccionado.id, fechaConteo, movimientosComprados, registros).toFixed(2)} kg` : "—"}</b>{saldoReal !== "" && productoSeleccionado && <> · ajuste {Number(saldoReal) - calcularSaldoAlimentoComprado(productoSeleccionado.id, fechaConteo, movimientosComprados, registros) >= 0 ? "+" : ""}{(Number(saldoReal) - calcularSaldoAlimentoComprado(productoSeleccionado.id, fechaConteo, movimientosComprados, registros)).toFixed(2)} kg</>}</span><button type="button" disabled={guardando} onClick={registrarConteo} style={{ ...btn, background: "var(--v10-control, #f1f1ea)", color: "var(--v10-text, #1c1f1a)", border: "1px solid var(--v10-border, #d7ded5)" }}>{guardando ? "Guardando…" : "Guardar ajuste físico"}</button></div>
          </div>
        </>}
      </>}
      {mensaje && <div role="status" style={{ padding: "7px 0", fontSize: 12.5, color: "var(--v10-muted, #667064)" }}>{mensaje}</div>}
      <div style={{ marginTop: 14 }}><b>Historial completo del kardex</b><div style={{ fontSize: 11.5, color: "var(--v10-muted, #667064)", margin: "3px 0 7px" }}>Incluye compras, consumo automático por lote y ajustes físicos; todo se expresa en kg.</div>
        {!movimientosKardex.length && <div style={{ fontSize: 12.5, color: "var(--v10-muted, #667064)" }}>Todavía no hay movimientos.</div>}
        {movimientosKardex.map(movimiento => {
          const nombre = movimiento.productoCompradoNombre || productos.find(p => String(p.id) === String(movimiento.productoCompradoId))?.nombre || "Alimento archivado";
          const lote = lotes.find(item => String(item.id) === String(movimiento.loteId));
          const consumo = movimiento.tipoKardex === "consumo_comprado";
          return <div key={movimiento.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid var(--v10-border, #d7ded5)", fontSize: 12.5 }}>
          <span><b>{movimiento.fecha}</b> · {nombre} · {consumo ? `Consumo · Gallinero ${lote?.galpon ?? movimiento.loteId ?? "—"}` : movimiento.tipo === "compra_comprado" ? `Compra ${movimiento.cantidadUnidades ?? ""} ${movimiento.unidadCompra || "unid."} × ${Number(movimiento.kgPorUnidad || 1)} kg` : "Ajuste físico"}{movimiento.proveedor ? ` · ${movimiento.proveedor}` : ""}{movimiento.loteProveedor ? ` · Lote ${movimiento.loteProveedor}` : ""}{movimiento.vencimiento ? ` · Vence ${dmy(movimiento.vencimiento)}` : ""}{movimiento.detalle ? ` · ${movimiento.detalle}` : ""}</span>
          <b style={{ color: movimiento.kg < 0 ? "var(--v10-danger, #c4442a)" : "var(--v10-green, #14432a)" }}>{movimiento.tipo === "compra_comprado" || movimiento.kg > 0 ? "+" : ""}{Number(movimiento.kg || 0).toFixed(2)} kg{movimiento.tipo === "ajuste_comprado" && movimiento.saldoRealKg != null ? ` · saldo físico ${Number(movimiento.saldoRealKg).toFixed(2)} kg` : ""}</b>
        </div>; })}
      </div>
      <div style={{ marginTop: 11, padding: 9, background: "var(--v10-control, #f1f1ea)", borderRadius: 8, fontSize: 11.5 }}>Los lotes de proveedor y vencimientos quedan en el historial para rastrear cada recepción. Cerrar este apartado lo archiva; no borra compras ni consumos.</div>
    </section>
  );
}
