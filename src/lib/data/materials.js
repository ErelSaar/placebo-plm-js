import { getItems, setItems } from './storage.js';
import { STORAGE_KEYS } from '../constants.js';

const KEY = STORAGE_KEYS.materials;

export const materialRepository = {
  getAll() {
    return getItems(KEY).filter((m) => !m.spam);
  },

  getSpam() {
    return getItems(KEY).filter((m) => m.spam === true);
  },

  getById(id) {
    return getItems(KEY).find((m) => m.id === id && !m.spam) ?? null;
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
    const idx = all.findIndex((m) => m.id === id);
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
    const all = getItems(KEY).filter((m) => m.id !== id);
    setItems(KEY, all);
  },
};
