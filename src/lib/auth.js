import { STORAGE_KEYS } from './constants';

// ─── Temporary credentials ─────────────────────────────────────────────────
// Replace this check with a real auth call (e.g. Supabase) when ready.
const TEMP_USERNAME = 'Placebo';
const TEMP_PASSWORD = 'password';

export function login(username, password) {
  if (username === TEMP_USERNAME && password === TEMP_PASSWORD) {
    const user = { username: TEMP_USERNAME, role: 'admin' };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    return { ok: true, user };
  }
  return { ok: false };
}

export function logout() {
  localStorage.removeItem(STORAGE_KEYS.user);
}

export function getUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
