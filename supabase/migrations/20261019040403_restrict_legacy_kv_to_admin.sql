-- The legacy key/value store still holds historical operational copies.
-- Keep it available for controlled administrator recovery, not for all users.
drop policy if exists "equipo lee" on public.kv;
drop policy if exists "equipo inserta" on public.kv;
drop policy if exists "equipo actualiza" on public.kv;

create policy kv_admin_select
on public.kv for select to authenticated
using ((select private.mi_rol()) = 'admin');

create policy kv_admin_insert
on public.kv for insert to authenticated
with check ((select private.mi_rol()) = 'admin');

create policy kv_admin_update
on public.kv for update to authenticated
using ((select private.mi_rol()) = 'admin')
with check ((select private.mi_rol()) = 'admin');
