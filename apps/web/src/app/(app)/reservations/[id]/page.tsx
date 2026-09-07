import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getAppContext } from '@/lib/auth/session';
import { withUser, schema } from '@travelkit/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ManageReservation } from './manage';
import { RES_STATUS } from '../status';

const copFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ctx } = await getAppContext();

  const [r] = await withUser(ctx.userId, (tx) =>
    tx.select().from(schema.reservations).where(eq(schema.reservations.id, id)).limit(1),
  );
  if (!r) notFound();

  const s = RES_STATUS[r.status] ?? RES_STATUS.pending;
  const occ = (r.occupancy ?? {}) as { adults?: number; children?: number[] };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{r.consecutivo ?? 'Reserva'}</h1>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', s.cls)}>{s.label}</span>
        {r.quoteId && (
          <Link href={`/quotes/${r.quoteId}`} className="ml-auto text-sm text-primary hover:underline">
            Ver cotización
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{r.clientName ?? '—'}</p>
            {r.clientEmail && <p className="text-muted-foreground">{r.clientEmail}</p>}
            {r.clientPhone && <p className="text-muted-foreground">{r.clientPhone}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reserva</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{r.hotelName}</p>
            <p className="text-muted-foreground">
              {r.hotelCity} · {r.board}
            </p>
            <p className="text-muted-foreground">
              {r.checkIn} → {r.checkOut} · {occ.adults ?? 0} adulto(s)
              {occ.children?.length ? ` + ${occ.children.length} niño(s)` : ''}
            </p>
            <p className="pt-1 font-semibold">
              {r.saleCop ? copFmt.format(Number(r.saleCop)) : '—'}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {r.saleUsd ? usdFmt.format(Number(r.saleUsd)) : ''}
              </span>
            </p>
            {r.providerConfirmation && (
              <p className="text-muted-foreground">Localizador: {r.providerConfirmation}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gestión</CardTitle>
        </CardHeader>
        <CardContent>
          <ManageReservation
            id={r.id}
            status={r.status}
            providerConfirmation={r.providerConfirmation}
            notes={r.notes}
          />
        </CardContent>
      </Card>
    </div>
  );
}
