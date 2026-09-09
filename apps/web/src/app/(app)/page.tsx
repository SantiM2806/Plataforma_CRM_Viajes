import Link from 'next/link';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { FileText, Send, CheckCircle2, CalendarCheck, TrendingUp, Plus } from 'lucide-react';
import { getAppContext } from '@/lib/auth/session';
import { withUser, schema } from '@crm/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const copFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const QUOTE_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-muted text-muted-foreground' },
  sent: { label: 'Enviada', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Aprobada', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazada', cls: 'bg-destructive/10 text-destructive' },
  expired: { label: 'Vencida', cls: 'bg-muted text-muted-foreground' },
};
const RES_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Por confirmar', cls: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmada', cls: 'bg-emerald-100 text-emerald-700' },
  completed: { label: 'Completada', cls: 'bg-primary/15 text-foreground' },
  cancelled: { label: 'Cancelada', cls: 'bg-destructive/10 text-destructive' },
};

export default async function HomePage() {
  const { ctx, active } = await getAppContext();

  if (!active) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Bienvenido</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {ctx.isPlatformAdmin
              ? 'Aún no hay agencias. Crea o selecciona una para ver el panel.'
              : 'Sin agencia activa.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = await withUser(ctx.userId, async (tx) => {
    const qc = await tx
      .select({ status: schema.quotes.status, n: sql<number>`count(*)::int` })
      .from(schema.quotes)
      .where(eq(schema.quotes.agencyId, active.id))
      .groupBy(schema.quotes.status);

    const [resActive] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.reservations)
      .where(
        and(
          eq(schema.reservations.agencyId, active.id),
          inArray(schema.reservations.status, ['pending', 'confirmed']),
        ),
      );

    const [sales] = await tx
      .select({ total: sql<string>`coalesce(sum(sale_cop), 0)` })
      .from(schema.reservations)
      .where(
        and(
          eq(schema.reservations.agencyId, active.id),
          inArray(schema.reservations.status, ['confirmed', 'completed']),
          sql`date_trunc('month', ${schema.reservations.createdAt}) = date_trunc('month', now())`,
        ),
      );

    const recentQuotes = await tx
      .select({
        id: schema.quotes.id,
        consecutivo: schema.quotes.consecutivo,
        clientName: schema.quotes.clientName,
        title: schema.quotes.title,
        status: schema.quotes.status,
      })
      .from(schema.quotes)
      .where(eq(schema.quotes.agencyId, active.id))
      .orderBy(desc(schema.quotes.createdAt))
      .limit(6);

    const recentRes = await tx
      .select({
        id: schema.reservations.id,
        consecutivo: schema.reservations.consecutivo,
        clientName: schema.reservations.clientName,
        status: schema.reservations.status,
        saleCop: schema.reservations.saleCop,
      })
      .from(schema.reservations)
      .where(eq(schema.reservations.agencyId, active.id))
      .orderBy(desc(schema.reservations.createdAt))
      .limit(6);

    return { qc, resActive: resActive?.n ?? 0, salesMonth: Number(sales?.total ?? 0), recentQuotes, recentRes };
  });

  const q = (s: string) => data.qc.find((x) => x.status === s)?.n ?? 0;

  const tiles = [
    { label: 'Borradores', value: String(q('draft')), icon: FileText },
    { label: 'Enviadas', value: String(q('sent')), icon: Send },
    { label: 'Aprobadas', value: String(q('approved')), icon: CheckCircle2 },
    { label: 'Reservas activas', value: String(data.resActive), icon: CalendarCheck },
    { label: 'Ventas del mes', value: copFmt.format(data.salesMonth), icon: TrendingUp, wide: true },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {active.name}</h1>
          <p className="text-muted-foreground">
            {ctx.isPlatformAdmin ? 'Vista de plataforma · ' : ''}Panel de la agencia
          </p>
        </div>
        <Button asChild>
          <Link href="/quotes/new">
            <Plus className="h-4 w-4" /> Nueva cotización
          </Link>
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label} className={cn(t.wide && 'col-span-2 sm:col-span-1')}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <t.icon className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">{t.label}</span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight">{t.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actividad reciente */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Cotizaciones recientes</CardTitle>
            <Link href="/quotes">
              <span className="text-sm font-medium text-muted-foreground hover:text-foreground">Ver todas</span>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {data.recentQuotes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay cotizaciones.</p>
            ) : (
              <ul className="divide-y">
                {data.recentQuotes.map((r) => {
                  const s = QUOTE_STATUS[r.status] ?? QUOTE_STATUS.draft;
                  return (
                    <li key={r.id}>
                      <Link href={`/quotes/${r.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {r.clientName ?? r.title ?? 'Sin cliente'}
                          </span>
                          <span className="block text-xs text-muted-foreground">{r.consecutivo ?? 'borrador'}</span>
                        </span>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', s.cls)}>{s.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Reservas recientes</CardTitle>
            <Link href="/reservations">
              <span className="text-sm font-medium text-muted-foreground hover:text-foreground">Ver todas</span>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {data.recentRes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay reservas.</p>
            ) : (
              <ul className="divide-y">
                {data.recentRes.map((r) => {
                  const s = RES_STATUS[r.status] ?? RES_STATUS.pending;
                  return (
                    <li key={r.id}>
                      <Link href={`/reservations/${r.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.clientName ?? 'Sin cliente'}</span>
                          <span className="block text-xs text-muted-foreground">{r.consecutivo}</span>
                        </span>
                        <span className="text-sm tabular-nums">
                          {r.saleCop ? copFmt.format(Number(r.saleCop)) : '—'}
                        </span>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', s.cls)}>{s.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
