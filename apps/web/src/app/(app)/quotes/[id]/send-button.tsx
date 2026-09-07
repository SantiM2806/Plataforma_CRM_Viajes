'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sendQuoteAction } from '../actions';

export function SendButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSend() {
    setError(null);
    startTransition(async () => {
      try {
        await sendQuoteAction(quoteId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al enviar.');
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={onSend} disabled={pending}>
        <Send className="h-4 w-4" />
        {pending ? 'Enviando…' : 'Enviar cotización'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
