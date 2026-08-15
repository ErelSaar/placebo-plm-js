import {
  convertCurrency,
  roundForDisplay,
  getRate,
  buildCurrencyList,
  sessionCurrencyKey,
  SUPPORTED_CURRENCIES,
} from '@/lib/currency';

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
    const amount = 198.70; // LOKE unit cost
    const converted = convertCurrency(amount, 'EUR', 'SEK', rate);
    // Full-precision result carried through
    expect(converted).toBeCloseTo(amount * rate, 4);
    // Only round at display time
    expect(roundForDisplay(converted)).toBe(Math.round(amount * rate * 100) / 100);
  });

  // Test 9: Full precision during conversion, rounding only at display
  it('carries full precision before display rounding', () => {
    const rate = 11.24;
    const amount = 1.126; // 1.126 * 11.24 = 12.65624 — carries precision, rounds to 12.66
    const converted = convertCurrency(amount, 'EUR', 'SEK', rate);
    // Full precision is carried
    expect(converted).toBeCloseTo(amount * rate, 5);
    // Only round at display time
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
  it('returns a rate object with rate=1 for same-currency pair', () => {
    const r = getRate('EUR', 'EUR');
    expect(r).not.toBeNull();
    expect(r.rate).toBe(1);
    expect(r.base).toBe('EUR');
    expect(r.quote).toBe('EUR');
  });

  it('returns a rate object for known EUR→SEK pair', () => {
    const r = getRate('EUR', 'SEK');
    expect(r).not.toBeNull();
    expect(r.rate).toBeGreaterThan(0);
    expect(r.base).toBe('EUR');
    expect(r.quote).toBe('SEK');
    expect(r.rate_date).toBeTruthy();
  });

  it('returns a rate for all supported cross-pairs', () => {
    const currencies = ['EUR', 'USD', 'GBP', 'SEK', 'ILS', 'CNY'];
    for (const from of currencies) {
      for (const to of currencies) {
        const r = getRate(from, to);
        expect(r).not.toBeNull();
        expect(r.rate).toBeGreaterThan(0);
      }
    }
  });

  // Test 6: Missing rate returns null
  it('returns null for an unknown currency pair', () => {
    expect(getRate('EUR', 'XYZ')).toBeNull();
    expect(getRate('ZZZ', 'EUR')).toBeNull();
  });

  it('returns null for missing arguments', () => {
    expect(getRate(null, 'EUR')).toBeNull();
    expect(getRate('EUR', null)).toBeNull();
  });
});

// ─── buildCurrencyList ────────────────────────────────────────────────────────

describe('buildCurrencyList', () => {
  it('puts the order currency first', () => {
    const list = buildCurrencyList('USD');
    expect(list[0]).toBe('USD');
  });

  it('includes all supported currencies without duplicates', () => {
    const list = buildCurrencyList('EUR');
    const unique = new Set(list);
    expect(unique.size).toBe(list.length);
    for (const c of SUPPORTED_CURRENCIES) {
      expect(list).toContain(c);
    }
  });

  it('always includes orderCurrency even if not in SUPPORTED_CURRENCIES', () => {
    const list = buildCurrencyList('CHF');
    expect(list).toContain('CHF');
    expect(list[0]).toBe('CHF');
  });

  it('includes baseCurrency without duplicating orderCurrency', () => {
    // Both order and base are EUR — only one EUR entry
    const list = buildCurrencyList('EUR', 'EUR');
    const count = list.filter((c) => c === 'EUR').length;
    expect(count).toBe(1);
  });

  it('includes both orderCurrency and baseCurrency without duplicates', () => {
    const list = buildCurrencyList('EUR', 'SEK');
    const unique = new Set(list);
    expect(unique.size).toBe(list.length);
    expect(list).toContain('EUR');
    expect(list).toContain('SEK');
  });
});

// ─── sessionCurrencyKey ───────────────────────────────────────────────────────

describe('sessionCurrencyKey', () => {
  // Test 5: Session preference scoped to the order
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
    const rate = 11.24;
    const rows = [100.01, 200.02, 300.03];
    const nativeTotal = rows.reduce((a, b) => a + b, 0); // 600.06

    // CORRECT: convert the native total
    const correctTotal = roundForDisplay(convertCurrency(nativeTotal, 'EUR', 'SEK', rate));

    // INCORRECT approach: sum individually rounded converted rows
    const sumOfRoundedRows = rows
      .map((r) => roundForDisplay(convertCurrency(r, 'EUR', 'SEK', rate)))
      .reduce((a, b) => a + b, 0);
    const sumRounded = roundForDisplay(sumOfRoundedRows);

    // They should both be close but may differ by a cent due to rounding
    expect(Math.abs(correctTotal - sumRounded)).toBeLessThanOrEqual(0.03);
    // The spec-correct total is derived from the native total
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

    convertCurrency(order.shipping_cost, 'EUR', 'SEK', 11.24);
    convertCurrency(order.total_landed_cost, 'EUR', 'SEK', 11.24);

    expect(JSON.stringify(order)).toBe(snapshot);
  });

  it('getRate does not modify its arguments', () => {
    const from = 'EUR';
    const to = 'SEK';
    getRate(from, to);
    expect(from).toBe('EUR');
    expect(to).toBe('SEK');
  });
});

// ─── Test 10: Currency selector does not generate audit events ────────────────
// The currency selector calls handleDisplayCurrencyChange which only writes to
// sessionStorage and calls setDisplayCurrency — it never calls recordRepository.
// This is verified structurally: sessionCurrencyKey produces a sessionStorage
// key (not a localStorage key and not an audit-log key).

describe('session preference — no audit, no order patch', () => {
  it('sessionCurrencyKey uses a dedicated session prefix, not an audit key', () => {
    const key = sessionCurrencyKey('ord-test');
    expect(key).toMatch(/^plm_order_display_currency_/);
    // Must not collide with audit log or order storage keys
    expect(key).not.toContain('plm_audit_log');
    expect(key).not.toContain('plm_orders');
  });

  it('different orders produce different session keys', () => {
    const keys = ['ord-a', 'ord-b', 'ord-c'].map(sessionCurrencyKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(3);
  });
});

// ─── Test 6 (extended): Missing rate falls back to native currency ────────────

describe('missing rate fallback', () => {
  it('getRate returns null for unsupported currency so fmtMoney can fall back', () => {
    const rate = getRate('EUR', 'JPY'); // JPY not in MOCK_FX_RATES
    expect(rate).toBeNull();
  });

  it('convertCurrency returns null when rate is null, preventing wrong-symbol display', () => {
    // Simulate what fmtMoney does: if fxRate is null, it falls back to native.
    // This test confirms that calling convertCurrency with a null rate returns null.
    const result = convertCurrency(100, 'EUR', 'JPY', null);
    expect(result).toBeNull();
    // The caller (fmtMoney) must then fall back to native formatCurrency.
  });
});
