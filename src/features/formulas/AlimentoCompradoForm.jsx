import React, { useState } from "react";

const control = { width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid var(--v10-border, #d7ded5)", borderRadius: 9, background: "var(--v10-control, #f1f1ea)", color: "var(--v10-text, #1c1f1a)", font: "inherit" };
const field = { display: "grid", gap: 4, flex: "1 1 180px", fontSize: 12, fontWeight: 600 };

const nuevoFormulario = () => ({ id: "", nombre: "", etapa: "Inicio", unidad: "Saco", kgPorUnidad: "40", proveedor: "" });

export function AlimentoCompradoForm({ productos = [], onGuardar, bloqueado = false }) {
  const [form, setForm] = useState(nuevoFormulario);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const activos = productos.filter(producto => producto.activo !== false);

  const guardar = async () => {
    const nombre = form.nombre.trim();
    const unidad = form.unidad.trim() || "Saco";
    const kgPorUnidad = unidad.toLowerCase() === "kg" ? 1 : Number(String(form.kgPorUnidad).replace(",", "."));
    if (!nombre || !Number.isFinite(kgPorUnidad) || kgPorUnidad <= 0) {
      setMensaje("Escribe el nombre del alimento y una presentación válida en kg por unidad.");
      return;
    }
    const actual = productos.find(producto => String(producto.id) === String(form.id));
    const producto = {
      ...actual,
      id: form.id || (globalThis.crypto?.randomUUID?.() || `comprado-${Date.now()}`),
      nombre,
      etapa: form.etapa.trim() || "General",
      unidad,
      kgPorUnidad,
      proveedor: form.proveedor.trim(),
      activo: actual?.activo !== false,
      actualizadoEl: new Date().toISOString(),
    };
    setGuardando(true);
    setMensaje("");
    try {
      const siguiente = form.id
        ? productos.map(item => String(item.id) === String(form.id) ? producto : item)
        : [...productos, producto];
      await onGuardar(siguiente);
      setForm(nuevoFormulario());
      setMensaje(form.id ? "Producto actualizado; el historial conserva sus presentaciones originales." : "Alimento agregado al catálogo.");
    } catch (error) {
      setMensaje(error?.message || "No se pudo guardar el producto.");
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (producto) => {
    setGuardando(true);
    setMensaje("");
    try {
      await onGuardar(productos.map(item => String(item.id) === String(producto.id)
        ? { ...item, activo: item.activo === false, actualizadoEl: new Date().toISOString() }
        : item));
    } catch (error) {
      setMensaje(error?.message || "No se pudo actualizar el producto.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section style={{ background: "var(--v10-surface, #fff)", border: "1px solid var(--v10-border, #d7ded5)", borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 4px", color: "var(--v10-green, #14432a)" }}>Alimentos comprados para lotes</h3>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--v10-muted, #667064)" }}>Define aquí el alimento comercial y su presentación. Las compras y existencias se registran aparte en Planta; nunca se mezclan con los baches propios.</p>
      {!bloqueado && <>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          <label style={field}>Nombre del producto<input style={control} value={form.nombre} placeholder="ej. Pollita inicio 1" onChange={event => setForm(value => ({ ...value, nombre: event.target.value }))} /></label>
          <label style={field}>Etapa / uso<input style={control} value={form.etapa} placeholder="ej. Inicio, crecimiento" onChange={event => setForm(value => ({ ...value, etapa: event.target.value }))} /></label>
          <label style={field}>Presentación (saco, cubeta, kg…) <input style={control} value={form.unidad} onChange={event => setForm(value => ({ ...value, unidad: event.target.value }))} /></label>
          <label style={field}>Kg por presentación<input style={control} type="number" min="0.01" step="0.01" disabled={form.unidad.trim().toLowerCase() === "kg"} value={form.unidad.trim().toLowerCase() === "kg" ? 1 : form.kgPorUnidad} onChange={event => setForm(value => ({ ...value, kgPorUnidad: event.target.value }))} /></label>
          <label style={field}>Proveedor habitual<input style={control} value={form.proveedor} placeholder="opcional" onChange={event => setForm(value => ({ ...value, proveedor: event.target.value }))} /></label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" disabled={guardando} onClick={guardar} style={{ padding: "9px 14px", border: 0, borderRadius: 9, color: "#fff", background: "var(--v10-green, #14432a)", fontWeight: 700, cursor: "pointer" }}>{guardando ? "Guardando…" : form.id ? "Guardar cambios" : "Agregar alimento"}</button>
          {form.id && <button type="button" onClick={() => { setForm(nuevoFormulario()); setMensaje(""); }} style={{ padding: "9px 14px", border: "1px solid var(--v10-border, #d7ded5)", borderRadius: 9, background: "transparent", color: "var(--v10-text, #1c1f1a)" }}>Cancelar</button>}
        </div>
      </>}
      {mensaje && <div role="status" style={{ marginTop: 8, fontSize: 12, color: "var(--v10-muted, #667064)" }}>{mensaje}</div>}
      <div style={{ marginTop: 14 }}>
        {!productos.length && <div style={{ fontSize: 13, color: "var(--v10-muted, #667064)" }}>Todavía no hay alimentos comprados configurados.</div>}
        {productos.map(producto => (
          <div key={producto.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 9, flexWrap: "wrap", padding: "9px 0", borderTop: "1px solid var(--v10-border, #d7ded5)" }}>
            <span style={{ fontSize: 13 }}><b>{producto.nombre}</b> · {producto.etapa || "General"} · {producto.unidad || "Saco"} de {Number(producto.kgPorUnidad || 1)} kg{producto.proveedor ? ` · ${producto.proveedor}` : ""} · {producto.activo === false ? "Archivado" : "Activo"}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {producto.activo !== false && !bloqueado && <button type="button" disabled={guardando} onClick={() => setForm({ id: producto.id, nombre: producto.nombre, etapa: producto.etapa || "", unidad: producto.unidad || "Saco", kgPorUnidad: String(producto.kgPorUnidad || 1), proveedor: producto.proveedor || "" })} style={{ padding: "5px 9px", border: "1px solid var(--v10-border, #d7ded5)", borderRadius: 7, background: "var(--v10-control, #f1f1ea)", color: "var(--v10-text, #1c1f1a)" }}>Editar</button>}
              {!bloqueado && <button type="button" disabled={guardando} onClick={() => cambiarEstado(producto)} style={{ padding: "5px 9px", border: "1px solid var(--v10-border, #d7ded5)", borderRadius: 7, background: producto.activo === false ? "var(--v10-green-soft, #e7efe8)" : "transparent", color: producto.activo === false ? "var(--v10-green, #14432a)" : "var(--v10-danger, #c4442a)" }}>{producto.activo === false ? "Reactivar" : "Archivar"}</button>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
