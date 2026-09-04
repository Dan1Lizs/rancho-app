-- ═══════════════════════════════════════════════════════════════
-- Rancho El Soñado — base de datos de la app de gestión
-- Pega TODO este archivo en: Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- Tabla de datos de la granja (clave → valor)
create table if not exists public.kv (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- Seguridad: solo usuarios con sesión iniciada pueden leer/escribir
alter table public.kv enable row level security;

drop policy if exists "equipo lee" on public.kv;
create policy "equipo lee" on public.kv
  for select to authenticated using (true);

drop policy if exists "equipo inserta" on public.kv;
create policy "equipo inserta" on public.kv
  for insert to authenticated with check (true);

drop policy if exists "equipo actualiza" on public.kv;
create policy "equipo actualiza" on public.kv
  for update to authenticated using (true);

-- Nadie sin sesión puede ver nada (RLS lo garantiza).
