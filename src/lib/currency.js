// ─── Supported Currencies ─────────────────────────────────────────────────────
// Centralised list. Add or remove currencies here; all selectors build from this.

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'SEK', 'ILS', 'CNY'];

// ─── Development FX Rates ─────────────────────────────────────────────────────
// TODO: Replace MOCK_FX_RATES with a backend API call when fx_rates records are
// available. Expected contract:
//   GET /api/fx-rates  →  [{ base, quote, rate, rate_date, source }]
// The getRate() function below is the single point to swap in the real provider.
//
// These are approximate indicative rates as of 2026-08-14 for development only.
// They must NOT be used for financial decisions or real transactions.

const MOCK_FX_RATES = [
  // EUR pairs
  { base: 'EUR', quote: 'USD', rate: 1.08,    rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'EUR', quote: 'GBP', rate: 0.855,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'EUR', quote: 'SEK', rate: 11.24,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'EUR', quote: 'ILS', rate: 3.97,    rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'EUR', quote: 'CNY', rate: 7.82,    rate_date: '2026-08-14', source: 'dev-mock' },
  // USD pairs
  { base: 'USD', quote: 'EUR', rate: 0.926,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'USD', quote: 'GBP', rate: 0.792,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'USD', quote: 'SEK', rate: 10.41,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'USD', quote: 'ILS', rate: 3.68,    rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'USD', quote: 'CNY', rate: 7.24,    rate_date: '2026-08-14', source: 'dev-mock' },
  // GBP pairs
  { base: 'GBP', quote: 'EUR', rate: 1.170,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'GBP', quote: 'USD', rate: 1.263,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'GBP', quote: 'SEK', rate: 13.15,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'GBP', quote: 'ILS', rate: 4.64,    rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'GBP', quote: 'CNY', rate: 9.15,    rate_date: '2026-08-14', source: 'dev-mock' },
  // SEK pairs
  { base: 'SEK', quote: 'EUR', rate: 0.0890,  rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'SEK', quote: 'USD', rate: 0.0961,  rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'SEK', quote: 'GBP', rate: 0.0761,  rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'SEK', quote: 'ILS', rate: 0.353,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'SEK', quote: 'CNY', rate: 0.696,   rate_date: '2026-08-14', source: 'dev-mock' },
  // ILS pairs
  { base: 'ILS', quote: 'EUR', rate: 0.252,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'ILS', quote: 'USD', rate: 0.272,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'ILS', quote: 'GBP', rate: 0.215,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'ILS', quote: 'SEK', rate: 2.83,    rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'ILS', quote: 'CNY', rate: 1.97,    rate_date: '2026-08-14', source: 'dev-mock' },
  // CNY pairs
  { base: 'CNY', quote: 'EUR', rate: 0.1279,  rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'CNY', quote: 'USD', rate: 0.138,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'CNY', quote: 'GBP', rate: 0.1094,  rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'CNY', quote: 'SEK', rate: 1.438,   rate_date: '2026-08-14', source: 'dev-mock' },
  { base: 'CNY', quote: 'ILS', rate: 0.508,   rate_date: '2026-08-14', source: 'dev-mock' },
];

// ─── Rate Lookup ───────────────────────────────────────────────────────────────

/**
 * Get an FX rate record for a currency pair.
 *
 * Isolate point: swap out MOCK_FX_RATES lookup here for a real backend call
 * once GET /api/fx-rates is available.
 *
 * @param {string} fromCurrency
 * @param {string} toCurrency
 * @returns {{ base: string, quote: string, rate: number, rate_date: string|null, source: string|null } | null}
 */
export function getRate(fromCurrency, toCurrency) {
  if (!fromCurrency || !toCurrency) return null;
  if (fromCurrency === toCurrency) {
    return { base: fromCurrency, quote: toCurrency, rate: 1, rate_date: null, source: null };
  }
  return MOCK_FX_RATES.find((r) => r.base === fromCurrency && r.quote === toCurrency) ?? null;
}

// ─── Currency Conversion ───────────────────────────────────────────────────────

/**
 * Convert an amount from one currency to another.
 *
 * - Returns the original amount unchanged when fromCurrency === toCurrency.
 * - Returns null for invalid/missing amounts or a zero/missing rate.
 * - Carries full precision — call roundForDisplay() only at display time.
 * - Does not mutate the source value.
 *
 * @param {number|null|undefined} amount
 * @param {string} fromCurrency
 * @param {string} toCurrency
 * @param {number|null|undefined} rate  (1 fromCurrency = rate toCurrency)
 * @returns {number|null}
 */
export function convertCurrency(amount, fromCurrency, toCurrency, rate) {
  if (amount == null || isNaN(amount)) return null;
  if (fromCurrency === toCurrency) return amount;
  if (!rate || rate <= 0) return null;
  return amount * rate;
}

/**
 * Round a number to 2 decimal places for display.
 * Use only at the presentation layer — not during intermediate calculations.
 *
 * @param {number} n
 * @returns {number}
 */
export function roundForDisplay(n) {
  return Math.round(n * 100) / 100;
}

// ─── Currency List Builder ─────────────────────────────────────────────────────

/**
 * Build an ordered, deduplicated currency selector list.
 * The order currency is always first; supported currencies follow.
 *
 * @param {string} orderCurrency
 * @param {string|null} [baseCurrency]  organisation base currency if known
 * @returns {string[]}
 */
export function buildCurrencyList(orderCurrency, baseCurrency = null) {
  const seen = new Set();
  const list = [];

  function add(c) {
    if (c && !seen.has(c)) { seen.add(c); list.push(c); }
  }

  add(orderCurrency);
  if (baseCurrency) add(baseCurrency);
  for (const c of SUPPORTED_CURRENCIES) add(c);

  return list;
}

// ─── Session Storage Key ───────────────────────────────────────────────────────

/**
 * Returns the sessionStorage key for order-level display currency preference.
 * Scoped to the order so different orders keep independent preferences.
 *
 * @param {string} orderId
 * @returns {string}
 */
export function sessionCurrencyKey(orderId) {
  return `plm_order_display_currency_${orderId}`;
}
