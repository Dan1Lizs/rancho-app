-- Ejecutar en Supabase SQL Editor SOLO después de resolver todas las fechas
-- duplicadas desde el historial de bodega de la app (v8.5 o posterior).
-- Si aún quedan duplicados, CREATE UNIQUE INDEX fallará sin borrar ningún dato.

create unique index if not exists bodega_movs_fecha_unica_idx
on public.bodega_movs ((
  case
    when data->>'fecha' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then data->>'fecha'
    when data->>'fecha' ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' then
      split_part(data->>'fecha', '/', 3) || '-' ||
      lpad(split_part(data->>'fecha', '/', 2), 2, '0') || '-' ||
      lpad(split_part(data->>'fecha', '/', 1), 2, '0')
    else data->>'fecha'
  end
));
