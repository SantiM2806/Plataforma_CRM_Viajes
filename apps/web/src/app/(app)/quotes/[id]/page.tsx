import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { getAppContext } from '@/lib/auth/session';
import { withUser, schema } from '@travelkit/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SendButton } from './send-button';

const copFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-muted text-muted-foreground' },
  sent: { label: 'Enviada', cls: 'bg-primary/10 text-primary' },
  approved: { label: 'Aprobada', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazada', cls: 'bg-destructive/10 text-destructive' },
  expired: { label: 'Vencida', cls: 'bg-amber-100 text-amber-700' },
};

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
  const { q, opts } = data;
  const s = STATUS[q.status] ?? STATUS.draft;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {q.consecutivo ?? 'Borrador sin enviar'}
            </h1>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', s.cls)}>{s.label}</span>
          </div>
          {q.title && <p className="text-muted-foreground">{q.title}</p>}
        </div>
        {q.status === 'draft' && <SendButton quoteId={q.id} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{q.clientName ?? '—'}</p>
            {q.clientEmail && <p className="text-muted-foreground">{q.clientEmail}</p>}
            {q.clientPhone && <p className="text-muted-foreground">{q.clientPhone}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            {q.trmCopPerUsd ? (
              <p>TRM: {copFmt.format(Number(q.trmCopPerUsd))} / USD ({q.trmDate})</p>
            ) : (
              <p>TRM: se congela al enviar</p>
            )}
            {q.validUntil && <p>Válida hasta: {q.validUntil}</p>}
            {q.publicToken && (
              <p className="break-all">
                Propuesta pública:{' '}
                <a href={`/p/${q.publicToken}`} target="_blank" className="text-primary hover:underline">
                  /p/{q.publicToken}
                </a>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Opciones ({opts.length})</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Hotel</th>
                <th className="px-4 py-2 font-medium">Estadía</th>
                <th className="px-4 py-2 font-medium">Ocupación</th>
                <th className="px-4 py-2 text-right font-medium">Precio</th>
              </tr>
            </thead>
            <tbody>
              {opts.map((o) => {
                const occ = (o.occupancy ?? {}) as { adults?: number; children?: number[] };
                return (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{o.hotelName}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.board} {o.hotelStars ? `· ${o.hotelStars}★` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.checkIn} → {o.checkOut}
                      <br />
                      <span className="text-xs">{o.nights} noche(s)</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {occ.adults ?? 0} ad{occ.children?.length ? ` + ${occ.children.length} niño(s)` : ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold">
                        {o.saleCop ? copFmt.format(Number(o.saleCop)) : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">{usdFmt.format(Number(o.saleUsd))}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
