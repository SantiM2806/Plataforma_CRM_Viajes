import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { Send, MessageCircle } from 'lucide-react';
import { getAppContext } from '@/lib/auth/session';
import { withUser, schema } from '@crm/db';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default async function InboxPage() {
  const { ctx } = await getAppContext();

  const convs = await withUser(ctx.userId, (tx) =>
    tx
      .select({
        id: schema.conversations.id,
        channel: schema.conversations.channel,
        contactName: schema.conversations.contactName,
        contactHandle: schema.conversations.contactHandle,
        preview: schema.conversations.lastMessagePreview,
        at: schema.conversations.lastMessageAt,
        unread: schema.conversations.unread,
        assigned: schema.conversations.assignedAgentId,
      })
      .from(schema.conversations)
      .orderBy(desc(schema.conversations.lastMessageAt))
      .limit(100),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-muted-foreground">{convs.length} conversación(es)</p>
      </div>

      <Card className="overflow-hidden">
        {convs.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Sin conversaciones. Configura un canal en Configuración y escribe al bot para probar.
          </div>
        ) : (
          <ul className="divide-y">
            {convs.map((c) => (
              <li key={c.id}>
                <Link href={`/inbox/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    {c.channel === 'telegram' ? <Send className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn('truncate', c.unread ? 'font-semibold' : 'font-medium')}>
                        {c.contactName ?? c.contactHandle ?? 'Contacto'}
                      </p>
                      {!c.assigned && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          Sin asignar
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{c.preview ?? ''}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">
                      {c.at ? new Date(c.at).toLocaleDateString('es-CO') : ''}
                    </span>
                    {c.unread && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
