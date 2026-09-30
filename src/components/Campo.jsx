import React from "react";

const C = {
  borde: "var(--v10-border, #E4E4DC)", texto: "var(--v10-text, #1C1F1A)",
  textoSuave: "var(--v10-muted, #6B7266)", verde: "var(--v10-green, #14432A)",
  yema: "var(--v10-amber, #E8940A)", alerta: "var(--v10-danger, #C4442A)",
};
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 16, color: C.texto, border: `1.5px solid ${C.borde}`, borderRadius: 10, background: "var(--v10-input, #fff)", fontFamily: "'Inter', sans-serif", outline: "none" };

export function Campo({ etiqueta, mitad, tercio, unidad, error, advertencia, sugerencia, ...props }) {
  const esNum = props.type === "number" || props.inputMode === "decimal" || props.inputMode === "numeric";
  const extra = esNum ? {
    type: "text",
    inputMode: props.inputMode || "decimal",
    onChange: (evento) => {
      evento.target.value = evento.target.value.replace(/,/g, ".");
      props.onChange?.(evento);
    },
  } : {};
  const mensajeId = `${props.name || etiqueta}-mensaje`;

  return (
    <label style={{ display: "block", marginBottom: 12, flex: tercio ? "1 1 30%" : mitad ? "1 1 45%" : "1 1 100%", minWidth: tercio ? 96 : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.texto }}>{etiqueta}</span>
        {sugerencia && <span style={{ fontSize: 11, color: C.verde, fontWeight: 600 }}>{sugerencia}</span>}
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input {...props} {...extra} aria-invalid={Boolean(error)} aria-describedby={error || advertencia ? mensajeId : undefined} style={{ ...inputStyle, borderColor: error ? C.alerta : advertencia ? C.yema : C.borde, paddingRight: unidad ? (unidad.length > 3 ? 55 : 42) : 12, ...(props.style || {}) }} />
        {unidad && <span style={{ position: "absolute", right: 10, fontSize: 12, fontWeight: 600, color: C.textoSuave, pointerEvents: "none", userSelect: "none" }}>{unidad}</span>}
      </div>
      {error && <div id={mensajeId} role="alert" style={{ fontSize: 11.5, color: C.alerta, marginTop: 4, fontWeight: 600 }}>⚠ {error}</div>}
      {advertencia && !error && <div id={mensajeId} style={{ fontSize: 11.5, color: "#9A6605", marginTop: 4, fontWeight: 500 }}>⚠ {advertencia}</div>}
    </label>
  );
}
