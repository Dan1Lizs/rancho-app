import React, { useEffect, useRef } from "react";

const C = {
  superficie: "var(--v10-surface, #FFFFFF)", fondo: "var(--v10-bg-soft, #F6F6F1)",
  borde: "var(--v10-border, #E4E4DC)", verde: "var(--v10-green, #14432A)",
  alerta: "var(--v10-danger, #C4442A)", alertaSuave: "var(--v10-danger-soft, #FBEAE6)",
  textoSuave: "var(--v10-muted, #6B7266)",
};

export function ModalDialog({ abierto, titulo, subtitulo, onClose, children, ancho = 560, pie = null, tono = "normal" }) {
  const dialogoRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const inicioEnFondoRef = useRef(false);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!abierto) return undefined;
    const focoPrevio = document.activeElement;
    dialogoRef.current?.focus();
    const alTeclear = (evento) => {
      if (evento.key === "Escape") {
        evento.stopPropagation();
        onCloseRef.current?.();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => {
      window.removeEventListener("keydown", alTeclear);
      focoPrevio?.focus?.();
    };
  }, [abierto]);

  if (!abierto) return null;

  return (
    <div
      className="v10-modal-backdrop"
      role="presentation"
      onPointerDown={(evento) => {
        inicioEnFondoRef.current = evento.button === 0 && evento.target === evento.currentTarget;
      }}
      onPointerCancel={() => { inicioEnFondoRef.current = false; }}
      onClick={(evento) => {
        const inicioEnFondo = inicioEnFondoRef.current;
        inicioEnFondoRef.current = false;
        if (inicioEnFondo && evento.target === evento.currentTarget) onClose?.();
      }}
      style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(20, 30, 24, 0.65)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 16, overflowY: "auto" }}>
      <div ref={dialogoRef} tabIndex={-1} className="v10-modal-box" role="dialog" aria-modal="true" aria-label={titulo || "Diálogo"} onClick={(evento) => evento.stopPropagation()} style={{ background: C.superficie, borderRadius: 18, border: `1px solid ${tono === "alerta" ? C.alerta : C.borde}`, boxShadow: "0 14px 38px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.12)", width: "100%", maxWidth: ancho, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 20px 14px", borderBottom: `1px solid ${C.borde}`, background: tono === "alerta" ? C.alertaSuave : C.superficie }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontFamily: "'Space Grotesk', sans-serif", color: tono === "alerta" ? C.alerta : C.verde, fontWeight: 700 }}>{titulo}</h3>
            {subtitulo && <div style={{ fontSize: 12.5, color: C.textoSuave, marginTop: 4, lineHeight: 1.4 }}>{subtitulo}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar ventana" style={{ background: "transparent", border: "none", color: C.textoSuave, fontSize: 20, lineHeight: 1, padding: "4px 8px", cursor: "pointer", borderRadius: 8 }}>×</button>
        </div>
        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1, fontSize: 13.5, lineHeight: 1.5 }}>{children}</div>
        {pie && <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.borde}`, background: C.fondo, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>{pie}</div>}
      </div>
    </div>
  );
}
