alter table public.bodega_tiquetes_devolucion_movs
  add column if not exists regla_salida_neta boolean not null default false;

alter table public.bodega_tiquetes_devolucion_movs
  drop constraint if exists bodega_tiquetes_devolucion_movs_tipo_cantidad_check;

alter table public.bodega_tiquetes_devolucion_movs
  add constraint bodega_tiquetes_devolucion_movs_tipo_cantidad_check
  check (
    (
      tipo = 'devolucion_mala'
      and cartones_informativos > 0
      and (
        (regla_salida_neta = false and cartones_delta = 0)
        or (regla_salida_neta = true and cartones_delta = -cartones_informativos)
      )
    )
    or (
      tipo = 'correccion'
      and (
        (regla_salida_neta = false and (cartones_delta = 0 or cartones_informativos = 0))
        or (regla_salida_neta = true and (cartones_informativos = 0 or cartones_delta = -cartones_informativos))
      )
    )
    or (tipo in ('devolucion', 'uso') and cartones_informativos = 0)
  );

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
      repartidor, cartones_delta, cartones_informativos, regla_salida_neta, motivo, por
    ) values (
      p_operacion_id, p_operacion_id, 'devolucion', v_numero, p_fecha_recepcion,
      p_fecha_recepcion, p_fecha_ruta_origen, p_ruta_mov_id, p_ruta_id, v_repartidor,
      p_cartones, 0, true,
      'Devolución buena; se descuenta de la salida efectiva y queda disponible para reutilizar', v_email
    );
  end if;
  if p_cartones_malos > 0 then
    insert into public.bodega_tiquetes_devolucion_movs (
      operacion_id, tiquete_id, tipo, numero, fecha, fecha_recepcion, fecha_ruta, ruta_mov_id, ruta_id,
      repartidor, cartones_delta, cartones_informativos, regla_salida_neta, motivo, por
    ) values (
      case when p_cartones = 0 then p_operacion_id else pg_catalog.gen_random_uuid() end,
      p_operacion_id, 'devolucion_mala', v_numero, p_fecha_recepcion, p_fecha_recepcion,
      p_fecha_ruta_origen, p_ruta_mov_id, p_ruta_id, v_repartidor,
      -p_cartones_malos, p_cartones_malos, true,
      'Huevo devuelto malo; se descuenta de la salida efectiva y del inventario al recibirse', v_email
    );
  end if;
  return pg_catalog.to_jsonb(v_tiquete);
exception
  when unique_violation then
    raise exception 'Ese número de tiquete de devolución ya está registrado';
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
    repartidor, cartones_delta, cartones_informativos, regla_salida_neta, motivo, por
  ) values (
    p_operacion_id, v_tiquete.id, 'correccion', v_tiquete.numero, v_fecha_movimiento,
    v_tiquete.fecha_recepcion, v_tiquete.fecha_ruta_origen, v_tiquete.ruta_mov_id, v_tiquete.ruta_id,
    v_tiquete.repartidor, v_delta, 0, true, coalesce(v_motivo, 'Edición antes de reutilizar'), v_email
  );

  if v_delta_malos <> 0 then
    insert into public.bodega_tiquetes_devolucion_movs (
      operacion_id, tiquete_id, tipo, numero, fecha, fecha_recepcion, fecha_ruta, ruta_mov_id, ruta_id,
      repartidor, cartones_delta, cartones_informativos, regla_salida_neta, motivo, por
    ) values (
      pg_catalog.gen_random_uuid(), v_tiquete.id, 'correccion', v_tiquete.numero, v_fecha_movimiento,
      v_tiquete.fecha_recepcion, v_tiquete.fecha_ruta_origen, v_tiquete.ruta_mov_id, v_tiquete.ruta_id,
      v_tiquete.repartidor, -v_delta_malos, v_delta_malos, true,
      coalesce(v_motivo, 'Corrección de huevo devuelto malo y su merma de inventario'), v_email
    );
  end if;
  return pg_catalog.to_jsonb(v_tiquete);
exception
  when unique_violation then
    raise exception 'Ese número de tiquete de devolución o identificador de operación ya está registrado';
end;
$$;

revoke all on function public.registrar_devolucion_tiquete(uuid, text, numeric, numeric, date, date, text, text, text) from public, anon;
revoke all on function public.corregir_tiquete_devolucion(uuid, uuid, text, numeric, numeric, date, text) from public, anon;
grant execute on function public.registrar_devolucion_tiquete(uuid, text, numeric, numeric, date, date, text, text, text) to authenticated;
grant execute on function public.corregir_tiquete_devolucion(uuid, uuid, text, numeric, numeric, date, text) to authenticated;
