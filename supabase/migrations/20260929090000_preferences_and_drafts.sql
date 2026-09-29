create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
grant select, insert, update, delete on public.user_preferences to authenticated;

drop policy if exists "preferences_own_select" on public.user_preferences;
create policy "preferences_own_select" on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "preferences_own_insert" on public.user_preferences;
create policy "preferences_own_insert" on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "preferences_own_update" on public.user_preferences;
create policy "preferences_own_update" on public.user_preferences
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "preferences_own_delete" on public.user_preferences;
create policy "preferences_own_delete" on public.user_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.user_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_key text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, draft_key)
);

alter table public.user_drafts enable row level security;
grant select, insert, update, delete on public.user_drafts to authenticated;

drop policy if exists "drafts_own_select" on public.user_drafts;
create policy "drafts_own_select" on public.user_drafts
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "drafts_own_insert" on public.user_drafts;
create policy "drafts_own_insert" on public.user_drafts
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "drafts_own_update" on public.user_drafts;
create policy "drafts_own_update" on public.user_drafts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "drafts_own_delete" on public.user_drafts;
create policy "drafts_own_delete" on public.user_drafts
  for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.organization_settings (
  id text primary key default 'rancho',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.organization_settings enable row level security;
grant select, insert, update on public.organization_settings to authenticated;

drop policy if exists "organization_settings_read" on public.organization_settings;
create policy "organization_settings_read" on public.organization_settings
  for select to authenticated using ((select private.mi_rol()) is not null);
drop policy if exists "organization_settings_admin_insert" on public.organization_settings;
create policy "organization_settings_admin_insert" on public.organization_settings
  for insert to authenticated with check ((select private.mi_rol()) = 'admin');
drop policy if exists "organization_settings_admin_update" on public.organization_settings;
create policy "organization_settings_admin_update" on public.organization_settings
  for update to authenticated using ((select private.mi_rol()) = 'admin')
  with check ((select private.mi_rol()) = 'admin');

insert into public.organization_settings (id, settings)
values ('rancho', '{"nombre":"Rancho El Soñado","razonSocial":"","numeracionTiquetes":"manual","cierreBodegaObligatorio":true,"retencionHistorialMeses":60,"borradoresPermitidos":true}'::jsonb)
on conflict (id) do nothing;

