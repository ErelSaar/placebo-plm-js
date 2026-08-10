# PLACEBO PLM — Codebase Map

A file-by-file guide to every important source file in the project.

---

## Source Tree

```
src/
├── app/
│   ├── globals.css
│   ├── layout.jsx
│   ├── page.jsx
│   ├── products/
│   │   ├── page.jsx
│   │   └── [id]/
│   │       └── page.jsx
│   ├── materials/
│   │   ├── page.jsx
│   │   └── [id]/
│   │       └── page.jsx
│   ├── suppliers/
│   │   ├── page.jsx
│   │   └── [id]/
│   │       └── page.jsx
│   └── orders/
│       ├── page.jsx
│       ├── new/
│       │   └── page.jsx
│       └── [id]/
│           └── page.jsx
├── components/
│   ├── ui.jsx
│   ├── nav.jsx
│   └── demo-init.jsx
├── lib/
│   ├── constants.js
│   ├── calculations.js
│   ├── demo-init.js
│   ├── data/
│   │   ├── storage.js
│   │   ├── suppliers.js
│   │   ├── materials.js
│   │   ├── products.js
│   │   ├── bom.js
│   │   └── orders.js
│   └── exports/
│       ├── excel.js
│       └── pdf.js
├── data/
│   └── demo-data.js
└── __tests__/
    └── calculations.test.js
```

Root config files:
```
package.json
next.config.js
jsconfig.json
jest.config.js
babel.config.js
postcss.config.js
```

---

## Root Config Files

---

### `package.json`

**Purpose:** Project metadata, dependency versions, and npm scripts.

**Scripts:**
- `npm run dev` — starts Next.js dev server
- `npm run build` — production build
- `npm run start` — serves production build
- `npm test` — runs Jest

**Key dependencies:** `next@15.3.3`, `react@19`, `uuid@10`, `xlsx@0.18.5`, `jspdf@4.2.1`, `jspdf-autotable@5.0.8`

**Dev dependencies:** `jest@29`, `babel-jest`, `@babel/preset-env`, `@babel/preset-react`, `jest-environment-jsdom`, `tailwindcss@4`, `@tailwindcss/postcss@4`

**Edit this file when:** Adding or updating dependencies.

---

### `jsconfig.json`

**Purpose:** Configures the `@/` import alias for VS Code IntelliSense and Next.js.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

`@/lib/calculations` resolves to `src/lib/calculations.js`. This alias is used throughout the codebase.

**Edit this file when:** Adding new top-level source directories that need an alias.

---

### `jest.config.js`

**Purpose:** Jest test runner configuration.

Sets `testEnvironment: 'node'`, maps `@/` to `src/` (matching jsconfig), finds tests in `src/__tests__/*.test.js`, and transforms `.jsx?` files via `babel-jest`.

**Edit this file when:** Adding test directories, changing the test environment, or adding module name mappings.

---

### `babel.config.js`

**Purpose:** Babel configuration used by Jest (Next.js uses its own SWC compiler for the app build).

Uses `@babel/preset-env` targeting current Node.js and `@babel/preset-react` with `runtime: 'automatic'` (so tests don't need to import React explicitly).

**Edit this file when:** Adding Babel plugins needed by the test suite.

---

### `next.config.js`

**Purpose:** Next.js configuration. Currently empty (`{}`).

**Edit this file when:** Adding Next.js features like image domains, redirects, environment variables, or custom webpack config.

---

## `src/app/` — Pages

---

### `src/app/layout.jsx`

**Purpose:** Root layout — wraps every page. Renders `<DemoInit />`, `<Nav />`, and the page content inside `<main>`.

The sidebar (`<Nav />`) is fixed-width (224px / `w-56`). The main content area has `ml-56` to clear it.

**Imports:** `DemoInit` from `@/components/demo-init`, `Nav` from `@/components/nav`.

**What imports it:** Next.js App Router loads this automatically for all routes.

**Edit this file when:** Changing the global layout (sidebar width, body styles, metadata like `<title>`).

---

### `src/app/page.jsx`

**Route:** `/`

**Purpose:** Dashboard — shows summary statistics, recent orders, approaching deadlines, and products with no BOM.

**Data loaded in `useEffect`:** All six entity collections from their respective repositories. `getApproachingOrders(orders, 60)` is called to find orders with `target_date` within 60 days.

**Key logic:**
- `activeProducts` — `products.filter(p => p.status === 'active')`
- `activeOrders` — excludes `completed` and `cancelled`
- `missingBOM` — active products whose `product_id` has no BOM lines
- `approaching` — non-complete/cancelled orders within 60 days (color-coded: red <14d, amber <30d)

**Depends on:** All six repositories, `getApproachingOrders` from `@/lib/calculations`, UI components from `@/components/ui`.

**Edit this file when:** Changing dashboard metrics, threshold for approaching deadlines, or what cards are displayed.

---

### `src/app/products/page.jsx`

**Route:** `/products`

**Purpose:** Products list with search, category filter, status filter, and Add Product modal.

**Key exported functions/components:** `ProductsPage` (default export)

**Validation:** `validate()` checks name, style_code (unique), sku (unique).

**On save:** `uuidv4()` → `productRepository.create()` → `router.push('/products/' + id)`

**Depends on:** `productRepository`, `PRODUCT_CATEGORIES`, `uuid`, UI components.

**Edit this file when:** Changing the products list columns, the create modal fields, or product list filtering behavior.

---

### `src/app/products/[id]/page.jsx`

**Route:** `/products/[id]`

**Purpose:** Product detail page with four tabs: Overview, Bill of Materials, Costing, Orders.

**Key logic:**

- **BOM tab:** Calls `bomRepository.getByProduct(id)` and groups lines by `MATERIAL_CATEGORY_GROUPS`. The BOM modal's `<select>` filters materials to `status === 'active'`.

- **Costing tab:** Calls `calculateProductCostSummary({ bomLines, materials, pricingMultiplier })` on every render. The multiplier input immediately saves to the product record via `productRepository.update`.

- **Orders tab:** Finds orders containing this product by joining `orderLineRepository.getAll()` filtered to `product_id === id`.

- **Delete:** Cascade-removes BOM lines and order lines before removing the product.

**Local helper components:** `Field` (label/value display row), `CostRow` (cost breakdown row).

**Depends on:** `productRepository`, `materialRepository`, `supplierRepository`, `bomRepository`, `orderRepository`, `orderLineRepository`, `calculateBOMCost`, `calculateProductCostSummary`, `MATERIAL_CATEGORY_GROUPS`, `PRODUCT_CATEGORIES`, `uuid`, UI components.

**Edit this file when:** Changing product fields, BOM UI, costing display, or the product orders tab.

---

### `src/app/materials/page.jsx`

**Route:** `/materials`

**Purpose:** Materials list with grouped/flat toggle, search, category filter, status filter, and Add Material modal.

**Grouped view:** Iterates `MATERIAL_CATEGORY_GROUPS` and renders a separate `<Table>` per group. Active only when no search or category filter is applied (`showGrouped` flag).

**Flat view:** Single `<Table>` for all filtered materials.

**Depends on:** `materialRepository`, `supplierRepository`, `MATERIAL_CATEGORY_GROUPS`, `MATERIAL_CATEGORIES`, `uuid`, UI components.

**Edit this file when:** Changing material list columns, create modal fields, or grouping behavior.

---

### `src/app/materials/[id]/page.jsx`

**Route:** `/materials/[id]`

**Purpose:** Material detail page — shows fields, required quantity in active orders, and which products use this material.

**Key logic:**

- **Required in Active Orders:** Loads all active orders and their lines, runs `calculateRequiredMaterials()`, finds the entry for this material's ID, extracts `total_quantity`.

- **Used In Products:** Filters `bomRepository.getAll()` to lines where `material_id === id`, maps to product records.

- **Archive:** `materialRepository.update(id, { status: 'active' | 'archived' })`.

- **Duplicate:** `materialRepository.create({ ...material, id: newId, name: name + ' (Copy)', ... })` and navigate.

- **Delete:** Removes all BOM lines for this material first, then removes the material record.

**Warnings shown:** Missing `supplier_id`, missing `unit_cost`.

**Local helper component:** `Field`

**Depends on:** `materialRepository`, `supplierRepository`, `productRepository`, `bomRepository`, `orderRepository`, `orderLineRepository`, `calculateRequiredMaterials`, `MATERIAL_CATEGORIES`, `uuid`, UI components.

**Edit this file when:** Changing material fields, the required-quantity calculation, or the "used in products" panel.

---

### `src/app/suppliers/page.jsx`

**Route:** `/suppliers`

**Purpose:** Suppliers list with search, status filter, and Add Supplier modal.

**Validation:** Name is required.

**Depends on:** `supplierRepository`, `uuid`, UI components.

**Edit this file when:** Changing supplier list columns or the create modal fields.

---

### `src/app/suppliers/[id]/page.jsx`

**Route:** `/suppliers/[id]`

**Purpose:** Supplier detail page — shows contact fields, active order value, materials supplied, and products using this supplier.

**Key logic:**

- **Active Order Value:** Iterates all active orders, calls `calculateRequiredMaterials()` for each, filters results to materials with `supplier_id === id`, sums `estimated_cost`.

- **Materials:** `materialRepository.getAll().filter(m => m.supplier_id === id)`

- **Products Using This Supplier:** Finds BOM lines that reference any of the supplier's materials, then maps to unique product records.

**Local helper component:** `Field`

**Depends on:** `supplierRepository`, `materialRepository`, `productRepository`, `bomRepository`, `orderRepository`, `orderLineRepository`, `calculateRequiredMaterials`, UI components.

**Edit this file when:** Changing supplier fields, how active order value is computed, or what related data is shown.

---

### `src/app/orders/page.jsx`

**Route:** `/orders`

**Purpose:** Orders list sorted newest-first, with search and status filter.

Each row shows unique product count (`Set(lines.map(l => l.product_id)).size`) and total units.

**Depends on:** `orderRepository`, `orderLineRepository`, UI components.

**Edit this file when:** Changing the orders list columns or filtering behavior.

---

### `src/app/orders/new/page.jsx`

**Route:** `/orders/new`

**Purpose:** New order creation form. Two-column layout — form on left, product search panel on right.

**Key logic:**

- Product search panel only shows `status === 'active'` products.
- Clicking a product adds a line object to local `lines` state (no localStorage write until save).
- Color and size default to `product.colors[0]` / `product.sizes[0]`.
- `hasDuplicate()` checks for `product_id|color|size` key collisions within `lines`.
- `handleSave(status)` creates the order with `orderRepository.create()` then writes all lines with `orderLineRepository.saveMany()`.

**Depends on:** `orderRepository`, `orderLineRepository`, `productRepository`, `uuid`, UI components.

**Edit this file when:** Changing the new order form fields, adding order defaults, or changing new-order validation rules.

---

### `src/app/orders/[id]/page.jsx`

**Route:** `/orders/[id]`

**Purpose:** Order detail page — the most complex page in the application. Four tabs, a costs modal, and two export buttons.

**Computed data (re-calculated on every render):**

```javascript
const requiredMaterialsBase = calculateRequiredMaterials({ orderLines, products, bomLines, materials, suppliers });
const requiredMaterials = applyLandedCostAllocation(order, orderLines, requiredMaterialsBase);
const supplierSummary = buildSupplierSummary(requiredMaterials, order.shipping_destination);
const costSummary = calculateOrderCostSummary({ order, orderLines, requiredMaterials });
```

**Tabs:**
- `products` — order lines with per-line `getProductLineCosts(line)` computation
- `materials` — `requiredMaterials` table
- `supplier` — `supplierSummary` cards
- `costs` — `costSummary` totals + per-product breakdown

**`getProductLineCosts(line)`** — defined inside the component. Traces each RequiredMaterial back to the specific order line to compute per-unit material, labor, and logistics costs. Used in both the Products tab and the Cost Breakdown tab.

**Costs modal:** Updates `shipping_cost`, `shipping_cost_type`, `customs_cost`, `customs_type`, `cost_allocation_method`, `additional_costs` on the order record.

**Local helper component:** `CostRow`

**Depends on:** `orderRepository`, `orderLineRepository`, `productRepository`, `materialRepository`, `supplierRepository`, `bomRepository`, all four main calculation functions, `exportOrderToExcel`, `exportOrderToPDF`, `uuid`, UI components.

**Edit this file when:** Changing order fields, tab content, costs modal, or the per-line cost attribution logic.

---

## `src/components/` — Shared Components

---

### `src/components/ui.jsx`

**Purpose:** Every reusable UI primitive in the application. Exported as named exports.

**Exports:**

| Export | Description |
|---|---|
| `formatCurrency(amount, currency)` | Formats number as currency string (e.g. `€5.80`) |
| `formatDate(dateStr)` | Formats ISO date as `DD Mon YYYY` |
| `PageHeader` | Page title + subtitle + action buttons slot |
| `Button` | Button with variants: `primary`, `secondary`, `ghost`, `danger`; sizes: `sm`, `md` |
| `Badge` | Small inline badge with variants: `default`, `success`, `warning`, `danger`, `muted` |
| `StatusBadge` | Badge that maps status strings to variants and display labels |
| `Card` | White bordered rounded container |
| `StatCard` | Stat display card (label + large number + optional sub-text) |
| `Table`, `Thead`, `Tbody`, `Th`, `Td`, `Tr` | Styled table primitives |
| `EmptyState` | Centered empty-state message with optional action button |
| `Input` | Labelled `<input>` with error display |
| `Textarea` | Labelled `<textarea>` with error display |
| `Select` | Labelled `<select>` with error display |
| `Spinner` | SVG spinning animation, sizes `sm` and `md` |
| `Warning` | Amber banner for warnings |
| `Section` | Section with title and optional action slot |
| `Tabs` | Horizontal tab bar |
| `Modal` | Centered overlay modal with title, scrollable body, and footer slot |

**`StatusBadge` maps:**

| Status | Badge Variant |
|---|---|
| `active` | success (green) |
| `archived` | muted (gray) |
| `draft` | muted (gray) |
| `confirmed` | default (black) |
| `in_progress` | warning (amber) |
| `completed` | success (green) |
| `cancelled` | danger (red) |

**Edit this file when:** Changing the visual design of shared components, adding new status values to `StatusBadge`, or adding new utility components.

---

### `src/components/nav.jsx`

**Purpose:** Fixed left sidebar navigation with active-state highlighting.

**`NAV_ITEMS`:** `[{ href: '/', label: 'Dashboard' }, { href: '/products', ... }, ...]`

Active state: `pathname === '/'` for Dashboard; `pathname.startsWith(href)` for all others.

Shows a "Demo Mode" badge at the bottom of the sidebar.

**What imports it:** `src/app/layout.jsx`

**Edit this file when:** Adding a new navigation item, changing the sidebar design, or removing "Demo Mode" badge for production.

---

### `src/components/demo-init.jsx`

**Purpose:** A `'use client'` component that calls `initializeDemoData()` once on mount.

Returns `null` — renders nothing. Exists solely to run the side effect in the browser.

**Why it's a component instead of being in `layout.jsx` directly:** `layout.jsx` can be a Server Component. Calling `initializeDemoData()` requires `window`/localStorage access which is only available in the browser. The `DemoInit` client component provides the correct execution context.

**What imports it:** `src/app/layout.jsx`

**Edit this file when:** This file should rarely need changing. If you want to expose a reset button instead of auto-seeding, replace the `useEffect` logic here.

---

## `src/lib/` — Library

---

### `src/lib/constants.js`

**Purpose:** All shared enumeration constants and storage key definitions. The single source of truth for category lists, status values, and localStorage key names.

**Exports:**

| Export | Type | Contents |
|---|---|---|
| `MATERIAL_CATEGORY_GROUPS` | Array | Groups with `key`, `label`, `categories[]` — defines display grouping |
| `getMaterialGroupLabel(category)` | Function | Returns group label for a category string |
| `MATERIAL_CATEGORIES` | Array | All 10 raw category strings |
| `PRODUCT_CATEGORIES` | Array | `outerwear`, `knitwear`, `tops`, `bottoms`, `accessories`, `other` |
| `ORDER_STATUSES` | Array | `draft`, `confirmed`, `in_progress`, `completed`, `cancelled` |
| `DEFAULT_PRICING_MULTIPLIER` | Number | `3.5` |
| `STORAGE_KEYS` | Object | Maps entity names to localStorage keys |

**`MATERIAL_CATEGORY_GROUPS` structure:**
```javascript
[
  { key: 'fabrics',          label: 'Fabrics',          categories: ['fabric', 'filling'] },
  { key: 'soft_trims',       label: 'Soft Trims',       categories: ['soft_trim'] },
  { key: 'trims',            label: 'Trims',            categories: ['zipper', 'label', 'hardware', 'branding'] },
  { key: 'packaging',        label: 'Packaging',        categories: ['packaging'] },
  { key: 'labor',            label: 'Labor',            categories: ['labor'] },
  { key: 'additional_costs', label: 'Additional Costs', categories: ['other'] },
]
```

**Used by:** BOM tab (grouping), materials list (grouping), BOM modal (`<optgroup>` labels), `calculations.js` (category lookup is not done here — it uses its own `LABOR_CATEGORIES` Set).

**Edit this file when:** Adding a material category, product category, order status, or changing the display grouping of materials. Also update `STORAGE_KEYS.initialized` to a new version key when making breaking demo data changes.

---

### `src/lib/calculations.js`

**Purpose:** All business-logic calculations. Pure functions with no side effects, no localStorage access, no React dependencies.

**Exports:**

| Function | Description |
|---|---|
| `calculateRequiredMaterials({ orderLines, products, bomLines, materials, suppliers })` | Aggregates BOM × order quantities. Returns `RequiredMaterial[]` |
| `buildSupplierSummary(requiredMaterials, shippingDestination)` | Groups RequiredMaterials by supplier. Returns `SupplierSummaryLine[]` |
| `calculateBOMCost(bomLines, materials)` | Computes cost per unit. Returns `{ byCategory, total, materialCost, laborCost, hasUnknownCosts }` |
| `applyLandedCostAllocation(order, orderLines, requiredMaterials)` | Enriches RequiredMaterials with allocated shipping/customs/additional costs |
| `calculateProductCostSummary({ bomLines, materials, pricingMultiplier, allocatedShippingPerUnit, allocatedCustomsPerUnit, allocatedAdditionalPerUnit })` | Full unit cost + RSP. Returns cost summary object |
| `calculateOrderCostSummary({ order, orderLines, requiredMaterials })` | Order-level cost totals. Returns totals object |
| `getApproachingOrders(orders, daysThreshold)` | Filters orders approaching target date |
| `resolveAdditionalCosts(additionalCosts, totalUnits, basisAmount)` | Computes total additional cost for display purposes |

**Internal constants:**
- `LABOR_CATEGORIES = new Set(['labor'])` — only `labor` category is excluded from logistics allocation.
- `round2(n)` — rounds to 2 decimal places.
- `round6(n)` — rounds to 6 decimal places (used for quantities to avoid floating-point drift).

**Used by:** `src/app/page.jsx` (dashboard), `src/app/orders/[id]/page.jsx` (all four functions), `src/app/products/[id]/page.jsx` (`calculateBOMCost`, `calculateProductCostSummary`), `src/app/materials/[id]/page.jsx` (`calculateRequiredMaterials`), `src/app/suppliers/[id]/page.jsx` (`calculateRequiredMaterials`), both export files.

**Edit this file when:** Changing any cost calculation, logistics allocation method, BOM aggregation logic, or RSP formula. Add tests in `calculations.test.js` for any changes.

---

### `src/lib/demo-init.js`

**Purpose:** Seeds localStorage with demo data on first run. Provides a `resetDemoData()` function for development.

**Exports:**

- `initializeDemoData()` — checks `plm_initialized_v3`; if absent, writes all six demo collections and sets the key.
- `resetDemoData()` — clears all PLM storage keys (including legacy `plm_initialized` and `plm_initialized_v2`) then calls `initializeDemoData()`.

**Depends on:** `STORAGE_KEYS` from `src/lib/constants.js`, all `DEMO_*` arrays from `src/data/demo-data.js`, `setItems` from `src/lib/data/storage.js`.

**What imports it:** `src/components/demo-init.jsx`

**Edit this file when:** Changing which collections are seeded, or bumping the version key after a breaking demo data change.

---

## `src/lib/data/` — Repositories

---

### `src/lib/data/storage.js`

**Purpose:** The only file that touches `localStorage`. Provides `getItems(key)` and `setItems(key, data)`.

```javascript
getItems(key)  // Returns JSON-parsed array or [] on error/SSR
setItems(key, data)  // JSON.stringify and write
```

**This is the Supabase migration boundary.** Replacing these two functions is the minimum change required to switch from localStorage to a remote database.

**Used by:** All five repository files.

**Edit this file when:** Migrating to a new storage backend.

---

### `src/lib/data/suppliers.js`

**Purpose:** CRUD repository for Supplier records.

**Export:** `supplierRepository`

**Methods:** `getAll()`, `getById(id)`, `create(data)`, `update(id, data)`, `remove(id)`

**Storage key:** `plm_suppliers`

**Edit this file when:** Adding supplier-specific query methods (e.g. `getByCountry`). For field changes, no repository changes are needed.

---

### `src/lib/data/materials.js`

**Purpose:** CRUD repository for Material records.

**Export:** `materialRepository`

**Methods:** `getAll()`, `getById(id)`, `create(data)`, `update(id, data)`, `remove(id)`

**Storage key:** `plm_materials`

**Edit this file when:** Adding material-specific query methods.

---

### `src/lib/data/products.js`

**Purpose:** CRUD repository for Product records.

**Export:** `productRepository`

**Methods:** `getAll()`, `getById(id)`, `create(data)`, `update(id, data)`, `remove(id)`

**Storage key:** `plm_products`

**Edit this file when:** Adding product-specific query methods.

---

### `src/lib/data/bom.js`

**Purpose:** Repository for BOM Line records. Has extra methods specific to the BOM use case.

**Export:** `bomRepository`

**Methods:**

| Method | Description |
|---|---|
| `getAll()` | All BOM lines across all products |
| `getByProduct(productId)` | BOM lines for one product, sorted by `sort_order` ascending |
| `create(data)` | Appends a BOM line (no auto-timestamps — BOM lines don't have them) |
| `update(id, data)` | Merges data into existing line |
| `remove(id)` | Removes one BOM line |
| `removeByProduct(productId)` | Removes all BOM lines for a product (used on product delete) |
| `saveMany(lines)` | Replaces lines by ID — keeps all other lines, inserts/updates the provided ones |

**Storage key:** `plm_bom_lines`

**Edit this file when:** Adding BOM-specific query methods or changing BOM line persistence behavior.

---

### `src/lib/data/orders.js`

**Purpose:** Repositories for Order and OrderLine records. Exports two objects from one file because they are closely related and often used together.

**Exports:** `orderRepository`, `orderLineRepository`

**`orderRepository` methods:**

| Method | Description |
|---|---|
| `getAll()` | All orders |
| `getById(id)` | Single order by ID |
| `create(data)` | Creates order with timestamps |
| `update(id, data)` | Merges data, updates `updated_at` |
| `remove(id)` | Removes order AND all its order lines |
| `orderNumberExists(orderNumber, excludeId?)` | Uniqueness check for order numbers |

**`orderLineRepository` methods:**

| Method | Description |
|---|---|
| `getAll()` | All order lines across all orders |
| `getByOrder(orderId)` | Lines for one order |
| `getByProduct(productId)` | Lines referencing a product (used on product detail Orders tab) |
| `saveMany(orderId, lines)` | Replaces all lines for the order with the provided array |
| `removeByOrder(orderId)` | Removes all lines for an order |

**Storage keys:** `plm_orders`, `plm_order_lines`

**Edit this file when:** Adding order-specific query methods. Note that `orderRepository.remove()` also removes order lines — this cascade is intentional.

---

## `src/lib/exports/` — Export Functions

---

### `src/lib/exports/excel.js`

**Purpose:** Generates and downloads a five-sheet Excel workbook for an order.

**Export:** `exportOrderToExcel(data)`

**Input shape:**
```javascript
{
  order,
  orderLines,
  products,
  requiredMaterials,   // already enriched by applyLandedCostAllocation
  supplierSummary,     // output of buildSupplierSummary
  costSummary,         // output of calculateOrderCostSummary
  pricingMultiplier,
}
```

**Sheets generated:**

| Sheet | Key data |
|---|---|
| Order Summary | Order metadata + cost category totals |
| Products | Per-line: name, style code, color, size, SKU, qty, mat cost, labor, logistics, unit cost, RSP |
| Required Materials | Per material: name, cat, supplier, qty, UOM, unit cost, mat cost, shipping, customs, additional, landed cost, products using |
| Supplier Summary | Per supplier: name, country, materials, quantities, destination, cost totals |
| Cost Breakdown | Category totals, units, avg cost/unit, multiplier, avg RSP, per-product RSP |

**Library used:** `xlsx` (`import * as XLSX from 'xlsx'`)

**File naming:** `{order.order_number}-export.xlsx`

**Used by:** `src/app/orders/[id]/page.jsx` (`handleExportExcel`)

**Edit this file when:** Adding columns, sheets, changing formatting, or adding styles to cells. Column widths are set via `ws['!cols']` as arrays of `{ wch: number }` objects.

---

### `src/lib/exports/pdf.js`

**Purpose:** Generates and downloads an A4 PDF report for an order.

**Export:** `exportOrderToPDF(data)`

**Input shape:** Same as `exportOrderToExcel`.

**Sections generated:**

1. Header — PLACEBO branding + order number/name
2. Order details table (status, dates, factory, destination)
3. Products table (per-line: name, color, size, qty, mat cost, labor, unit cost, RSP)
4. Required Materials table (name, category, supplier, qty, unit cost, mat cost, shipping, landed cost)
5. Cost summary table (category totals, units, avg cost, avg RSP)

**Libraries used:** `jspdf` and `jspdf-autotable`

**File naming:** `{order.order_number}-export.pdf`

**Note:** The PDF's per-product RSP uses only BOM material + labor costs, not logistics allocation (unlike the Excel). This is a known simplification in the PDF rendering code.

**Used by:** `src/app/orders/[id]/page.jsx` (`handleExportPDF`)

**Edit this file when:** Adding sections, changing table columns, adjusting fonts/sizes, or fixing the logistics attribution in per-product RSP.

---

## `src/data/` — Demo Data

---

### `src/data/demo-data.js`

**Purpose:** Static demo data arrays used to seed localStorage on first run and as fixtures in the test suite.

**Exports:** `DEMO_SUPPLIERS`, `DEMO_MATERIALS`, `DEMO_PRODUCTS`, `DEMO_BOM_LINES`, `DEMO_ORDERS`, `DEMO_ORDER_LINES`

**Demo scenario:** PLACEBO AW 26/27 production run with three products:

| Product | ID | Description |
|---|---|---|
| LOKE BOXY PUFFER | `prod-loke` | Boxy puffer jacket, 22 units ordered |
| ULLER MIDI PUFFER | `prod-uller` | Midi puffer jacket, 2 units ordered |
| FREJA MAXI COAT PUFFER | `prod-freja` | Maxi coat puffer, 1 unit ordered |

Two demo orders:
- `ord-2026-portugal` — Portugal production (22× LOKE)
- `ord-2026-sweden` — Sweden production (2× ULLER, 1× FREJA)

Four demo suppliers: Belpunto (Italy, fabrics), YKK (Japan, zippers), Misc Trims Supplier (trims/labels), Production Factory (labor).

**Used by:** `src/lib/demo-init.js` (seeding), `src/__tests__/calculations.test.js` (fixtures).

**Edit this file when:** Changing demo products/materials to reflect a different collection. After editing, bump `STORAGE_KEYS.initialized` in `src/lib/constants.js` to `plm_initialized_v4` (or next version) so existing users get the new demo data on next visit.

---

## `src/__tests__/` — Tests

---

### `src/__tests__/calculations.test.js`

**Purpose:** Unit tests for all functions in `src/lib/calculations.js`. Uses the demo data as test fixtures.

**Test suites:**

| Suite | What it covers |
|---|---|
| `order totals` | Basic unit/product count assertions against demo data |
| `calculateRequiredMaterials` | Aggregation across products, material cost calculation, warning generation, supplier attachment |
| `buildSupplierSummary` | Grouping by supplier, no-supplier group |
| `calculateBOMCost` | Per-product BOM cost with expected totals (LOKE: ~€198.70, ULLER: ~€244.56, FREJA: ~€585.96), labor separation |
| `applyLandedCostAllocation` | Fixed shipping, per-unit shipping, percentage customs, by-quantity allocation, equally allocation, fixed additional, per-unit additional, labor zero-allocation |
| `calculateProductCostSummary` | Default and custom multiplier |
| `calculateOrderCostSummary` | Total units, cost totals, average per unit |
| `getApproachingOrders` | Threshold filtering, completed/cancelled exclusion |
| `resolveAdditionalCosts` | Fixed, per-unit, percentage, multiple combined |

**Run with:** `npm test`

**Edit this file when:** Adding new calculation functions or changing existing logic — add corresponding test cases. When changing demo data, verify all quantity/cost assertions still match.
