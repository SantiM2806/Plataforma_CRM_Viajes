-- ============================================================
-- 0006_reservations.sql
-- Reservas: se crean automáticamente al aprobar una cotización (opción elegida).
-- ============================================================
begin;

do $$ begin
  create type reservation_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
exception when duplicate_object then null; end $$;

create table if not exists reservations (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references agencies(id) on delete cascade,
  quote_id        uuid references quotes(id) on delete set null,
  quote_option_id uuid references quote_options(id) on delete set null,
  agent_id        uuid not null references users(id),
  consecutivo     text unique,                       -- RES-AVM-XXXX
  status          reservation_status not null default 'pending',

  -- snapshots (cliente / hotel / precio) tomados al aprobar
  client_name     text,
  client_email    citext,
  client_phone    text,
  hotel_name      text,
  hotel_city      text,
  check_in        date,
  check_out       date,
  board           text,
  occupancy       jsonb,

  net_cost_usd    numeric(12,2),
  sale_usd        numeric(12,2),
  sale_cop        numeric(14,2),
  trm_cop_per_usd numeric(16,6),

  provider_ref          jsonb,
  provider_confirmation text,                        -- localizador del proveedor
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_reservations_agency_status on reservations(agency_id, status);
create index if not exists idx_reservations_agent on reservations(agent_id);
drop trigger if exists trg_reservations_updated on reservations;
create trigger trg_reservations_updated before update on reservations
  for each row execute function set_updated_at();

-- ---------- RLS (mismo patrón que quotes) ----------
alter table reservations enable row level security;

drop policy if exists reservations_select on reservations;
create policy reservations_select on reservations for select
  using (
    is_platform_admin()
    or has_agency_role(agency_id, array['admin_agencia','contable']::app_role[])
    or (agent_id = app_current_user() and is_member_of(agency_id))
  );

drop policy if exists reservations_write on reservations;
create policy reservations_write on reservations for all
  using (
    has_agency_role(agency_id, array['admin_agencia']::app_role[])
    or (agent_id = app_current_user() and has_agency_role(agency_id, array['agente','admin_agencia']::app_role[]))
  )
  with check (
    has_agency_role(agency_id, array['admin_agencia']::app_role[])
    or (agent_id = app_current_user() and has_agency_role(agency_id, array['agente','admin_agencia']::app_role[]))
  );

grant select, insert, update, delete on reservations to crm_app;

-- ---------- Recrear decide_public_quote: al aprobar, crea la reserva ----------
create or replace function decide_public_quote(p_token text, p_option uuid, p_decision text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_quote quotes;
begin
  select * into v_quote from quotes where public_token = p_token;
  if v_quote.id is null then
    raise exception 'Cotización no encontrada';
  end if;
  if v_quote.status <> 'sent' then
    raise exception 'La cotización ya fue decidida o no está disponible';
  end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    update quotes set status = 'expired' where id = v_quote.id;
    raise exception 'La cotización venció';
  end if;

  if p_decision = 'approve' then
    if not exists (select 1 from quote_options where id = p_option and quote_id = v_quote.id) then
      raise exception 'Opción inválida';
    end if;
    update quote_options set selected = (id = p_option) where quote_id = v_quote.id;
    update quotes set status = 'approved', decided_at = now() where id = v_quote.id;

    -- Crear la reserva a partir de la opción elegida (si no existe ya).
    if not exists (select 1 from reservations where quote_id = v_quote.id) then
      insert into reservations (
        agency_id, quote_id, quote_option_id, agent_id, consecutivo, status,
        client_name, client_email, client_phone,
        hotel_name, hotel_city, check_in, check_out, board, occupancy,
        net_cost_usd, sale_usd, sale_cop, trm_cop_per_usd, provider_ref
      )
      select
        v_quote.agency_id, v_quote.id, o.id, v_quote.agent_id,
        next_consecutivo(v_quote.agency_id, 'RES'), 'pending',
        v_quote.client_name, v_quote.client_email, v_quote.client_phone,
        o.hotel_name, o.hotel_city, o.check_in, o.check_out, o.board, o.occupancy,
        o.net_cost_usd, o.sale_usd, o.sale_cop, v_quote.trm_cop_per_usd, o.provider_ref
      from quote_options o
      where o.id = p_option and o.quote_id = v_quote.id;
    end if;

    return 'approved';
  elsif p_decision = 'reject' then
    update quotes set status = 'rejected', decided_at = now() where id = v_quote.id;
    return 'rejected';
  else
    raise exception 'Decisión inválida';
  end if;
end $$;

grant execute on function decide_public_quote(text, uuid, text) to crm_app;

commit;
