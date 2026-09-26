const isoADmy = iso => iso.split("-").reverse().join("/");

export function planServidoGanado(grupos, fechaISO, movimientos) {
  const fecha = isoADmy(fechaISO);
  const servidos = movimientos.filter(m => m.categoria === "Ganado" && m.tipo === "servido" && m.fecha === fecha);
  const gruposConfigurados = grupos.map((g, indice) => ({
    key: String(indice), nombre: g.nombre, formula: g.formula,
    animales: Number(g.animales), kgAnimal: Number(g.kgAnimal),
    kg: +(Number(g.animales) * Number(g.kgAnimal)).toFixed(2),
  }));
  const validos = gruposConfigurados.filter(g => Number.isFinite(g.animales) && g.animales > 0 && Number.isFinite(g.kgAnimal) && g.kgAnimal > 0 && g.kg > 0 && g.formula);
  const filas = validos.map(g => ({ ...g, registrado: servidos.some(m => String(m.grupoKey ?? "") === g.key || (!m.grupoKey && m.detalle === g.nombre)) }));
  const sinGrupo = servidos.filter(m => m.grupoKey == null && !gruposConfigurados.some(g => g.nombre === m.detalle));
  return { filas, pendientes: filas.filter(g => !g.registrado), sinGrupo, fecha };
}
