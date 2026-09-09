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
  address?: string;
  stars?: number;
  rating?: number;
  reviewCount?: number;
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
  freeCancellationUntil?: string | null; // fecha límite de cancelación gratuita
  netCostUsd: number; // costo neto (retailRate.total)
  currency: string;
  cancellationPolicies?: unknown;
}

export interface MinRate {
  hotelId: string;
  priceUsd: number; // costo neto mínimo
  offerId?: string;
}

/**
 * Búsqueda de un solo input (destino o nombre de hotel), multi-país, vía aiSearch.
 */
export async function searchHotels(params: { query: string; limit?: number }): Promise<HotelSummary[]> {
  const q = new URLSearchParams({ aiSearch: params.query, limit: String(params.limit ?? 30) });
  const json = await liteFetch<{ data?: any[] }>(`/data/hotels?${q.toString()}`);
  return (json.data ?? []).map((h) => ({
    id: String(h.id),
    name: h.name,
    city: h.city,
    country: typeof h.country === 'string' ? h.country.toUpperCase() : undefined,
    address: h.address,
    stars: h.stars,
    rating: h.rating,
    reviewCount: h.reviewCount,
    thumbnail: h.thumbnail,
    mainPhoto: h.main_photo,
  }));
}

/**
 * Precio mínimo (neto) por hotel para fechas + ocupación. Una sola llamada para
 * muchos hoteles: sirve para mostrar "desde $X" en cada tarjeta.
 */
export async function getMinRates(params: {
  hotelIds: string[];
  checkin: string;
  checkout: string;
  occupancies: Occupancy[];
  currency?: string;
  guestNationality?: string;
}): Promise<Map<string, MinRate>> {
  const out = new Map<string, MinRate>();
  if (params.hotelIds.length === 0) return out;
  const body = {
    hotelIds: params.hotelIds,
    checkin: params.checkin,
    checkout: params.checkout,
    currency: params.currency ?? 'USD',
    guestNationality: params.guestNationality ?? 'CO',
    occupancies: params.occupancies.map((o) => ({ adults: o.adults, children: o.children })),
  };
  const json = await liteFetch<{ data?: any[] }>(`/hotels/min-rates`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  for (const r of json.data ?? []) {
    const id = String(r.hotelId);
    out.set(id, { hotelId: id, priceUsd: Number(r.price), offerId: r.offerId });
  }
  return out;
}

/**
 * Tarifas completas de un hotel (todas las habitaciones/regímenes) para fechas +
 * ocupación. `retailRate.total` = costo neto sobre el que se aplican los markups.
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
        const canc = parseCancellation(rate);
        offers.push({
          hotelId: String(hotel.hotelId ?? params.hotelId),
          offerId: rt.offerId,
          rateId: rate.rateId,
          roomTypeId: rt.roomTypeId,
          name: rate.name,
          boardType: rate.boardType,
          boardName: rate.boardName,
          refundable: canc.refundable,
          freeCancellationUntil: canc.freeUntil ?? null,
          netCostUsd: extractNetCost(rate),
          currency: extractCurrency(rate) ?? params.currency ?? 'USD',
          cancellationPolicies: rate.cancellationPolicies,
        });
      }
    }
  }
  return offers.sort((a, b) => a.netCostUsd - b.netCostUsd);
}

function parseCancellation(rate: any): { refundable: boolean; freeUntil?: string } {
  const cp = rate?.cancellationPolicies;
  const refundable = cp?.refundableTag === 'RFN';
  let freeUntil: string | undefined;
  const infos = cp?.cancelPolicyInfos;
  if (refundable && Array.isArray(infos) && infos.length) {
    const times = infos.map((i: any) => i?.cancelTime).filter(Boolean).sort();
    freeUntil = times[0];
  }
  return { refundable, freeUntil };
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
