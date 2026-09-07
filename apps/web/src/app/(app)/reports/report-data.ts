import 'server-only';
import { and, between, desc, eq, inArray } from 'drizzle-orm';
import { withUser, schema, type Db } from '@travelkit/db';

export interface ReportRow {
  consecutivo: string | null;
  date: string; // ISO
  clientName: string | null;
  clientTaxId: string | null;
  hotelName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  costoCop: number;
  markupCop: number;
  feeCop: number;
  ventaCop: number;
  trm: number | null;
}

export interface Report {
  rows: ReportRow[];
  totals: { costoCop: number; markupCop: number; feeCop: number; ventaCop: number; count: number };
  from: string;
  to: string;
}

const r0 = (n: number) => Math.round(n);

/** Conciliación de ventas efectivas (reservas confirmadas/completadas) en un rango. */
export async function getReport(
  userId: string,
  agencyId: string,
  from: Date,
  to: Date,
): Promise<Report> {
  const rows = await withUser(userId, (tx: Db) =>
    tx
      .select({
        consecutivo: schema.reservations.consecutivo,
        date: schema.reservations.createdAt,
        clientName: schema.reservations.clientName,
        clientTaxId: schema.reservations.clientTaxId,
        hotelName: schema.reservations.hotelName,
        checkIn: schema.reservations.checkIn,
        checkOut: schema.reservations.checkOut,
        status: schema.reservations.status,
        netUsd: schema.reservations.netCostUsd,
        saleCop: schema.reservations.saleCop,
        trm: schema.reservations.trmCopPerUsd,
        markupPercent: schema.quoteOptions.markupPercent,
        markupFixed: schema.quoteOptions.markupFixedUsd,
        feePercent: schema.quoteOptions.bankFeePercent,
      })
      .from(schema.reservations)
      .leftJoin(schema.quoteOptions, eq(schema.quoteOptions.id, schema.reservations.quoteOptionId))
      .where(
        and(
          eq(schema.reservations.agencyId, agencyId),
          inArray(schema.reservations.status, ['confirmed', 'completed']),
          between(schema.reservations.createdAt, from, to),
        ),
      )
      .orderBy(desc(schema.reservations.createdAt)),
  );

  const out: ReportRow[] = rows.map((r) => {
    const trm = r.trm != null ? Number(r.trm) : null;
    const netUsd = Number(r.netUsd ?? 0);
    const ventaCop = Number(r.saleCop ?? 0);
    const costoCop = trm ? r0(netUsd * trm) : 0;

    let feeCop = 0;
    let markupCop = 0;
    if (r.feePercent != null || r.markupPercent != null) {
      const feeUsd = netUsd * (Number(r.feePercent ?? 0) / 100);
      const markupUsd = netUsd * (Number(r.markupPercent ?? 0) / 100) + Number(r.markupFixed ?? 0);
      feeCop = trm ? r0(feeUsd * trm) : 0;
      markupCop = trm ? r0(markupUsd * trm) : 0;
    } else {
      // Sin desglose (reserva sin opción vinculada): margen total como markup.
      markupCop = Math.max(ventaCop - costoCop, 0);
    }

    return {
      consecutivo: r.consecutivo,
      date: new Date(r.date).toISOString(),
      clientName: r.clientName,
      clientTaxId: r.clientTaxId,
      hotelName: r.hotelName,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      status: r.status,
      costoCop,
      markupCop,
      feeCop,
      ventaCop,
      trm,
    };
  });

  const totals = out.reduce(
    (acc, r) => ({
      costoCop: acc.costoCop + r.costoCop,
      markupCop: acc.markupCop + r.markupCop,
      feeCop: acc.feeCop + r.feeCop,
      ventaCop: acc.ventaCop + r.ventaCop,
      count: acc.count + 1,
    }),
    { costoCop: 0, markupCop: 0, feeCop: 0, ventaCop: 0, count: 0 },
  );

  return {
    rows: out,
    totals,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** Rango por defecto: del primer día del mes a hoy. */
export function defaultRange(fromParam?: string, toParam?: string): { from: Date; to: Date } {
  const now = new Date();
  const from = fromParam
    ? new Date(`${fromParam}T00:00:00`)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toParam ? new Date(`${toParam}T23:59:59.999`) : now;
  return { from, to };
}
