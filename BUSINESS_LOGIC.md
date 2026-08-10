# PLACEBO PLM — Business Logic

This document explains every business calculation used by PLACEBO PLM — in plain English, as formulas, and with direct references to the implementing functions.

All business logic is consolidated in one file: **`src/lib/calculations.js`**.

---

## Table of Contents

1. [BOM Line Cost](#1-bom-line-cost)
2. [BOM Total Cost](#2-bom-total-cost)
3. [Required Materials](#3-required-materials)
4. [Shipping Cost](#4-shipping-cost)
5. [Customs Cost](#5-customs-cost)
6. [Additional Costs](#6-additional-costs)
7. [Cost Allocation](#7-cost-allocation)
8. [Landed Cost Per Material](#8-landed-cost-per-material)
9. [Product Unit Cost](#9-product-unit-cost)
10. [Recommended Selling Price (RSP)](#10-recommended-selling-price-rsp)
11. [Order Cost Summary](#11-order-cost-summary)
12. [Average Cost Per Unit](#12-average-cost-per-unit)
13. [Supplier Summary Totals](#13-supplier-summary-totals)
14. [Approaching Orders](#14-approaching-orders)
15. [Currency Handling](#15-currency-handling)

---

## 1. BOM Line Cost

The cost contribution of a single BOM line — one material on one product.

**Formula:**

```
line_cost = material.unit_cost × bom_line.quantity_per_unit
```

**Example:**

```
ARIZONA 7999 fabric: €5.80 per metre
BOM quantity: 4 metres per jacket

line_cost = 5.80 × 4 = €23.20
```

**Implementation:**
`src/lib/calculations.js` → `calculateBOMCost()`

```javascript
const lineCost = round2(mat.unit_cost * line.quantity_per_unit);
```

If a material has no `unit_cost`, the line is skipped and `hasUnknownCosts` is set to `true` in the result.

---

## 2. BOM Total Cost

The sum of all BOM line costs for one product unit. Split into two components:

- **Material cost** — all non-labor BOM lines.
- **Labor cost** — BOM lines where `material.category === 'labor'`.

```
material_cost = sum of line_cost for all non-labor BOM lines
labor_cost    = sum of line_cost for all labor BOM lines
total         = material_cost + labor_cost
```

**Example (LOKE BOXY PUFFER):**

```
Fabric (ARIZONA 7999):     4m  × €5.80   = €23.20
Fabric (TNT SCRIM BLACK):  3m  × €0.45   = €1.35
Filling (200 ZERO DOWN):   3kg × €6.30   = €18.90
Filling (100 ZERO DOWN):   3kg × €3.45   = €10.35
... (zippers, hardware, labels, packaging)
                                 subtotal = €78.70  (material_cost)
Labor (Sewing):            1   × €120    = €120.00 (labor_cost)
                                   TOTAL = €198.70
```

**Implementation:**
`src/lib/calculations.js` → `calculateBOMCost(bomLines, materials)`

Returns `{ byCategory, total, materialCost, laborCost, hasUnknownCosts }`.

`byCategory` is an object keyed by category string (e.g. `{ fabric: 24.55, filling: 29.25, labor: 120 }`).

---

## 3. Required Materials

For each material referenced in a product's BOM, the total quantity needed for an order line is:

```
required_quantity = bom_line.quantity_per_unit × order_line.quantity
```

When multiple order lines reference products that use the same material, the quantities are **aggregated by material ID**:

```
total_required = sum of (bom_line.quantity_per_unit × order_line.quantity)
                 for all order lines containing this material
```

**Example:**

```
Order contains:
  LOKE BOXY PUFFER × 22 units   (BOM: ARIZONA 7999 = 4m per unit)
  ULLER MIDI PUFFER × 2 units   (BOM: ARIZONA 7999 = 5m per unit)
  FREJA MAXI COAT × 1 unit      (BOM: ARIZONA 7999 = 5m per unit)

ARIZONA 7999 total required:
  (4 × 22) + (5 × 2) + (5 × 1) = 88 + 10 + 5 = 103 metres
```

Once aggregated, the estimated material purchase cost is:

```
estimated_cost = material.unit_cost × total_required_quantity
```

```
ARIZONA 7999: €5.80 × 103m = €597.40
```

**Implementation:**
`src/lib/calculations.js` → `calculateRequiredMaterials({ orderLines, products, bomLines, materials, suppliers })`

Quantities are rounded to 6 decimal places (`round6`) during accumulation to prevent floating-point drift.

The function also attaches the supplier object to each material (resolved from the `suppliers` array) and generates `warnings[]`:
- `'No supplier assigned'` — when `material.supplier_id` is null
- `'No unit cost'` — when `material.unit_cost` is null or undefined
- `'Cannot calculate cost'` — when `estimated_cost` cannot be computed

---

## 4. Shipping Cost

Two modes are supported.

**Fixed:**

```
shipping_total = order.shipping_cost
```

The same fixed amount applies regardless of unit count.

**Per Unit:**

```
shipping_total = order.shipping_cost × total_ordered_units
```

`total_ordered_units` is the sum of all `order_line.quantity` values for the order.

**Example:**

```
Fixed:    shipping_cost = €500    → shipping_total = €500
Per unit: shipping_cost = €10/unit, 25 units → shipping_total = €250
```

**Implementation:**
`src/lib/calculations.js` → `applyLandedCostAllocation()`

```javascript
shippingTotal =
  order.shipping_cost_type === 'per_unit'
    ? order.shipping_cost * totalUnits
    : order.shipping_cost;
```

---

## 5. Customs Cost

Two modes are supported.

**Fixed:**

```
customs_total = order.customs_cost
```

**Percentage:**

```
customs_total = (total_materials_cost + shipping_total) × (order.customs_cost / 100)
```

The percentage basis is materials cost (non-labor only) plus shipping. Labor is excluded from the basis.

**Example:**

```
Materials cost: €3,200  (non-labor)
Shipping total: €500
Customs rate:   10%

customs_total = (3200 + 500) × 0.10 = €370
```

**Implementation:**
`src/lib/calculations.js` → `applyLandedCostAllocation()`

```javascript
if (order.customs_type === 'percentage') {
  customsTotal = round2((totalMaterialsCost + shippingTotal) * (order.customs_cost / 100));
} else {
  customsTotal = order.customs_cost;
}
```

`totalMaterialsCost` here refers to the sum of `estimated_cost` for all **non-labor** required materials.

---

## 6. Additional Costs

Each additional cost entry on an order has a `cost_type`:

**Fixed:**
```
amount_total = ac.amount
```

**Per Unit:**
```
amount_total = ac.amount × total_ordered_units
```

**Percentage:**
```
amount_total = (total_materials_cost + shipping_total) × (ac.amount / 100)
```

The percentage basis is the same as customs — non-labor materials plus shipping.

When there are multiple additional cost entries, their totals are summed:

```
additional_total = sum of amount_total for all additional cost entries
```

**Implementation:**
`src/lib/calculations.js` → `applyLandedCostAllocation()`

```javascript
for (const ac of order.additional_costs ?? []) {
  if (ac.cost_type === 'per_unit')    additionalTotal += ac.amount * totalUnits;
  if (ac.cost_type === 'percentage')  additionalTotal += basisAmount * (ac.amount / 100);
  else                                additionalTotal += ac.amount;
}
```

For display-only purposes (outside of allocation), `resolveAdditionalCosts(additionalCosts, totalUnits, basisAmount)` performs the same calculation.

---

## 7. Cost Allocation

Once `shipping_total`, `customs_total`, and `additional_total` are computed, they must be distributed across individual materials. This determines each material's landed cost.

**Labor is always excluded from allocation.** Labor lines receive `allocated_shipping: 0`, `allocated_customs: 0`, `allocated_additional: 0`. The rationale: shipping and customs are costs incurred to transport physical goods. Labor is a service rendered at the factory and is not subject to import duties or freight costs.

Three allocation methods are available:

### By Material Value (`by_value`)

Each material's share is proportional to its estimated material cost:

```
weight_i = estimated_cost_i / sum(estimated_cost for all non-labor materials)

allocated_shipping_i   = shipping_total   × weight_i
allocated_customs_i    = customs_total    × weight_i
allocated_additional_i = additional_total × weight_i
```

This is the default and most intuitive method — expensive materials absorb more of the logistics costs.

### By Quantity (`by_quantity`)

Each material's share is proportional to its total required quantity:

```
weight_i = total_quantity_i / sum(total_quantity for all non-labor materials)
```

Useful when materials have comparable costs but vary greatly in volume.

### Equally (`equally`)

Each non-labor material receives an equal share:

```
weight_i = 1 / count(non-labor materials)
```

**Implementation:**
`src/lib/calculations.js` → `applyLandedCostAllocation(order, orderLines, requiredMaterials)`

```javascript
if (method === 'by_value') {
  weight = totalMaterialsCost > 0 ? (rm.estimated_cost ?? 0) / totalMaterialsCost : 0;
} else if (method === 'by_quantity') {
  const totalQty = materialOnlyItems.reduce((acc, m) => acc + m.total_quantity, 0);
  weight = totalQty > 0 ? rm.total_quantity / totalQty : 0;
} else if (method === 'equally') {
  weight = materialOnlyItems.length > 0 ? 1 / materialOnlyItems.length : 0;
}
```

Rounding to 2 decimal places is applied to each allocation figure.

---

## 8. Landed Cost Per Material

After allocation, each material's total landed cost is:

```
total_landed_cost = estimated_cost + allocated_shipping + allocated_customs + allocated_additional
```

For labor:
```
total_landed_cost = estimated_cost   (no logistics added)
```

**Implementation:**
`src/lib/calculations.js` → `applyLandedCostAllocation()` (return value per material item)

---

## 9. Product Unit Cost

When viewing a single product (without order context), the unit cost is built from the BOM alone:

```
total_unit_cost = material_cost + labor_cost
```

When viewing a product within an order (with logistics allocated), the unit cost includes a logistics attribution:

```
total_unit_cost = material_cost_per_unit
               + labor_cost_per_unit
               + allocated_shipping_per_unit
               + allocated_customs_per_unit
               + allocated_additional_per_unit
```

The logistics attribution per unit is computed in `getProductLineCosts()` inside `src/app/orders/[id]/page.jsx`:

```
For each RequiredMaterial used by this product:
  unit_fraction = (bom_quantity × this_line_quantity) / total_required_quantity
  logistics_for_this_material = (allocated_shipping + allocated_customs + allocated_additional) × unit_fraction
  logistics_per_unit += logistics_for_this_material / this_line_quantity
```

**Implementation:**
- Without order context: `src/lib/calculations.js` → `calculateProductCostSummary()`
- Within order: `src/app/orders/[id]/page.jsx` → `getProductLineCosts(line)` (inline function)

---

## 10. Recommended Selling Price (RSP)

```
RSP = total_unit_cost × pricing_multiplier
```

The default pricing multiplier is **3.5**, meaning the recommended retail price is 3.5× the total unit cost.

**This is a cost-plus markup multiplier, not a gross-margin percentage.** A 3.5× multiplier corresponds to approximately 71% gross margin — the multiplier and margin are not the same thing.

The multiplier is stored per-product (`product.pricing_multiplier`) with a default of `3.5`. It can be changed on the Product Detail → Costing tab.

**Example:**

```
LOKE BOXY PUFFER:
  total_unit_cost = €198.70
  pricing_multiplier = 3.5

  RSP = 198.70 × 3.5 = €695.45
```

**Implementation:**
`src/lib/calculations.js` → `calculateProductCostSummary()`

```javascript
const recommendedSellingPrice = round2(totalUnitCost * pricingMultiplier);
```

On the Order Detail page, per-line RSP uses the product's own `pricing_multiplier` (falling back to `3.5`):

```javascript
const multiplier = product?.pricing_multiplier ?? 3.5;
```

---

## 11. Order Cost Summary

Sums all required material costs across the full order, separated by cost type:

```
total_materials_cost  = sum of estimated_cost  for all non-labor RequiredMaterials
total_labor_cost      = sum of estimated_cost  for all labor RequiredMaterials
total_shipping_cost   = sum of allocated_shipping  for all non-labor RequiredMaterials
total_customs_cost    = sum of allocated_customs   for all non-labor RequiredMaterials
total_additional_cost = sum of allocated_additional for all non-labor RequiredMaterials

total_landed_cost = total_materials_cost
                  + total_labor_cost
                  + total_shipping_cost
                  + total_customs_cost
                  + total_additional_cost
```

Labor's allocated logistics are zero (by design), so they do not appear in the logistics subtotals.

**Implementation:**
`src/lib/calculations.js` → `calculateOrderCostSummary({ order, orderLines, requiredMaterials })`

---

## 12. Average Cost Per Unit

```
average_cost_per_unit = total_landed_cost / total_ordered_units
```

`total_ordered_units` is the sum of all `order_line.quantity` values.

**Example:**

```
Order total landed cost: €4,371.40
Total units: 22

Average cost per unit: 4371.40 / 22 = €198.70
```

**Implementation:**
`src/lib/calculations.js` → `calculateOrderCostSummary()`

```javascript
const averageCostPerUnit = totalUnits > 0 ? round2(totalLandedCost / totalUnits) : 0;
```

---

## 13. Supplier Summary Totals

For each supplier group, the summary aggregates cost fields across all materials belonging to that supplier:

```
total_estimated_cost = sum of estimated_cost for all materials in group
total_shipping       = sum of allocated_shipping for all materials in group
total_customs        = sum of allocated_customs for all materials in group
total_additional     = sum of allocated_additional for all materials in group
total_landed_cost    = total_estimated_cost + total_shipping + total_customs + total_additional
```

If any material in the group has `null` estimated cost, `total_estimated_cost` is `null` and `total_landed_cost` is `null` (cannot be computed).

**Implementation:**
`src/lib/calculations.js` → `buildSupplierSummary(requiredMaterials, shippingDestination)`

---

## 14. Approaching Orders

An order is "approaching" if:

1. Its `status` is not `completed` or `cancelled`.
2. It has a `target_date`.
3. The `target_date` is between today (inclusive) and `today + daysThreshold` (inclusive).

```
days_until_target = (target_date - now) / milliseconds_per_day

approaching = status not in ['completed', 'cancelled']
           AND target_date exists
           AND 0 <= days_until_target <= daysThreshold
```

The Dashboard uses a threshold of **60 days**. The deadline color coding on the Dashboard:
- Red: `days <= 14`
- Amber: `days <= 30`
- Gray: `days > 30`

**Implementation:**
`src/lib/calculations.js` → `getApproachingOrders(orders, daysThreshold = 30)`

---

## 15. Currency Handling

The system is **not a multi-currency conversion engine**. All values are stored and displayed in the currency recorded on each record. There is no exchange rate calculation.

- Materials have their own `currency` field.
- Products have a `currency` field (for their `selling_price`).
- Orders have `order_currency`.

`calculateOrderCostSummary()` checks whether materials from multiple currencies are present:

```javascript
const currencies = new Set(requiredMaterials.map((rm) => rm.material.currency));
currencies.add(order.order_currency);
const hasMultipleCurrencies = currencies.size > 1;
```

This flag is returned in the cost summary but the application currently does not display a warning from it on screen. It is available for future use (e.g. showing a multi-currency disclaimer).

`formatCurrency(amount, currency)` in `src/components/ui.jsx` uses `Intl.NumberFormat` with `'en-DE'` locale (European number formatting with `.` as thousands separator and `,` as decimal separator), defaulting to `EUR`.

---

## Summary Reference Table

| Calculation | Formula | Function | File |
|---|---|---|---|
| BOM line cost | `unit_cost × qty_per_unit` | `calculateBOMCost` | `calculations.js` |
| BOM total | `sum of all line costs` | `calculateBOMCost` | `calculations.js` |
| Required quantity | `qty_per_unit × ordered_units` | `calculateRequiredMaterials` | `calculations.js` |
| Estimated material cost | `unit_cost × total_quantity` | `calculateRequiredMaterials` | `calculations.js` |
| Shipping (fixed) | `shipping_cost` | `applyLandedCostAllocation` | `calculations.js` |
| Shipping (per unit) | `shipping_cost × total_units` | `applyLandedCostAllocation` | `calculations.js` |
| Customs (fixed) | `customs_cost` | `applyLandedCostAllocation` | `calculations.js` |
| Customs (percentage) | `(materials + shipping) × rate/100` | `applyLandedCostAllocation` | `calculations.js` |
| Additional (fixed) | `amount` | `applyLandedCostAllocation` | `calculations.js` |
| Additional (per unit) | `amount × total_units` | `applyLandedCostAllocation` | `calculations.js` |
| Additional (percentage) | `(materials + shipping) × amount/100` | `applyLandedCostAllocation` | `calculations.js` |
| Allocation weight (by value) | `mat_cost / total_mat_cost` | `applyLandedCostAllocation` | `calculations.js` |
| Allocation weight (by qty) | `mat_qty / total_mat_qty` | `applyLandedCostAllocation` | `calculations.js` |
| Allocation weight (equally) | `1 / count(non-labor materials)` | `applyLandedCostAllocation` | `calculations.js` |
| Landed cost per material | `est_cost + shipping + customs + additional` | `applyLandedCostAllocation` | `calculations.js` |
| Product unit cost (BOM only) | `material_cost + labor_cost` | `calculateProductCostSummary` | `calculations.js` |
| Product unit cost (with logistics) | `materials + labor + logistics` | `getProductLineCosts` | `orders/[id]/page.jsx` |
| RSP | `total_unit_cost × pricing_multiplier` | `calculateProductCostSummary` | `calculations.js` |
| Order total landed cost | `materials + labor + shipping + customs + additional` | `calculateOrderCostSummary` | `calculations.js` |
| Average cost per unit | `total_landed_cost / total_units` | `calculateOrderCostSummary` | `calculations.js` |
