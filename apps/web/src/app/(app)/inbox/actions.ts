'use server';

import { revalidatePath } from 'next/cache';
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { withUser, schema, type Db } from '@travelkit/db';
import { getSessionContext } from '@/lib/auth/session';
import { sendViaChannel, type Channel, type ChannelConfig } from '@/lib/channels';

const BASE_URL =
  process.env.APP_BASE_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000';

async function requireUser(): Promise<string> {
  const c = await getSessionContext();
  if (!c) throw new Error('No autenticado');
  return c.userId;
}

interface Delivery {
  conversationId: string;
  channel: Channel;
  externalId: string;
  agencyId: string;
  body: string;
  kind: 'text' | 'quote';
  quoteId?: string;
}

/**
 * Inserta el mensaje saliente, asigna la conversación al agente si estaba libre,
 * intenta entregar por el canal y marca el resultado.
 */
async function postOutbound(userId: string, d: Delivery): Promise<{ error?: string }> {
  // 1) Persistir mensaje + actualizar conversación.
  const { messageId, config } = await withUser(userId, async (tx: Db) => {
    const [msg] = await tx
      .insert(schema.messages)
      .values({
        conversationId: d.conversationId,
        direction: 'outbound',
        kind: d.kind,
        body: d.body,
        quoteId: d.quoteId ?? null,
        senderUserId: userId,
        delivered: false,
      })
      .returning({ id: schema.messages.id });

    await tx
      .update(schema.conversations)
      .set({
        lastMessageAt: sql`now()`,
        lastMessagePreview: d.body.slice(0, 140),
        unread: false,
        assignedAgentId: sql`coalesce(assigned_agent_id, ${userId}::uuid)`,
      })
      .where(eq(schema.conversations.id, d.conversationId));

    const [ci] = await tx
      .select({ config: schema.channelIntegrations.config, active: schema.channelIntegrations.active })
      .from(schema.channelIntegrations)
      .where(
        and(
          eq(schema.channelIntegrations.agencyId, d.agencyId),
          eq(schema.channelIntegrations.channel, d.channel),
        ),
      )
      .limit(1);

    return { messageId: msg.id, config: ci?.active ? (ci.config as ChannelConfig) : null };
  });

  // 2) Entregar por el canal (fuera de la transacción).
  if (!config) {
    return { error: `Mensaje guardado, pero el canal ${d.channel} no está configurado/activo.` };
  }
  try {
    const extId = await sendViaChannel(d.channel, config, d.externalId, d.body);
    await withUser(userId, (tx: Db) =>
      tx
        .update(schema.messages)
        .set({ delivered: true, externalMessageId: extId })
        .where(eq(schema.messages.id, messageId)),
    );
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo entregar el mensaje.' };
  }
}

async function loadConversation(userId: string, conversationId: string) {
  const [c] = await withUser(userId, (tx: Db) =>
    tx
      .select({
        id: schema.conversations.id,
        agencyId: schema.conversations.agencyId,
        channel: schema.conversations.channel,
        externalId: schema.conversations.externalId,
      })
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .limit(1),
  );
  if (!c) throw new Error('Conversación no encontrada');
  return c;
}

export async function sendMessageAction(
  conversationId: string,
  body: string,
): Promise<{ error?: string }> {
  const userId = await requireUser();
  const text = body.trim();
  if (!text) return { error: 'Escribe un mensaje.' };
  const conv = await loadConversation(userId, conversationId);
  const res = await postOutbound(userId, {
    conversationId: conv.id,
    channel: conv.channel as Channel,
    externalId: conv.externalId,
    agencyId: conv.agencyId,
    body: text,
    kind: 'text',
  });
  revalidatePath(`/inbox/${conversationId}`);
  revalidatePath('/inbox');
  return res;
}

export async function sendQuoteInChatAction(
  conversationId: string,
  quoteId: string,
): Promise<{ error?: string }> {
  const userId = await requireUser();
  const conv = await loadConversation(userId, conversationId);

  const [q] = await withUser(userId, (tx: Db) =>
    tx
      .select({
        consecutivo: schema.quotes.consecutivo,
        title: schema.quotes.title,
        publicToken: schema.quotes.publicToken,
      })
      .from(schema.quotes)
      .where(eq(schema.quotes.id, quoteId))
      .limit(1),
  );
  if (!q?.publicToken) return { error: 'La cotización debe estar enviada (con enlace público).' };

  const body = `${q.title ?? 'Cotización'} ${q.consecutivo ?? ''}\nMira tu propuesta: ${BASE_URL}/p/${q.publicToken}`;
  const res = await postOutbound(userId, {
    conversationId: conv.id,
    channel: conv.channel as Channel,
    externalId: conv.externalId,
    agencyId: conv.agencyId,
    body,
    kind: 'quote',
    quoteId,
  });
  revalidatePath(`/inbox/${conversationId}`);
  return res;
}

export async function claimConversationAction(conversationId: string): Promise<void> {
  const userId = await requireUser();
  await withUser(userId, (tx: Db) =>
    tx
      .update(schema.conversations)
      .set({ assignedAgentId: userId })
      .where(eq(schema.conversations.id, conversationId)),
  );
  revalidatePath(`/inbox/${conversationId}`);
  revalidatePath('/inbox');
}

export async function listSendableQuotesAction(): Promise<
  Array<{ id: string; consecutivo: string | null; title: string | null; clientName: string | null }>
> {
  const userId = await requireUser();
  return withUser(userId, (tx: Db) =>
    tx
      .select({
        id: schema.quotes.id,
        consecutivo: schema.quotes.consecutivo,
        title: schema.quotes.title,
        clientName: schema.quotes.clientName,
      })
      .from(schema.quotes)
      .where(and(inArray(schema.quotes.status, ['sent', 'approved']), isNotNull(schema.quotes.publicToken)))
      .orderBy(desc(schema.quotes.createdAt))
      .limit(50),
  );
}
