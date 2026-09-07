// Cliente LiteAPI (v3.0) — solo server-side. Doc: https://docs.liteapi.travel
// Auth: header X-API-Key. Sandbox usa la misma base URL con key prefijo 'sand_'.
import 'server-only';

const BASE_URL = 'https://api.liteapi.travel/v3.0';

function apiKey(): string {
  const env = (process.env.LITEAPI_ENV ?? 'sandbox').toLowerCase();
  const key = env === 'prod' ? process.env.LITEAPI_KEY_PROD : process.env.LITEAPI_KEY_SANDBOX;
  if (!key) throw new Error(`Falta la API key de LiteAPI (${env}). Configúrala en .env.`);
  return key;
}

async function liteFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'X-API-Key': apiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LiteAPI ${res.status} en ${path}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export interface HotelSummary {
  id: string;
  name: string;
  city?: string;
  country?: string;
  stars?: number;
  rating?: number;
  thumbnail?: string;
  mainPhoto?: string;
}

export interface Occupancy {
  adults: number;
  children: number[]; // edades
}

export interface RateOffer {
  hotelId: string;
  offerId?: string;
  rateId?: string;
  roomTypeId?: string;
  name?: string; // nombre de la habitación
  boardType?: string; // RO, BB, etc.
  boardName?: string;
  refundable: boolean;
  netCostUsd: number; // costo (ver nota abajo)
  currency: string;
  cancellationPolicies?: unknown;
}

/**
 * Busca hoteles por ciudad (+ nombre opcional). Colombia por defecto.
 */
export async function searchHotels(params: {
  cityName: string;
  countryCode?: string;
  hotelName?: string;
  limit?: number;
}): Promise<HotelSummary[]> {
  const q = new URLSearchParams({
    countryCode: params.countryCode ?? 'CO',
    cityName: params.cityName,
    limit: String(params.limit ?? 25),
  });
  if (params.hotelName) q.set('hotelName', params.hotelName);

  const json = await liteFetch<{ data?: any[] }>(`/data/hotels?${q.toString()}`);
  const list = json.data ?? [];
  return list.map((h) => ({
    id: String(h.id),
    name: h.name,
    city: h.city,
    country: h.country,
    stars: h.stars,
    rating: h.rating,
    thumbnail: h.thumbnail,
    mainPhoto: h.main_photo,
  }));
}

/**
 * Tarifas de un hotel específico para fechas + ocupación (con edades de niños).
 * Devuelve una oferta por tarifa (aplanado).
 *
 * NOTA DE PRECIO: usamos `retailRate.total` como COSTO NETO sobre el que la
 * agencia aplica sus markups. Verifícalo contra tu cuenta LiteAPI: si tu "neto"
 * real es otro campo, cámbialo en `extractNetCost`.
 */
export async function getRates(params: {
  hotelId: string;
  checkin: string; // YYYY-MM-DD
  checkout: string;
  occupancies: Occupancy[];
  currency?: string;
  guestNationality?: string;
}): Promise<RateOffer[]> {
  const body = {
    hotelIds: [params.hotelId],
    checkin: params.checkin,
    checkout: params.checkout,
    currency: params.currency ?? 'USD',
    guestNationality: params.guestNationality ?? 'CO',
    occupancies: params.occupancies.map((o) => ({ adults: o.adults, children: o.children })),
  };

  const json = await liteFetch<{ data?: any[] }>(`/hotels/rates`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const offers: RateOffer[] = [];
  for (const hotel of json.data ?? []) {
    for (const rt of hotel.roomTypes ?? []) {
      for (const rate of rt.rates ?? []) {
        offers.push({
          hotelId: String(hotel.hotelId ?? params.hotelId),
          offerId: rt.offerId,
          rateId: rate.rateId,
          roomTypeId: rt.roomTypeId,
          name: rate.name,
          boardType: rate.boardType,
          boardName: rate.boardName,
          refundable: rate.cancellationPolicies?.refundableTag === 'RFN',
          netCostUsd: extractNetCost(rate),
          currency: extractCurrency(rate) ?? params.currency ?? 'USD',
          cancellationPolicies: rate.cancellationPolicies,
        });
      }
    }
  }
  // Ordena por costo ascendente.
  return offers.sort((a, b) => a.netCostUsd - b.netCostUsd);
}

function extractNetCost(rate: any): number {
  const total = rate?.retailRate?.total;
  const amount = Array.isArray(total) ? total[0]?.amount : total?.amount;
  return typeof amount === 'number' ? amount : Number(amount ?? 0);
}

function extractCurrency(rate: any): string | undefined {
  const total = rate?.retailRate?.total;
  return Array.isArray(total) ? total[0]?.currency : total?.currency;
}
