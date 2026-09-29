import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { supabase } from "./supabase";
import Login from "./Login.jsx";
import App from "./App.jsx";

// ── Capturador de errores: si la app se rompe, lo MUESTRA en pantalla en vez de quedar en blanco ──
class Capturador extends React.Component {
  constructor(p) { super(p); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#F6F6F1", padding: 24, fontFamily: "sans-serif" }}>
          <div style={{ maxWidth: 640, margin: "40px auto", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 6px 30px rgba(0,0,0,0.08)" }}>
            <h2 style={{ color: "#C4442A", marginTop: 0 }}>⚠️ La app encontró un error al arrancar</h2>
            <p style={{ fontSize: 14, color: "#333" }}>Toma una captura de este mensaje y compártela con el equipo de soporte.</p>
            <pre style={{ background: "#FBEAE6", padding: 14, borderRadius: 10, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
{String(this.state.error?.message || this.state.error)}
{"\n\n"}{String(this.state.error?.stack || "").slice(0, 800)}
            </pre>
            <button onClick={() => location.reload()} style={{ padding: "10px 16px", background: "#14432A", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14 }}>Reintentar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Raiz() {
  const [sesion, setSesion] = useState(undefined);
  const [recuperando, setRecuperando] = useState(false);
  const [nuevaClave, setNuevaClave] = useState("");
  const [errorClave, setErrorClave] = useState("");

  const fijarSesion = (s) => { window.__usuarioEmail = s?.user?.email || null; window.__usuarioNombre = s?.user?.user_metadata?.full_name || s?.user?.user_metadata?.name || ""; setSesion(s ?? null); };
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => fijarSesion(data.session)).catch(() => fijarSesion(null));
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => { fijarSesion(s); if (evento === "PASSWORD_RECOVERY") setRecuperando(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (sesion === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F6F6F1", fontFamily: "sans-serif", color: "#14432A" }}>Verificando acceso…</div>;
  }
  if (!sesion) return <Login />;
  if (recuperando) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F6F6F1", fontFamily: "sans-serif", padding: 20 }}><form onSubmit={async e => { e.preventDefault(); if (nuevaClave.length < 12) { setErrorClave("Usa al menos 12 caracteres."); return; } const { error } = await supabase.auth.updateUser({ password: nuevaClave }); if (error) setErrorClave("No se pudo cambiar la contraseña. Solicita otro enlace."); else { setRecuperando(false); setNuevaClave(""); } }} style={{ background: "white", borderRadius: 14, padding: 24, width: "min(100%,380px)" }}><h1 style={{ fontSize: 22 }}>Nueva contraseña</h1><label htmlFor="nueva-clave">Contraseña nueva</label><input id="nueva-clave" type="password" autoComplete="new-password" value={nuevaClave} onChange={e => setNuevaClave(e.target.value)} required style={{ display: "block", boxSizing: "border-box", width: "100%", padding: 12, margin: "10px 0" }} />{errorClave && <p role="alert">{errorClave}</p>}<button type="submit" style={{ padding: 12 }}>Guardar contraseña</button></form></div>;

  return (
    <>
      <Capturador><App /></Capturador>
      <button
        onClick={() => supabase.auth.signOut()}
        title={sesion.user?.email}
        style={{ position: "fixed", bottom: 12, right: 12, zIndex: 60, padding: "8px 13px", fontSize: 12, fontWeight: 600, background: "rgba(20,67,42,0.9)", color: "#fff", border: "none", borderRadius: 20, cursor: "pointer", fontFamily: "sans-serif" }}>
        Salir
      </button>
    </>
  );
}

// Red de seguridad extra: errores fuera de React también se muestran
window.addEventListener("error", (e) => {
  const root = document.getElementById("root");
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `<div style="padding:30px;font-family:sans-serif"><h3 style="color:#C4442A">⚠️ Error al cargar la app</h3><p>Recarga la página. Si el problema continúa, toma una captura y contacta al equipo de soporte.</p></div>`;
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(<Raiz />);
