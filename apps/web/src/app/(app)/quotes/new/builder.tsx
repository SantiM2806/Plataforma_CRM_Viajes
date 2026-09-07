'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Search, Plus, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  searchHotelsAction,
  getOffersAction,
  saveQuoteAction,
  type QuoteOptionInput,
  type OfferPreview,
} from '../actions';
import type { HotelSummary } from '@/lib/liteapi/client';

const copFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

type AddedOption = QuoteOptionInput & { saleUsd: number; saleCop: number | null; roomName?: string };

function parseAges(input: string): number[] {
  return input
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0 && n < 18);
}

export function QuoteBuilder() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Cliente
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [title, setTitle] = useState('');

  // Búsqueda de hotel
  const [city, setCity] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [hotels, setHotels] = useState<HotelSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<HotelSummary | null>(null);

  // Estadía + tarifas
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [adults, setAdults] = useState(2);
  const [childrenAges, setChildrenAges] = useState('');
  const [offers, setOffers] = useState<OfferPreview[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [trmRate, setTrmRate] = useState<number | null>(null);

  // Opciones agregadas
  const [added, setAdded] = useState<AddedOption[]>([]);

  async function doSearch() {
    setError(null);
    setSearching(true);
    setHotels([]);
    setSelected(null);
    setOffers([]);
    try {
      const res = await searchHotelsAction({ cityName: city, hotelName });
      setHotels(res);
      if (res.length === 0) setError('Sin hoteles para esa búsqueda.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error buscando hoteles.');
    } finally {
      setSearching(false);
    }
  }

  async function loadOffers() {
    if (!selected || !checkin || !checkout) {
      setError('Elige hotel y fechas.');
      return;
    }
    setError(null);
    setLoadingOffers(true);
    setOffers([]);
    try {
      const res = await getOffersAction({
        hotelId: selected.id,
        checkin,
        checkout,
        occupancy: { adults, children: parseAges(childrenAges) },
      });
      setOffers(res.offers);
      setTrmRate(res.trmRate);
      if (res.offers.length === 0) setError('Sin tarifas disponibles para esas fechas.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error consultando tarifas.');
    } finally {
      setLoadingOffers(false);
    }
  }

  function addOffer(o: OfferPreview) {
    if (!selected) return;
    setAdded((prev) => [
      ...prev,
      {
        label: `Opción ${prev.length + 1}`,
        provider: 'liteapi',
        providerRef: { rateId: o.rateId, offerId: o.offerId, roomTypeId: o.roomTypeId, boardType: o.boardType },
        hotelId: selected.id,
        hotelName: selected.name,
        hotelCity: selected.city,
        hotelStars: selected.stars,
        hotelImage: selected.mainPhoto ?? selected.thumbnail,
        checkin,
        checkout,
        occupancy: { adults, children: parseAges(childrenAges) },
        board: o.boardName,
        netCostUsd: o.netCostUsd,
        saleUsd: o.saleUsd,
        saleCop: o.saleCop,
        roomName: o.name,
      },
    ]);
  }

  function save(send: boolean) {
    setError(null);
    if (!clientName.trim()) {
      setError('El nombre del cliente es obligatorio.');
      return;
    }
    if (added.length === 0) {
      setError('Agrega al menos una opción.');
      return;
    }
    startTransition(async () => {
      try {
        const { id } = await saveQuoteAction(
          {
            title: title || undefined,
            clientName,
            clientEmail: clientEmail || undefined,
            clientPhone: clientPhone || undefined,
            options: added.map(({ saleUsd, saleCop, roomName, ...rest }) => rest),
          },
          { send },
        );
        router.push(`/quotes/${id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al guardar.');
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nueva cotización</h1>

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
        </CardContent>
      </Card>

      {/* Buscador */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agregar opción — buscar hotel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="city">Ciudad *</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cartagena" />
            </div>
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="hn">Nombre del hotel</Label>
              <Input id="hn" value={hotelName} onChange={(e) => setHotelName(e.target.value)} placeholder="opcional" />
            </div>
            <Button type="button" variant="outline" onClick={doSearch} disabled={searching || !city}>
              <Search className="h-4 w-4" />
              {searching ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>

          {hotels.length > 0 && (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
              {hotels.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelected(h)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                    selected?.id === h.id ? 'bg-accent text-accent-foreground' : ''
                  }`}
                >
                  <span className="flex-1">{h.name}</span>
                  {h.stars ? (
                    <span className="flex items-center gap-0.5 text-xs text-amber-500">
                      {h.stars} <Star className="h-3 w-3 fill-current" />
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">{h.city}</span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-medium">{selected.name}</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="ci">Check-in</Label>
                  <Input id="ci" type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="co">Check-out</Label>
                  <Input id="co" type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} />
                </div>
                <div className="grid w-20 gap-1.5">
                  <Label htmlFor="ad">Adultos</Label>
                  <Input id="ad" type="number" min={1} value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
                </div>
                <div className="grid flex-1 gap-1.5">
                  <Label htmlFor="ch">Edades niños</Label>
                  <Input id="ch" value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} placeholder="ej: 5, 8" />
                </div>
                <Button type="button" variant="outline" onClick={loadOffers} disabled={loadingOffers}>
                  {loadingOffers ? 'Consultando…' : 'Ver tarifas'}
                </Button>
              </div>

              {trmRate && (
                <p className="text-xs text-muted-foreground">
                  TRM usada (indicativa): {copFmt.format(trmRate)} / USD
                </p>
              )}

              {offers.length > 0 && (
                <div className="space-y-1">
                  {offers.map((o, i) => (
                    <div key={i} className="flex items-center gap-3 rounded border bg-card px-3 py-2 text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{o.name ?? 'Habitación'}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.boardName ?? o.boardType} · costo {usdFmt.format(o.netCostUsd)}
                          {o.refundable ? ' · reembolsable' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{o.saleCop ? copFmt.format(o.saleCop) : usdFmt.format(o.saleUsd)}</p>
                        <p className="text-xs text-muted-foreground">{usdFmt.format(o.saleUsd)}</p>
                      </div>
                      <Button type="button" size="sm" onClick={() => addOffer(o)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
              <div key={i} className="flex items-center gap-3 rounded border px-3 py-2 text-sm">
                <div className="flex-1">
                  <p className="font-medium">{a.hotelName}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.roomName} · {a.checkin} → {a.checkout} · {a.occupancy.adults} ad
                    {a.occupancy.children.length ? ` + ${a.occupancy.children.length} niño(s)` : ''}
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
