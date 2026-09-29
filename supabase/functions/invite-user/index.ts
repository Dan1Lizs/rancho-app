import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set(
  (Deno.env.get("APP_ORIGIN") || "https://app.ranchosonado.cr")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean),
);

const responseHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin",
});

serve(async req => {
  const origin = (req.headers.get("origin") || "").replace(/\/$/, "");
  const autorizado = allowedOrigins.has(origin);
  const headers = responseHeaders(autorizado ? origin : "https://app.ranchosonado.cr");
  const reply = (status: number, data: object) => new Response(JSON.stringify(data), { status, headers });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST" || !autorizado) return reply(403, { error: "Origen no autorizado" });
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !anon || !secret) return reply(503, { error: "Invitaciones no configuradas" });
  const bearer = req.headers.get("authorization") || "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: bearer } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser(bearer.replace(/^Bearer\s+/i, ""));
  if (authError || !user) return reply(401, { error: "Inicia sesión de nuevo" });
  const admin = createClient(url, secret);
  const { data: actor } = await admin.from("user_roles").select("role,active").eq("user_id", user.id).maybeSingle();
  if (actor?.role !== "admin" || !actor.active) return reply(403, { error: "Solo un administrador puede invitar" });
  let body: { email?: string; role?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "Solicitud incorrecta" }); }
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["admin", "encargado", "bodega", "planta", "bienestar", "consulta"].includes(role)) return reply(400, { error: "Revisa el correo y el rol" });
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: origin });
  if (error || !data.user) return reply(400, { error: error?.message || "No se pudo enviar la invitación" });
  const { error: roleError } = await admin.from("user_roles").upsert({ user_id: data.user.id, email, role, active: true });
  if (roleError) return reply(500, { error: "Invitación enviada, pero el rol no quedó asignado. Revisa el usuario antes de reintentar." });
  return reply(200, { ok: true });
});
