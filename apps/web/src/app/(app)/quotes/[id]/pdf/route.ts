import { createElement } from 'react';
import { asc, eq } from 'drizzle-orm';
import { renderToBuffer } from '@react-pdf/renderer';
import { withUser, schema } from '@crm/db';
import { getSessionContext } from '@/lib/auth/session';
import { QuotePdf, type QuotePdfData } from '@/lib/pdf/quote-pdf';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!ctx) return new Response('No autenticado', { status: 401 });

  const data = await withUser(ctx.userId, async (tx) => {
    const [q] = await tx
      .select({
        consecutivo: schema.quotes.consecutivo,
        title: schema.quotes.title,
        clientName: schema.quotes.clientName,
        clientEmail: schema.quotes.clientEmail,
        clientPhone: schema.quotes.clientPhone,
        status: schema.quotes.status,
        validUntil: schema.quotes.validUntil,
        trm: schema.quotes.trmCopPerUsd,
        trmDate: schema.quotes.trmDate,
        agencyName: schema.agencies.name,
      })
      .from(schema.quotes)
      .innerJoin(schema.agencies, eq(schema.agencies.id, schema.quotes.agencyId))
      .where(eq(schema.quotes.id, id))
      .limit(1);
    if (!q) return null;

    const opts = await tx
      .select()
      .from(schema.quoteOptions)
      .where(eq(schema.quoteOptions.quoteId, id))
      .orderBy(asc(schema.quoteOptions.position));

    const pdf: QuotePdfData = {
      agencyName: q.agencyName,
      consecutivo: q.consecutivo,
      title: q.title,
      clientName: q.clientName,
      clientEmail: q.clientEmail,
      clientPhone: q.clientPhone,
      status: q.status,
      validUntil: q.validUntil,
      trm: q.trm != null ? Number(q.trm) : null,
      trmDate: q.trmDate,
      options: opts.map((o) => {
        const occ = (o.occupancy ?? {}) as { adults?: number; children?: number[] };
        return {
          hotelName: o.hotelName,
          hotelCity: o.hotelCity,
          hotelStars: o.hotelStars,
          board: o.board,
          checkIn: o.checkIn,
          checkOut: o.checkOut,
          nights: o.nights,
          adults: occ.adults ?? 0,
          children: occ.children?.length ?? 0,
          saleCop: o.saleCop != null ? Number(o.saleCop) : null,
          saleUsd: o.saleUsd != null ? Number(o.saleUsd) : null,
          selected: o.selected,
        };
      }),
    };
    return pdf;
  });

  if (!data) return new Response('No encontrada', { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(QuotePdf, { data }) as any);
  const filename = `${data.consecutivo ?? 'cotizacion'}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
