'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { approveQuoteAction, rejectQuoteAction } from '../actions';

const copFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

interface Opt {
  id: string;
  hotelName: string | null;
  saleCop: string | null;
}

export function StatusActions({ quoteId, options }: { quoteId: string; options: Opt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optId, setOptId] = useState(options[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    start(async () => {
      try {
        const { reservationId } = await approveQuoteAction(quoteId, optId);
        router.push(`/reservations/${reservationId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al aprobar.');
      }
    });
  }

  function reject() {
    setError(null);
    start(async () => {
      await rejectQuoteAction(quoteId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Si el cliente confirmó (por chat, teléfono, etc.), márcala como aprobada: se crea la reserva.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {options.length > 1 && (
          <select
            value={optId}
            onChange={(e) => setOptId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.hotelName} {o.saleCop ? `· ${copFmt.format(Number(o.saleCop))}` : ''}
              </option>
            ))}
          </select>
        )}
        <Button onClick={approve} disabled={pending || !optId}>
          <CheckCircle2 className="h-4 w-4" /> Marcar aprobada
        </Button>
        <Button variant="outline" onClick={reject} disabled={pending}>
          <XCircle className="h-4 w-4 text-destructive" /> Rechazar
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
