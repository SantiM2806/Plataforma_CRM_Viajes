import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { getAppContext } from '@/lib/auth/session';
import { withUser, schema } from '@crm/db';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-muted text-muted-foreground' },
  sent: { label: 'Enviada', cls: 'bg-primary/10 text-primary' },
  approved: { label: 'Aprobada', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazada', cls: 'bg-destructive/10 text-destructive' },
  expired: { label: 'Vencida', cls: 'bg-amber-100 text-amber-700' },
};

export default async function QuotesPage() {
  const { ctx } = await getAppContext();

  const rows = await withUser(ctx.userId, (tx) =>
    tx
      .select({
        id: schema.quotes.id,
        consecutivo: schema.quotes.consecutivo,
        status: schema.quotes.status,
        title: schema.quotes.title,
        clientName: schema.quotes.clientName,
        createdAt: schema.quotes.createdAt,
      })
      .from(schema.quotes)
      .orderBy(desc(schema.quotes.createdAt))
      .limit(100),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cotizaciones</h1>
          <p className="text-muted-foreground">{rows.length} en total</p>
        </div>
        <Button asChild>
          <Link href="/quotes/new">Nueva cotización</Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Aún no hay cotizaciones. Crea la primera.
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
                        <Link href={`/quotes/${q.id}`} className="font-medium text-primary hover:underline">
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
