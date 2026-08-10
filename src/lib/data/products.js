import { getItems, setItems } from './storage.js';
import { STORAGE_KEYS } from '../constants.js';

const KEY = STORAGE_KEYS.products;

export const productRepository = {
  getAll() {
    return getItems(KEY);
  },

  getById(id) {
    return getItems(KEY).find((p) => p.id === id) ?? null;
  },

  create(data) {
    const all = getItems(KEY);
    const now = new Date().toISOString();
    const item = { ...data, created_at: now, updated_at: now };
    setItems(KEY, [...all, item]);
    return item;
  },

  update(id, data) {
    const all = getItems(KEY);
    const idx = all.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const updated = { ...all[idx], ...data, updated_at: new Date().toISOString() };
    all[idx] = updated;
    setItems(KEY, all);
    return updated;
  },

  remove(id) {
    const all = getItems(KEY).filter((p) => p.id !== id);
    setItems(KEY, all);
  },
};
