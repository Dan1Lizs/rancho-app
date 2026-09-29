import React, { useMemo, useState } from "react";
import { estadosCapturaDelDia } from "./estadoCaptura";

const C = { superficie: "#FFFFFF", borde: "#E4E4DC", verde: "#14432A", verdeSuave: "#E7EFE8", yema: "#E8940A", yemaSuave: "#FDF3E0", texto: "#1C1F1A", textoSuave: "#6B7266" };
const badge = (estado) => estado === "guardado"
  ? { fondo: C.verdeSuave, color: C.verde, texto: "✓ Listo" }
  : estado === "borrador"
    ? { fondo: C.yemaSuave, color: "#9A6605", texto: "En borrador" }
    : { fondo: "#F1F1EA", color: C.textoSuave, texto: "Pendiente" };

export function MatrizQueFaltaHoy({ activos, registros, capturas, fechaCaptura, galponActivo, setGalponActivo }) {
  const [expandida, setExpandida] = useState(false);
  const fecha = fechaCaptura.split("-").reverse().join("/");
  const estados = useMemo(() => estadosCapturaDelDia({ lotes: activos, registros, capturas, fecha }), [activos, registros, capturas, fecha]);
  const completos = estados.filter((estado) => estado.completo).length;
  const todoListo = activos.length > 0 && completos === activos.length;

  return (
    <section aria-label={`Estado de captura del ${fecha}`} style={{ background: C.superficie, border: `1.5px solid ${todoListo ? C.verde : C.yema}`, borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <b style={{ fontSize: 14, color: C.texto }}>¿Qué falta registrar hoy? · {fecha}</b>
          <div style={{ fontSize: 12, color: C.textoSuave }}>{todoListo ? "Todos los gallineros tienen su control completo guardado" : `${completos} de ${activos.length} gallineros completos`}</div>
        </div>
        <button type="button" aria-expanded={expandida} onClick={() => setExpandida((valor) => !valor)} style={{ padding: "5px 11px", fontSize: 12, fontWeight: 600, background: "#F1F1EA", color: C.texto, border: "none", borderRadius: 8, cursor: "pointer" }}>{expandida ? "Vista compacta" : "Ver matriz detallada"}</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {estados.map((estado) => {
          const fondo = estado.completo ? C.verdeSuave : estado.parcial ? C.yemaSuave : "#F1F1EA";
          const color = estado.completo ? C.verde : estado.parcial ? "#9A6605" : C.textoSuave;
          return <button key={estado.lote.id} type="button" onClick={() => setGalponActivo(estado.lote.id)} aria-pressed={galponActivo === estado.lote.id} style={{ flex: "1 1 80px", padding: "8px 6px", borderRadius: 10, border: galponActivo === estado.lote.id ? `2px solid ${C.verde}` : `1px solid ${C.borde}`, background: fondo, cursor: "pointer", textAlign: "center" }}><b style={{ fontSize: 13, color }}>G{estado.lote.galpon}</b><div style={{ fontSize: 10.5, fontWeight: 600, color }}>{estado.completo ? "Completo ✓" : estado.parcial ? "En proceso" : "Pendiente"}</div></button>;
        })}
      </div>
      {expandida && <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.borde}`, overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr style={{ color: C.textoSuave, textAlign: "left", fontSize: 11 }}><th>Gallinero</th><th>Producción</th><th>Alimento</th><th>Mortalidad</th><th>Agua / chequeo</th></tr></thead><tbody>{estados.map((estado) => <tr key={estado.lote.id} onClick={() => setGalponActivo(estado.lote.id)} style={{ borderTop: `1px solid ${C.borde}`, cursor: "pointer", background: galponActivo === estado.lote.id ? C.verdeSuave : "transparent" }}><td style={{ padding: "7px 6px", fontWeight: 700 }}>Gallinero {estado.lote.galpon}</td>{[estado.prod, estado.alim, estado.mort, estado.agua].map((valor, indice) => { const estilo = badge(valor); return <td key={indice} style={{ padding: "7px 6px" }}><span style={{ fontSize: 11, padding: "3px 7px", borderRadius: 12, background: estilo.fondo, color: estilo.color, fontWeight: 600, whiteSpace: "nowrap" }}>{estilo.texto}</span></td>; })}</tr>)}</tbody></table></div>}
    </section>
  );
}
