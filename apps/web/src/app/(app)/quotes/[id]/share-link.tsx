'use client';

import { useState } from 'react';
import { Copy, Check, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const waText = encodeURIComponent(`Hola, aquí está tu propuesta de viaje: ${url}`);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
        />
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer">
            <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        El cliente abre este enlace, compara las opciones y aprueba con un clic.
      </p>
    </div>
  );
}
