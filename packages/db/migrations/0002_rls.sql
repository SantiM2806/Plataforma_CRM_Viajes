-- ============================================================
-- 0002_rls.sql  (PostgreSQL puro)
-- RLS sobre tablas de dominio, dirigida por app_current_user() (GUC app.user_id).
-- Las tablas de Auth.js (users/accounts/sessions/verification_tokens) NO llevan RLS.
-- El rol crm_app (runtime) NO es owner => la RLS lo alcanza.
-- ============================================================
begin;

alter table agencies       enable row level security;
alter table memberships    enable row level security;
alter table markup_rules   enable row level security;
alter table doc_sequences  enable row level security;   -- sin policies => solo vía RPC definer
alter table exchange_rates enable row level security;
alter table audit_log      enable row level security;

-- ---------- agencies ----------
drop policy if exists agencies_select on agencies;
create policy agencies_select on agencies for select
  using (is_member_of(id));

-- Inserción directa solo super_admin; el auto-registro usa onboard_agency() (definer).
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
    user_id = app_current_user()
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

-- ---------- exchange_rates (lectura para autenticados; escritura vía worker/admin) ----------
drop policy if exists rates_select on exchange_rates;
create policy rates_select on exchange_rates for select
  using (app_current_user() is not null);

-- ---------- audit_log ----------
drop policy if exists audit_select on audit_log;
create policy audit_select on audit_log for select
  using (
    is_platform_admin()
    or (agency_id is not null and has_agency_role(agency_id, array['admin_agencia','contable']::app_role[]))
  );

-- ============================================================
-- Grants al rol de runtime crm_app (la RLS decide las filas)
-- ============================================================
grant usage on schema public to crm_app;

-- Tablas de Auth.js (sin RLS): la app las gestiona vía el adaptador
grant select, insert, update, delete on users               to crm_app;
grant select, insert, update, delete on accounts            to crm_app;
grant select, insert, update, delete on sessions            to crm_app;
grant select, insert, update, delete on verification_tokens to crm_app;

-- Dominio (con RLS)
grant select, insert, update          on agencies       to crm_app;
grant select, insert, update, delete  on memberships    to crm_app;
grant select, insert, update, delete  on markup_rules   to crm_app;
grant select                          on exchange_rates to crm_app;
grant select                          on audit_log      to crm_app;
-- doc_sequences: SIN grants directos (solo vía next_consecutivo, SECURITY DEFINER)

grant execute on function app_current_user()                    to crm_app;
grant execute on function onboard_agency(text, text, text)      to crm_app;
grant execute on function next_consecutivo(uuid, text, int)     to crm_app;
grant execute on function is_platform_admin()                   to crm_app;
grant execute on function is_member_of(uuid)                    to crm_app;
grant execute on function has_agency_role(uuid, app_role[])     to crm_app;
grant execute on function current_agency_ids()                  to crm_app;

commit;
