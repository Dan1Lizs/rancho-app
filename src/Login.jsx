import { useState } from "react";
import { supabase } from "./supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setError(""); setCargando(true);
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setError("⚙️ La app no tiene configuradas las llaves de la base de datos. En Vercel: Settings → Environment Variables (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY) y luego Redeploy.");
      setCargando(false); return;
    }
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (err) {
        const m = (err.message || "").toLowerCase();
        if (m.includes("email not confirmed")) setError("📧 El usuario existe pero no está confirmado. En Supabase: Authentication → Users → clic en el usuario → menú ⋮ → 'Confirm email'. Luego intenta de nuevo.");
        else if (m.includes("invalid login credentials")) setError("Correo o contraseña incorrectos. Verifica mayúsculas/minúsculas y espacios — o confirma en Supabase (Authentication → Users) que este correo exista tal cual.");
        else if (m.includes("failed to fetch") || m.includes("network")) setError("🌐 No se pudo contactar la base de datos. Revisa tu internet, y en Vercel que VITE_SUPABASE_URL sea exactamente el Project URL de Supabase (y haz Redeploy tras cualquier cambio).");
        else setError(`Error: ${err.message}`);
      }
    } catch {
      setError("🌐 Error de conexión con la base de datos — revisa las variables en Vercel y haz Redeploy.");
    }
    setCargando(false);
  };

  const input = {
    width: "100%", boxSizing: "border-box", padding: "13px 14px", fontSize: 16,
    border: "1.5px solid #E4E4DC", borderRadius: 12, fontFamily: "'Inter', sans-serif",
    background: "#fff", marginBottom: 12,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F6F6F1", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');`}</style>
      <form onSubmit={entrar} style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 20, padding: "32px 26px", boxShadow: "0 6px 30px rgba(20,67,42,0.10)" }}>
        <div style={{ textAlign: "center", marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: "#14432A" }}>Rancho El Soñado</div>
        <div style={{ textAlign: "center", fontSize: 13, color: "#6B7266", marginBottom: 22 }}>Granja Avícola y Ganadería Rancho El Soñado LTDA.</div>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Correo electrónico</label>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} placeholder="tucorreo@ejemplo.com" required />
        <label style={{ fontSize: 13, fontWeight: 600 }}>Contraseña</label>
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} required />
        {error && <div style={{ fontSize: 13, color: "#C4442A", marginBottom: 10, lineHeight: 1.5, background: "#FBEAE6", borderRadius: 10, padding: "9px 12px" }}>{error}</div>}
        <button type="submit" disabled={cargando} style={{ width: "100%", padding: 14, fontSize: 16, fontWeight: 600, background: "#14432A", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
          {cargando ? "Entrando…" : "Entrar a la granja"}
        </button>
        <div style={{ fontSize: 11.5, color: "#6B7266", textAlign: "center", marginTop: 14 }}>
          Acceso solo para el equipo autorizado.
        </div>
      </form>
    </div>
  );
}
