import { getItems, setItems } from './storage.js';
import { STORAGE_KEYS } from '../constants.js';

const KEY = STORAGE_KEYS.suppliers;

export const supplierRepository = {
  getAll() {
    return getItems(KEY).filter((s) => !s.spam);
  },

  getSpam() {
    return getItems(KEY).filter((s) => s.spam === true);
  },

  getById(id) {
    return getItems(KEY).find((s) => s.id === id && !s.spam) ?? null;
  },

  create(data) {
    const all = getItems(KEY);
    const now = new Date().toISOString();
    const item = { ...data, spam: false, created_at: now, updated_at: now };
    setItems(KEY, [...all, item]);
    return item;
  },

  update(id, data) {
    const all = getItems(KEY);
    const idx = all.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    const updated = { ...all[idx], ...data, updated_at: new Date().toISOString() };
    all[idx] = updated;
    setItems(KEY, all);
    return updated;
  },

  softDelete(id) {
    return this.update(id, { spam: true });
  },

  restore(id) {
    return this.update(id, { spam: false });
  },

  hardDelete(id) {
    const all = getItems(KEY).filter((s) => s.id !== id);
    setItems(KEY, all);
  },
};
