import { STORAGE_KEYS } from './constants.js';
import {
  DEMO_SUPPLIERS,
  DEMO_MATERIALS,
  DEMO_PRODUCTS,
  DEMO_BOM_LINES,
  DEMO_ORDERS,
  DEMO_ORDER_LINES,
} from '../data/demo-data.js';
import { setItems } from './data/storage.js';

export function initializeDemoData() {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(STORAGE_KEYS.initialized)) return;

  setItems(STORAGE_KEYS.suppliers, DEMO_SUPPLIERS);
  setItems(STORAGE_KEYS.materials, DEMO_MATERIALS);
  setItems(STORAGE_KEYS.products, DEMO_PRODUCTS);
  setItems(STORAGE_KEYS.bom_lines, DEMO_BOM_LINES);
  setItems(STORAGE_KEYS.orders, DEMO_ORDERS);
  setItems(STORAGE_KEYS.order_lines, DEMO_ORDER_LINES);
  localStorage.setItem(STORAGE_KEYS.initialized, 'true');
}

export function resetDemoData() {
  if (typeof window === 'undefined') return;
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  // Clear old keys from v2
  localStorage.removeItem('plm_initialized');
  localStorage.removeItem('plm_initialized_v2');
  initializeDemoData();
}
