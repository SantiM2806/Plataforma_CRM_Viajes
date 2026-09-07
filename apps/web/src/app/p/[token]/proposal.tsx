'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Check, Plane, CalendarDays, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { decideAction } from './actions';

const copFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export interface ProposalOption {
  id: string;
  label: string | null;
  hotelName: string | null;
  hotelCity: string | null;
  hotelStars: number | null;
  hotelImage: string | null;
  board: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  occupancy: { adults?: number; children?: number[] } | null;
  saleUsd: string | number | null;
  saleCop: string | number | null;
  selected: boolean;
}

export interface ProposalData {
  id: string;
  consecutivo: string | null;
  status: 'sent' | 'approved' | 'rejected' | 'expired';
  title: string | null;
  clientName: string | null;
  validUntil: string | null;
  expired: boolean;
  agency: { name: string; initials: string };
  options: ProposalOption[];
}

export function Proposal({ data, token }: { data: ProposalData; token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(
    data.options.find((o) => o.selected)?.id ?? data.options[0]?.id ?? null,
  );

  const decided = data.status === 'approved' || data.status === 'rejected';
  const expired = data.expired || data.status === 'expired';
  const interactive = data.status === 'sent' && !expired;

  function decide(decision: 'approve' | 'reject') {
    setError(null);
    startTransition(async () => {
      const res = await decideAction(token, decision === 'approve' ? choice : null, decision);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Plane className="h-4 w-4" />
          </span>
          <div>
            <p className="font-semibold leading-tight">{data.agency.name}</p>
            {data.consecutivo && <p className="text-xs text-muted-foreground">{data.consecutivo}</p>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data.title ?? 'Tu propuesta de viaje'}
          </h1>
          <p className="text-muted-foreground">
            Hola {data.clientName ?? ''}, aquí está tu propuesta.
            {data.validUntil && !decided && ` Válida hasta el ${data.validUntil}.`}
          </p>
        </div>

        {/* Estados finales */}
        {data.status === 'approved' && (
          <Banner tone="success">
            <Check className="h-5 w-5" /> ¡Propuesta aprobada! Tu agencia se pondrá en contacto para confirmar.
          </Banner>
        )}
        {data.status === 'rejected' && <Banner tone="muted">Propuesta rechazada.</Banner>}
        {expired && data.status !== 'approved' && (
          <Banner tone="warning">Esta propuesta venció. Contacta a tu agencia para una nueva.</Banner>
        )}

        {/* Opciones */}
        <div className="space-y-3">
          {data.options.map((o) => {
            const chosen = interactive ? choice === o.id : o.selected;
            const cop = o.saleCop != null ? copFmt.format(Number(o.saleCop)) : '—';
            return (
              <button
                key={o.id}
                type="button"
                disabled={!interactive}
                onClick={() => interactive && setChoice(o.id)}
                className={cn(
                  'flex w-full gap-4 rounded-xl border bg-card p-4 text-left transition-colors',
                  chosen ? 'border-primary ring-1 ring-primary' : 'border-border',
                  interactive && 'hover:border-primary/60',
                )}
              >
                {o.hotelImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.hotelImage} alt={o.hotelName ?? ''} className="h-24 w-32 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-24 w-32 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Plane className="h-6 w-6" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{o.hotelName}</p>
                    {o.hotelStars ? (
                      <span className="flex items-center gap-0.5 text-xs text-amber-500">
                        {o.hotelStars} <Star className="h-3 w-3 fill-current" />
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{o.hotelCity} · {o.board}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> {o.checkIn} → {o.checkOut} ({o.nights}N)
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {o.occupancy?.adults ?? 0} adulto(s)
                      {o.occupancy?.children?.length ? ` + ${o.occupancy.children.length} niño(s)` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between">
                  {chosen && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  <p className="text-lg font-bold">{cop}</p>
                </div>
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Acciones */}
        {interactive && (
          <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => decide('reject')} disabled={pending}>
              Rechazar
            </Button>
            <Button onClick={() => decide('approve')} disabled={pending || !choice}>
              {pending ? 'Procesando…' : 'Aprobar opción seleccionada'}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

function Banner({ tone, children }: { tone: 'success' | 'warning' | 'muted'; children: React.ReactNode }) {
  const cls = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    muted: 'bg-muted text-muted-foreground border-border',
  }[tone];
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium', cls)}>
      {children}
    </div>
  );
}
