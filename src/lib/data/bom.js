import { getItems, setItems } from './storage.js';
import { STORAGE_KEYS } from '../constants.js';

const KEY = STORAGE_KEYS.bom_lines;

export const bomRepository = {
  getAll() {
    return getItems(KEY);
  },

  getByProduct(productId) {
    return getItems(KEY)
      .filter((b) => b.product_id === productId)
      .sort((a, b) => a.sort_order - b.sort_order);
  },

  create(data) {
    const all = getItems(KEY);
    setItems(KEY, [...all, data]);
    return data;
  },

  update(id, data) {
    const all = getItems(KEY);
    const idx = all.findIndex((b) => b.id === id);
    if (idx < 0) return null;
    all[idx] = { ...all[idx], ...data };
    setItems(KEY, all);
    return all[idx];
  },

  remove(id) {
    const all = getItems(KEY).filter((b) => b.id !== id);
    setItems(KEY, all);
  },

  removeByProduct(productId) {
    const all = getItems(KEY).filter((b) => b.product_id !== productId);
    setItems(KEY, all);
  },

  saveMany(lines) {
    const all = getItems(KEY);
    const other = all.filter((b) => !lines.some((l) => l.id === b.id));
    setItems(KEY, [...other, ...lines]);
  },
};
