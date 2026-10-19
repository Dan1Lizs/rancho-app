import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export default function TendenciaPostura({ tendencia, metaGenetica, colores }) {
  return <div style={{ width: "100%", height: 200 }}>
    <ResponsiveContainer>
      <LineChart data={tendencia} margin={{ top: 5, right: 8, bottom: 0, left: -22 }}>
        <XAxis dataKey="dia" tick={{ fontSize: 10.5, fill: colores.textoSuave }} tickLine={false} axisLine={{ stroke: colores.borde }} interval={2} />
        <YAxis domain={[50, 100]} tick={{ fontSize: 10.5, fill: colores.textoSuave }} tickLine={false} axisLine={false} />
        <Tooltip formatter={(valor) => [`${valor}%`, "Postura"]} contentStyle={{ borderRadius: 10, border: `1px solid ${colores.borde}`, fontSize: 13 }} />
        {metaGenetica != null && <ReferenceLine y={metaGenetica} stroke={colores.verde} strokeDasharray="5 4" strokeWidth={1.5} />}
        <Line type="monotone" dataKey="postura" stroke={colores.yema} strokeWidth={2.5} dot={{ r: 2.5, fill: colores.yema }} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
