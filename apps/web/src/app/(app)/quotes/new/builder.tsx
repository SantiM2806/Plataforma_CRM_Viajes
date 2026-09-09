'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Search, Plus, Star, MapPin, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  searchHotelsAction,
  getOffersAction,
  saveQuoteAction,
  updateQuoteAction,
  type QuoteOptionInput,
  type OfferPreview,
  type HotelResult,
} from '../actions';

const copFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export type AddedOption = QuoteOptionInput & { saleUsd: number; saleCop: number | null; roomName?: string };

export interface QuoteEditInitial {
  quoteId: string;
  title?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientTaxId?: string;
  options: AddedOption[];
}

function parseAges(input: string): number[] {
  return input
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0 && n < 18);
}

function ratingLabel(r?: number): string {
  if (!r) return '';
  if (r >= 9) return 'Excelente';
  if (r >= 8) return 'Muy bueno';
  if (r >= 7) return 'Bueno';
  if (r >= 6) return 'Agradable';
  return 'Correcto';
}

function fmtDate(d?: string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export function QuoteBuilder({ initial }: { initial?: QuoteEditInitial } = {}) {
  const router = useRouter();
  const isEdit = Boolean(initial?.quoteId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Cliente
  const [clientName, setClientName] = useState(initial?.clientName ?? '');
  const [clientEmail, setClientEmail] = useState(initial?.clientEmail ?? '');
  const [clientPhone, setClientPhone] = useState(initial?.clientPhone ?? '');
  const [clientTaxId, setClientTaxId] = useState(initial?.clientTaxId ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');

  // Búsqueda
  const [query, setQuery] = useState('');
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [adults, setAdults] = useState(2);
  const [childrenAges, setChildrenAges] = useState('');
  const [hotels, setHotels] = useState<HotelResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Opciones (tarifas) de un hotel expandido
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [offers, setOffers] = useState<OfferPreview[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);

  // Opciones agregadas
  const [added, setAdded] = useState<AddedOption[]>(initial?.options ?? []);

  const occ = () => ({ adults, children: parseAges(childrenAges) });

  async function doSearch() {
    setError(null);
    setSearching(true);
    setHotels([]);
    setExpandedId(null);
    setOffers([]);
    try {
      const res = await searchHotelsAction({ query, checkin, checkout, occupancy: occ() });
      setHotels(res);
      if (res.length === 0) setError('Sin resultados. Prueba con otro destino u hotel.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error buscando.');
    } finally {
      setSearching(false);
    }
  }

  async function toggleOptions(h: HotelResult) {
    if (expandedId === h.id) {
      setExpandedId(null);
      return;
    }
    setError(null);
    setExpandedId(h.id);
    setOffers([]);
    setLoadingOffers(true);
    try {
      const res = await getOffersAction({ hotelId: h.id, checkin, checkout, occupancy: occ() });
      setOffers(res.offers);
      if (res.offers.length === 0) setError('Sin tarifas para esas fechas en este hotel.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error consultando tarifas.');
    } finally {
      setLoadingOffers(false);
    }
  }

  function addOffer(h: HotelResult, o: OfferPreview) {
    setAdded((prev) => [
      ...prev,
      {
        label: `Opción ${prev.length + 1}`,
        provider: 'liteapi',
        providerRef: { hotelId: h.id, rateId: o.rateId, offerId: o.offerId, roomTypeId: o.roomTypeId, boardType: o.boardType },
        hotelId: h.id,
        hotelName: h.name,
        hotelCity: h.city,
        hotelStars: h.stars,
        hotelImage: h.image,
        checkin,
        checkout,
        occupancy: occ(),
        board: o.boardName,
        netCostUsd: o.netCostUsd,
        refundable: o.refundable,
        freeCancellationUntil: o.freeCancellationUntil ?? null,
        saleUsd: o.saleUsd,
        saleCop: o.saleCop,
        roomName: o.name,
      },
    ]);
  }

  function save(send: boolean) {
    setError(null);
    if (!clientName.trim()) return setError('El nombre del cliente es obligatorio.');
    if (added.length === 0) return setError('Agrega al menos una opción.');
    const input = {
      title: title || undefined,
      clientName,
      clientEmail: clientEmail || undefined,
      clientPhone: clientPhone || undefined,
      clientTaxId: clientTaxId || undefined,
      options: added.map(({ saleUsd, saleCop, roomName, ...rest }) => rest),
    };
    startTransition(async () => {
      try {
        const { id } = isEdit
          ? await updateQuoteAction(initial!.quoteId, input, { send })
          : await saveQuoteAction(input, { send });
        router.push(`/quotes/${id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al guardar.');
      }
    });
  }

  const canSearch = query.trim().length > 1 && !!checkin && !!checkout && !searching;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isEdit ? 'Editar cotización' : 'Nueva cotización'}
      </h1>

      {/* Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cn">Nombre *</Label>
            <Input id="cn" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ct">Título</Label>
            <Input id="ct" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cartagena 3 noches" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ce">Email</Label>
            <Input id="ce" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cp">Teléfono / WhatsApp</Label>
            <Input id="cp" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ctx">NIT / CC (para facturación)</Label>
            <Input id="ctx" value={clientTaxId} onChange={(e) => setClientTaxId(e.target.value)} placeholder="opcional" />
          </div>
        </CardContent>
      </Card>

      {/* Buscador estilo OTA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar hotel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)_auto] lg:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="q">Destino u hotel *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="q"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && canSearch && doSearch()}
                  placeholder="Cartagena, Punta Cana, Hilton…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ci">Check-in</Label>
              <Input id="ci" type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="co">Check-out</Label>
              <Input id="co" type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ad">Adultos</Label>
              <Input id="ad" type="number" min={1} value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
            </div>
            <Button type="button" onClick={doSearch} disabled={!canSearch}>
              {searching ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="ch">Edades de niños (opcional)</Label>
            <Input id="ch" value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} placeholder="ej: 5, 8" />
          </div>

          {/* Resultados */}
          {hotels.length > 0 && (
            <div className="space-y-3">
              {hotels.map((h) => (
                <div key={h.id} className="overflow-hidden rounded-xl border bg-card">
                  <div className="flex flex-col gap-4 p-3 sm:flex-row">
                    {h.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.image} alt={h.name} className="h-32 w-full shrink-0 rounded-lg object-cover sm:w-44" />
                    ) : (
                      <div className="flex h-32 w-full shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:w-44">
                        <MapPin className="h-6 w-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold">{h.name}</h3>
                        {h.stars ? (
                          <span className="flex shrink-0 items-center gap-0.5 text-xs text-amber-500">
                            {Array.from({ length: h.stars }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-current" />
                            ))}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {h.city}
                        {h.country ? `, ${h.country}` : ''}
                      </p>
                      {h.rating ? (
                        <div className="mt-1.5 flex items-center gap-2 text-sm">
                          <span className="rounded bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground">
                            {h.rating.toFixed(1)}
                          </span>
                          <span className="font-medium">{ratingLabel(h.rating)}</span>
                          {h.reviewCount ? (
                            <span className="text-xs text-muted-foreground">{h.reviewCount} reseñas</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">desde</p>
                        <p className="text-lg font-bold">
                          {h.minSaleCop != null ? copFmt.format(h.minSaleCop) : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">total, {checkin} → {checkout}</p>
                      </div>
                      <Button type="button" variant={expandedId === h.id ? 'secondary' : 'default'} size="sm" onClick={() => toggleOptions(h)}>
                        {expandedId === h.id ? 'Ocultar' : 'Ver opciones'}
                      </Button>
                    </div>
                  </div>

                  {/* Opciones (tarifas) del hotel */}
                  {expandedId === h.id && (
                    <div className="border-t bg-muted/30 p-3">
                      {loadingOffers ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">Consultando tarifas…</p>
                      ) : offers.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">Sin tarifas disponibles.</p>
                      ) : (
                        <div className="space-y-2">
                          {offers.map((o, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{o.name ?? 'Habitación'}</p>
                                <p className="text-xs text-muted-foreground">{o.boardName ?? o.boardType}</p>
                                <p className="mt-0.5 text-xs">
                                  {o.refundable ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600">
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                      {o.freeCancellationUntil
                                        ? `Cancelación gratis hasta ${fmtDate(o.freeCancellationUntil)}`
                                        : 'Cancelación gratuita'}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">No reembolsable</span>
                                  )}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{o.saleCop ? copFmt.format(o.saleCop) : usdFmt.format(o.saleUsd)}</p>
                                <p className="text-xs text-muted-foreground">{usdFmt.format(o.saleUsd)}</p>
                              </div>
                              <Button type="button" size="sm" onClick={() => addOffer(h, o)}>
                                <Plus className="h-4 w-4" /> Agregar
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Opciones agregadas */}
      {added.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opciones de la cotización ({added.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {added.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.hotelName}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.roomName} · {a.checkin} → {a.checkout} · {a.occupancy.adults} ad
                    {a.occupancy.children.length ? ` + ${a.occupancy.children.length} niño(s)` : ''}
                    {a.refundable ? ' · cancelación gratis' : ''}
                  </p>
                </div>
                <p className="font-semibold">{a.saleCop ? copFmt.format(a.saleCop) : usdFmt.format(a.saleUsd)}</p>
                <Button type="button" variant="ghost" size="icon" onClick={() => setAdded((p) => p.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => save(false)} disabled={pending}>
          Guardar borrador
        </Button>
        <Button onClick={() => save(true)} disabled={pending}>
          {pending ? 'Procesando…' : 'Guardar y enviar'}
        </Button>
      </div>
    </div>
  );
}
