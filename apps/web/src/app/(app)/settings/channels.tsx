'use client';

import { useActionState } from 'react';
import { saveChannelAction, type ActionState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ChannelConfig {
  active: boolean;
  config: Record<string, string>;
}

export function ChannelsManager({
  agencyId,
  baseUrl,
  telegram,
  whatsapp,
}: {
  agencyId: string;
  baseUrl: string;
  telegram: ChannelConfig | null;
  whatsapp: ChannelConfig | null;
}) {
  return (
    <div className="grid gap-4">
      <TelegramForm agencyId={agencyId} baseUrl={baseUrl} data={telegram} />
      <WhatsAppForm agencyId={agencyId} baseUrl={baseUrl} data={whatsapp} />
    </div>
  );
}

function Hook({ url }: { url: string }) {
  return (
    <p className="mt-2 break-all text-xs text-muted-foreground">
      Webhook: <span className="font-mono">{url}</span>
    </p>
  );
}

function TelegramForm({ agencyId, baseUrl, data }: { agencyId: string; baseUrl: string; data: ChannelConfig | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveChannelAction, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Telegram</CardTitle>
        <CardDescription>Para pruebas/MVP. Crea un bot con @BotFather y pega su token.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="channel" value="telegram" />
          <div className="grid gap-1.5">
            <Label htmlFor="tg">Bot token</Label>
            <Input id="tg" name="botToken" defaultValue={data?.config.botToken ?? ''} placeholder="123456:ABC-..." />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={data?.active ?? true} /> Activo
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
            {state.ok && <span className="text-sm text-emerald-600">Guardado ✓</span>}
            {state.error && <span className="text-sm text-destructive">{state.error}</span>}
          </div>
          <Hook url={`${baseUrl}/api/webhooks/telegram/${agencyId}`} />
        </form>
      </CardContent>
    </Card>
  );
}

function WhatsAppForm({ agencyId, baseUrl, data }: { agencyId: string; baseUrl: string; data: ChannelConfig | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveChannelAction, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">WhatsApp Cloud API</CardTitle>
        <CardDescription>Integración nativa con Meta (sin intermediarios).</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="channel" value="whatsapp" />
          <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pnid">Phone Number ID</Label>
              <Input id="pnid" name="phoneNumberId" defaultValue={data?.config.phoneNumberId ?? ''} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vt">Verify token</Label>
              <Input id="vt" name="verifyToken" defaultValue={data?.config.verifyToken ?? ''} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="at">Access token</Label>
            <Input id="at" name="accessToken" type="password" defaultValue={data?.config.accessToken ?? ''} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={data?.active ?? true} /> Activo
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
            {state.ok && <span className="text-sm text-emerald-600">Guardado ✓</span>}
            {state.error && <span className="text-sm text-destructive">{state.error}</span>}
          </div>
          <Hook url={`${baseUrl}/api/webhooks/whatsapp/${agencyId}`} />
        </form>
      </CardContent>
    </Card>
  );
}
