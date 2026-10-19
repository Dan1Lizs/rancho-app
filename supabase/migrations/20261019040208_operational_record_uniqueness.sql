-- Protect the one-control-per-lot/day and one-weigh-in-per-lot/day rules at
-- the database boundary. Existing production rows were checked for duplicate
-- canonical date/lot pairs before applying this migration.
create unique index if not exists registros_lote_fecha_unica_idx
on public.registros (
  (data ->> 'lote'),
  (
    case
      when (data ->> 'fecha') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then data ->> 'fecha'
      when (data ->> 'fecha') ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
        then split_part(data ->> 'fecha', '/', 3) || '-' ||
          lpad(split_part(data ->> 'fecha', '/', 2), 2, '0') || '-' ||
          lpad(split_part(data ->> 'fecha', '/', 1), 2, '0')
      else data ->> 'fecha'
    end
  )
)
where coalesce(data ->> 'lote', '') <> '' and coalesce(data ->> 'fecha', '') <> '';

create unique index if not exists pesajes_lote_fecha_unica_idx
on public.pesajes (
  (data ->> 'lote'),
  (
    case
      when (data ->> 'fecha') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then data ->> 'fecha'
      when (data ->> 'fecha') ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
        then split_part(data ->> 'fecha', '/', 3) || '-' ||
          lpad(split_part(data ->> 'fecha', '/', 2), 2, '0') || '-' ||
          lpad(split_part(data ->> 'fecha', '/', 1), 2, '0')
      else data ->> 'fecha'
    end
  )
)
where coalesce(data ->> 'lote', '') <> '' and coalesce(data ->> 'fecha', '') <> '';
