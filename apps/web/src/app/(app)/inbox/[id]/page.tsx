import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { ArrowLeft, Send, MessageCircle } from 'lucide-react';
import { getAppContext } from '@/lib/auth/session';
import { withUser, schema } from '@crm/db';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Composer } from './composer';
import { claimConversationAction } from '../actions';

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getAppContext();

  const data = await withUser(ctx.userId, async (tx) => {
    const [c] = await tx.select().from(schema.conversations).where(eq(schema.conversations.id, id)).limit(1);
    if (!c) return null;
    const msgs = await tx
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, id))
      .orderBy(asc(schema.messages.createdAt));
    // marcar como leída
    if (c.unread) {
      await tx.update(schema.conversations).set({ unread: false }).where(eq(schema.conversations.id, id));
    }
    return { c, msgs };
  });

  if (!data) notFound();
  const { c, msgs } = data;
  const assigned = c.assignedAgentId === ctx.userId;

  async function claim() {
    'use server';
    await claimConversationAction(id);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem-4rem)] max-w-3xl flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b pb-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/inbox">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
          {c.channel === 'telegram' ? <Send className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        </span>
        <div className="flex-1">
          <p className="font-medium">{c.contactName ?? c.contactHandle ?? 'Contacto'}</p>
          <p className="text-xs capitalize text-muted-foreground">{c.channel}</p>
        </div>
        {!c.assignedAgentId && (
          <form action={claim}>
            <Button type="submit" variant="outline" size="sm">
              Reclamar
            </Button>
          </form>
        )}
        {assigned && <span className="text-xs text-muted-foreground">Asignada a ti</span>}
      </div>

      {/* Mensajes */}
      <div className="flex-1 space-y-2 overflow-y-auto py-4">
        {msgs.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Sin mensajes.</p>
        ) : (
          msgs.map((m) => {
            const out = m.direction === 'outbound';
            return (
              <div key={m.id} className={cn('flex', out ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[75%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
                    out ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {m.kind === 'quote' && (
                    <span className="mb-1 block text-[10px] font-semibold uppercase opacity-70">
                      Cotización
                    </span>
                  )}
                  {m.body}
                  <span className={cn('mt-1 block text-[10px]', out ? 'opacity-70' : 'text-muted-foreground')}>
                    {new Date(m.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    {out && !m.delivered ? ' · no entregado' : ''}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Composer conversationId={id} />
    </div>
  );
}
