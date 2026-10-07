import React from "react";
import { filasCambiosBodega, presentacionRutaNeta, valorBodega } from "./bodegaResumen";

const tabla = { width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 7 };
const celda = { padding: "7px 5px", textAlign: "left", borderBottom: "1px solid #E4E4DC", verticalAlign: "top" };

export function CambiosBodega({ anterior, nuevo }) {
  const cambios = filasCambiosBodega(anterior, nuevo);
  if (!cambios.length) return <p style={{ fontSize: 12, color: "#6B7266" }}>No cambiaron los valores del movimiento. Puede haber cambiado un saldo posterior.</p>;
  return <div style={{ overflowX: "auto" }}><table style={tabla}>
    <thead><tr><th style={celda}>Dato modificado</th><th style={celda}>Antes</th><th style={celda}>Después</th></tr></thead>
    <tbody>{cambios.map(f => <tr key={f.nombre}><th scope="row" style={celda}>{f.nombre}</th><td style={celda}>{f.antes}</td><td style={{ ...celda, color: "#14432A", fontWeight: 700 }}>{f.despues}</td></tr>)}</tbody>
  </table></div>;
}

export function ResumenMovimientoBodega({ movimiento }) {
  const impactoRuta = presentacionRutaNeta(movimiento.rutaNeta);
  return <div style={{ fontSize: 12, lineHeight: 1.6, padding: "8px 10px", marginTop: 6, background: "#F6F6F1", borderRadius: 8 }}>
    <b>{movimiento.fecha}</b> · Producido: {valorBodega(movimiento.producido, "cart")} · {impactoRuta.etiqueta}{impactoRuta.signo ? ` (${impactoRuta.signo})` : ""}: {impactoRuta.cantidad == null ? "—" : valorBodega(impactoRuta.cantidad, "cart")} · Saldo final: <b>{valorBodega(movimiento.saldoFinal, "cart")}</b>
    {!!movimiento.obs && <div>Observaciones: {movimiento.obs}</div>}
    {(movimiento.repartos || []).map((r, i) => <div key={i}>{r.nombre || "Repartidor"}: salida {valorBodega(r.salida, "cart")}, devolución buena {valorBodega(r.devBueno, "cart")}, devolución mala {valorBodega(r.devMalo, "cart")}</div>)}
  </div>;
}
