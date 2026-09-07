import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { getAppContext } from '@/lib/auth/session';
import { withUser, schema } from '@crm/db';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { RES_STATUS } from './status';

const copFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export default async function ReservationsPage() {
  const { ctx } = await getAppContext();

  const rows = await withUser(ctx.userId, (tx) =>
    tx
      .select({
        id: schema.reservations.id,
        consecutivo: schema.reservations.consecutivo,
        status: schema.reservations.status,
        clientName: schema.reservations.clientName,
        hotelName: schema.reservations.hotelName,
        checkIn: schema.reservations.checkIn,
        checkOut: schema.reservations.checkOut,
        saleCop: schema.reservations.saleCop,
      })
      .from(schema.reservations)
      .orderBy(desc(schema.reservations.createdAt))
      .limit(100),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reservas</h1>
        <p className="text-muted-foreground">
          {rows.length} en total · se crean al aprobar una cotización
        </p>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Aún no hay reservas. Cuando un cliente apruebe una cotización, aparecerá aquí.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Reserva</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Hotel</th>
                  <th className="px-4 py-3 font-medium">Fechas</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Venta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = RES_STATUS[r.status] ?? RES_STATUS.pending;
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/reservations/${r.id}`} className="font-medium text-primary hover:underline">
                          {r.consecutivo ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{r.clientName ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.hotelName ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.checkIn} → {r.checkOut}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', s.cls)}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {r.saleCop ? copFmt.format(Number(r.saleCop)) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
