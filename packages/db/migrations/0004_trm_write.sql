-- ============================================================
-- 0004_trm_write.sql
-- exchange_rates es dato PÚBLICO de referencia (TRM). Permite upsert por crm_app
-- (el servicio TRM corre con el cliente `db` sin contexto de usuario).
-- ============================================================
begin;

-- Lectura pública (TRM no es dato de tenant). Además, ON CONFLICT DO UPDATE
-- necesita SELECT sobre la fila en conflicto, y el servicio TRM corre sin usuario.
drop policy if exists rates_select on exchange_rates;
create policy rates_select on exchange_rates for select
  using (true);

drop policy if exists rates_insert on exchange_rates;
create policy rates_insert on exchange_rates for insert
  with check (true);

drop policy if exists rates_update on exchange_rates;
create policy rates_update on exchange_rates for update
  using (true)
  with check (true);

grant insert, update on exchange_rates to crm_app;

commit;
