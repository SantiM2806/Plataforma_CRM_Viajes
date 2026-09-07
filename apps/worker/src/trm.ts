import { sql } from 'drizzle-orm';
import { db } from '@crm/db';

const SOURCE_URL = process.env.TRM_SOURCE_URL ?? 'https://www.datos.gov.co/resource/32sa-8pi3.json';

/** Obtiene la TRM vigente (BanRep vía datos.gov.co) y la persiste en exchange_rates. */
export async function refreshTrm(): Promise<{ rate: number; rateDate: string }> {
  const onDate = new Date().toISOString().slice(0, 10);
  const qs = [
    `$where=${encodeURIComponent(`vigenciadesde <= '${onDate}T00:00:00.000'`)}`,
    `$order=${encodeURIComponent('vigenciadesde DESC')}`,
    `$limit=1`,
  ].join('&');

  const res = await fetch(`${SOURCE_URL}?${qs}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`datos.gov.co ${res.status}`);
  const rows = (await res.json()) as Array<{ valor: string; vigenciadesde: string }>;
  const row = rows[0];
  if (!row) throw new Error('Sin TRM disponible');

  const rate = Number(row.valor);
  const rateDate = String(row.vigenciadesde).slice(0, 10);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('TRM inválida');

  await db.execute(sql`
    insert into exchange_rates (rate_date, base_currency, quote_currency, rate, source)
    values (${rateDate}, 'USD', 'COP', ${rate}, 'BANREP')
    on conflict (rate_date, base_currency, quote_currency)
      do update set rate = excluded.rate, fetched_at = now()
  `);

  return { rate, rateDate };
}
