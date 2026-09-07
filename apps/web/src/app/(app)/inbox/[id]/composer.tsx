'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  sendMessageAction,
  sendQuoteInChatAction,
  listSendableQuotesAction,
} from '../actions';

type Quote = { id: string; consecutivo: string | null; title: string | null; clientName: string | null };

export function Composer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (picker && quotes.length === 0) {
      listSendableQuotesAction().then(setQuotes).catch(() => {});
    }
  }, [picker, quotes.length]);

  function send() {
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await sendMessageAction(conversationId, text);
      if (res.error) setError(res.error);
      else setText('');
      router.refresh();
    });
  }

  function sendQuote(q: Quote) {
    setPicker(false);
    setError(null);
    startTransition(async () => {
      const res = await sendQuoteInChatAction(conversationId, q.id);
      if (res.error) setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="border-t bg-card p-3">
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <div className="relative flex items-end gap-2">
        <div className="relative">
          <Button type="button" variant="outline" size="icon" onClick={() => setPicker((v) => !v)} title="Adjuntar cotización">
            <FileText className="h-4 w-4" />
          </Button>
          {picker && (
            <div
              ref={pickerRef}
              className="absolute bottom-12 left-0 z-10 max-h-64 w-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
            >
              {quotes.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Sin cotizaciones enviadas.</p>
              ) : (
                quotes.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => sendQuote(q)}
                    className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-medium">{q.consecutivo}</span>
                    <span className="text-muted-foreground"> · {q.clientName ?? q.title ?? ''}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Escribe un mensaje…"
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="button" onClick={send} disabled={pending || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
