-- ═══════════════════════════════════════════════════════════════════════
-- Rancho El Soñado — Base de datos v6 (rediseño completo)
-- Pega TODO este archivo en: Supabase → SQL Editor → Run
-- NO borra tu tabla vieja "kv" — se necesita para migrar los datos actuales.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1) Una tabla por cada tipo de dato de la granja ──
-- Antes: TODO vivía en una sola tabla "kv" como un bloque JSON gigante,
-- así que guardar UN registro reescribía TODO el historial completo, y si
-- dos personas guardaban casi al mismo tiempo, una le borraba el trabajo
-- a la otra. Ahora cada registro (un día de producción, un pesaje, una
-- factura...) es su propia fila con su propio identificador. Guardar un
-- dato ya NO toca los demás — así dos personas pueden trabajar a la vez
-- sin pisarse.
create table if not exists public.lotes           (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.registros        (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.pesajes          (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.medicaciones     (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.fumigaciones     (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.bodega_movs      (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.planta_movs      (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.facturas         (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.bitacora         (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.vacunas          (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.enfermedades     (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.necropsias       (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.plan_vacunas     (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.mp_pedidos       (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.insumos          (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.insumos_movs     (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.kardex           (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.mp_catalogo      (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
-- Cuentas por pagar: separadas en 3 tablas porque son datos de dinero — mientras
-- alguien registra un pago, otra persona puede registrar una factura nueva sin chocar.
create table if not exists public.cxp_facturas     (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.cxp_pagos        (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);
create table if not exists public.cxp_notas        (id text primary key, data jsonb not null, updated_at timestamptz not null default now(), updated_by text);

-- ── 2) Tabla de configuración ──
-- Para los pocos datos que SÍ son "un solo bloque" de verdad (ajustes generales,
-- catálogo de fórmulas, lista de administradores, respaldos temporales) — estos
-- casi nunca los edita más de una persona a la vez, así que no hace falta partirlos.
create table if not exists public.config (
  key text primary key,
  data jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- ── 3) Auditoría: quién cambió qué y cuándo ──
-- Cada vez que se crea, edita o borra CUALQUIER registro en cualquiera de las
-- tablas de arriba, queda anotado aquí para siempre. Si algo se ve raro, se
-- puede revisar exactamente qué pasó y quién lo hizo — nadie puede "perder"
-- un dato sin dejar rastro.
create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id text,
  accion text not null,
  datos_antes jsonb,
  datos_despues jsonb,
  por text,
  cuando timestamptz not null default now()
);
create index if not exists auditoria_cuando_idx on public.auditoria (cuando desc);
create index if not exists auditoria_tabla_idx on public.auditoria (tabla);

create or replace function public.f_auditoria() returns trigger as $$
declare
  usuario text := coalesce(auth.jwt() ->> 'email', 'sistema');
begin
  if (tg_op = 'DELETE') then
    insert into public.auditoria(tabla, registro_id, accion, datos_antes, por)
    values (tg_table_name, old.id, 'DELETE', old.data, usuario);
    return old;
  elsif (tg_op = 'UPDATE') then
    new.updated_at := now();
    new.updated_by := usuario;
    insert into public.auditoria(tabla, registro_id, accion, datos_antes, datos_despues, por)
    values (tg_table_name, new.id, 'UPDATE', old.data, new.data, usuario);
    return new;
  elsif (tg_op = 'INSERT') then
    new.updated_at := now();
    new.updated_by := usuario;
    insert into public.auditoria(tabla, registro_id, accion, datos_despues, por)
    values (tg_table_name, new.id, 'INSERT', new.data, usuario);
    return new;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

-- ── 4) Aplicar seguridad (RLS) y auditoría a todas las tablas de datos ──
do $$
declare
  t text;
  tablas text[] := array[
    'lotes','registros','pesajes','medicaciones','fumigaciones','bodega_movs',
    'planta_movs','facturas','bitacora','vacunas','enfermedades','necropsias',
    'plan_vacunas','mp_pedidos','insumos','insumos_movs','kardex','mp_catalogo',
    'cxp_facturas','cxp_pagos','cxp_notas'
  ];
begin
  foreach t in array tablas loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "equipo_select" on public.%I;', t);
    execute format('create policy "equipo_select" on public.%I for select to authenticated using (true);', t);

    execute format('drop policy if exists "equipo_insert" on public.%I;', t);
    execute format('create policy "equipo_insert" on public.%I for insert to authenticated with check (true);', t);

    execute format('drop policy if exists "equipo_update" on public.%I;', t);
    execute format('create policy "equipo_update" on public.%I for update to authenticated using (true);', t);

    execute format('drop policy if exists "equipo_delete" on public.%I;', t);
    execute format('create policy "equipo_delete" on public.%I for delete to authenticated using (true);', t);

    execute format('drop trigger if exists trg_auditoria on public.%I;', t);
    execute format('create trigger trg_auditoria before insert or update or delete on public.%I for each row execute function public.f_auditoria();', t);
  end loop;
end $$;

-- Config: mismas reglas, sin auditoría de fila-por-fila (son ajustes generales)
alter table public.config enable row level security;
drop policy if exists "equipo_select" on public.config;
create policy "equipo_select" on public.config for select to authenticated using (true);
drop policy if exists "equipo_insert" on public.config;
create policy "equipo_insert" on public.config for insert to authenticated with check (true);
drop policy if exists "equipo_update" on public.config;
create policy "equipo_update" on public.config for update to authenticated using (true);
drop policy if exists "equipo_delete" on public.config;
create policy "equipo_delete" on public.config for delete to authenticated using (true);

-- Auditoría: todo el equipo puede CONSULTAR el historial, pero nadie la edita
-- directamente a mano (solo se llena sola, mediante los triggers de arriba).
alter table public.auditoria enable row level security;
drop policy if exists "equipo_lee_auditoria" on public.auditoria;
create policy "equipo_lee_auditoria" on public.auditoria for select to authenticated using (true);

-- ── 5) Actualización en vivo ──
-- Así, si Roxana guarda un pesaje, la pantalla del encargado se refresca
-- sola unos segundos después, sin que nadie tenga que tocar el botón ⟳.
do $$
declare
  t text;
  tablas text[] := array[
    'lotes','registros','pesajes','medicaciones','fumigaciones','bodega_movs',
    'planta_movs','facturas','bitacora','vacunas','enfermedades','necropsias',
    'plan_vacunas','mp_pedidos','insumos','insumos_movs','kardex','mp_catalogo',
    'cxp_facturas','cxp_pagos','cxp_notas','config'
  ];
begin
  foreach t in array tablas loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then
      null; -- ya estaba agregada, no pasa nada
    end;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- Listo. La tabla vieja "kv" sigue ahí intacta — la usa el migrador de
-- datos una sola vez y después ya no hace falta (se puede borrar mucho
-- más adelante, sin prisa, el día que quieras).
-- ═══════════════════════════════════════════════════════════════════════
