'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  setReservationStatusAction,
  updateReservationNotesAction,
  type ReservationStatus,
} from '../actions';

export function ManageReservation({
  id,
  status,
  providerConfirmation,
  notes,
}: {
  id: string;
  status: ReservationStatus;
  providerConfirmation: string | null;
  notes: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locator, setLocator] = useState(providerConfirmation ?? '');
  const [noteText, setNoteText] = useState(notes ?? '');
  const [savedNotes, setSavedNotes] = useState(false);

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  const canConfirm = status === 'pending';
  const canComplete = status === 'confirmed';
  const canCancel = status === 'pending' || status === 'confirmed';

  return (
    <div className="space-y-4">
      {(canConfirm || canComplete || canCancel) && (
        <div className="space-y-3">
          {canConfirm && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid flex-1 gap-1.5">
                <Label htmlFor="loc">Localizador del proveedor</Label>
                <Input
                  id="loc"
                  value={locator}
                  onChange={(e) => setLocator(e.target.value)}
                  placeholder="opcional"
                />
              </div>
              <Button
                disabled={pending}
                onClick={() => run(() => setReservationStatusAction(id, 'confirmed', locator))}
              >
                <CheckCircle2 className="h-4 w-4" /> Confirmar
              </Button>
            </div>
          )}

          <div className="flex gap-3">
            {canComplete && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => run(() => setReservationStatusAction(id, 'completed'))}
              >
                <Flag className="h-4 w-4" /> Marcar completada
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => run(() => setReservationStatusAction(id, 'cancelled'))}
              >
                <XCircle className="h-4 w-4 text-destructive" /> Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notas internas</Label>
        <textarea
          id="notes"
          value={noteText}
          onChange={(e) => {
            setNoteText(e.target.value);
            setSavedNotes(false);
          }}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(async () => {
                await updateReservationNotesAction(id, noteText);
                setSavedNotes(true);
              })
            }
          >
            Guardar notas
          </Button>
          {savedNotes && <span className="text-sm text-emerald-600">Guardado ✓</span>}
        </div>
      </div>
    </div>
  );
}
