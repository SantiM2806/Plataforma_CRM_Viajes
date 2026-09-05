import assert from 'node:assert/strict';
import { computePrice, roundToHundred, type MarkupRule } from './pricing';

const rules: MarkupRule[] = [
  { scope: 'agency_default', scopeRef: null, calcType: 'percent', value: 10, currency: 'USD' },
  { scope: 'provider', scopeRef: 'liteapi', calcType: 'percent', value: 5, currency: 'USD' },
  { scope: 'product_type', scopeRef: 'hotel', calcType: 'fixed', value: 8, currency: 'USD' },
  { scope: 'provider', scopeRef: 'omnibees', calcType: 'percent', value: 99, currency: 'USD' }, // NO aplica
];

// 1) Suma de %: 10 + 5 (markup) + 3 (fee) = 18% sobre 100 => 118 + 8 fijo = 126 USD
{
  const r = computePrice({
    netCostUsd: 100,
    bankFeePercent: 3,
    rules,
    context: { provider: 'liteapi', productType: 'hotel' },
    trmCopPerUsd: 4000,
  });
  assert.equal(r.markupPercent, 15, 'markup% debe ser 15 (no cuenta omnibees)');
  assert.equal(r.markupFixedUsd, 8, 'fijo debe ser 8');
  assert.equal(r.saleUsd, 126, 'saleUsd = 100*1.18 + 8 = 126');
  assert.equal(r.saleCop, 504000, 'saleCop = 126*4000 = 504000');
}

// 2) Redondeo a la centena
{
  const r = computePrice({
    netCostUsd: 100.3,
    bankFeePercent: 3,
    rules: [{ scope: 'agency_default', scopeRef: null, calcType: 'percent', value: 10, currency: 'USD' }],
    context: { provider: 'liteapi', productType: 'hotel' },
    trmCopPerUsd: 4000,
  });
  // 100.3 * 1.13 = 113.339 -> round2 113.34 ; *4000 = 453360 -> centena 453400
  assert.equal(r.saleUsd, 113.34);
  assert.equal(r.saleCop, 453400);
}

// 3) Sin TRM => saleCop null
{
  const r = computePrice({
    netCostUsd: 50,
    bankFeePercent: 0,
    rules: [],
    context: { provider: 'liteapi', productType: 'hotel' },
  });
  assert.equal(r.saleUsd, 50);
  assert.equal(r.saleCop, null);
}

// 4) Fijo en COP se convierte a USD con la TRM
{
  const r = computePrice({
    netCostUsd: 100,
    bankFeePercent: 0,
    rules: [{ scope: 'agency_default', scopeRef: null, calcType: 'fixed', value: 40000, currency: 'COP' }],
    context: { provider: 'liteapi', productType: 'hotel' },
    trmCopPerUsd: 4000,
  });
  // 40000 COP / 4000 = 10 USD fijo => 110 USD
  assert.equal(r.markupFixedUsd, 10);
  assert.equal(r.saleUsd, 110);
  assert.equal(r.saleCop, 440000);
}

// 5) roundToHundred
assert.equal(roundToHundred(453349), 453300);
assert.equal(roundToHundred(453350), 453400);

console.log('✓ pricing: todos los casos pasaron');
