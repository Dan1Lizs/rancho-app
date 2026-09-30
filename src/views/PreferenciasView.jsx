import React, { useEffect, useState } from "react";
import { completarOrdenNavegacion, normalizarPreferencias, ordenarPorPreferencia } from "../preferences";

const seccion = { background: "var(--v10-surface, #fff)", border: "1px solid var(--v10-border, #e4e4dc)", borderRadius: 14, padding: 16, marginBottom: 12 };
const select = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid var(--v10-border, #d8d8cf)", borderRadius: 9, background: "var(--v10-surface, #fff)", color: "inherit", font: "inherit" };

function Interruptor({ checked, onChange, children }) {
  return <label className="v10-preference-toggle"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span>{children}</span></label>;
}

export default function PreferenciasView({ preferencias, tabs, onGuardar, guardando }) {
  const modulosOrdenables = tabs.filter(t => !["administracion", "preferencias"].includes(t.id));
  const [form, setForm] = useState(() => normalizarPreferencias({ ...preferencias, ordenNavegacion: completarOrdenNavegacion(modulosOrdenables, preferencias.ordenNavegacion) }));
  useEffect(() => setForm(normalizarPreferencias({ ...preferencias, ordenNavegacion: completarOrdenNavegacion(modulosOrdenables, preferencias.ordenNavegacion) })), [preferencias, tabs]);
  const patch = cambio => setForm(v => normalizarPreferencias({ ...v, ...cambio }));
  const patchGrupo = (grupo, cambio) => patch({ [grupo]: { ...form[grupo], ...cambio } });
  const ordenadas = ordenarPorPreferencia(modulosOrdenables, form.ordenNavegacion);
  const mover = (id, delta) => {
    const orden = ordenadas.map(t => t.id);
    const i = orden.indexOf(id); const j = i + delta;
    if (i < 0 || j < 0 || j >= orden.length) return;
    [orden[i], orden[j]] = [orden[j], orden[i]];
    patch({ ordenNavegacion: orden });
  };

  return <div className="v10-preferences-view">
    <div className="v10-view-heading"><div><h2>Preferencias personales</h2><p>Se sincronizan con tu cuenta y no cambian la experiencia de los demás usuarios.</p></div></div>

    <section style={seccion}><h3>Inicio y navegación</h3>
      <label>Pantalla al entrar<select value={form.pantallaInicio} onChange={e => patch({ pantallaInicio: e.target.value })} style={select}>{tabs.filter(t => !["administracion", "preferencias"].includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>
      <p className="v10-help">Elige tus accesos favoritos y el orden en que aparecen en el menú móvil.</p>
      <div className="v10-preference-modules">{ordenadas.map((t, i) => <div key={t.id} className="v10-preference-module"><Interruptor checked={form.favoritos.includes(t.id)} onChange={on => patch({ favoritos: on ? [...form.favoritos, t.id] : form.favoritos.filter(x => x !== t.id) })}>{t.nombre}</Interruptor><span><button type="button" aria-label={`Subir ${t.nombre}`} disabled={!i} onClick={() => mover(t.id, -1)}>↑</button><button type="button" aria-label={`Bajar ${t.nombre}`} disabled={i === ordenadas.length - 1} onClick={() => mover(t.id, 1)}>↓</button></span></div>)}</div>
    </section>

    <section style={seccion}><h3>Visualización</h3><div className="v10-preference-grid">
      <label>Densidad<select value={form.densidad} onChange={e => patch({ densidad: e.target.value })} style={select}><option value="compacta">Compacta</option><option value="comoda">Cómoda</option><option value="campo">Campo · botones grandes</option></select></label>
      <label>Tamaño de texto<select value={form.tamanoTexto} onChange={e => patch({ tamanoTexto: e.target.value })} style={select}><option value="pequeno">Pequeño</option><option value="normal">Normal</option><option value="grande">Grande</option></select></label>
      <label>Tema<select value={form.tema} onChange={e => patch({ tema: e.target.value })} style={select}><option value="claro">Claro</option><option value="oscuro">Oscuro</option><option value="automatico">Según el dispositivo</option><option value="contraste">Alto contraste</option></select></label>
      <label>Decimales<select value={form.formatoNumeros.decimales} onChange={e => patchGrupo("formatoNumeros", { decimales: e.target.value })} style={select}><option value="automaticos">Solo cuando hagan falta, máximo 2</option><option value="siempre2">Mostrar siempre 2</option></select></label>
    </div><Interruptor checked={form.formatoNumeros.separadorMiles} onChange={v => patchGrupo("formatoNumeros", { separadorMiles: v })}>Separar los miles para facilitar la lectura</Interruptor></section>

    <section style={seccion}><h3>Avisos</h3><div className="v10-preference-grid">
      <Interruptor checked={form.notificaciones.faltantesDiarios} onChange={v => patchGrupo("notificaciones", { faltantesDiarios: v })}>Pendientes del control diario</Interruptor>
      <Interruptor checked={form.notificaciones.inventarioBajo} onChange={v => patchGrupo("notificaciones", { inventarioBajo: v })}>Inventario bajo</Interruptor>
      <Interruptor checked={form.notificaciones.bienestar} onChange={v => patchGrupo("notificaciones", { bienestar: v })}>Vacunas, retiros y bienestar</Interruptor>
      <Interruptor checked={form.notificaciones.cuentasPorPagar} onChange={v => patchGrupo("notificaciones", { cuentasPorPagar: v })}>Cuentas por pagar</Interruptor>
    </div></section>

    <section style={seccion}><h3>Seguridad</h3><Interruptor checked={form.confirmaciones.correcciones} onChange={v => patchGrupo("confirmaciones", { correcciones: v })}>Confirmación adicional al corregir información</Interruptor><Interruptor checked={form.confirmaciones.reemplazos} onChange={v => patchGrupo("confirmaciones", { reemplazos: v })}>Confirmación adicional al reemplazar importaciones</Interruptor><p className="v10-help">Las eliminaciones definitivas siempre pedirán confirmación.</p></section>

    <section style={seccion}><h3>Borradores</h3><Interruptor checked={form.borradores.autoguardado} onChange={v => patchGrupo("borradores", { autoguardado: v })}>Guardar automáticamente mientras trabajo</Interruptor><div className="v10-preference-grid"><label>Intervalo<select value={form.borradores.intervaloSegundos} onChange={e => patchGrupo("borradores", { intervaloSegundos: Number(e.target.value) })} style={select}><option value="5">Cada 5 segundos</option><option value="10">Cada 10 segundos</option><option value="30">Cada 30 segundos</option><option value="60">Cada minuto</option></select></label><label>Ubicación<select value={form.borradores.almacenamiento} onChange={e => patchGrupo("borradores", { almacenamiento: e.target.value })} style={select}><option value="local">Este dispositivo</option><option value="nube">Nube y respaldo local</option></select></label></div><Interruptor checked={form.borradores.recuperarAutomaticamente} onChange={v => patchGrupo("borradores", { recuperarAutomaticamente: v })}>Recuperar automáticamente el borrador al volver a la fecha</Interruptor></section>

    <button className="v10-primary-action" disabled={guardando} onClick={() => onGuardar({ ...form, ordenNavegacion: completarOrdenNavegacion(modulosOrdenables, form.ordenNavegacion) })}>{guardando ? "Guardando…" : "Guardar mis preferencias"}</button>
  </div>;
}

