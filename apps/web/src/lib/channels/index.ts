// Adaptadores de canal (envío saliente). Solo server-side.
import 'server-only';

export type Channel = 'telegram' | 'whatsapp';

export interface TelegramConfig {
  botToken?: string;
}
export interface WhatsAppConfig {
  phoneNumberId?: string;
  accessToken?: string;
  verifyToken?: string;
}
export type ChannelConfig = TelegramConfig & WhatsAppConfig;

/** Envía un texto por el canal indicado. Devuelve el id externo del mensaje (o null). */
export async function sendViaChannel(
  channel: Channel,
  config: ChannelConfig,
  to: string,
  body: string,
): Promise<string | null> {
  if (channel === 'telegram') return sendTelegram(config, to, body);
  if (channel === 'whatsapp') return sendWhatsApp(config, to, body);
  return null;
}

async function sendTelegram(config: TelegramConfig, chatId: string, text: string): Promise<string> {
  if (!config.botToken) throw new Error('Telegram no configurado (falta botToken).');
  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: { message_id: number } };
  if (!json.ok) throw new Error(`Telegram: ${json.description ?? res.status}`);
  return String(json.result?.message_id ?? '');
}

async function sendWhatsApp(config: WhatsAppConfig, to: string, text: string): Promise<string | null> {
  if (!config.phoneNumberId || !config.accessToken) {
    throw new Error('WhatsApp no configurado (falta phoneNumberId/accessToken).');
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
  const json = (await res.json()) as { messages?: Array<{ id: string }>; error?: unknown };
  if (!res.ok) throw new Error(`WhatsApp: ${JSON.stringify(json.error ?? json)}`);
  return json.messages?.[0]?.id ?? null;
}
