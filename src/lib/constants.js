// ─── Material Category Groups ──────────────────────────────────────────────────

export const MATERIAL_CATEGORY_GROUPS = [
  { key: 'fabrics', label: 'Fabrics', categories: ['fabric', 'filling'] },
  { key: 'soft_trims', label: 'Soft Trims', categories: ['soft_trim'] },
  { key: 'trims', label: 'Trims', categories: ['zipper', 'label', 'hardware', 'branding'] },
  { key: 'packaging', label: 'Packaging', categories: ['packaging'] },
  { key: 'labor', label: 'Labor', categories: ['labor'] },
  { key: 'additional_costs', label: 'Additional Costs', categories: ['other'] },
];

export function getMaterialGroupLabel(category) {
  const group = MATERIAL_CATEGORY_GROUPS.find((g) => g.categories.includes(category));
  return group?.label ?? 'Other';
}

export const MATERIAL_CATEGORIES = [
  'fabric',
  'filling',
  'soft_trim',
  'zipper',
  'label',
  'hardware',
  'branding',
  'packaging',
  'labor',
  'other',
];

export const PRODUCT_CATEGORIES = [
  'outerwear',
  'knitwear',
  'tops',
  'bottoms',
  'accessories',
  'other',
];

export const ORDER_STATUSES = [
  'draft',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
];

export const DEFAULT_PRICING_MULTIPLIER = 3.5;

// localStorage keys
export const STORAGE_KEYS = {
  suppliers: 'plm_suppliers',
  materials: 'plm_materials',
  products: 'plm_products',
  bom_lines: 'plm_bom_lines',
  orders: 'plm_orders',
  order_lines: 'plm_order_lines',
  initialized: 'plm_initialized_v3',
};
