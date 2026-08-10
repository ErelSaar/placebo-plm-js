/**
 * Generic localStorage storage layer.
 * Replace getItems/setItems with Supabase calls to migrate away from localStorage.
 */

export function getItems(key) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setItems(key, data) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}
