import React, { useMemo, useState } from "react";
import { parsearTiquetesPegados } from "./parsearTiquetes";

const C = { fondo: "var(--v10-bg-soft, #F6F6F1)", borde: "var(--v10-border, #E4E4DC)", verde: "var(--v10-green, #14432A)", alerta: "var(--v10-danger, #C4442A)", alertaSuave: "var(--v10-danger-soft, #FBEAE6)", yemaSuave: "var(--v10-amber-soft, #FDF3E0)", texto: "var(--v10-text, #1C1F1A)", textoSuave: "var(--v10-muted, #6B7266)" };

export function ModalPegarTiquetes({ abierto, onCerrar, onAplicar, galponNum, tiquetesCompartidos }) {
  const [texto, setTexto] = useState("");
  const filas = useMemo(() => parsearTiquetesPegados(texto, tiquetesCompartidos), [texto, tiquetesCompartidos]);
  if (!abierto) return null;
  const validas = filas.filter((fila) => fila.valido);
  const cartones = validas.reduce((total, fila) => total + fila.c, 0);
  const kilos = validas.reduce((total, fila) => total + fila.p, 0);
  const promedio = cartones > 0 && kilos > 0 ? (kilos * 1000) / (cartones * 30) : null;
  const aplicar = (agregar) => onAplicar(validas.map((fila) => ({ num: fila.num, cartones: String(fila.c), peso: String(fila.p) })), agregar);

  return (
    <div className="v10-overlay" role="dialog" aria-modal="true" aria-label="Pegar tiquetes desde Excel">
      <div className="v10-search" style={{ maxWidth: 620, padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><h3 style={{ margin: 0, color: C.verde }}>Pegar tiquetes · Gallinero {galponNum}</h3><button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.textoSuave }}>×</button></div>
        <p style={{ fontSize: 12.5, color: C.textoSuave, margin: "0 0 10px" }}>Copia tres columnas de Excel: número, cartones y peso en kg. Los duplicados no se importarán.</p>
        <textarea autoFocus rows={5} value={texto} onChange={(evento) => setTexto(evento.target.value)} placeholder={"6071\t14\t26,5\n6072\t12\t22,8"} style={{ width: "100%", boxSizing: "border-box", padding: 12, border: `1px solid ${C.borde}`, borderRadius: 10, fontFamily: "monospace", fontSize: 13, resize: "vertical" }} />
        {filas.length > 0 && <><div style={{ display: "flex", gap: 10, flexWrap: "wrap", background: C.fondo, padding: "9px 12px", borderRadius: 10, fontSize: 13, margin: "12px 0 10px" }}><span><b>{validas.length}</b> válidos</span><span><b>{cartones.toFixed(1)}</b> cartones</span><span><b>{kilos.toFixed(1)}</b> kg</span>{promedio && <span><b>{promedio.toFixed(1)}</b> g/huevo</span>}</div><div style={{ maxHeight: 220, overflowY: "auto", border: `1px solid ${C.borde}`, borderRadius: 8 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr style={{ background: "#F1F1EA", textAlign: "left" }}><th>#</th><th>Tiquete</th><th>Cartones</th><th>Peso kg</th><th>Estado</th></tr></thead><tbody>{filas.map((fila) => <tr key={fila.idx} style={{ borderTop: `1px solid ${C.borde}`, background: fila.duplicado ? C.yemaSuave : !fila.valido ? C.alertaSuave : "transparent" }}><td>{fila.idx}</td><td>#{fila.num || "s/n"}</td><td>{fila.cartones || "-"}</td><td>{fila.peso || "-"}</td><td style={{ color: fila.valido ? C.verde : fila.duplicado ? "#9A6605" : C.alerta }}>{fila.duplicado ? "Duplicado" : fila.valido ? "Válido" : "Incompleto"}</td></tr>)}</tbody></table></div></>}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}><button type="button" disabled={!validas.length} onClick={() => aplicar(false)}>Reemplazar ({validas.length})</button><button type="button" disabled={!validas.length} onClick={() => aplicar(true)}>Agregar al final</button><button type="button" onClick={onCerrar}>Cancelar</button></div>
      </div>
    </div>
  );
}
