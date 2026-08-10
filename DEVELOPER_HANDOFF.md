# PLACEBO PLM — Developer Handoff

This document is for JavaScript developers picking up this codebase.

## Architecture

```
React pages → Repository functions → getItems/setItems → localStorage
```

Pages never call `localStorage` directly. All data access goes through repository functions in `src/lib/data/`. This is intentional — it makes a future Supabase migration straightforward.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/constants.js` | MATERIAL_CATEGORY_GROUPS, STORAGE_KEYS, category lists |
| `src/lib/calculations.js` | All business logic. Tested in `__tests__/calculations.test.js` |
| `src/lib/demo-init.js` | Seeds localStorage with demo data on first load |
| `src/data/demo-data.js` | The actual PLACEBO AW 26/27 demo data |
| `src/lib/data/storage.js` | `getItems(key)` / `setItems(key, data)` — the only localStorage calls |
| `src/lib/data/*.js` | One repository file per entity |
| `src/components/ui.jsx` | All shared UI components |
| `src/components/nav.jsx` | Left sidebar |
| `src/lib/exports/excel.js` | Excel workbook generation (SheetJS) |
| `src/lib/exports/pdf.js` | PDF generation (jsPDF + autotable) |

## Data Model

### Core entities

**Supplier** — fabric/trim/labor supplier
**Material** — a physical component (fabric, zipper, label, thread, labor)
**Product** — a sellable garment (LOKE BOXY PUFFER etc.)
**BOMLine** — links a product to a material with `quantity_per_unit`
**Order** — a production run (has costs: shipping, customs, additional)
**OrderLine** — one product variant in an order (product + color + size + quantity)

### Relationships

```
Supplier → Materials (one-to-many via Material.supplier_id)
Product → Materials via BOMLines (many-to-many)
Order → Products via OrderLines (many-to-many)
```

### IDs

All IDs are UUIDs generated with `uuid` (v4). Demo data uses human-readable prefixed IDs (`prod-loke`, `sup-belpunto`, etc.) for readability.

## Business Logic

### Material Cost

```
BOM Quantity Per Unit × Material Unit Cost = Line Cost
Sum of all non-labor line costs = Material Cost Per Unit
```

### Labor

Material category `'labor'` is tracked separately. Labor items:
- Appear in cost breakdowns as "Sewing / Labor"
- Never receive shipping/customs/additional cost allocation

### Landed Cost Allocation

Three methods (no manual — it was buggy in the original TS version and intentionally not reproduced):

**by_value** (default): weight = material cost / total material costs
**by_quantity**: weight = material quantity / total material quantity
**equally**: weight = 1 / number of non-labor materials

```
Allocated Shipping = Shipping Total × Weight
Allocated Customs  = Customs Total × Weight
Allocated Additional = Additional Total × Weight
```

### RSP

```
RSP = Total Unit Cost × Product Pricing Multiplier (default 3.5)
```

### Customs Percentage

```
Customs = (Material Cost + Shipping) × (Customs % / 100)
```

### Additional Cost Types

- `fixed` — flat amount
- `per_unit` — amount × total order units
- `percentage` — (materials + shipping) × (amount / 100)

## Material Category Groups

Defined in `src/lib/constants.js` as `MATERIAL_CATEGORY_GROUPS`. Controls:
- Grouped view on Materials page
- BOM tab grouping on Product detail
- BOM add-material select optgroups

Groups: Fabrics (fabric, filling), Soft Trims (soft_trim), Trims (zipper, label, hardware, branding), Packaging (packaging), Labor (labor), Additional Costs (other).

## Important Functions

### `calculateRequiredMaterials({ orderLines, products, bomLines, materials, suppliers })`

Aggregates BOM × quantities across all order lines. Returns array of `RequiredMaterial` objects. Each has: `material`, `total_quantity`, `products[]`, `unit_cost`, `estimated_cost`, `warnings[]`.

### `applyLandedCostAllocation(order, orderLines, requiredMaterials)`

Takes the output of `calculateRequiredMaterials` and enriches each item with `allocated_shipping`, `allocated_customs`, `allocated_additional`, `total_landed_cost`. Returns enriched array.

### `buildSupplierSummary(requiredMaterials, shippingDestination)`

Groups enriched materials by supplier. Returns `SupplierSummaryLine[]`.

### `calculateOrderCostSummary({ order, orderLines, requiredMaterials })`

Sums everything up into order-level totals.

### Order detail page data flow

```
load() → orderLineRepository.getByOrder(id)
      → calculateRequiredMaterials(...)
      → applyLandedCostAllocation(order, lines, base)
      → buildSupplierSummary(allocated, destination)
      → calculateOrderCostSummary(...)
```

All four functions are called on every render with fresh data. No caching needed for demo scale.

## How to Add a New Feature

1. If you need a new field on an entity, add it to `src/data/demo-data.js` (for demo data) and update the relevant form/display in the page component.
2. If you need a new calculation, add it to `src/lib/calculations.js` and write a test.
3. If you need a new UI primitive, add it to `src/components/ui.jsx`.
4. Follow the pattern: page → repository → storage.

## How to Connect Supabase

1. Install: `npm install @supabase/supabase-js`
2. Create `src/lib/supabase.js`:
   ```js
   import { createClient } from '@supabase/supabase-js';
   export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
   ```
3. Replace each repository in `src/lib/data/` with Supabase equivalents. Example:
   ```js
   // suppliers.js
   import { supabase } from '../supabase';
   export const supplierRepository = {
     async getAll() { const { data } = await supabase.from('suppliers').select('*'); return data; },
     async getById(id) { const { data } = await supabase.from('suppliers').select('*').eq('id', id).single(); return data; },
     async create(data) { const { data: r } = await supabase.from('suppliers').insert(data).select().single(); return r; },
     async update(id, data) { const { data: r } = await supabase.from('suppliers').update(data).eq('id', id).select().single(); return r; },
     async remove(id) { await supabase.from('suppliers').delete().eq('id', id); },
   };
   ```
4. Add `async/await` to page components that call these repositories (currently synchronous).
5. Remove demo-init.jsx from layout and seed via Supabase migrations instead.

## Known Differences from Original TS Version

- No "Manual" allocation option — it was implemented in the UI but not in the calculation logic. Removed entirely to avoid confusion.
- Product deletion now correctly removes BOM lines and order lines (was orphaning them in original).
- Order deletion now correctly removes order lines via `orderRepository.remove()`.
- Material deletion now correctly removes BOM lines referencing that material.
