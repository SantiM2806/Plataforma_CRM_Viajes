import { notFound, redirect } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { getAppContext } from '@/lib/auth/session';
import { withUser, schema } from '@crm/db';
import { QuoteBuilder, type AddedOption } from '../../new/builder';

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getAppContext();

  const data = await withUser(ctx.userId, async (tx) => {
    const [q] = await tx.select().from(schema.quotes).where(eq(schema.quotes.id, id)).limit(1);
    if (!q) return null;
    const opts = await tx
      .select()
      .from(schema.quoteOptions)
      .where(eq(schema.quoteOptions.quoteId, id))
      .orderBy(asc(schema.quoteOptions.position));
    return { q, opts };
  });

  if (!data) notFound();
  if (data.q.status !== 'draft') redirect(`/quotes/${id}`);

  const options: AddedOption[] = data.opts.map((o) => {
    const ref = (o.providerRef ?? {}) as { hotelId?: string };
    return {
      label: o.label ?? undefined,
      provider: o.provider,
      providerRef: o.providerRef ?? undefined,
      hotelId: ref.hotelId,
      hotelName: o.hotelName ?? undefined,
      hotelCity: o.hotelCity ?? undefined,
      hotelStars: o.hotelStars ?? undefined,
      hotelImage: o.hotelImage ?? undefined,
      checkin: o.checkIn ?? '',
      checkout: o.checkOut ?? '',
      occupancy: (o.occupancy as { adults: number; children: number[] }) ?? { adults: 0, children: [] },
      board: o.board ?? undefined,
      netCostUsd: Number(o.netCostUsd),
      saleUsd: Number(o.saleUsd),
      saleCop: o.saleCop != null ? Number(o.saleCop) : null,
      roomName: o.board ?? undefined,
    };
  });

  return (
    <QuoteBuilder
      initial={{
        quoteId: id,
        title: data.q.title ?? undefined,
        clientName: data.q.clientName ?? undefined,
        clientEmail: data.q.clientEmail ?? undefined,
        clientPhone: data.q.clientPhone ?? undefined,
        clientTaxId: data.q.clientTaxId ?? undefined,
        options,
      }}
    />
  );
}
