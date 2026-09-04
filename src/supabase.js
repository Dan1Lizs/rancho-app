import { createClient } from "@supabase/supabase-js";

// Saneamos la URL: si viene con /rest/v1, /auth/v1, barras o espacios de más, se limpia sola
const cruda = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const url = cruda.replace(/\/(rest|auth|storage|realtime)\/v1\/?.*$/i, "").replace(/\/+$/, "");
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const supabase = createClient(url, anonKey);
