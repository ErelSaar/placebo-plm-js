# PLACEBO PLM

A browser-based Product Lifecycle Management system for PLACEBO Design Lab, built with Next.js and React.

## What is PLACEBO PLM?

PLACEBO PLM manages the full production lifecycle of a fashion label — from material sourcing through to order costing and export.

The system lets a small team:

- Maintain a library of **Materials** (fabrics, fillings, trims, zippers, labels, hardware, packaging, labor) with unit costs and supplier assignments.
- Maintain a library of **Suppliers** with contact details, lead times, payment terms, and live active-order value calculations.
- Define **Products** (outerwear, knitwear, etc.) with style codes, SKUs, colors, sizes, and a per-product pricing multiplier.
- Build a **Bill of Materials (BOM)** for each product — the list of materials and quantities consumed to produce one unit.
- Create **Production Orders** against those products, specifying quantities per color and size.
- Calculate **Required Materials** — the aggregated quantities of every material needed across all order lines, with supplier attribution.
- Model **Landed Costs** — shipping (fixed or per-unit), customs (fixed or percentage), and arbitrary additional costs — allocated across materials by value, quantity, or equally.
- Generate a complete **Cost Breakdown** per order and per product, with a Recommended Selling Price (RSP) derived from a pricing multiplier.
- Export the full order package to **Excel** (five-sheet workbook) or **PDF** (A4 report).

---

## Technology Stack

| Dependency | Version |
|---|---|
| Next.js | 15.3.3 |
| React | 19.0.0 |
| Tailwind CSS | 4.x (via `@tailwindcss/postcss`) |
| Jest | 29.7.0 |
| xlsx | 0.18.5 |
| jsPDF | 4.2.1 |
| jspdf-autotable | 5.0.8 |
| uuid | 10.0.0 |

The project is written in **JavaScript** (not TypeScript). React components use the `.jsx` extension.

---

## Installation

```bash
npm install
```

---

## Development

```bash
npm run dev
```

The application runs at `http://localhost:3000`.

On first load the `DemoInit` component (`src/components/demo-init.jsx`) automatically seeds localStorage with demo data (suppliers, materials, products, BOM lines, and two sample orders). This only happens once — the key `plm_initialized_v3` prevents re-seeding on subsequent visits.

---

## Testing

```bash
npm test
```

Tests live in `src/__tests__/calculations.test.js`. They cover all business-logic functions in `src/lib/calculations.js` using the demo data as fixtures.

---

## Production Build

```bash
npm run build
npm run start
```

---

## Project Structure

```
src/
  app/                  Next.js App Router pages
  components/           Shared React components
  lib/
    data/               Repository layer (one file per entity)
    exports/            Excel and PDF generation
    calculations.js     All business-logic functions
    constants.js        Enums, categories, storage keys
    demo-init.js        Demo data seeding
  data/
    demo-data.js        Static demo fixtures
  __tests__/
    calculations.test.js  Jest test suite
```

See [CODEBASE_MAP.md](CODEBASE_MAP.md) for a detailed file-by-file explanation.

---

## Data Storage

The current implementation stores all data in **browser localStorage**. There is no server, no database, and no login.

The storage abstraction lives in `src/lib/data/storage.js` — just two functions, `getItems(key)` and `setItems(key, data)`. All repositories (`products.js`, `materials.js`, etc.) call only those two functions and never touch localStorage directly.

This design means that **replacing localStorage with Supabase only requires changing `storage.js`** and adding async handling to the repositories. No page code needs to change.

localStorage keys:

| Key | Contents |
|---|---|
| `plm_suppliers` | Supplier records |
| `plm_materials` | Material records |
| `plm_products` | Product records |
| `plm_bom_lines` | BOM line records |
| `plm_orders` | Order records |
| `plm_order_lines` | Order line records |
| `plm_initialized_v3` | Flag — prevents re-seeding |

---

## Important Documentation

- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) — Architecture, module explanations, data flows, how to modify and extend the system.
- [CODEBASE_MAP.md](CODEBASE_MAP.md) — Every source file explained with purpose, exports, dependencies, and when to edit it.
- [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md) — Every business calculation in plain English and formulas, with code references.
