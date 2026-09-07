import { sql } from 'drizzle-orm';
import { db } from '@crm/db';

export const runtime = 'nodejs';

// Verificación del webhook (Meta): GET con hub.mode/hub.verify_token/hub.challenge.
export async function GET(req: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const res = (await db.execute(
    sql`select (config->>'verifyToken') as vt from channel_integrations
        where agency_id = ${agencyId}::uuid and channel = 'whatsapp' limit 1`,
  )) as unknown as { rows: Array<{ vt: string | null }> };
  const verifyToken = res.rows?.[0]?.vt;

  if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
    return new Response(challenge ?? '', { status: 200 });
  }
  return new Response('forbidden', { status: 403 });
}

// Mensajes entrantes.
export async function POST(req: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  try {
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        const contactName = value?.contacts?.[0]?.profile?.name ?? null;
        for (const m of value?.messages ?? []) {
          const body = m?.text?.body ?? m?.button?.text ?? '[mensaje no soportado]';
          await db.execute(sql`
            select ingest_inbound_message(
              ${agencyId}::uuid, 'whatsapp', ${String(m.from)},
              ${contactName}, ${String(m.from)},
              ${body}, ${String(m.id ?? '')}
            )
          `);
        }
      }
    }
  } catch (e) {
    return new Response('ingest error', { status: 500 });
  }
  return Response.json({ ok: true });
}
