'use client';

import { useActionState } from 'react';
import { updateAgencyPricingAction, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PricingForm({
  bankFeePercent,
  quoteValidityDays,
}: {
  bankFeePercent: number;
  quoteValidityDays: number;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateAgencyPricingAction,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Parámetros generales</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-wrap items-end gap-4">
          <div className="grid w-40 gap-1.5">
            <Label htmlFor="bf">Fee bancario (%)</Label>
            <Input
              id="bf"
              name="bankFeePercent"
              type="number"
              step="0.001"
              min="0"
              defaultValue={bankFeePercent}
            />
          </div>
          <div className="grid w-40 gap-1.5">
            <Label htmlFor="vd">Validez (días)</Label>
            <Input id="vd" name="quoteValidityDays" type="number" min="1" defaultValue={quoteValidityDays} />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
          {state.ok && <span className="text-sm text-emerald-600">Guardado ✓</span>}
          {state.error && <span className="text-sm text-destructive">{state.error}</span>}
        </form>
      </CardContent>
    </Card>
  );
}
