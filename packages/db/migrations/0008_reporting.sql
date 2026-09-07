-- ============================================================
-- 0008_reporting.sql
-- Documento del cliente (base DIAN) + propagación a la reserva.
-- ============================================================
begin;

alter table quotes       add column if not exists client_tax_id text;
alter table reservations add column if not exists client_tax_id text;

-- Recrear decide_public_quote para copiar también client_tax_id a la reserva.
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

    if not exists (select 1 from reservations where quote_id = v_quote.id) then
      insert into reservations (
        agency_id, quote_id, quote_option_id, agent_id, consecutivo, status,
        client_name, client_email, client_phone, client_tax_id,
        hotel_name, hotel_city, check_in, check_out, board, occupancy,
        net_cost_usd, sale_usd, sale_cop, trm_cop_per_usd, provider_ref
      )
      select
        v_quote.agency_id, v_quote.id, o.id, v_quote.agent_id,
        next_consecutivo(v_quote.agency_id, 'RES'), 'pending',
        v_quote.client_name, v_quote.client_email, v_quote.client_phone, v_quote.client_tax_id,
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
