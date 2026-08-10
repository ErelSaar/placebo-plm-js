// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round6(n) {
  return Math.round(n * 1000000) / 1000000;
}

// Labor is the only category excluded from logistics cost allocation.
// Shipping and customs are costs incurred to transport physical goods;
// labor is a service charged at the factory and does not attract import duties.
// To exclude additional categories in future, add them to this Set.
const LABOR_CATEGORIES = new Set(['labor']);

// ─── Required Materials ───────────────────────────────────────────────────────

/**
 * Calculate required materials for a set of order lines.
 * Aggregates the same material across products.
 *
 * @param {{ orderLines, products, bomLines, materials, suppliers }} params
 * @returns {Array} RequiredMaterial[]
 */
export function calculateRequiredMaterials({ orderLines, products, bomLines, materials, suppliers }) {
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const materialMap = new Map(materials.map((m) => [m.id, m]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const aggregated = new Map();

  for (const line of orderLines) {
    const product = productMap.get(line.product_id);
    if (!product) continue;

    const productBOM = bomLines.filter((b) => b.product_id === line.product_id);

    for (const bom of productBOM) {
      const material = materialMap.get(bom.material_id);
      if (!material) continue;

      const key = bom.material_id;
      const required = bom.quantity_per_unit * line.quantity;

      if (aggregated.has(key)) {
        const existing = aggregated.get(key);
        // round6 prevents floating-point drift when accumulating many small decimal quantities
        existing.total_quantity = round6(existing.total_quantity + required);
        existing.products.push({
          product,
          quantity: line.quantity,
          bom_quantity: bom.quantity_per_unit,
        });
      } else {
        const supplier = material.supplier_id
          ? supplierMap.get(material.supplier_id)
          : undefined;
        aggregated.set(key, {
          material: { ...material, supplier },
          total_quantity: round6(required),
          products: [{ product, quantity: line.quantity, bom_quantity: bom.quantity_per_unit }],
        });
      }
    }
  }

  return Array.from(aggregated.values()).map(({ material, total_quantity, products: prods }) => {
    const warnings = [];
    if (!material.supplier_id) warnings.push('No supplier assigned');
    if (!material.unit_of_measurement) warnings.push('No unit of measurement');
    if (material.unit_cost === null || material.unit_cost === undefined)
      warnings.push('No unit cost');

    const unit_cost = material.unit_cost ?? null;
    const estimated_cost =
      unit_cost !== null ? round2(unit_cost * total_quantity) : null;
    if (estimated_cost === null) warnings.push('Cannot calculate cost');

    return {
      material,
      total_quantity,
      products: prods,
      unit_cost,
      estimated_cost,
      warnings,
    };
  });
}

// ─── Supplier Summary ─────────────────────────────────────────────────────────

/**
 * Group required materials by supplier.
 *
 * @param {Array} requiredMaterials
 * @param {string} [shippingDestination]
 * @returns {Array} SupplierSummaryLine[]
 */
export function buildSupplierSummary(requiredMaterials, shippingDestination) {
  const supplierMap = new Map();

  for (const rm of requiredMaterials) {
    const sup = rm.material.supplier ?? null;
    const key = sup?.id ?? '__none__';
    if (!supplierMap.has(key)) {
      supplierMap.set(key, { supplier: sup, materials: [] });
    }
    supplierMap.get(key).materials.push(rm);
  }

  return Array.from(supplierMap.values()).map(({ supplier, materials: mats }) => {
    const costs = mats.map((m) => m.estimated_cost);
    const allKnown = costs.every((c) => c !== null);
    const total_estimated_cost = allKnown
      ? round2(costs.reduce((acc, c) => acc + (c ?? 0), 0))
      : null;

    const totalShipping = mats.reduce((acc, m) => acc + (m.allocated_shipping ?? 0), 0);
    const totalCustoms = mats.reduce((acc, m) => acc + (m.allocated_customs ?? 0), 0);
    const totalAdditional = mats.reduce((acc, m) => acc + (m.allocated_additional ?? 0), 0);
    const totalLanded =
      total_estimated_cost !== null
        ? round2(total_estimated_cost + totalShipping + totalCustoms + totalAdditional)
        : null;

    return {
      supplier,
      materials: mats,
      total_estimated_cost,
      total_shipping: round2(totalShipping),
      total_customs: round2(totalCustoms),
      total_additional: round2(totalAdditional),
      total_landed_cost: totalLanded,
      shipping_destination: shippingDestination,
    };
  });
}

// ─── BOM Cost ─────────────────────────────────────────────────────────────────

/**
 * Calculate total BOM cost for one unit of a product.
 * Returns material cost (non-labor) and labor cost separately.
 *
 * @param {Array} bomLines
 * @param {Array} materials
 * @returns {{ byCategory, total, materialCost, laborCost, hasUnknownCosts }}
 */
export function calculateBOMCost(bomLines, materials) {
  const matMap = new Map(materials.map((m) => [m.id, m]));
  const byCategory = {};
  let total = 0;
  let materialCost = 0;
  let laborCost = 0;
  let hasUnknownCosts = false;

  for (const line of bomLines) {
    const mat = matMap.get(line.material_id);
    if (!mat || mat.unit_cost === null || mat.unit_cost === undefined) {
      hasUnknownCosts = true;
      continue;
    }
    const lineCost = round2(mat.unit_cost * line.quantity_per_unit);
    const cat = mat.category;
    byCategory[cat] = round2((byCategory[cat] ?? 0) + lineCost);
    total = round2(total + lineCost);
    if (LABOR_CATEGORIES.has(cat)) {
      laborCost = round2(laborCost + lineCost);
    } else {
      materialCost = round2(materialCost + lineCost);
    }
  }

  return { byCategory, total, materialCost, laborCost, hasUnknownCosts };
}

// ─── Landed Cost Allocation ───────────────────────────────────────────────────

/**
 * Compute effective shipping, customs and additional costs for an order,
 * then allocate them across required materials.
 * Labor items receive zero allocation.
 *
 * @param {Object} order
 * @param {Array} orderLines
 * @param {Array} requiredMaterials
 * @returns {Array} enriched requiredMaterials
 */
export function applyLandedCostAllocation(order, orderLines, requiredMaterials) {
  const totalUnits = orderLines.reduce((acc, l) => acc + l.quantity, 0);

  // Non-labor materials only (for allocation basis)
  const materialOnlyItems = requiredMaterials.filter(
    (rm) => !LABOR_CATEGORIES.has(rm.material.category)
  );
  const totalMaterialsCost = materialOnlyItems.reduce(
    (acc, rm) => acc + (rm.estimated_cost ?? 0),
    0
  );

  // Shipping
  let shippingTotal = 0;
  if (order.shipping_cost != null && order.shipping_cost > 0) {
    shippingTotal =
      order.shipping_cost_type === 'per_unit'
        ? order.shipping_cost * totalUnits
        : order.shipping_cost;
  }

  // Customs
  let customsTotal = 0;
  if (order.customs_cost != null && order.customs_cost > 0) {
    if (order.customs_type === 'percentage') {
      // Customs percentage applies to physical goods cost only (materials + shipping).
      // Labor is excluded from the basis because it is not subject to import duties.
      customsTotal = round2((totalMaterialsCost + shippingTotal) * (order.customs_cost / 100));
    } else {
      customsTotal = order.customs_cost;
    }
  }

  // Additional costs
  let additionalTotal = 0;
  for (const ac of order.additional_costs ?? []) {
    if (ac.amount > 0) {
      if (ac.cost_type === 'per_unit') {
        additionalTotal = round2(additionalTotal + ac.amount * totalUnits);
      } else if (ac.cost_type === 'percentage') {
        additionalTotal = round2(
          additionalTotal + (totalMaterialsCost + shippingTotal) * (ac.amount / 100)
        );
      } else {
        additionalTotal = round2(additionalTotal + ac.amount);
      }
    }
  }

  const method = order.cost_allocation_method ?? 'by_value';

  return requiredMaterials.map((rm) => {
    // Labor receives no logistics allocation — its landed cost equals its raw estimated cost.
    if (LABOR_CATEGORIES.has(rm.material.category)) {
      return {
        ...rm,
        allocated_shipping: 0,
        allocated_customs: 0,
        allocated_additional: 0,
        total_landed_cost: rm.estimated_cost,
      };
    }

    let weight = 0;
    if (method === 'by_value') {
      weight = totalMaterialsCost > 0 ? (rm.estimated_cost ?? 0) / totalMaterialsCost : 0;
    } else if (method === 'by_quantity') {
      const totalQty = materialOnlyItems.reduce((acc, m) => acc + m.total_quantity, 0);
      weight = totalQty > 0 ? rm.total_quantity / totalQty : 0;
    } else if (method === 'equally') {
      weight = materialOnlyItems.length > 0 ? 1 / materialOnlyItems.length : 0;
    }

    const allocatedShipping = round2(shippingTotal * weight);
    const allocatedCustoms = round2(customsTotal * weight);
    const allocatedAdditional = round2(additionalTotal * weight);
    const totalLanded =
      rm.estimated_cost !== null
        ? round2(rm.estimated_cost + allocatedShipping + allocatedCustoms + allocatedAdditional)
        : null;

    return {
      ...rm,
      allocated_shipping: allocatedShipping,
      allocated_customs: allocatedCustoms,
      allocated_additional: allocatedAdditional,
      total_landed_cost: totalLanded,
    };
  });
}

// ─── Product Cost Summary ─────────────────────────────────────────────────────

/**
 * Build a full cost summary for one product unit.
 *
 * @param {{ bomLines, materials, pricingMultiplier?, allocatedShippingPerUnit?, allocatedCustomsPerUnit?, allocatedAdditionalPerUnit? }} params
 */
export function calculateProductCostSummary({
  bomLines,
  materials,
  pricingMultiplier = 3.5,
  allocatedShippingPerUnit = 0,
  allocatedCustomsPerUnit = 0,
  allocatedAdditionalPerUnit = 0,
}) {
  const { materialCost, laborCost, hasUnknownCosts } = calculateBOMCost(bomLines, materials);
  const totalUnitCost = round2(
    materialCost + laborCost + allocatedShippingPerUnit + allocatedCustomsPerUnit + allocatedAdditionalPerUnit
  );
  const recommendedSellingPrice = round2(totalUnitCost * pricingMultiplier);

  return {
    material_cost: materialCost,
    labor_cost: laborCost,
    allocated_shipping: allocatedShippingPerUnit,
    allocated_customs: allocatedCustomsPerUnit,
    allocated_additional: allocatedAdditionalPerUnit,
    total_unit_cost: totalUnitCost,
    recommended_selling_price: recommendedSellingPrice,
    pricing_multiplier: pricingMultiplier,
    has_unknown_costs: hasUnknownCosts,
  };
}

// ─── Order Cost Summary ───────────────────────────────────────────────────────

/**
 * Build a total cost summary for an entire order.
 *
 * @param {{ order, orderLines, requiredMaterials }} params
 */
export function calculateOrderCostSummary({ order, orderLines, requiredMaterials }) {
  const totalUnits = orderLines.reduce((acc, l) => acc + l.quantity, 0);

  let totalMaterialsCost = 0;
  let totalLaborCost = 0;
  let totalShippingCost = 0;
  let totalCustomsCost = 0;
  let totalAdditionalCost = 0;

  for (const rm of requiredMaterials) {
    if (LABOR_CATEGORIES.has(rm.material.category)) {
      totalLaborCost = round2(totalLaborCost + (rm.estimated_cost ?? 0));
    } else {
      totalMaterialsCost = round2(totalMaterialsCost + (rm.estimated_cost ?? 0));
      totalShippingCost = round2(totalShippingCost + (rm.allocated_shipping ?? 0));
      totalCustomsCost = round2(totalCustomsCost + (rm.allocated_customs ?? 0));
      totalAdditionalCost = round2(totalAdditionalCost + (rm.allocated_additional ?? 0));
    }
  }

  const totalLandedCost = round2(
    totalMaterialsCost + totalLaborCost + totalShippingCost + totalCustomsCost + totalAdditionalCost
  );
  const averageCostPerUnit = totalUnits > 0 ? round2(totalLandedCost / totalUnits) : 0;

  const currencies = new Set(requiredMaterials.map((rm) => rm.material.currency));
  const orderCurrency = order.order_currency ?? 'EUR';
  currencies.add(orderCurrency);
  const hasMultipleCurrencies = currencies.size > 1;

  return {
    total_materials_cost: totalMaterialsCost,
    total_labor_cost: totalLaborCost,
    total_shipping_cost: totalShippingCost,
    total_customs_cost: totalCustomsCost,
    total_additional_cost: totalAdditionalCost,
    total_landed_cost: totalLandedCost,
    total_units: totalUnits,
    average_cost_per_unit: averageCostPerUnit,
    has_multiple_currencies: hasMultipleCurrencies,
  };
}

// ─── Approaching Orders ───────────────────────────────────────────────────────

/**
 * Returns orders approaching their target date (within daysThreshold, not completed/cancelled).
 *
 * @param {Array} orders
 * @param {number} [daysThreshold=30]
 */
export function getApproachingOrders(orders, daysThreshold = 30) {
  const now = new Date();
  return orders.filter((o) => {
    if (o.status === 'completed' || o.status === 'cancelled') return false;
    if (!o.target_date) return false;
    const target = new Date(o.target_date);
    const diffDays = (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= daysThreshold;
  });
}

// ─── Additional Costs Utility ─────────────────────────────────────────────────

/**
 * Compute total additional cost value for display.
 *
 * @param {Array} additionalCosts
 * @param {number} totalUnits
 * @param {number} basisAmount  (materials + shipping)
 */
export function resolveAdditionalCosts(additionalCosts, totalUnits, basisAmount) {
  return round2(
    (additionalCosts ?? []).reduce((acc, ac) => {
      if (!ac.amount || ac.amount <= 0) return acc;
      if (ac.cost_type === 'per_unit') return acc + ac.amount * totalUnits;
      if (ac.cost_type === 'percentage') return acc + basisAmount * (ac.amount / 100);
      return acc + ac.amount;
    }, 0)
  );
}
