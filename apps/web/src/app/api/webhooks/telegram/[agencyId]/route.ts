import { sql } from 'drizzle-orm';
import { db } from '@travelkit/db';

export const runtime = 'nodejs';

// Configura el webhook en Telegram apuntando a:
//   https://TU_DOMINIO/api/webhooks/telegram/<AGENCY_ID>
export async function POST(req: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const msg = update?.message ?? update?.edited_message;
  const text: string | undefined = msg?.text;
  const chat = msg?.chat;
  if (!msg || !chat || !text) {
    return Response.json({ ok: true }); // ignoramos updates sin texto
  }

  const contactName = [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || null;

  try {
    await db.execute(sql`
      select ingest_inbound_message(
        ${agencyId}::uuid, 'telegram', ${String(chat.id)},
        ${contactName}, ${chat.username ?? null},
        ${text}, ${String(msg.message_id ?? '')}
      )
    `);
  } catch (e) {
    return new Response('ingest error', { status: 500 });
  }
  return Response.json({ ok: true });
}
