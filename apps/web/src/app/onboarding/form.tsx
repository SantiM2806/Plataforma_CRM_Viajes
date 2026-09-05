'use client';

import { useActionState } from 'react';
import { createAgencyAction, type OnboardState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function OnboardingForm() {
  const [state, action, pending] = useActionState<OnboardState, FormData>(createAgencyAction, {});

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Nombre de la agencia</Label>
        <Input id="name" name="name" placeholder="Agencia de Viajes AVM" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="initials">Iniciales (prefijo de consecutivos)</Label>
        <Input
          id="initials"
          name="initials"
          placeholder="AVM"
          maxLength={6}
          className="uppercase"
          required
        />
        <p className="text-xs text-muted-foreground">2–6 letras/números. Ej: tus cotizaciones serán COT-AVM-0001.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tax_id">NIT (opcional)</Label>
        <Input id="tax_id" name="tax_id" placeholder="900123456-7" />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Creando agencia…' : 'Crear agencia y continuar'}
      </Button>
    </form>
  );
}
