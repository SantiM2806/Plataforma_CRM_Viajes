import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

export interface QuotePdfOption {
  hotelName: string | null;
  hotelCity: string | null;
  hotelStars: number | null;
  board: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  adults: number;
  children: number;
  saleCop: number | null;
  saleUsd: number | null;
  selected: boolean;
}

export interface QuotePdfData {
  agencyName: string;
  consecutivo: string | null;
  title: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  status: string;
  validUntil: string | null;
  trm: number | null;
  trmDate: string | null;
  options: QuotePdfOption[];
}

function cop(n: number | null): string {
  if (n == null) return '—';
  return 'COP ' + Math.round(n).toLocaleString('es-CO');
}
function usd(n: number | null): string {
  if (n == null) return '';
  return 'USD ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PURPLE = '#6d28d9';
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#1f2430', fontFamily: 'Helvetica' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 12,
    marginBottom: 18,
  },
  agency: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: PURPLE },
  right: { textAlign: 'right' },
  consecutivo: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  muted: { color: '#6b7280' },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  section: { marginBottom: 16 },
  label: { fontSize: 8, color: '#6b7280', marginBottom: 2 },
  option: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionSelected: { borderColor: PURPLE, borderWidth: 1.5, backgroundColor: '#faf7ff' },
  hotel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  detail: { color: '#6b7280', marginBottom: 1 },
  priceBox: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 120 },
  price: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  priceUsd: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  badge: { fontSize: 7, color: PURPLE, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  footer: {
    marginTop: 'auto',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    fontSize: 8,
    color: '#6b7280',
  },
});

export function QuotePdf({ data }: { data: QuotePdfData }) {
  return (
    <Document title={data.consecutivo ?? 'Cotización'}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.agency}>{data.agencyName}</Text>
          <View style={styles.right}>
            {data.consecutivo ? <Text style={styles.consecutivo}>{data.consecutivo}</Text> : null}
            <Text style={styles.muted}>{new Date().toLocaleDateString('es-CO')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>{data.title ?? 'Propuesta de viaje'}</Text>
          <Text style={styles.muted}>
            {data.clientName ?? ''}
            {data.clientEmail ? ` · ${data.clientEmail}` : ''}
            {data.clientPhone ? ` · ${data.clientPhone}` : ''}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>OPCIONES</Text>
          {data.options.map((o, i) => (
            <View key={i} style={[styles.option, o.selected ? styles.optionSelected : {}]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                {o.selected ? <Text style={styles.badge}>OPCIÓN ELEGIDA</Text> : null}
                <Text style={styles.hotel}>
                  {o.hotelName}
                  {o.hotelStars ? `  (${o.hotelStars}*)` : ''}
                </Text>
                <Text style={styles.detail}>
                  {o.hotelCity}
                  {o.board ? ` · ${o.board}` : ''}
                </Text>
                <Text style={styles.detail}>
                  {o.checkIn} a {o.checkOut} ({o.nights} noche(s))
                </Text>
                <Text style={styles.detail}>
                  {o.adults} adulto(s){o.children ? ` + ${o.children} niño(s)` : ''}
                </Text>
              </View>
              <View style={styles.priceBox}>
                <Text style={styles.price}>{cop(o.saleCop)}</Text>
                <Text style={styles.priceUsd}>{usd(o.saleUsd)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          {data.validUntil ? <Text>Cotización válida hasta el {data.validUntil}.</Text> : null}
          {data.trm ? (
            <Text>
              Precios en COP calculados a la TRM de {cop(data.trm).replace('COP ', '')}
              {data.trmDate ? ` (${data.trmDate})` : ''}. Sujeto a disponibilidad al momento de la reserva.
            </Text>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}
