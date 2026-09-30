import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

const input = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #d4d9d1", borderRadius: 9, font: "inherit" };

export default function AdministracionView({ nombresUsuarios, onGuardarNombre, onBorrarNombre, avisar, onCerrarSesion }) {
  const [seccion, setSeccion] = useState("usuarios");
  const [usuarios, setUsuarios] = useState([]);
  const [correo, setCorreo] = useState("");
  const [rol, setRol] = useState("encargado");
  const [ocupado, setOcupado] = useState(false);
  const [emailNombre, setEmailNombre] = useState("");
  const [nombreVisible, setNombreVisible] = useState("");
  const [ajustes, setAjustes] = useState({ nombre: "Rancho El Soñado", razonSocial: "", numeracionTiquetes: "manual", cierreBodegaObligatorio: true, retencionHistorialMeses: 60, borradoresPermitidos: true });

  const cargar = async () => {
    const [{ data: roles }, { data: org }] = await Promise.all([
      supabase.from("user_roles").select("user_id,email,role,active").order("email"),
      supabase.from("organization_settings").select("settings").eq("id", "rancho").maybeSingle(),
    ]);
    if (roles) setUsuarios(roles);
    if (org?.settings) setAjustes(v => ({ ...v, ...org.settings }));
  };
  useEffect(() => { cargar(); }, []);
  const actualizarUsuario = async (u, cambio) => {
    setOcupado(true); const { error } = await supabase.from("user_roles").update(cambio).eq("user_id", u.user_id); setOcupado(false);
    if (error) return avisar(`⚠ ${error.message}`);
    setUsuarios(v => v.map(x => x.user_id === u.user_id ? { ...x, ...cambio } : x)); avisar("✓ Acceso actualizado");
  };
  const invitar = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) return avisar("⚠ Escribe un correo válido");
    setOcupado(true); const { error } = await supabase.functions.invoke("invite-user", { body: { email: correo.trim().toLowerCase(), role: rol } }); setOcupado(false);
    if (error) return avisar(`⚠ No se pudo invitar: ${error.message}`);
    setCorreo(""); avisar("✓ Invitación enviada"); cargar();
  };
  const guardarAjustes = async () => {
    setOcupado(true); const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("organization_settings").upsert({ id: "rancho", settings: ajustes, updated_at: new Date().toISOString(), updated_by: auth?.user?.id || null }); setOcupado(false);
    if (!error) window.dispatchEvent(new CustomEvent("rancho:organization-settings", { detail: ajustes }));
    avisar(error ? `⚠ ${error.message}` : "✓ Configuración de la organización guardada");
  };

  return <div><div className="v10-view-heading"><div><h2>Administración</h2><p>Usuarios, permisos y reglas generales del Rancho El Soñado.</p></div></div>
    <div className="v10-admin-subnav"><button className={seccion === "usuarios" ? "active" : ""} onClick={() => setSeccion("usuarios")}>Usuarios y acceso</button><button className={seccion === "organizacion" ? "active" : ""} onClick={() => setSeccion("organizacion")}>Organización</button></div>
    {seccion === "usuarios" && <>
      <section className="v10-settings-card"><h3>Invitar usuario</h3><p>La persona recibirá un enlace seguro y entrará únicamente a los módulos permitidos por su rol.</p><div className="v10-user-form"><input type="email" placeholder="persona@correo.com" value={correo} onChange={e => setCorreo(e.target.value)} /><select value={rol} onChange={e => setRol(e.target.value)}>{["encargado", "bodega", "planta", "bienestar", "consulta", "admin"].map(r => <option key={r}>{r}</option>)}</select><button disabled={ocupado} onClick={invitar}>Enviar invitación</button></div></section>
      <section className="v10-settings-card"><h3>Accesos activos</h3>{usuarios.map(u => <div key={u.user_id} className="v10-user-row"><span>{nombresUsuarios[u.email] || u.email}<small>{u.email}</small></span><select value={u.role} disabled={ocupado} onChange={e => actualizarUsuario(u, { role: e.target.value })}>{["admin", "encargado", "bodega", "planta", "bienestar", "consulta"].map(r => <option key={r}>{r}</option>)}</select><button disabled={ocupado || u.email === window.__usuarioEmail?.toLowerCase()} onClick={() => actualizarUsuario(u, { active: !u.active })}>{u.active ? "Suspender" : "Reactivar"}</button></div>)}</section>
      <section className="v10-settings-card"><h3>Nombres visibles</h3><p>Se mantiene el correo para auditoría, pero la aplicación muestra el nombre asignado.</p>{Object.entries(nombresUsuarios).sort(([a], [b]) => a.localeCompare(b)).map(([email, nombre]) => <div key={email} className="v10-user-row"><span><b>{nombre}</b><small>{email}</small></span><button onClick={() => { setEmailNombre(email); setNombreVisible(nombre); }}>Editar</button><button className="danger" onClick={() => onBorrarNombre(email)}>Quitar</button></div>)}<div className="v10-preference-grid"><label>Correo del usuario<input style={input} type="email" value={emailNombre} onChange={e => setEmailNombre(e.target.value)} placeholder="persona@correo.com" /></label><label>Nombre visible<input style={input} value={nombreVisible} onChange={e => setNombreVisible(e.target.value)} placeholder="Nombre y apellido" /></label></div><button className="v10-primary-action" onClick={async () => { await onGuardarNombre(emailNombre, nombreVisible); setEmailNombre(""); setNombreVisible(""); }}>Guardar nombre visible</button></section>
    </>}
    {seccion === "organizacion" && <section className="v10-settings-card"><h3>Configuración general</h3><div className="v10-preference-grid"><label>Nombre de la operación<input style={input} value={ajustes.nombre} onChange={e => setAjustes(v => ({ ...v, nombre: e.target.value }))} /></label><label>Razón social<input style={input} value={ajustes.razonSocial} onChange={e => setAjustes(v => ({ ...v, razonSocial: e.target.value }))} /></label><label>Numeración de tiquetes<select style={input} value={ajustes.numeracionTiquetes} onChange={e => setAjustes(v => ({ ...v, numeracionTiquetes: e.target.value }))}><option value="manual">Manual</option><option value="consecutiva">Consecutiva</option></select></label><label>Retención del historial<select style={input} value={ajustes.retencionHistorialMeses} onChange={e => setAjustes(v => ({ ...v, retencionHistorialMeses: Number(e.target.value) }))}><option value="24">2 años</option><option value="60">5 años</option><option value="120">10 años</option><option value="0">Sin vencimiento</option></select></label></div><label className="v10-preference-toggle"><input type="checkbox" checked={ajustes.cierreBodegaObligatorio} onChange={e => setAjustes(v => ({ ...v, cierreBodegaObligatorio: e.target.checked }))} />Exigir cierre diario de bodega</label><label className="v10-preference-toggle"><input type="checkbox" checked={ajustes.borradoresPermitidos} onChange={e => setAjustes(v => ({ ...v, borradoresPermitidos: e.target.checked }))} />Permitir borradores operativos</label><button className="v10-primary-action" disabled={ocupado} onClick={guardarAjustes}>{ocupado ? "Guardando…" : "Guardar configuración"}</button></section>}
    <section className="v10-settings-card"><h3>Sesión actual</h3><p>Cuando termines de usar la aplicación, cierra la sesión para proteger los datos del Rancho.</p><button className="v10-primary-action" style={{ background: "#C4442A" }} onClick={onCerrarSesion}>Cerrar sesión</button></section>
  </div>;
}

