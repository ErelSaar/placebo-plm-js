import { STORAGE_KEYS } from './constants';

// ─── Temporary dev credentials ──────────────────────────────────────────────
// Replace with a real auth call (e.g. Supabase) when ready.
const ADMIN_USERNAME = 'Placebo';
const ADMIN_PASSWORD = 'password';

// ─── Registered user registry ───────────────────────────────────────────────
// Dev-only: stored as plaintext in localStorage.
// Swap getRegisteredUsers / saveRegisteredUsers for real API calls to migrate.

export function getRegisteredUsers() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.registered_users);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRegisteredUsers(users) {
  localStorage.setItem(STORAGE_KEYS.registered_users, JSON.stringify(users));
}

export function registerUser({ name, username, email, password }) {
  const users = getRegisteredUsers();

  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, error: 'Username is already taken.' };
  }
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: 'Email is already registered.' };
  }

  const newUser = {
    id: Date.now().toString(),
    name,
    username,
    email,
    // NOTE: plaintext password — intentionally temporary dev storage only.
    password,
    role: 'guest', // lowest permission level (ROLE_PERMISSIONS.guest = 0)
  };

  saveRegisteredUsers([...users, newUser]);
  return { ok: true };
}

// ─── Login ──────────────────────────────────────────────────────────────────

export function login(username, password) {
  // 1. Check built-in admin account.
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const user = { username: ADMIN_USERNAME, name: 'Placebo Admin', role: 'admin' };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    return { ok: true, user };
  }

  // 2. Check registered users.
  const users = getRegisteredUsers();
  const found = users.find(
    (u) =>
      u.username.toLowerCase() === username.toLowerCase() &&
      u.password === password
  );

  if (found) {
    const user = { username: found.username, name: found.name, role: found.role };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    return { ok: true, user };
  }

  return { ok: false };
}

// ─── Session helpers ─────────────────────────────────────────────────────────

export function logout() {
  localStorage.removeItem(STORAGE_KEYS.logged_user);
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.logged_user);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
