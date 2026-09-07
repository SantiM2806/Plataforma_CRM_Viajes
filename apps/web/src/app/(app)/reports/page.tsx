import { Download } from 'lucide-react';
import { getAppContext, roleInAgency } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getReport, defaultRange } from './report-data';

const copFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { ctx, active } = await getAppContext();
  const role = active ? roleInAgency(ctx, active.id) : null;
  const canSee = ctx.isPlatformAdmin || role === 'admin_agencia' || role === 'contable';

  if (!canSee || !active) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Reportes</CardTitle>
            <CardDescription>Solo el administrador o el contable de la agencia pueden ver la reportería.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const { from, to } = defaultRange(sp.from, sp.to);
  const report = await getReport(ctx.userId, active.id, from, to);
  const qs = `from=${report.from}&to=${report.to}`;

  const cards = [
    { label: 'Ventas', value: String(report.totals.count) },
    { label: 'Venta total', value: copFmt.format(report.totals.ventaCop) },
    { label: 'Costo proveedor', value: copFmt.format(report.totals.costoCop) },
    { label: 'Markup (utilidad)', value: copFmt.format(report.totals.markupCop) },
    { label: 'Fee bancario', value: copFmt.format(report.totals.feeCop) },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reportes y conciliación</h1>
          <p className="text-muted-foreground">Ventas efectivas (reservas confirmadas/completadas)</p>
        </div>
        <div className="flex items-end gap-2">
          <form className="flex items-end gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Desde
              <input type="date" name="from" defaultValue={report.from} className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Hasta
              <input type="date" name="to" defaultValue={report.to} className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
            </label>
            <Button type="submit" variant="outline">Filtrar</Button>
          </form>
          <Button asChild>
            <a href={`/reports/export?${qs}`}>
              <Download className="h-4 w-4" /> CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <p className="text-xs uppercase text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-lg font-bold tracking-tight">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {report.rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Sin ventas efectivas en el rango seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Reserva</th>
                  <th className="px-3 py-3 font-medium">Fecha</th>
                  <th className="px-3 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 font-medium">Hotel</th>
                  <th className="px-3 py-3 text-right font-medium">Costo</th>
                  <th className="px-3 py-3 text-right font-medium">Markup</th>
                  <th className="px-3 py-3 text-right font-medium">Fee</th>
                  <th className="px-3 py-3 text-right font-medium">Venta</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{r.consecutivo}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(r.date).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-3 py-2">
                      {r.clientName}
                      {r.clientTaxId ? <span className="block text-xs text-muted-foreground">{r.clientTaxId}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.hotelName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{copFmt.format(r.costoCop)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{copFmt.format(r.markupCop)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{copFmt.format(r.feeCop)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{copFmt.format(r.ventaCop)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
