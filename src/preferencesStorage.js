import { supabase } from "./supabase";
import { DEFAULT_PREFERENCES, normalizarPreferencias } from "./preferences";

const LOCAL_KEY = "rancho:preferencias";

const usuarioActual = async () => {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
};

export async function leerPreferencias() {
  let local = DEFAULT_PREFERENCES;
  try { local = normalizarPreferencias(JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}")); } catch { /* usa valores seguros */ }
  const user = await usuarioActual();
  if (!user) return local;
  const { data, error } = await supabase.from("user_preferences").select("preferences").eq("user_id", user.id).maybeSingle();
  if (error) return local;
  const preferencias = normalizarPreferencias(data?.preferences || local);
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(preferencias)); } catch { /* respaldo opcional */ }
  return preferencias;
}

export async function guardarPreferencias(preferencias) {
  const normalizadas = normalizarPreferencias(preferencias);
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(normalizadas)); } catch { /* continúa con nube */ }
  const user = await usuarioActual();
  if (!user) return { preferencias: normalizadas, nube: false };
  const { error } = await supabase.from("user_preferences").upsert({
    user_id: user.id,
    preferences: normalizadas,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { preferencias: normalizadas, nube: true };
}

const claveLocal = clave => `borrador-control:${window.__usuarioEmail || "local"}:${clave}`;

export async function leerBorrador(clave, almacenamiento = "local") {
  if (almacenamiento === "nube") {
    const user = await usuarioActual();
    if (user) {
      const { data, error } = await supabase.from("user_drafts").select("payload").eq("user_id", user.id).eq("draft_key", clave).maybeSingle();
      if (!error && data?.payload) return data.payload;
    }
  }
  try { return JSON.parse(localStorage.getItem(claveLocal(clave)) || "null"); } catch { return null; }
}

export async function guardarBorrador(clave, payload, almacenamiento = "local") {
  try { localStorage.setItem(claveLocal(clave), JSON.stringify(payload)); } catch { /* la nube aún puede funcionar */ }
  if (almacenamiento !== "nube") return;
  const user = await usuarioActual();
  if (!user) return;
  const { error } = await supabase.from("user_drafts").upsert({ user_id: user.id, draft_key: clave, payload, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function eliminarBorrador(clave, almacenamiento = "local") {
  try { localStorage.removeItem(claveLocal(clave)); } catch { /* continúa */ }
  if (almacenamiento !== "nube") return;
  const user = await usuarioActual();
  if (!user) return;
  const { error } = await supabase.from("user_drafts").delete().eq("user_id", user.id).eq("draft_key", clave);
  if (error) throw error;
}


