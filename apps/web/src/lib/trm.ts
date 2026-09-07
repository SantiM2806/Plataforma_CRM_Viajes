// TRM oficial (Banco de la República) vía datos.gov.co (Socrata).
// Recurso 32sa-8pi3: campos valor, unidad, vigenciadesde, vigenciahasta.
import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@crm/db';

const SOURCE_URL = process.env.TRM_SOURCE_URL ?? 'https://www.datos.gov.co/resource/32sa-8pi3.json';

export interface Trm {
  rate: number; // COP por 1 USD
  rateDate: string; // YYYY-MM-DD (vigenciadesde)
  source: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * TRM vigente para una fecha (por defecto hoy). Consulta la fila cuya vigencia
 * cubre la fecha; si la API falla, cae al último valor guardado en exchange_rates.
 */
async function fetchTrmRow(onDate: string): Promise<{ valor: string; vigenciadesde: string } | null> {
  const qs = [
    `$where=${encodeURIComponent(`vigenciadesde <= '${onDate}T00:00:00.000'`)}`,
    `$order=${encodeURIComponent('vigenciadesde DESC')}`,
    `$limit=1`,
  ].join('&');
  const res = await fetch(`${SOURCE_URL}?${qs}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`datos.gov.co ${res.status}`);
  const rows = (await res.json()) as Array<{ valor: string; vigenciadesde: string }>;
  return rows[0] ?? null;
}

export async function getTrm(onDate: string = isoDate(new Date())): Promise<Trm> {
  try {
    const row = await fetchTrmRow(onDate);
    if (!row) throw new Error('Sin TRM para la fecha');

    const rate = Number(row.valor);
    const rateDate = row.vigenciadesde.slice(0, 10);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('TRM inválida');

    await upsertRate({ rate, rateDate, source: 'BANREP' });
    return { rate, rateDate, source: 'BANREP' };
  } catch (err) {
    // Fallback: última TRM persistida.
    const fallback = await latestStoredRate();
    if (fallback) return fallback;
    throw new Error(
      `No se pudo obtener la TRM y no hay valor previo guardado. Causa: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

async function upsertRate(t: Trm): Promise<void> {
  await db.execute(sql`
    insert into exchange_rates (rate_date, base_currency, quote_currency, rate, source)
    values (${t.rateDate}, 'USD', 'COP', ${t.rate}, ${t.source})
    on conflict (rate_date, base_currency, quote_currency)
      do update set rate = excluded.rate, fetched_at = now()
  `);
}

async function latestStoredRate(): Promise<Trm | null> {
  const rows = (await db.execute(sql`
    select rate_date, rate, source from exchange_rates
    where base_currency = 'USD' and quote_currency = 'COP'
    order by rate_date desc limit 1
  `)) as unknown as { rows: Array<{ rate_date: string; rate: string; source: string }> };
  const r = rows.rows?.[0];
  if (!r) return null;
  return { rate: Number(r.rate), rateDate: String(r.rate_date).slice(0, 10), source: r.source };
}
