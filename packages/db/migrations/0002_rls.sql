-- ============================================================
-- 0002_rls.sql
-- Row Level Security + grants para los roles de Supabase
-- ============================================================
begin;

alter table profiles       enable row level security;
alter table agencies       enable row level security;
alter table memberships    enable row level security;
alter table markup_rules   enable row level security;
alter table doc_sequences  enable row level security;   -- sin policies => acceso solo vía RPC definer
alter table exchange_rates enable row level security;
alter table audit_log      enable row level security;

-- ---------- profiles ----------
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (id = auth.uid() or is_platform_admin());

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- agencies ----------
drop policy if exists agencies_select on agencies;
create policy agencies_select on agencies for select
  using (is_member_of(id));

-- Inserción directa solo plataforma; el auto-registro usa onboard_agency() (definer).
drop policy if exists agencies_insert on agencies;
create policy agencies_insert on agencies for insert
  with check (is_platform_admin());

drop policy if exists agencies_update on agencies;
create policy agencies_update on agencies for update
  using (has_agency_role(id, array['admin_agencia']::app_role[]))
  with check (has_agency_role(id, array['admin_agencia']::app_role[]));

-- ---------- memberships ----------
drop policy if exists memberships_select on memberships;
create policy memberships_select on memberships for select
  using (
    user_id = auth.uid()
    or is_platform_admin()
    or (agency_id is not null and has_agency_role(agency_id, array['admin_agencia']::app_role[]))
  );

drop policy if exists memberships_write on memberships;
create policy memberships_write on memberships for all
  using (
    is_platform_admin()
    or (agency_id is not null and has_agency_role(agency_id, array['admin_agencia']::app_role[]))
  )
  with check (
    is_platform_admin()
    or (agency_id is not null and has_agency_role(agency_id, array['admin_agencia']::app_role[]))
  );

-- ---------- markup_rules ----------
drop policy if exists markup_select on markup_rules;
create policy markup_select on markup_rules for select
  using (is_member_of(agency_id));

drop policy if exists markup_write on markup_rules;
create policy markup_write on markup_rules for all
  using (has_agency_role(agency_id, array['admin_agencia']::app_role[]))
  with check (has_agency_role(agency_id, array['admin_agencia']::app_role[]));

-- ---------- exchange_rates ----------
-- Lectura para autenticados; escritura la hace el worker con service_role (bypassa RLS).
drop policy if exists rates_select on exchange_rates;
create policy rates_select on exchange_rates for select
  using (auth.uid() is not null);

-- ---------- audit_log ----------
-- Lectura por super_admin, o admin_agencia/contable de la agencia; escritura vía service_role/definer.
drop policy if exists audit_select on audit_log;
create policy audit_select on audit_log for select
  using (
    is_platform_admin()
    or (agency_id is not null and has_agency_role(agency_id, array['admin_agencia','contable']::app_role[]))
  );

-- ============================================================
-- Grants para roles Supabase (RLS opera POR ENCIMA de estos grants)
-- ============================================================
grant usage on schema public to authenticated, anon;

grant select, insert, update          on profiles       to authenticated;
grant select, insert, update          on agencies       to authenticated;
grant select, insert, update, delete  on memberships    to authenticated;
grant select, insert, update, delete  on markup_rules   to authenticated;
grant select                          on exchange_rates to authenticated;
grant select                          on audit_log      to authenticated;
-- doc_sequences: SIN grants directos (solo vía next_consecutivo, SECURITY DEFINER)

grant execute on function onboard_agency(text, text, text)      to authenticated;
grant execute on function next_consecutivo(uuid, text, int)     to authenticated;
grant execute on function is_platform_admin()                   to authenticated;
grant execute on function is_member_of(uuid)                    to authenticated;
grant execute on function has_agency_role(uuid, app_role[])     to authenticated;
grant execute on function current_agency_ids()                  to authenticated;

commit;
