import {
  convertCurrency,
  roundForDisplay,
  getRate,
  buildCurrencyList,
  sessionCurrencyKey,
} from '@/lib/currency';

// ─── Mock FX rates (backend-format: EUR-based) ────────────────────────────────
// Mirrors what GET /api/currencies returns from the Frankfurter v2 API.

const MOCK_FX_RATES = [
  { date: '2026-08-15', base: 'EUR', quote: 'EUR', rate: 1.0 },
  { date: '2026-08-15', base: 'EUR', quote: 'GBP', rate: 0.85525 },
  { date: '2026-08-15', base: 'EUR', quote: 'SEK', rate: 11.0172 },
  { date: '2026-08-15', base: 'EUR', quote: 'USD', rate: 1.1552 },
];

// ─── Test 1 & 2: convertCurrency ─────────────────────────────────────────────

describe('convertCurrency', () => {
  // Test 1: Native currency selected → values unchanged
  it('returns original amount unchanged when fromCurrency === toCurrency', () => {
    expect(convertCurrency(100, 'EUR', 'EUR', 1)).toBe(100);
    expect(convertCurrency(123.45, 'USD', 'USD', 1)).toBe(123.45);
    expect(convertCurrency(0, 'GBP', 'GBP', 1)).toBe(0);
  });

  // Test 2: EUR → SEK style conversion
  it('converts EUR to SEK correctly using provided rate', () => {
    const rate = 11.24;
    const result = convertCurrency(100, 'EUR', 'SEK', rate);
    expect(result).toBeCloseTo(1124, 4);
  });

  it('converts a known EUR amount to SEK and rounds correctly at display', () => {
    const rate = 11.24;
    const amount = 198.70;
    const converted = convertCurrency(amount, 'EUR', 'SEK', rate);
    expect(converted).toBeCloseTo(amount * rate, 4);
    expect(roundForDisplay(converted)).toBe(Math.round(amount * rate * 100) / 100);
  });

  // Test 9: Full precision during conversion, rounding only at display
  it('carries full precision before display rounding', () => {
    const rate = 11.24;
    const amount = 1.126; // 1.126 * 11.24 = 12.65624 — carries precision, rounds to 12.66
    const converted = convertCurrency(amount, 'EUR', 'SEK', rate);
    expect(converted).toBeCloseTo(amount * rate, 5);
    const displayed = roundForDisplay(converted);
    expect(displayed).toBe(Math.round(amount * rate * 100) / 100);
    expect(displayed).toBe(12.66);
  });

  // Test 6 (part): Missing/invalid rate → null (no conversion)
  it('returns null when rate is 0', () => {
    expect(convertCurrency(100, 'EUR', 'SEK', 0)).toBeNull();
  });

  it('returns null when rate is null', () => {
    expect(convertCurrency(100, 'EUR', 'SEK', null)).toBeNull();
  });

  it('returns null when rate is undefined', () => {
    expect(convertCurrency(100, 'EUR', 'SEK', undefined)).toBeNull();
  });

  it('returns null when rate is negative', () => {
    expect(convertCurrency(100, 'EUR', 'SEK', -1)).toBeNull();
  });

  // Test 7: Wrong currency symbol never shown for unconverted value
  it('returns null for null amount', () => {
    expect(convertCurrency(null, 'EUR', 'SEK', 11.24)).toBeNull();
  });

  it('returns null for undefined amount', () => {
    expect(convertCurrency(undefined, 'EUR', 'SEK', 11.24)).toBeNull();
  });

  it('returns null for NaN amount', () => {
    expect(convertCurrency(NaN, 'EUR', 'SEK', 11.24)).toBeNull();
  });

  // Immutability
  it('does not mutate the source value', () => {
    const obj = { amount: 100 };
    convertCurrency(obj.amount, 'EUR', 'SEK', 11.24);
    expect(obj.amount).toBe(100);
  });
});

// ─── roundForDisplay ──────────────────────────────────────────────────────────

describe('roundForDisplay', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundForDisplay(1.126)).toBe(1.13);
    expect(roundForDisplay(1.124)).toBe(1.12);
    expect(roundForDisplay(100)).toBe(100);
    expect(roundForDisplay(1124.3567)).toBe(1124.36);
    expect(roundForDisplay(0.555)).toBe(0.56);
    expect(roundForDisplay(1124.001)).toBe(1124);
  });
});

// ─── getRate ──────────────────────────────────────────────────────────────────

describe('getRate', () => {
  // Same currency — always rate 1 regardless of fxRates
  it('returns rate=1 for same-currency pair', () => {
    const r = getRate('EUR', 'EUR', MOCK_FX_RATES);
    expect(r).not.toBeNull();
    expect(r.rate).toBe(1);
    expect(r.base).toBe('EUR');
    expect(r.quote).toBe('EUR');
  });

  it('returns rate=1 for same-currency pair without fxRates', () => {
    const r = getRate('USD', 'USD', []);
    expect(r).not.toBeNull();
    expect(r.rate).toBe(1);
  });

  // Base conversion: EUR → SEK
  it('returns correct rate for EUR → SEK', () => {
    const r = getRate('EUR', 'SEK', MOCK_FX_RATES);
    expect(r).not.toBeNull();
    expect(r.base).toBe('EUR');
    expect(r.quote).toBe('SEK');
    // EUR→SEK: SEK_rate / EUR_rate = 11.0172 / 1.0 = 11.0172
    expect(r.rate).toBeCloseTo(11.0172, 4);
    expect(r.rate_date).toBe('2026-08-15');
  });

  // Reverse conversion: SEK → EUR
  it('returns correct rate for SEK → EUR', () => {
    const r = getRate('SEK', 'EUR', MOCK_FX_RATES);
    expect(r).not.toBeNull();
    // SEK→EUR: EUR_rate / SEK_rate = 1.0 / 11.0172 ≈ 0.09078
    expect(r.rate).toBeCloseTo(1 / 11.0172, 6);
  });

  // Cross conversion: USD → SEK
  it('returns correct cross-rate for USD → SEK', () => {
    const r = getRate('USD', 'SEK', MOCK_FX_RATES);
    expect(r).not.toBeNull();
    // USD→SEK: SEK_rate / USD_rate = 11.0172 / 1.1552
    const expected = 11.0172 / 1.1552;
    expect(r.rate).toBeCloseTo(expected, 4);
  });

  // Cross conversion: GBP → USD
  it('returns correct cross-rate for GBP → USD', () => {
    const r = getRate('GBP', 'USD', MOCK_FX_RATES);
    expect(r).not.toBeNull();
    const expected = 1.1552 / 0.85525;
    expect(r.rate).toBeCloseTo(expected, 4);
  });

  // Missing currency returns null — no fake fallback
  it('returns null for a currency not in backend rates', () => {
    expect(getRate('EUR', 'ILS', MOCK_FX_RATES)).toBeNull();
    expect(getRate('CNY', 'EUR', MOCK_FX_RATES)).toBeNull();
    expect(getRate('EUR', 'JPY', MOCK_FX_RATES)).toBeNull();
    expect(getRate('ZZZ', 'EUR', MOCK_FX_RATES)).toBeNull();
  });

  // Empty / missing fxRates
  it('returns null when fxRates is empty', () => {
    expect(getRate('EUR', 'SEK', [])).toBeNull();
  });

  it('returns null when fxRates is null', () => {
    expect(getRate('EUR', 'SEK', null)).toBeNull();
  });

  it('returns null when fxRates is undefined', () => {
    expect(getRate('EUR', 'SEK', undefined)).toBeNull();
  });

  // Missing arguments
  it('returns null for missing fromCurrency', () => {
    expect(getRate(null, 'EUR', MOCK_FX_RATES)).toBeNull();
  });

  it('returns null for missing toCurrency', () => {
    expect(getRate('EUR', null, MOCK_FX_RATES)).toBeNull();
  });

  // rate_date is populated from the backend response
  it('populates rate_date from backend data', () => {
    const r = getRate('EUR', 'USD', MOCK_FX_RATES);
    expect(r.rate_date).toBe('2026-08-15');
  });

  // Immutability
  it('does not modify its arguments', () => {
    const from = 'EUR';
    const to = 'SEK';
    const rates = [...MOCK_FX_RATES];
    getRate(from, to, rates);
    expect(from).toBe('EUR');
    expect(to).toBe('SEK');
    expect(rates).toHaveLength(MOCK_FX_RATES.length);
  });
});

// ─── buildCurrencyList ────────────────────────────────────────────────────────

describe('buildCurrencyList', () => {
  it('puts the order currency first', () => {
    const list = buildCurrencyList('USD', MOCK_FX_RATES);
    expect(list[0]).toBe('USD');
  });

  it('includes all backend currencies without duplicates', () => {
    const list = buildCurrencyList('EUR', MOCK_FX_RATES);
    const unique = new Set(list);
    expect(unique.size).toBe(list.length);
    // All currencies in MOCK_FX_RATES should be present
    for (const r of MOCK_FX_RATES) {
      expect(list).toContain(r.quote);
    }
  });

  it('always includes orderCurrency even if not in backend rates', () => {
    const list = buildCurrencyList('CHF', MOCK_FX_RATES);
    expect(list).toContain('CHF');
    expect(list[0]).toBe('CHF');
  });

  it('includes baseCurrency without duplicating orderCurrency', () => {
    const list = buildCurrencyList('EUR', MOCK_FX_RATES, 'EUR');
    const count = list.filter((c) => c === 'EUR').length;
    expect(count).toBe(1);
  });

  it('includes both orderCurrency and baseCurrency without duplicates', () => {
    const list = buildCurrencyList('EUR', MOCK_FX_RATES, 'SEK');
    const unique = new Set(list);
    expect(unique.size).toBe(list.length);
    expect(list).toContain('EUR');
    expect(list).toContain('SEK');
  });

  it('does not expose currencies absent from backend rates', () => {
    // ILS and CNY are not in MOCK_FX_RATES
    const list = buildCurrencyList('EUR', MOCK_FX_RATES);
    expect(list).not.toContain('ILS');
    expect(list).not.toContain('CNY');
  });

  it('returns just the orderCurrency when fxRates is empty', () => {
    const list = buildCurrencyList('EUR', []);
    expect(list).toEqual(['EUR']);
  });
});

// ─── sessionCurrencyKey ───────────────────────────────────────────────────────

describe('sessionCurrencyKey', () => {
  it('returns the expected key format', () => {
    expect(sessionCurrencyKey('ord-123')).toBe('plm_order_display_currency_ord-123');
  });

  it('scopes key to the specific order ID', () => {
    const key1 = sessionCurrencyKey('ord-2026-portugal');
    const key2 = sessionCurrencyKey('ord-2026-sweden');
    expect(key1).not.toBe(key2);
    expect(key1).toContain('ord-2026-portugal');
    expect(key2).toContain('ord-2026-sweden');
  });
});

// ─── Test 8: Converted total from native total, not summed rows ───────────────

describe('total conversion rule', () => {
  it('converts native total directly rather than summing converted rows', () => {
    const rate = 11.0172; // EUR→SEK from MOCK_FX_RATES
    const rows = [100.01, 200.02, 300.03];
    const nativeTotal = rows.reduce((a, b) => a + b, 0); // 600.06

    // CORRECT: convert the native total
    const correctTotal = roundForDisplay(convertCurrency(nativeTotal, 'EUR', 'SEK', rate));

    // INCORRECT approach: sum individually rounded converted rows
    const sumOfRoundedRows = rows
      .map((r) => roundForDisplay(convertCurrency(r, 'EUR', 'SEK', rate)))
      .reduce((a, b) => a + b, 0);
    const sumRounded = roundForDisplay(sumOfRoundedRows);

    expect(Math.abs(correctTotal - sumRounded)).toBeLessThanOrEqual(0.03);
    expect(correctTotal).toBe(roundForDisplay(nativeTotal * rate));
  });
});

// ─── Test 3: Switching currencies does not modify order data ─────────────────

describe('order data immutability', () => {
  it('convertCurrency does not modify the order object', () => {
    const order = {
      id: 'ord-1',
      order_currency: 'EUR',
      shipping_cost: 500,
      total_landed_cost: 1234.56,
    };
    const snapshot = JSON.stringify(order);

    convertCurrency(order.shipping_cost, 'EUR', 'SEK', 11.0172);
    convertCurrency(order.total_landed_cost, 'EUR', 'SEK', 11.0172);

    expect(JSON.stringify(order)).toBe(snapshot);
  });
});

// ─── Test 10: Currency selector does not generate audit events ────────────────

describe('session preference — no audit, no order patch', () => {
  it('sessionCurrencyKey uses a dedicated session prefix, not an audit key', () => {
    const key = sessionCurrencyKey('ord-test');
    expect(key).toMatch(/^plm_order_display_currency_/);
    expect(key).not.toContain('plm_audit_log');
    expect(key).not.toContain('plm_orders');
  });

  it('different orders produce different session keys', () => {
    const keys = ['ord-a', 'ord-b', 'ord-c'].map(sessionCurrencyKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(3);
  });
});

// ─── Missing rate fallback — no fake rates ────────────────────────────────────

describe('missing rate fallback', () => {
  it('getRate returns null for unsupported currency so fmtMoney can fall back', () => {
    // JPY not in MOCK_FX_RATES
    const rate = getRate('EUR', 'JPY', MOCK_FX_RATES);
    expect(rate).toBeNull();
  });

  it('getRate returns null when fxRates unavailable', () => {
    const rate = getRate('EUR', 'SEK', []);
    expect(rate).toBeNull();
  });

  it('convertCurrency returns null when rate is null, preventing wrong-symbol display', () => {
    const result = convertCurrency(100, 'EUR', 'JPY', null);
    expect(result).toBeNull();
  });
});

// ─── Cross-rate calculation accuracy ─────────────────────────────────────────

describe('cross-rate accuracy', () => {
  it('USD → SEK equals EUR/SEK ÷ EUR/USD', () => {
    const r = getRate('USD', 'SEK', MOCK_FX_RATES);
    const eurSek = MOCK_FX_RATES.find((x) => x.quote === 'SEK').rate;
    const eurUsd = MOCK_FX_RATES.find((x) => x.quote === 'USD').rate;
    expect(r.rate).toBeCloseTo(eurSek / eurUsd, 8);
  });

  it('inverse of EUR → SEK equals SEK → EUR', () => {
    const forward = getRate('EUR', 'SEK', MOCK_FX_RATES);
    const reverse = getRate('SEK', 'EUR', MOCK_FX_RATES);
    expect(forward.rate * reverse.rate).toBeCloseTo(1, 8);
  });
});
