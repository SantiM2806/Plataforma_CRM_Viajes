'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import {
  addMarkupRuleAction,
  deleteMarkupRuleAction,
  toggleMarkupRuleAction,
  type ActionState,
} from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Rule {
  id: string;
  scope: 'agency_default' | 'provider' | 'product_type' | 'product';
  scopeRef: string | null;
  calcType: 'percent' | 'fixed';
  value: number;
  currency: string;
  active: boolean;
}

const SCOPE_LABEL: Record<Rule['scope'], string> = {
  agency_default: 'General de agencia',
  provider: 'Por proveedor',
  product_type: 'Por tipo de producto',
  product: 'Por producto',
};

export function RulesManager({ rules }: { rules: Rule[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(addMarkupRuleAction, {});
  const [scope, setScope] = useState<Rule['scope']>('agency_default');
  const [busy, startTransition] = useTransition();

  const selectCls =
    'h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reglas de markup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista */}
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin reglas. Agrega la primera abajo.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="flex-1">
                  <span className="font-medium">{SCOPE_LABEL[r.scope]}</span>
                  {r.scopeRef && <span className="text-muted-foreground"> · {r.scopeRef}</span>}
                </div>
                <span className="tabular-nums">
                  {r.calcType === 'percent' ? `${r.value}%` : `${r.value} ${r.currency}`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await toggleMarkupRuleAction(r.id, !r.active);
                      router.refresh();
                    })
                  }
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {r.active ? 'Activa' : 'Inactiva'}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteMarkupRuleAction(r.id);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Alta */}
        <form action={action} className="flex flex-wrap items-end gap-3 border-t pt-4">
          <div className="grid gap-1.5">
            <Label>Alcance</Label>
            <select name="scope" value={scope} onChange={(e) => setScope(e.target.value as Rule['scope'])} className={selectCls}>
              <option value="agency_default">General de agencia</option>
              <option value="provider">Por proveedor</option>
              <option value="product_type">Por tipo de producto</option>
              <option value="product">Por producto</option>
            </select>
          </div>
          {scope !== 'agency_default' && (
            <div className="grid gap-1.5">
              <Label htmlFor="sr">
                {scope === 'provider' ? 'Proveedor' : scope === 'product_type' ? 'Tipo' : 'Producto'}
              </Label>
              <Input id="sr" name="scopeRef" placeholder={scope === 'provider' ? 'liteapi' : scope === 'product_type' ? 'hotel' : 'hotelId'} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <select name="calcType" className={selectCls} defaultValue="percent">
              <option value="percent">Porcentaje</option>
              <option value="fixed">Valor fijo</option>
            </select>
          </div>
          <div className="grid w-28 gap-1.5">
            <Label htmlFor="val">Valor</Label>
            <Input id="val" name="value" type="number" step="0.0001" min="0" required />
          </div>
          <div className="grid w-24 gap-1.5">
            <Label>Moneda</Label>
            <select name="currency" className={selectCls} defaultValue="USD">
              <option value="USD">USD</option>
              <option value="COP">COP</option>
            </select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Agregando…' : 'Agregar regla'}
          </Button>
          {state.error && <span className="w-full text-sm text-destructive">{state.error}</span>}
        </form>
      </CardContent>
    </Card>
  );
}
