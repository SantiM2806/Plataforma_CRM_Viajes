// Motor de precios: costo neto (USD) -> venta (USD y COP).
// Regla confirmada: venta_usd = costo * (1 + Σmarkup% + fee%) + Σfijos.
// Todos los % (markups aplicables + fee bancario) se suman y se aplican sobre el costo neto.

export type MarkupCalc = 'percent' | 'fixed';
export type MarkupScope = 'agency_default' | 'provider' | 'product_type' | 'product';

export interface MarkupRule {
  scope: MarkupScope;
  scopeRef: string | null; // code proveedor / product_type / product_id
  calcType: MarkupCalc;
  value: number; // percent: 10 = 10% ; fixed: monto en `currency`
  currency: string; // 'USD' | 'COP'
  active?: boolean;
}

export interface PriceContext {
  provider: string; // ej. 'liteapi'
  productType: string; // ej. 'hotel'
  productId?: string | null; // ej. hotelId
}

export interface PriceInput {
  netCostUsd: number;
  bankFeePercent: number; // ej. 3 = 3%
  rules: MarkupRule[];
  context: PriceContext;
  trmCopPerUsd?: number | null; // requerido para saleCop
}

export interface PriceBreakdown {
  netCostUsd: number;
  markupPercent: number; // Σ % de markup aplicable
  markupFixedUsd: number; // Σ fijos convertidos a USD
  bankFeePercent: number;
  saleUsd: number;
  saleCop: number | null; // redondeado a la centena
  trmCopPerUsd: number | null;
}

/** ¿La regla aplica al contexto (proveedor/producto) de esta opción? */
function ruleApplies(rule: MarkupRule, ctx: PriceContext): boolean {
  if (rule.active === false) return false;
  switch (rule.scope) {
    case 'agency_default':
      return true;
    case 'provider':
      return rule.scopeRef === ctx.provider;
    case 'product_type':
      return rule.scopeRef === ctx.productType;
    case 'product':
      return !!ctx.productId && rule.scopeRef === ctx.productId;
    default:
      return false;
  }
}

/** Redondeo a la centena de COP más cercana. */
export function roundToHundred(cop: number): number {
  return Math.round(cop / 100) * 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computePrice(input: PriceInput): PriceBreakdown {
  const { netCostUsd, bankFeePercent, rules, context, trmCopPerUsd } = input;
  const applicable = rules.filter((r) => ruleApplies(r, context));

  let markupPercent = 0;
  let markupFixedUsd = 0;
  for (const r of applicable) {
    if (r.calcType === 'percent') {
      markupPercent += r.value;
    } else {
      // Fijos en COP se convierten a USD con la TRM si está disponible.
      const usd = r.currency === 'COP' && trmCopPerUsd ? r.value / trmCopPerUsd : r.value;
      markupFixedUsd += usd;
    }
  }

  const totalPercent = (markupPercent + bankFeePercent) / 100;
  const saleUsd = round2(netCostUsd * (1 + totalPercent) + markupFixedUsd);
  const saleCop = trmCopPerUsd ? roundToHundred(saleUsd * trmCopPerUsd) : null;

  return {
    netCostUsd: round2(netCostUsd),
    markupPercent,
    markupFixedUsd: round2(markupFixedUsd),
    bankFeePercent,
    saleUsd,
    saleCop,
    trmCopPerUsd: trmCopPerUsd ?? null,
  };
}
