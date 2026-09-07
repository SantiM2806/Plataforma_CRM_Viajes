'use server';

import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { withUser, schema, type Db } from '@crm/db';
import { getSessionContext, getUserAgencies } from '@/lib/auth/session';
import { loadAgencyPricing, priceOption } from '@/lib/pricing';
import { getTrm } from '@/lib/trm';
import { searchHotels, getRates, type HotelSummary, type RateOffer } from '@/lib/liteapi/client';

// ---------- Tipos compartidos con el builder ----------
export interface OccupancyInput {
  adults: number;
  children: number[];
}
export interface QuoteOptionInput {
  label?: string;
  provider: string;
  providerRef?: unknown;
  hotelId?: string;
  hotelName?: string;
  hotelCity?: string;
  hotelStars?: number;
  hotelImage?: string;
  checkin: string;
  checkout: string;
  occupancy: OccupancyInput;
  board?: string;
  netCostUsd: number;
}
export interface QuoteInput {
  title?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientTaxId?: string;
  notes?: string;
  options: QuoteOptionInput[];
}

export interface OfferPreview extends RateOffer {
  saleUsd: number;
  saleCop: number | null;
}

// ---------- Resolución de contexto (usuario + agencia activa) ----------
async function resolveContext(): Promise<{ userId: string; agencyId: string }> {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error('No autenticado');
  const agencies = await getUserAgencies(ctx.userId);
  const store = await cookies();
  const requested = store.get('active_agency')?.value;
  const active = agencies.find((a) => a.id === requested) ?? agencies[0];
  if (!active) throw new Error('Sin agencia activa');
  return { userId: ctx.userId, agencyId: active.id };
}

// ---------- Búsqueda de hoteles (LiteAPI) ----------
export async function searchHotelsAction(input: {
  cityName: string;
  hotelName?: string;
}): Promise<HotelSummary[]> {
  await resolveContext(); // valida sesión
  if (!input.cityName?.trim()) return [];
  return searchHotels({ cityName: input.cityName.trim(), hotelName: input.hotelName?.trim() });
}

// ---------- Tarifas de un hotel + precio de venta (preview) ----------
export async function getOffersAction(input: {
  hotelId: string;
  checkin: string;
  checkout: string;
  occupancy: OccupancyInput;
}): Promise<{ offers: OfferPreview[]; trmRate: number | null; trmDate: string | null }> {
  const { userId, agencyId } = await resolveContext();

  const [offers, pricing, trm] = await Promise.all([
    getRates({
      hotelId: input.hotelId,
      checkin: input.checkin,
      checkout: input.checkout,
      occupancies: [input.occupancy],
    }),
    loadAgencyPricing(userId, agencyId),
    getTrm().catch(() => null),
  ]);

  const priced = offers.map<OfferPreview>((o) => {
    const b = priceOption(pricing, o.netCostUsd, { provider: 'liteapi', productType: 'hotel', productId: o.hotelId }, trm?.rate ?? null);
    return { ...o, saleUsd: b.saleUsd, saleCop: b.saleCop };
  });

  return { offers: priced, trmRate: trm?.rate ?? null, trmDate: trm?.rateDate ?? null };
}

// ---------- Guardar cotización (borrador) ----------
export async function saveQuoteAction(
  input: QuoteInput,
  opts?: { send?: boolean },
): Promise<{ id: string; consecutivo?: string; publicToken?: string }> {
  const { userId, agencyId } = await resolveContext();
  if (!input.clientName?.trim()) throw new Error('El nombre del cliente es obligatorio.');
  if (input.options.length === 0) throw new Error('Agrega al menos una opción.');

  const pricing = await loadAgencyPricing(userId, agencyId);

  const quoteId = await withUser(userId, async (tx: Db) => {
    const [q] = await tx
      .insert(schema.quotes)
      .values({
        agencyId,
        agentId: userId,
        title: input.title ?? null,
        clientName: input.clientName.trim(),
        clientEmail: input.clientEmail?.trim() || null,
        clientPhone: input.clientPhone?.trim() || null,
        clientTaxId: input.clientTaxId?.trim() || null,
        notes: input.notes?.trim() || null,
      })
      .returning({ id: schema.quotes.id });

    let pos = 1;
    for (const opt of input.options) {
      const b = priceOption(
        pricing,
        opt.netCostUsd,
        { provider: opt.provider, productType: 'hotel', productId: opt.hotelId },
        null, // COP se congela al enviar
      );
      await tx.insert(schema.quoteOptions).values({
        quoteId: q.id,
        position: pos++,
        label: opt.label ?? null,
        provider: opt.provider,
        providerRef: (opt.providerRef ?? null) as never,
        hotelName: opt.hotelName ?? null,
        hotelCity: opt.hotelCity ?? null,
        hotelStars: opt.hotelStars ?? null,
        hotelImage: opt.hotelImage ?? null,
        checkIn: opt.checkin,
        checkOut: opt.checkout,
        occupancy: opt.occupancy as never,
        board: opt.board ?? null,
        netCostUsd: opt.netCostUsd.toFixed(2),
        markupPercent: b.markupPercent.toFixed(4),
        markupFixedUsd: b.markupFixedUsd.toFixed(2),
        bankFeePercent: b.bankFeePercent.toFixed(3),
        saleUsd: b.saleUsd.toFixed(2),
        saleCop: null,
      });
    }
    return q.id;
  });

  if (opts?.send) {
    const r = await sendQuoteAction(quoteId);
    return { id: quoteId, ...r };
  }
  return { id: quoteId };
}

// ---------- Editar un borrador (cabecera + opciones) ----------
export async function updateQuoteAction(
  quoteId: string,
  input: QuoteInput,
  opts?: { send?: boolean },
): Promise<{ id: string; consecutivo?: string; publicToken?: string }> {
  const { userId } = await resolveContext();
  if (!input.clientName?.trim()) throw new Error('El nombre del cliente es obligatorio.');
  if (input.options.length === 0) throw new Error('Agrega al menos una opción.');

  const [q] = await withUser(userId, (tx: Db) =>
    tx
      .select({ agencyId: schema.quotes.agencyId, status: schema.quotes.status })
      .from(schema.quotes)
      .where(sql`${schema.quotes.id} = ${quoteId}`)
      .limit(1),
  );
  if (!q) throw new Error('Cotización no encontrada.');
  if (q.status !== 'draft') throw new Error('Solo se pueden editar borradores.');

  const pricing = await loadAgencyPricing(userId, q.agencyId);

  await withUser(userId, async (tx: Db) => {
    await tx
      .update(schema.quotes)
      .set({
        title: input.title ?? null,
        clientName: input.clientName.trim(),
        clientEmail: input.clientEmail?.trim() || null,
        clientPhone: input.clientPhone?.trim() || null,
        clientTaxId: input.clientTaxId?.trim() || null,
        notes: input.notes?.trim() || null,
      })
      .where(sql`${schema.quotes.id} = ${quoteId}`);

    await tx.delete(schema.quoteOptions).where(sql`${schema.quoteOptions.quoteId} = ${quoteId}`);

    let pos = 1;
    for (const opt of input.options) {
      const b = priceOption(
        pricing,
        opt.netCostUsd,
        { provider: opt.provider, productType: 'hotel', productId: opt.hotelId },
        null,
      );
      await tx.insert(schema.quoteOptions).values({
        quoteId,
        position: pos++,
        label: opt.label ?? null,
        provider: opt.provider,
        providerRef: (opt.providerRef ?? null) as never,
        hotelName: opt.hotelName ?? null,
        hotelCity: opt.hotelCity ?? null,
        hotelStars: opt.hotelStars ?? null,
        hotelImage: opt.hotelImage ?? null,
        checkIn: opt.checkin,
        checkOut: opt.checkout,
        occupancy: opt.occupancy as never,
        board: opt.board ?? null,
        netCostUsd: opt.netCostUsd.toFixed(2),
        markupPercent: b.markupPercent.toFixed(4),
        markupFixedUsd: b.markupFixedUsd.toFixed(2),
        bankFeePercent: b.bankFeePercent.toFixed(3),
        saleUsd: b.saleUsd.toFixed(2),
        saleCop: null,
      });
    }
  });

  if (opts?.send) {
    const r = await sendQuoteAction(quoteId);
    return { id: quoteId, ...r };
  }
  return { id: quoteId };
}

// ---------- Enviar (congela consecutivo + TRM + token público) ----------
export async function sendQuoteAction(
  quoteId: string,
): Promise<{ consecutivo: string; publicToken: string }> {
  const { userId, agencyId } = await resolveContext();
  const pricing = await loadAgencyPricing(userId, agencyId);
  const trm = await getTrm(); // TRM del día (con fallback)

  return withUser(userId, async (tx: Db) => {
    const [quote] = await tx
      .select({ id: schema.quotes.id, status: schema.quotes.status, agencyId: schema.quotes.agencyId })
      .from(schema.quotes)
      .where(sql`${schema.quotes.id} = ${quoteId}`)
      .limit(1);
    if (!quote) throw new Error('Cotización no encontrada.');
    if (quote.status !== 'draft') throw new Error('La cotización ya fue enviada.');

    const [agency] = await tx
      .select({
        bankFeePercent: schema.agencies.bankFeePercent,
        validityDays: schema.agencies.quoteValidityDays,
      })
      .from(schema.agencies)
      .where(sql`${schema.agencies.id} = ${quote.agencyId}`)
      .limit(1);

    // Recalcular y congelar precios de cada opción con la TRM.
    const options = await tx
      .select()
      .from(schema.quoteOptions)
      .where(sql`${schema.quoteOptions.quoteId} = ${quoteId}`);
    if (options.length === 0) throw new Error('La cotización no tiene opciones.');

    for (const opt of options) {
      const b = priceOption(
        pricing,
        Number(opt.netCostUsd),
        { provider: opt.provider, productType: 'hotel', productId: opt.hotelName ?? undefined },
        trm.rate,
      );
      await tx
        .update(schema.quoteOptions)
        .set({
          markupPercent: b.markupPercent.toFixed(4),
          markupFixedUsd: b.markupFixedUsd.toFixed(2),
          bankFeePercent: b.bankFeePercent.toFixed(3),
          saleUsd: b.saleUsd.toFixed(2),
          saleCop: b.saleCop != null ? b.saleCop.toFixed(2) : null,
        })
        .where(sql`${schema.quoteOptions.id} = ${opt.id}`);
    }

    const { rows } = (await tx.execute(
      sql`select next_consecutivo(${quote.agencyId}, 'COT') as c`,
    )) as unknown as { rows: Array<{ c: string }> };
    const consecutivo = rows[0].c;
    const publicToken = crypto.randomUUID();
    const validityDays = agency?.validityDays ?? 7;

    await tx
      .update(schema.quotes)
      .set({
        consecutivo,
        status: 'sent',
        trmCopPerUsd: trm.rate.toFixed(6),
        trmDate: trm.rateDate,
        bankFeePercent: (agency?.bankFeePercent ?? '0').toString(),
        validUntil: sql`current_date + ${validityDays}::int`,
        publicToken,
        sentAt: sql`now()`,
      })
      .where(sql`${schema.quotes.id} = ${quoteId}`);

    return { consecutivo, publicToken };
  });
}
