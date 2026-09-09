import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { getAppContext } from '@/lib/auth/session';
import { withUser, schema } from '@crm/db';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-muted text-muted-foreground' },
  sent: { label: 'Enviada', cls: 'bg-sky-100 text-sky-700' },
  approved: { label: 'Aprobada', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazada', cls: 'bg-destructive/10 text-destructive' },
  expired: { label: 'Vencida', cls: 'bg-amber-100 text-amber-700' },
};

const TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'draft', label: 'Borradores' },
  { key: 'sent', label: 'Enviadas' },
  { key: 'approved', label: 'Aprobadas' },
  { key: 'rejected', label: 'Rechazadas' },
  { key: 'expired', label: 'Vencidas' },
];

type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { ctx } = await getAppContext();
  const sp = await searchParams;
  const active = TABS.some((t) => t.key === sp.status) ? (sp.status as string) : 'all';

  const rows = await withUser(ctx.userId, (tx) => {
    const base = tx
      .select({
        id: schema.quotes.id,
        consecutivo: schema.quotes.consecutivo,
        status: schema.quotes.status,
        title: schema.quotes.title,
        clientName: schema.quotes.clientName,
        createdAt: schema.quotes.createdAt,
      })
      .from(schema.quotes);
    const filtered =
      active === 'all'
        ? base
        : base.where(and(eq(schema.quotes.status, active as QuoteStatus)));
    return filtered.orderBy(desc(schema.quotes.createdAt)).limit(200);
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cotizaciones</h1>
          <p className="text-muted-foreground">{rows.length} {active === 'all' ? 'en total' : 'en este estado'}</p>
        </div>
        <Button asChild>
          <Link href="/quotes/new">Nueva cotización</Link>
        </Button>
      </div>

      {/* Filtros por estado */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === 'all' ? '/quotes' : `/quotes?status=${t.key}`}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              active === t.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No hay cotizaciones {active === 'all' ? 'todavía' : 'en este estado'}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Consecutivo</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Título</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Creada</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => {
                  const s = STATUS[q.status] ?? STATUS.draft;
                  return (
                    <tr key={q.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/quotes/${q.id}`} className="font-medium text-foreground hover:underline">
                          {q.consecutivo ?? '— (borrador)'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{q.clientName ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{q.title ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', s.cls)}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(q.createdAt).toLocaleDateString('es-CO')}
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
