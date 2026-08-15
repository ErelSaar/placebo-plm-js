import { apiRequest } from './aws-storage';

/**
 * Load all available FX rates from the backend.
 * Returns an array of EUR-based rate objects from the Frankfurter API:
 *   [{ date, base: 'EUR', quote: 'USD'|'GBP'|..., rate: number }, ...]
 *
 * Callers should handle the returned promise and store the result in state.
 * Pass the loaded rates to getRate() and buildCurrencyList() in @/lib/currency.
 */
export async function loadCurrencies() {
    return apiRequest('currencies', 'get');
}
