-- Ejecutar en Supabase SQL Editor después de revisar usuarios existentes.
-- Conserva el acceso actual: los correos de cfgAdmins son admin; si esa lista
-- estaba vacía, todos los usuarios existentes eran admin. El resto, encargado
-- con los permisos operativos que ya tenía. Los roles de área son para cuentas
-- nuevas o cambios posteriores hechos conscientemente por un administrador.
-- Después se pueden asignar roles específicos desde la app.
begin;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('admin','encargado','bodega','planta','bienestar','consulta')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.user_roles to authenticated;
grant update (role, active) on public.user_roles to authenticated;

insert into public.user_roles(user_id,email,role)
select u.id,lower(u.email),
  case when jsonb_array_length(case when jsonb_typeof(c.data)='array' then c.data else '[]'::jsonb end)=0
    or lower(u.email) in (select lower(value) from jsonb_array_elements_text(case when jsonb_typeof(c.data)='array' then c.data else '[]'::jsonb end) as value)
    then 'admin' else 'encargado' end
from auth.users u
left join public.config c on c.key='granja2:cfgAdmins'
where u.email is not null
on conflict(user_id) do nothing;

create or replace function public.mi_rol() returns text language sql stable security definer
set search_path = '' as $$
  select role from public.user_roles where user_id = auth.uid() and active = true
$$;
revoke all on function public.mi_rol() from public;
grant execute on function public.mi_rol() to authenticated;

alter table public.user_roles enable row level security;
drop policy if exists roles_ver on public.user_roles;
create policy roles_ver on public.user_roles for select to authenticated
using (user_id=auth.uid() or public.mi_rol()='admin');
drop policy if exists roles_admin on public.user_roles;
create policy roles_admin on public.user_roles for update to authenticated
using (public.mi_rol()='admin') with check (public.mi_rol()='admin');

create or replace function public.proteger_ultimo_admin() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if old.role='admin' and old.active and (new.role<>'admin' or not new.active)
    and (select count(*) from public.user_roles where role='admin' and active and user_id<>old.user_id)=0 then
      raise exception 'Debe quedar al menos un administrador activo';
  end if;
  return new;
end $$;
drop trigger if exists ultimo_admin on public.user_roles;
create trigger ultimo_admin before update on public.user_roles for each row execute function public.proteger_ultimo_admin();

create or replace function public.puede_escribir(tabla text) returns boolean language sql stable security definer
set search_path = '' as $$
  select case public.mi_rol()
    when 'admin' then true
    when 'encargado' then true
    when 'bodega' then tabla in ('bodega_movs')
    when 'planta' then tabla in ('planta_movs','kardex','mp_pedidos','mp_inv_historial','mp_catalogo')
    when 'bienestar' then tabla in ('pesajes','medicaciones','fumigaciones','vacunas','enfermedades','necropsias','plan_vacunas')
    else false end
$$;
revoke all on function public.puede_escribir(text) from public;
grant execute on function public.puede_escribir(text) to authenticated;

create or replace function public.puede_configurar(clave text) returns boolean language sql stable security definer
set search_path = '' as $$
  select case public.mi_rol()
    when 'admin' then true
    when 'encargado' then true
    when 'bodega' then clave in ('granja2:bodegaCfg','granja2:advertenciasAjustes','sembrado:bodega_movs') or clave like 'granja2:tarea:%'
    when 'planta' then clave in ('granja2:plantaCfg','granja2:nucleoInv','granja2:recetas','granja2:mpInventario','granja2:mpConfig','granja2:racionesGanado','granja2:advertenciasAjustes','sembrado:planta_movs','sembrado:mp_pedidos','sembrado:mp_inv_historial','sembrado:kardex','sembrado:mp_catalogo') or clave like 'granja2:tarea:%'
    when 'bienestar' then clave in ('sembrado:pesajes','sembrado:medicaciones','sembrado:fumigaciones','sembrado:vacunas','sembrado:enfermedades','sembrado:necropsias','sembrado:plan_vacunas') or clave like 'granja2:tarea:%'
    else false end
$$;
revoke all on function public.puede_configurar(text) from public;
grant execute on function public.puede_configurar(text) to authenticated;

do $$ declare t text; tables text[] := array[
  'lotes','registros','pesajes','medicaciones','fumigaciones','bodega_movs',
  'planta_movs','facturas','bitacora','vacunas','enfermedades','necropsias',
  'plan_vacunas','mp_pedidos','insumos','insumos_movs','kardex','mp_catalogo',
  'favoritos','mp_inv_historial','cxp_facturas','cxp_pagos','cxp_notas'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists equipo_select on public.%I',t);
    execute format('drop policy if exists equipo_insert on public.%I',t);
    execute format('drop policy if exists equipo_update on public.%I',t);
    execute format('drop policy if exists equipo_delete on public.%I',t);
    execute format('drop policy if exists v10_select on public.%I',t);
    execute format('drop policy if exists v10_insert on public.%I',t);
    execute format('drop policy if exists v10_update on public.%I',t);
    execute format('drop policy if exists v10_delete on public.%I',t);
    execute format('create policy v10_select on public.%I for select to authenticated using (public.mi_rol() is not null and (%L not like ''cxp_%%'' and %L <> ''facturas'' or public.mi_rol() in (''admin'',''encargado'')))',t,t,t);
    execute format('create policy v10_insert on public.%I for insert to authenticated with check (public.puede_escribir(%L))',t,t);
    execute format('create policy v10_update on public.%I for update to authenticated using (public.puede_escribir(%L)) with check (public.puede_escribir(%L))',t,t,t);
    execute format('create policy v10_delete on public.%I for delete to authenticated using (public.puede_escribir(%L))',t,t);
  end loop;
end $$;

drop policy if exists equipo_select on public.config;
drop policy if exists equipo_insert on public.config;
drop policy if exists equipo_update on public.config;
drop policy if exists equipo_delete on public.config;
drop policy if exists v10_config_select on public.config;
drop policy if exists v10_config_insert on public.config;
drop policy if exists v10_config_update on public.config;
drop policy if exists v10_config_delete on public.config;
create policy v10_config_select on public.config for select to authenticated
using (public.mi_rol() is not null and (key not like 'granja2:cxp%' and key <> 'granja2:costos' or public.mi_rol() in ('admin','encargado')));
create policy v10_config_insert on public.config for insert to authenticated
with check (public.puede_configurar(key));
create policy v10_config_update on public.config for update to authenticated
using (public.puede_configurar(key)) with check (public.puede_configurar(key));
create policy v10_config_delete on public.config for delete to authenticated using (public.mi_rol()='admin');

drop policy if exists equipo_lee_auditoria on public.auditoria;
drop policy if exists v10_auditoria on public.auditoria;
create policy v10_auditoria on public.auditoria for select to authenticated using (public.mi_rol() in ('admin','encargado'));

-- Borra un conteo de planta con motivo y deja la reversión del núcleo en la
-- misma transacción. El trigger existente registra el DELETE en auditoria.
create or replace function public.borrar_ajuste_planta(p_id text, p_visto jsonb, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  movimiento jsonb;
  inventario jsonb;
  actualizado jsonb;
  formula text;
  diferencia numeric;
  evento jsonb;
begin
  if auth.uid() is null or not public.puede_escribir('planta_movs') then
    raise exception 'No tienes permiso para borrar ajustes de planta';
  end if;
  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Indica el motivo de la eliminación';
  end if;
  select data into movimiento from public.planta_movs where id=p_id for update;
  if movimiento is null or movimiento <> p_visto or movimiento->>'tipo' <> 'ajuste' then
    raise exception 'El ajuste cambió en otro dispositivo. Actualiza la pantalla antes de continuar';
  end if;
  if movimiento->>'categoria' = 'Núcleo' then
    formula := movimiento->>'formula';
    diferencia := coalesce((movimiento->>'porciones')::numeric, 0);
    select data into inventario from public.config where key='granja2:nucleoInv' for update;
    if inventario is null or not public.puede_configurar('granja2:nucleoInv') then
      raise exception 'No se pudo consultar o ajustar el inventario de núcleos';
    end if;
    actualizado := jsonb_set(inventario, array[formula],
      to_jsonb(round(coalesce((inventario->>formula)::numeric, 0)-diferencia, 2)), true);
    update public.config set data=actualizado, updated_at=now(), updated_by=auth.jwt()->>'email' where key='granja2:nucleoInv';
  end if;
  evento := jsonb_build_object('id',p_id,'fecha',movimiento->>'fecha',
    'instante',now(),'por',auth.jwt()->>'email','motivo',btrim(p_motivo),
    'original',movimiento,'categoria',movimiento->>'categoria','formula',movimiento->>'formula');
  insert into public.config(key,data,updated_by)
    values ('granja2:ajustePlantaBorrado:'||p_id,evento,auth.jwt()->>'email');
  delete from public.planta_movs where id=p_id;
  return jsonb_build_object('evento',evento,'inventario',actualizado);
end $$;
revoke all on function public.borrar_ajuste_planta(text,jsonb,text) from public;
grant execute on function public.borrar_ajuste_planta(text,jsonb,text) to authenticated;

commit;
