import { getItems, setItems } from './storage.js';
import { STORAGE_KEYS } from '../constants.js';

const ORDER_KEY = STORAGE_KEYS.orders;
const LINE_KEY = STORAGE_KEYS.order_lines;

export const orderRepository = {
  getAll() {
    return getItems(ORDER_KEY).filter((o) => !o.spam);
  },

  getSpam() {
    return getItems(ORDER_KEY).filter((o) => o.spam === true);
  },

  getById(id) {
    return getItems(ORDER_KEY).find((o) => o.id === id && !o.spam) ?? null;
  },

  create(data) {
    const all = getItems(ORDER_KEY);
    const now = new Date().toISOString();
    const item = { ...data, spam: false, created_at: now, updated_at: now };
    setItems(ORDER_KEY, [...all, item]);
    return item;
  },

  update(id, data) {
    const all = getItems(ORDER_KEY);
    const idx = all.findIndex((o) => o.id === id);
    if (idx < 0) return null;
    const updated = { ...all[idx], ...data, updated_at: new Date().toISOString() };
    all[idx] = updated;
    setItems(ORDER_KEY, all);
    return updated;
  },

  softDelete(id) {
    return this.update(id, { spam: true });
  },

  restore(id) {
    return this.update(id, { spam: false });
  },

  hardDelete(id) {
    const all = getItems(ORDER_KEY).filter((o) => o.id !== id);
    setItems(ORDER_KEY, all);
    // Also permanently remove all order lines for this order
    const lines = getItems(LINE_KEY).filter((l) => l.order_id !== id);
    setItems(LINE_KEY, lines);
  },

  orderNumberExists(orderNumber, excludeId) {
    return getItems(ORDER_KEY).some(
      (o) => o.order_number === orderNumber && o.id !== excludeId
    );
  },
};

export const orderLineRepository = {
  getAll() {
    return getItems(LINE_KEY);
  },

  getByOrder(orderId) {
    return getItems(LINE_KEY).filter((l) => l.order_id === orderId);
  },

  getByProduct(productId) {
    return getItems(LINE_KEY).filter((l) => l.product_id === productId);
  },

  saveMany(orderId, lines) {
    const all = getItems(LINE_KEY).filter((l) => l.order_id !== orderId);
    setItems(LINE_KEY, [...all, ...lines]);
  },

  removeByOrder(orderId) {
    const all = getItems(LINE_KEY).filter((l) => l.order_id !== orderId);
    setItems(LINE_KEY, all);
  },
};
