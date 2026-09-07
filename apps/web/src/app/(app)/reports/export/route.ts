import { getAppContext, roleInAgency } from '@/lib/auth/session';
import { getReport, defaultRange } from '../report-data';

export const runtime = 'nodejs';

function csvCell(v: string | number | null): string {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const { ctx, active } = await getAppContext();
  const role = active ? roleInAgency(ctx, active.id) : null;
  const canSee = ctx.isPlatformAdmin || role === 'admin_agencia' || role === 'contable';
  if (!canSee || !active) return new Response('No autorizado', { status: 403 });

  const url = new URL(req.url);
  const { from, to } = defaultRange(url.searchParams.get('from') ?? undefined, url.searchParams.get('to') ?? undefined);
  const report = await getReport(ctx.userId, active.id, from, to);

  const header = [
    'Consecutivo',
    'Fecha',
    'Cliente',
    'Documento',
    'Hotel',
    'CheckIn',
    'CheckOut',
    'Estado',
    'Costo_COP',
    'Markup_COP',
    'Fee_COP',
    'Venta_COP',
    'TRM',
  ];
  const lines = [header.join(',')];
  for (const r of report.rows) {
    lines.push(
      [
        r.consecutivo,
        r.date.slice(0, 10),
        r.clientName,
        r.clientTaxId,
        r.hotelName,
        r.checkIn,
        r.checkOut,
        r.status,
        r.costoCop,
        r.markupCop,
        r.feeCop,
        r.ventaCop,
        r.trm ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  // Totales
  lines.push(
    ['TOTALES', '', '', '', '', '', '', '', report.totals.costoCop, report.totals.markupCop, report.totals.feeCop, report.totals.ventaCop, '']
      .map(csvCell)
      .join(','),
  );

  const csv = '﻿' + lines.join('\n'); // BOM para Excel
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="conciliacion_${report.from}_${report.to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
