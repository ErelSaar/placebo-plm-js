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
    role: 'viewer', // lowest permission level (ROLE_PERMISSIONS.guest = 0)
  };

  saveRegisteredUsers([...users, newUser]);
  return { ok: true };
}

// ─── Login ──────────────────────────────────────────────────────────────────

export function login(username, password) {
  // 1. Check built-in admin account.
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const user = { username: ADMIN_USERNAME, name: 'Placebo Admin', role: 'owner' };
    localStorage.setItem(STORAGE_KEYS.logged_user, JSON.stringify(user));
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
    const user = {id: found.id, username: found.username, name: found.name, role: found.role };
    localStorage.setItem(STORAGE_KEYS.logged_user, JSON.stringify(user));
    return { ok: true, user };
  }

  return { ok: false };
}

// ─── Role management ─────────────────────────────────────────────────────────

export function updateUserRole(userId, newRole) {
  const users = getRegisteredUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return { ok: false, error: 'User not found' };

  users[idx] = { ...users[idx], role: newRole };
  saveRegisteredUsers(users);

  // If this user is currently logged in, update their session too
  const currentUser = getUser();
  if (currentUser && currentUser.username === users[idx].username) {
    localStorage.setItem(STORAGE_KEYS.logged_user, JSON.stringify({ ...currentUser, role: newRole }));
  }

  return { ok: true };
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
