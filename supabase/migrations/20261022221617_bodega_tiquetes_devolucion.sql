create table if not exists public.bodega_tiquetes_devolucion (
  id uuid primary key,
  numero text not null check (length(btrim(numero)) > 0),
  fecha_recepcion date not null,
  fecha_ruta_origen date not null,
  ruta_mov_id text not null,
  ruta_id text not null,
  repartidor text not null check (length(btrim(repartidor)) > 0),
  cartones_iniciales numeric(12, 2) not null constraint bodega_tiquetes_devolucion_cartones_iniciales_check check (cartones_iniciales >= 0),
  cartones_malos numeric(12, 2) not null default 0 constraint bodega_tiquetes_devolucion_cartones_malos_check check (cartones_malos >= 0),
  saldo_cartones numeric(12, 2) not null check (saldo_cartones >= 0),
  creado_por text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint bodega_tiquetes_devolucion_fechas_check check (fecha_recepcion >= fecha_ruta_origen),
  constraint bodega_tiquetes_devolucion_cantidades_check check (cartones_iniciales + cartones_malos > 0)
);

alter table public.bodega_tiquetes_devolucion
  add column if not exists cartones_malos numeric(12, 2) not null default 0;
alter table public.bodega_tiquetes_devolucion
  drop constraint if exists bodega_tiquetes_devolucion_cartones_iniciales_check;
alter table public.bodega_tiquetes_devolucion
  add constraint bodega_tiquetes_devolucion_cartones_iniciales_check check (cartones_iniciales >= 0);
alter table public.bodega_tiquetes_devolucion
  drop constraint if exists bodega_tiquetes_devolucion_cantidades_check;
alter table public.bodega_tiquetes_devolucion
  add constraint bodega_tiquetes_devolucion_cantidades_check check (cartones_iniciales + cartones_malos > 0);
alter table public.bodega_tiquetes_devolucion
  drop constraint if exists bodega_tiquetes_devolucion_medios_check;
alter table public.bodega_tiquetes_devolucion
  add constraint bodega_tiquetes_devolucion_medios_check
  check (
    cartones_iniciales * 2 = pg_catalog.round(cartones_iniciales * 2)
    and cartones_malos * 2 = pg_catalog.round(cartones_malos * 2)
    and saldo_cartones * 2 = pg_catalog.round(saldo_cartones * 2)
  );

create unique index if not exists bodega_tiquetes_devolucion_numero_unico_idx
  on public.bodega_tiquetes_devolucion (lower(btrim(numero)));

create table if not exists public.bodega_tiquetes_devolucion_movs (
  id uuid primary key default gen_random_uuid(),
  operacion_id uuid not null unique,
  tiquete_id uuid not null references public.bodega_tiquetes_devolucion(id) on delete restrict,
  tipo text not null check (tipo in ('devolucion', 'devolucion_mala', 'uso', 'correccion')),
  numero text not null,
  fecha date not null,
  fecha_recepcion date,
  fecha_ruta date not null,
  ruta_mov_id text not null,
  ruta_id text not null,
  repartidor text not null,
  cartones_delta numeric(12, 2) not null,
  motivo text,
  por text,
  cuando timestamptz not null default now(),
  check (cartones_delta <> 0 or tipo = 'correccion')
);

alter table public.bodega_tiquetes_devolucion_movs
  add column if not exists fecha_recepcion date;
alter table public.bodega_tiquetes_devolucion_movs
  drop constraint if exists bodega_tiquetes_devolucion_movs_tipo_check;
alter table public.bodega_tiquetes_devolucion_movs
  add constraint bodega_tiquetes_devolucion_movs_tipo_check
  check (tipo in ('devolucion', 'devolucion_mala', 'uso', 'correccion'));
alter table public.bodega_tiquetes_devolucion_movs
  drop constraint if exists bodega_tiquetes_devolucion_movs_medios_check;
alter table public.bodega_tiquetes_devolucion_movs
  add constraint bodega_tiquetes_devolucion_movs_medios_check
  check (cartones_delta * 2 = pg_catalog.round(cartones_delta * 2));

drop function if exists public.registrar_devolucion_tiquete(uuid, text, numeric, date, date, text, text, text);
drop function if exists public.corregir_tiquete_devolucion(uuid, uuid, text, numeric, date, text);

create index if not exists bodega_tiquetes_devolucion_movs_fecha_idx
  on public.bodega_tiquetes_devolucion_movs (fecha desc, cuando desc);

create index if not exists bodega_tiquetes_devolucion_movs_tiquete_idx
  on public.bodega_tiquetes_devolucion_movs (tiquete_id, cuando desc);

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bodega_tiquetes_devolucion'
    ) then
      execute 'alter publication supabase_realtime add table public.bodega_tiquetes_devolucion';
    end if;
    if not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bodega_tiquetes_devolucion_movs'
    ) then
      execute 'alter publication supabase_realtime add table public.bodega_tiquetes_devolucion_movs';
    end if;
  end if;
end;
$$;

alter table public.bodega_tiquetes_devolucion enable row level security;
alter table public.bodega_tiquetes_devolucion_movs enable row level security;

revoke all on table public.bodega_tiquetes_devolucion from anon, authenticated;
revoke all on table public.bodega_tiquetes_devolucion_movs from anon, authenticated;
grant select on table public.bodega_tiquetes_devolucion to authenticated;
grant select on table public.bodega_tiquetes_devolucion_movs to authenticated;

drop policy if exists bodega_tiquetes_devolucion_ver on public.bodega_tiquetes_devolucion;
create policy bodega_tiquetes_devolucion_ver
  on public.bodega_tiquetes_devolucion for select to authenticated
  using ((select private.mi_rol()) in ('admin', 'encargado', 'bodega', 'consulta'));

drop policy if exists bodega_tiquetes_devolucion_movs_ver on public.bodega_tiquetes_devolucion_movs;
create policy bodega_tiquetes_devolucion_movs_ver
  on public.bodega_tiquetes_devolucion_movs for select to authenticated
  using ((select private.mi_rol()) in ('admin', 'encargado', 'bodega', 'consulta'));

create or replace function public.registrar_devolucion_tiquete(
  p_operacion_id uuid,
  p_numero text,
  p_cartones numeric,
  p_cartones_malos numeric,
  p_fecha_recepcion date,
  p_fecha_ruta_origen date,
  p_ruta_mov_id text,
  p_ruta_id text,
  p_repartidor text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text := (select private.mi_rol());
  v_numero text := nullif(pg_catalog.btrim(p_numero), '');
  v_repartidor text := nullif(pg_catalog.btrim(p_repartidor), '');
  v_tiquete public.bodega_tiquetes_devolucion%rowtype;
  v_email text;
begin
  if (select auth.uid()) is null or v_rol not in ('admin', 'encargado', 'bodega') then
    raise exception 'No tienes permiso para registrar devoluciones de ruta';
  end if;
  if p_operacion_id is null or v_numero is null or p_cartones is null or p_cartones < 0
    or p_cartones_malos is null or p_cartones_malos < 0 or p_cartones + p_cartones_malos <= 0 then
    raise exception 'Indica el número del tiquete y una cantidad positiva de cartones buenos o malos';
  end if;
  if p_cartones * 2 <> pg_catalog.round(p_cartones * 2)
    or p_cartones_malos * 2 <> pg_catalog.round(p_cartones_malos * 2) then
    raise exception 'Los cartones deben ser unidades enteras o medios cartones (.5)';
  end if;
  if p_fecha_recepcion is null or p_fecha_ruta_origen is null or p_fecha_recepcion < p_fecha_ruta_origen then
    raise exception 'La devolución no puede tener fecha anterior a la ruta de origen';
  end if;
  if nullif(pg_catalog.btrim(p_ruta_mov_id), '') is null or nullif(pg_catalog.btrim(p_ruta_id), '') is null or v_repartidor is null then
    raise exception 'Selecciona la ruta de origen y el repartidor';
  end if;

  select * into v_tiquete from public.bodega_tiquetes_devolucion where id = p_operacion_id;
  if found then
    if lower(pg_catalog.btrim(v_tiquete.numero)) = lower(v_numero)
      and v_tiquete.fecha_recepcion = p_fecha_recepcion
      and v_tiquete.fecha_ruta_origen = p_fecha_ruta_origen
      and v_tiquete.ruta_mov_id = p_ruta_mov_id
      and v_tiquete.ruta_id = p_ruta_id
      and v_tiquete.repartidor = v_repartidor
      and v_tiquete.cartones_iniciales = p_cartones
      and v_tiquete.cartones_malos = p_cartones_malos then
      return pg_catalog.to_jsonb(v_tiquete);
    end if;
    raise exception 'El identificador de operación ya fue utilizado';
  end if;

  select email into v_email from public.user_roles where user_id = (select auth.uid()) and active = true;
  insert into public.bodega_tiquetes_devolucion (
    id, numero, fecha_recepcion, fecha_ruta_origen, ruta_mov_id, ruta_id, repartidor,
    cartones_iniciales, cartones_malos, saldo_cartones, creado_por
  ) values (
    p_operacion_id, v_numero, p_fecha_recepcion, p_fecha_ruta_origen, p_ruta_mov_id,
    p_ruta_id, v_repartidor, p_cartones, p_cartones_malos, p_cartones, v_email
  ) returning * into v_tiquete;

  if p_cartones > 0 then
    insert into public.bodega_tiquetes_devolucion_movs (
      operacion_id, tiquete_id, tipo, numero, fecha, fecha_recepcion, fecha_ruta, ruta_mov_id, ruta_id,
      repartidor, cartones_delta, motivo, por
    ) values (
      p_operacion_id, p_operacion_id, 'devolucion', v_numero, p_fecha_recepcion,
      p_fecha_recepcion, p_fecha_ruta_origen, p_ruta_mov_id, p_ruta_id, v_repartidor, p_cartones,
      'Entrada de huevos buenos recibidos; disponibles para reutilizar', v_email
    );
  end if;
  if p_cartones_malos > 0 then
    insert into public.bodega_tiquetes_devolucion_movs (
      operacion_id, tiquete_id, tipo, numero, fecha, fecha_recepcion, fecha_ruta, ruta_mov_id, ruta_id,
      repartidor, cartones_delta, motivo, por
    ) values (
      case when p_cartones = 0 then p_operacion_id else pg_catalog.gen_random_uuid() end,
      p_operacion_id, 'devolucion_mala', v_numero, p_fecha_ruta_origen, p_fecha_recepcion,
      p_fecha_ruta_origen, p_ruta_mov_id, p_ruta_id, v_repartidor, -p_cartones_malos,
      'Devolución mala imputada a la ruta de origen', v_email
    );
  end if;
  return pg_catalog.to_jsonb(v_tiquete);
exception
  when unique_violation then
    raise exception 'Ese número de tiquete de devolución ya está registrado';
end;
$$;

create or replace function public.usar_tiquete_devolucion(
  p_operacion_id uuid,
  p_numero text,
  p_cartones numeric,
  p_fecha date,
  p_fecha_ruta date,
  p_ruta_mov_id text,
  p_ruta_id text,
  p_repartidor text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text := (select private.mi_rol());
  v_numero text := nullif(pg_catalog.btrim(p_numero), '');
  v_tiquete public.bodega_tiquetes_devolucion%rowtype;
  v_existente public.bodega_tiquetes_devolucion_movs%rowtype;
  v_email text;
begin
  if (select auth.uid()) is null or v_rol not in ('admin', 'encargado', 'bodega') then
    raise exception 'No tienes permiso para usar tiquetes devueltos';
  end if;
  if p_operacion_id is null or v_numero is null or p_cartones is null or p_cartones <= 0 then
    raise exception 'Indica el número del tiquete y una cantidad mayor que cero';
  end if;
  if p_cartones * 2 <> pg_catalog.round(p_cartones * 2) then
    raise exception 'Los cartones deben ser unidades enteras o medios cartones (.5)';
  end if;
  if p_fecha is null or p_fecha_ruta is null or p_fecha < p_fecha_ruta then
    raise exception 'La fecha del movimiento no puede ser anterior a la ruta';
  end if;
  if nullif(pg_catalog.btrim(p_ruta_mov_id), '') is null or nullif(pg_catalog.btrim(p_ruta_id), '') is null or nullif(pg_catalog.btrim(p_repartidor), '') is null then
    raise exception 'Selecciona la ruta que utilizará el tiquete';
  end if;

  select * into v_existente from public.bodega_tiquetes_devolucion_movs where operacion_id = p_operacion_id;
  if found then
    if v_existente.tipo = 'uso'
      and lower(pg_catalog.btrim(v_existente.numero)) = lower(v_numero)
      and v_existente.cartones_delta = -p_cartones
      and v_existente.fecha = p_fecha
      and v_existente.ruta_mov_id = p_ruta_mov_id
      and v_existente.ruta_id = p_ruta_id then
      select * into v_tiquete from public.bodega_tiquetes_devolucion where id = v_existente.tiquete_id;
      return pg_catalog.to_jsonb(v_tiquete);
    end if;
    raise exception 'El identificador de operación ya fue utilizado';
  end if;

  select * into v_tiquete
  from public.bodega_tiquetes_devolucion
  where lower(pg_catalog.btrim(numero)) = lower(v_numero)
  for update;
  if not found then raise exception 'No existe un tiquete de devolución con ese número'; end if;
  if p_fecha < v_tiquete.fecha_recepcion then
    raise exception 'El tiquete todavía no estaba disponible en esa fecha';
  end if;
  if v_tiquete.saldo_cartones < p_cartones then
    raise exception 'Saldo insuficiente: quedan % cartones de ese tiquete', v_tiquete.saldo_cartones;
  end if;

  select email into v_email from public.user_roles where user_id = (select auth.uid()) and active = true;
  update public.bodega_tiquetes_devolucion
  set saldo_cartones = saldo_cartones - p_cartones, actualizado_en = now()
  where id = v_tiquete.id
  returning * into v_tiquete;

  insert into public.bodega_tiquetes_devolucion_movs (
    operacion_id, tiquete_id, tipo, numero, fecha, fecha_recepcion, fecha_ruta, ruta_mov_id, ruta_id,
    repartidor, cartones_delta, por
  ) values (
    p_operacion_id, v_tiquete.id, 'uso', v_tiquete.numero, p_fecha, p_fecha, p_fecha_ruta,
    p_ruta_mov_id, p_ruta_id, pg_catalog.btrim(p_repartidor), -p_cartones, v_email
  );
  return pg_catalog.to_jsonb(v_tiquete);
exception
  when unique_violation then
    select * into v_existente from public.bodega_tiquetes_devolucion_movs where operacion_id = p_operacion_id;
    if found and v_existente.tipo = 'uso'
      and v_existente.cartones_delta = -p_cartones
      and lower(pg_catalog.btrim(v_existente.numero)) = lower(v_numero)
      and v_existente.fecha = p_fecha
      and v_existente.fecha_ruta = p_fecha_ruta
      and v_existente.ruta_mov_id = p_ruta_mov_id
      and v_existente.ruta_id = p_ruta_id
      and v_existente.repartidor = pg_catalog.btrim(p_repartidor) then
      select * into v_tiquete from public.bodega_tiquetes_devolucion where id = v_existente.tiquete_id;
      return pg_catalog.to_jsonb(v_tiquete);
    end if;
    raise exception 'El movimiento ya fue registrado o cambió en otro dispositivo';
end;
$$;

create or replace function public.corregir_tiquete_devolucion(
  p_operacion_id uuid,
  p_tiquete_id uuid,
  p_numero text,
  p_cartones_iniciales numeric,
  p_cartones_malos numeric,
  p_fecha_correccion date,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text := (select private.mi_rol());
  v_numero text := nullif(pg_catalog.btrim(p_numero), '');
  v_tiquete public.bodega_tiquetes_devolucion%rowtype;
  v_existente public.bodega_tiquetes_devolucion_movs%rowtype;
  v_usados numeric(12, 2);
  v_delta numeric(12, 2);
  v_delta_malos numeric(12, 2);
  v_nuevo_saldo numeric(12, 2);
  v_fecha_movimiento date;
  v_motivo text := nullif(pg_catalog.btrim(p_motivo), '');
  v_email text;
begin
  if (select auth.uid()) is null or v_rol not in ('admin', 'encargado', 'bodega') then
    raise exception 'No tienes permiso para corregir tiquetes devueltos';
  end if;
  if p_operacion_id is null or p_tiquete_id is null or v_numero is null
    or p_cartones_iniciales is null or p_cartones_iniciales < 0
    or p_cartones_malos is null or p_cartones_malos < 0
    or p_cartones_iniciales + p_cartones_malos <= 0 then
    raise exception 'Revisa el número y las cantidades de cartones buenos y malos';
  end if;
  if p_cartones_iniciales * 2 <> pg_catalog.round(p_cartones_iniciales * 2)
    or p_cartones_malos * 2 <> pg_catalog.round(p_cartones_malos * 2) then
    raise exception 'Los cartones deben ser unidades enteras o medios cartones (.5)';
  end if;

  select * into v_existente from public.bodega_tiquetes_devolucion_movs where operacion_id = p_operacion_id;
  if found then
    select * into v_tiquete from public.bodega_tiquetes_devolucion where id = p_tiquete_id;
    if found and v_existente.tipo = 'correccion' and v_existente.tiquete_id = p_tiquete_id
      and lower(pg_catalog.btrim(v_tiquete.numero)) = lower(v_numero)
      and v_tiquete.cartones_iniciales = p_cartones_iniciales
      and v_tiquete.cartones_malos = p_cartones_malos then
      return pg_catalog.to_jsonb(v_tiquete);
    end if;
    raise exception 'El identificador de operación ya fue utilizado';
  end if;

  select * into v_tiquete from public.bodega_tiquetes_devolucion where id = p_tiquete_id for update;
  if not found then raise exception 'El tiquete ya no existe'; end if;

  select coalesce(sum(-cartones_delta), 0) into v_usados
  from public.bodega_tiquetes_devolucion_movs
  where tiquete_id = p_tiquete_id and tipo = 'uso';

  if v_usados > 0 and v_motivo is null then
    raise exception 'Escribe un motivo para corregir un tiquete que ya se reutilizó';
  end if;
  if v_usados > 0 and lower(pg_catalog.btrim(v_tiquete.numero)) <> lower(v_numero) then
    raise exception 'El número no se puede cambiar después de reutilizar el tiquete';
  end if;

  v_delta := p_cartones_iniciales - v_tiquete.cartones_iniciales;
  v_delta_malos := p_cartones_malos - v_tiquete.cartones_malos;
  v_nuevo_saldo := v_tiquete.saldo_cartones + v_delta;
  if v_nuevo_saldo < 0 then
    raise exception 'La corrección dejaría saldo negativo: ya se usaron % cartones y el tiquete quedaría en %', v_usados, p_cartones_iniciales;
  end if;

  if lower(pg_catalog.btrim(v_tiquete.numero)) <> lower(v_numero)
    and exists (select 1 from public.bodega_tiquetes_devolucion x where lower(pg_catalog.btrim(x.numero)) = lower(v_numero) and x.id <> p_tiquete_id) then
    raise exception 'Ese número de tiquete de devolución ya está registrado';
  end if;

  v_fecha_movimiento := case when v_usados = 0 then v_tiquete.fecha_recepcion else coalesce(p_fecha_correccion, current_date) end;
  if v_usados > 0 and v_fecha_movimiento < v_tiquete.fecha_recepcion then
    raise exception 'La fecha de corrección no puede ser anterior a la devolución';
  end if;
  if v_usados > 0 and v_fecha_movimiento < (
    select coalesce(max(fecha), v_tiquete.fecha_recepcion)
    from public.bodega_tiquetes_devolucion_movs
    where tiquete_id = p_tiquete_id and tipo = 'uso'
  ) then
    raise exception 'La fecha de corrección no puede ser anterior al último uso del tiquete';
  end if;
  select email into v_email from public.user_roles where user_id = (select auth.uid()) and active = true;

  update public.bodega_tiquetes_devolucion
  set numero = v_numero,
      cartones_iniciales = p_cartones_iniciales,
      cartones_malos = p_cartones_malos,
      saldo_cartones = v_nuevo_saldo,
      actualizado_en = now()
  where id = p_tiquete_id
  returning * into v_tiquete;

  insert into public.bodega_tiquetes_devolucion_movs (
    operacion_id, tiquete_id, tipo, numero, fecha, fecha_recepcion, fecha_ruta, ruta_mov_id, ruta_id,
    repartidor, cartones_delta, motivo, por
  ) values (
    p_operacion_id, v_tiquete.id, 'correccion', v_tiquete.numero, v_fecha_movimiento,
    v_fecha_movimiento, v_tiquete.fecha_ruta_origen, v_tiquete.ruta_mov_id, v_tiquete.ruta_id,
    v_tiquete.repartidor, v_delta, coalesce(v_motivo, 'Edición antes de reutilizar'), v_email
  );
  if v_delta_malos <> 0 then
    insert into public.bodega_tiquetes_devolucion_movs (
      operacion_id, tiquete_id, tipo, numero, fecha, fecha_recepcion, fecha_ruta, ruta_mov_id, ruta_id,
      repartidor, cartones_delta, motivo, por
    ) values (
      pg_catalog.gen_random_uuid(), v_tiquete.id, 'correccion', v_tiquete.numero,
      case when v_usados = 0 then v_tiquete.fecha_ruta_origen else v_fecha_movimiento end,
      v_fecha_movimiento, v_tiquete.fecha_ruta_origen, v_tiquete.ruta_mov_id, v_tiquete.ruta_id,
      v_tiquete.repartidor, -v_delta_malos,
      coalesce(v_motivo, 'Corrección de cartones malos devueltos'), v_email
    );
  end if;
  return pg_catalog.to_jsonb(v_tiquete);
exception
  when unique_violation then
    raise exception 'Ese número de tiquete de devolución o identificador de operación ya está registrado';
end;
$$;

revoke all on function public.registrar_devolucion_tiquete(uuid, text, numeric, numeric, date, date, text, text, text) from public, anon;
revoke all on function public.usar_tiquete_devolucion(uuid, text, numeric, date, date, text, text, text) from public, anon;
revoke all on function public.corregir_tiquete_devolucion(uuid, uuid, text, numeric, numeric, date, text) from public, anon;
grant execute on function public.registrar_devolucion_tiquete(uuid, text, numeric, numeric, date, date, text, text, text) to authenticated;
grant execute on function public.usar_tiquete_devolucion(uuid, text, numeric, date, date, text, text, text) to authenticated;
grant execute on function public.corregir_tiquete_devolucion(uuid, uuid, text, numeric, numeric, date, text) to authenticated;
