'use client';

import { useActionState } from 'react';
import { changeOwnPasswordAction, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AccountCard({ email, mustChange }: { email: string; mustChange: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(changeOwnPasswordAction, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tu cuenta</CardTitle>
        <CardDescription>
          {email}
          {mustChange && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Cambia tu contraseña temporal
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-wrap items-end gap-3">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="np">Nueva contraseña</Label>
            <Input id="np" name="password" type="password" required autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
          {state.ok && <span className="text-sm text-emerald-600">Actualizada ✓</span>}
          {state.error && <span className="w-full text-sm text-destructive">{state.error}</span>}
        </form>
      </CardContent>
    </Card>
  );
}
