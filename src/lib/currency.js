// ─── Rate Lookup ───────────────────────────────────────────────────────────────

/**
 * Get an FX rate for a currency pair using EUR-based rates from the backend.
 *
 * The backend returns rates in the form:
 *   [{ date: string, base: 'EUR', quote: string, rate: number }, ...]
 *
 * Cross-rates are derived as:
 *   from → to  =  (EUR→to rate) / (EUR→from rate)
 *
 * @param {string} fromCurrency
 * @param {string} toCurrency
 * @param {Array<{date: string, base: string, quote: string, rate: number}>} fxRates
 *   EUR-based rate array from loadCurrencies().
 * @returns {{ base: string, quote: string, rate: number, rate_date: string|null, source: null } | null}
 */
export function getRate(fromCurrency, toCurrency, fxRates) {
  if (!fromCurrency || !toCurrency) return null;

  if (fromCurrency === toCurrency) {
    return { base: fromCurrency, quote: toCurrency, rate: 1, rate_date: null, source: null };
  }

  if (!fxRates || fxRates.length === 0) return null;

  // Each entry has base='EUR'. EUR itself is included with rate=1.
  const fromEntry = fxRates.find((r) => r.quote === fromCurrency);
  const toEntry   = fxRates.find((r) => r.quote === toCurrency);

  if (!fromEntry || !toEntry) return null;
  if (!fromEntry.rate || fromEntry.rate <= 0) return null;

  // Cross-rate: from → to = (EUR→to) / (EUR→from)
  const crossRate = toEntry.rate / fromEntry.rate;

  return {
    base: fromCurrency,
    quote: toCurrency,
    rate: crossRate,
    rate_date: toEntry.date ?? null,
    source: null,
  };
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
 * Build an ordered, deduplicated currency selector list from backend rates.
 * The order currency is always first; all currencies with backend rates follow.
 * Only currencies that actually have a rate from the backend are included.
 *
 * @param {string} orderCurrency
 * @param {Array<{quote: string}>} fxRates  EUR-based rate array from loadCurrencies().
 * @param {string|null} [baseCurrency]       organisation base currency if known
 * @returns {string[]}
 */
export function buildCurrencyList(orderCurrency, fxRates, baseCurrency = null) {
  const seen = new Set();
  const list = [];

  function add(c) {
    if (c && !seen.has(c)) { seen.add(c); list.push(c); }
  }

  add(orderCurrency);
  if (baseCurrency) add(baseCurrency);

  if (fxRates && fxRates.length > 0) {
    for (const r of fxRates) {
      if (r.quote) add(r.quote);
    }
  }

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
