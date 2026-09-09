'use client';

import { useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Copy } from 'lucide-react';
import { addUserAction, removeMemberAction, type UserFormState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Member {
  id: string;
  role: 'super_admin' | 'admin_agencia' | 'agente' | 'contable';
  email: string;
  name: string | null;
  isSelf: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin_agencia: 'Administrador',
  agente: 'Agente',
  contable: 'Contable',
};

export function UsersManager({ members }: { members: Member[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<UserFormState, FormData>(addUserAction, {});
  const [busy, startTransition] = useTransition();

  const selectCls =
    'h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Equipo</CardTitle>
        <CardDescription>Agrega agentes y contables a tu agencia. Cada agente ve solo sus propias cotizaciones y reservas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista */}
        <div className="divide-y rounded-md border">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="flex-1">
                <span className="font-medium">{m.name ?? m.email}</span>
                {m.name && <span className="text-muted-foreground"> · {m.email}</span>}
                {m.isSelf && <span className="text-muted-foreground"> (tú)</span>}
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{ROLE_LABEL[m.role]}</span>
              {!m.isSelf && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={() =>
                    startTransition(async () => {
                      await removeMemberAction(m.id);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Alta */}
        <form action={action} className="flex flex-wrap items-end gap-3 border-t pt-4">
          <div className="grid gap-1.5">
            <Label htmlFor="un">Nombre</Label>
            <Input id="un" name="name" placeholder="Nombre" />
          </div>
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="ue">Email</Label>
            <Input id="ue" name="email" type="email" required placeholder="agente@agencia.com" />
          </div>
          <div className="grid gap-1.5">
            <Label>Rol</Label>
            <select name="role" className={selectCls} defaultValue="agente">
              <option value="agente">Agente</option>
              <option value="contable">Contable</option>
              <option value="admin_agencia">Administrador</option>
            </select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Agregando…' : 'Agregar'}
          </Button>
        </form>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}

        {state.ok && state.existed && (
          <p className="text-sm text-emerald-600">
            {state.email} ya tenía cuenta y fue agregado a la agencia.
          </p>
        )}

        {state.ok && state.tempPassword && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-4">
            <p className="text-sm font-medium">Usuario creado: {state.email}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Comparte esta contraseña temporal (se muestra una sola vez). El usuario deberá cambiarla al entrar.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="rounded bg-background px-3 py-2 font-mono text-base tracking-wide">
                {state.tempPassword}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => navigator.clipboard?.writeText(state.tempPassword ?? '')}
                title="Copiar"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
