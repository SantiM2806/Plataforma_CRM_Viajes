-- ============================================================
-- 0005_public_quote.sql
-- Acceso público a la propuesta por token (sin login) vía SECURITY DEFINER.
-- Nunca expone costo neto ni markups: solo precio de venta (COP/USD).
-- ============================================================
begin;

-- Devuelve la cotización + opciones para un token, solo si ya fue enviada.
create or replace function get_public_quote(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', q.id,
    'consecutivo', q.consecutivo,
    'status', q.status,
    'title', q.title,
    'clientName', q.client_name,
    'validUntil', q.valid_until,
    'expired', (q.valid_until is not null and q.valid_until < current_date),
    'agency', jsonb_build_object('name', a.name, 'initials', a.initials),
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'label', o.label,
        'hotelName', o.hotel_name,
        'hotelCity', o.hotel_city,
        'hotelStars', o.hotel_stars,
        'hotelImage', o.hotel_image,
        'board', o.board,
        'checkIn', o.check_in,
        'checkOut', o.check_out,
        'nights', o.nights,
        'occupancy', o.occupancy,
        'saleUsd', o.sale_usd,
        'saleCop', o.sale_cop,
        'selected', o.selected
      ) order by o.position)
      from quote_options o where o.quote_id = q.id
    ), '[]'::jsonb)
  )
  from quotes q
  join agencies a on a.id = q.agency_id
  where q.public_token = p_token
    and q.status in ('sent', 'approved', 'rejected', 'expired');
$$;

-- El cliente aprueba (eligiendo una opción) o rechaza la cotización.
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
    return 'approved';
  elsif p_decision = 'reject' then
    update quotes set status = 'rejected', decided_at = now() where id = v_quote.id;
    return 'rejected';
  else
    raise exception 'Decisión inválida';
  end if;
end $$;

grant execute on function get_public_quote(text) to crm_app;
grant execute on function decide_public_quote(text, uuid, text) to crm_app;

commit;
