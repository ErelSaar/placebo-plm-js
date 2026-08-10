import {
  calculateRequiredMaterials,
  buildSupplierSummary,
  calculateBOMCost,
  getApproachingOrders,
  applyLandedCostAllocation,
  calculateProductCostSummary,
  calculateOrderCostSummary,
  resolveAdditionalCosts,
} from '@/lib/calculations';
import {
  DEMO_SUPPLIERS,
  DEMO_MATERIALS,
  DEMO_PRODUCTS,
  DEMO_BOM_LINES,
  DEMO_ORDERS,
  DEMO_ORDER_LINES,
} from '@/data/demo-data';

// ─── Order Totals ─────────────────────────────────────────────────────────────

describe('order totals', () => {
  it('should correctly count total ordered units across both orders', () => {
    const totalUnits = DEMO_ORDER_LINES.reduce((acc, l) => acc + l.quantity, 0);
    // Portugal: LOKE=22, Sweden: ULLER=2, FREJA=1
    expect(totalUnits).toBe(25);
  });

  it('should correctly count unique product types', () => {
    const productTypes = new Set(DEMO_ORDER_LINES.map((l) => l.product_id)).size;
    expect(productTypes).toBe(3);
  });

  it('should have 2 demo orders (Portugal and Sweden)', () => {
    expect(DEMO_ORDERS.length).toBe(2);
    expect(DEMO_ORDERS.find((o) => o.production_country === 'Portugal')).toBeDefined();
    expect(DEMO_ORDERS.find((o) => o.production_country === 'Sweden')).toBeDefined();
  });
});

// ─── Required Materials ───────────────────────────────────────────────────────

describe('calculateRequiredMaterials', () => {
  const params = {
    orderLines: DEMO_ORDER_LINES,
    products: DEMO_PRODUCTS,
    bomLines: DEMO_BOM_LINES,
    materials: DEMO_MATERIALS,
    suppliers: DEMO_SUPPLIERS,
  };

  let result;

  beforeAll(() => {
    result = calculateRequiredMaterials(params);
  });

  it('should produce required materials', () => {
    expect(result.length).toBeGreaterThan(0);
  });

  it('should aggregate ARIZONA 7999 shell fabric across products', () => {
    const arizona = result.find((r) => r.material.id === 'mat-arizona-7999');
    expect(arizona).toBeDefined();
    // LOKE: 4m × 22 = 88, ULLER: 5m × 2 = 10, FREJA: 5m × 1 = 5 → total = 103
    expect(arizona.total_quantity).toBe(103);
  });

  it('should calculate LOKE ARIZONA 7999 quantity as 4 × 22 = 88', () => {
    const arizona = result.find((r) => r.material.id === 'mat-arizona-7999');
    const lokeContrib = arizona.products.find((p) => p.product.id === 'prod-loke');
    expect(lokeContrib).toBeDefined();
    expect(lokeContrib.bom_quantity).toBe(4);
    expect(lokeContrib.quantity).toBe(22);
  });

  it('should calculate ULLER ARIZONA 7999 quantity as 5 × 2 = 10', () => {
    const arizona = result.find((r) => r.material.id === 'mat-arizona-7999');
    const ullerContrib = arizona.products.find((p) => p.product.id === 'prod-uller');
    expect(ullerContrib).toBeDefined();
    expect(ullerContrib.bom_quantity).toBe(5);
    expect(ullerContrib.quantity).toBe(2);
  });

  it('should calculate TNT SCRIM BLACK correctly', () => {
    const tnt = result.find((r) => r.material.id === 'mat-tnt-scrim-black');
    expect(tnt).toBeDefined();
    // LOKE: 3×22=66, ULLER: 2×2=4, FREJA: 2×1=2 → 72
    expect(tnt.total_quantity).toBe(72);
  });

  it('should calculate 200 ZERO DOWN correctly', () => {
    const down200 = result.find((r) => r.material.id === 'mat-200-zero-down');
    expect(down200).toBeDefined();
    // LOKE: 3×22=66, ULLER: 2×2=4, FREJA: 2×1=2 → 72
    expect(down200.total_quantity).toBe(72);
  });

  it('should calculate LOKE sewing labor correctly', () => {
    const sewing = result.find((r) => r.material.id === 'mat-sewing-loke');
    expect(sewing).toBeDefined();
    // LOKE: 1×22=22
    expect(sewing.total_quantity).toBe(22);
    // unit cost 120, total = 120×22 = 2640
    expect(sewing.estimated_cost).toBe(2640);
  });

  it('should flag materials with no supplier', () => {
    const matNoSupplier = result.find((r) => !r.material.supplier_id);
    if (matNoSupplier) {
      expect(matNoSupplier.warnings).toContain('No supplier assigned');
    }
  });

  it('should calculate estimated costs for materials with known unit costs', () => {
    const arizona = result.find((r) => r.material.id === 'mat-arizona-7999');
    expect(arizona).toBeDefined();
    // 103 m × €5.80 = €597.40
    expect(arizona.estimated_cost).toBeCloseTo(597.4, 2);
  });

  it('should not aggregate materials with different IDs even if names similar', () => {
    const arizona = result.find((r) => r.material.id === 'mat-arizona-7999');
    const arizonaQuilted = result.find((r) => r.material.id === 'mat-arizona-7999-quilted');
    expect(arizona).toBeDefined();
    expect(arizonaQuilted).toBeDefined();
  });

  it('VISLON #3 17cm 7999 should aggregate across all three products', () => {
    const vislon = result.find((r) => r.material.id === 'mat-vislon3-17-7999');
    expect(vislon).toBeDefined();
    // LOKE: 2×22=44, ULLER: 2×2=4, FREJA: 2×1=2 → 50
    expect(vislon.total_quantity).toBe(50);
  });
});

// ─── Supplier Summary ─────────────────────────────────────────────────────────

describe('buildSupplierSummary', () => {
  it('should group materials by supplier', () => {
    const reqMats = calculateRequiredMaterials({
      orderLines: DEMO_ORDER_LINES,
      products: DEMO_PRODUCTS,
      bomLines: DEMO_BOM_LINES,
      materials: DEMO_MATERIALS,
      suppliers: DEMO_SUPPLIERS,
    });
    const summary = buildSupplierSummary(reqMats);
    expect(summary.length).toBeGreaterThan(0);

    const belpunto = summary.find((s) => s.supplier?.id === 'sup-belpunto');
    expect(belpunto).toBeDefined();
    expect(belpunto.materials.length).toBeGreaterThan(0);

    const ykk = summary.find((s) => s.supplier?.id === 'sup-ykk');
    expect(ykk).toBeDefined();
  });

  it('should have a group for materials with no supplier', () => {
    const reqMats = calculateRequiredMaterials({
      orderLines: DEMO_ORDER_LINES,
      products: DEMO_PRODUCTS,
      bomLines: DEMO_BOM_LINES,
      materials: DEMO_MATERIALS,
      suppliers: DEMO_SUPPLIERS,
    });
    const summary = buildSupplierSummary(reqMats);
    const noSupplier = summary.find((s) => s.supplier === null);
    expect(noSupplier).toBeDefined();
  });
});

// ─── BOM Cost ─────────────────────────────────────────────────────────────────

describe('calculateBOMCost', () => {
  it('should calculate LOKE BOXY PUFFER cost correctly', () => {
    const lokeBOM = DEMO_BOM_LINES.filter((b) => b.product_id === 'prod-loke');
    const { total, byCategory, materialCost, laborCost } = calculateBOMCost(lokeBOM, DEMO_MATERIALS);

    // Fabric: ARIZONA 7999 (4×5.80=23.20) + TNT SCRIM BLACK (3×0.45=1.35) = 24.55
    expect(byCategory['fabric']).toBeCloseTo(24.55, 2);

    // Filling: 200 ZERO DOWN (3×6.30=18.90) + 100 ZERO DOWN (3×3.45=10.35) = 29.25
    expect(byCategory['filling']).toBeCloseTo(29.25, 2);

    // Labor: sewing (1×120=120)
    expect(laborCost).toBeCloseTo(120, 2);

    // Material cost = total - labor
    expect(materialCost).toBeCloseTo(total - 120, 1);

    // Total should be close to 198.70
    expect(total).toBeCloseTo(198.70, 1);
  });

  it('should calculate ULLER MIDI PUFFER cost correctly', () => {
    const ullerBOM = DEMO_BOM_LINES.filter((b) => b.product_id === 'prod-uller');
    const { total } = calculateBOMCost(ullerBOM, DEMO_MATERIALS);
    expect(total).toBeCloseTo(244.56, 1);
  });

  it('should calculate FREJA MAXI COAT PUFFER cost correctly', () => {
    const frejaBOM = DEMO_BOM_LINES.filter((b) => b.product_id === 'prod-freja');
    const { total } = calculateBOMCost(frejaBOM, DEMO_MATERIALS);
    expect(total).toBeCloseTo(585.96, 1);
  });

  it('should separate labor cost from material cost', () => {
    const lokeBOM = DEMO_BOM_LINES.filter((b) => b.product_id === 'prod-loke');
    const { materialCost, laborCost } = calculateBOMCost(lokeBOM, DEMO_MATERIALS);
    expect(laborCost).toBeCloseTo(120, 2);
    expect(materialCost).toBeCloseTo(198.70 - 120, 1);
  });
});

// ─── Landed Cost Allocation ───────────────────────────────────────────────────

describe('applyLandedCostAllocation', () => {
  const ptLines = DEMO_ORDER_LINES.filter((l) => l.order_id === 'ord-2026-portugal');
  const reqMats = calculateRequiredMaterials({
    orderLines: ptLines,
    products: DEMO_PRODUCTS,
    bomLines: DEMO_BOM_LINES,
    materials: DEMO_MATERIALS,
    suppliers: DEMO_SUPPLIERS,
  });

  it('should allocate fixed shipping cost across materials by value', () => {
    const order = {
      ...DEMO_ORDERS[0],
      shipping_cost: 500,
      shipping_cost_type: 'fixed',
      customs_cost: null,
      customs_type: 'fixed',
      cost_allocation_method: 'by_value',
      additional_costs: [],
    };
    const result = applyLandedCostAllocation(order, ptLines, reqMats);

    const totalAllocatedShipping = result
      .filter((r) => r.material.category !== 'labor')
      .reduce((acc, r) => acc + (r.allocated_shipping ?? 0), 0);
    expect(totalAllocatedShipping).toBeCloseTo(500, 0);
  });

  it('should give labor items zero allocation', () => {
    const order = {
      ...DEMO_ORDERS[0],
      shipping_cost: 500,
      shipping_cost_type: 'fixed',
      customs_cost: null,
      customs_type: 'fixed',
      cost_allocation_method: 'by_value',
      additional_costs: [],
    };
    const result = applyLandedCostAllocation(order, ptLines, reqMats);
    const laborItems = result.filter((r) => r.material.category === 'labor');
    laborItems.forEach((item) => {
      expect(item.allocated_shipping).toBe(0);
    });
  });

  it('should compute percentage customs based on materials + shipping', () => {
    const order = {
      ...DEMO_ORDERS[0],
      shipping_cost: 100,
      shipping_cost_type: 'fixed',
      customs_cost: 10,
      customs_type: 'percentage',
      cost_allocation_method: 'by_value',
      additional_costs: [],
    };
    const result = applyLandedCostAllocation(order, ptLines, reqMats);

    const totalAllocatedCustoms = result
      .filter((r) => r.material.category !== 'labor')
      .reduce((acc, r) => acc + (r.allocated_customs ?? 0), 0);

    const lokeMats = calculateRequiredMaterials({
      orderLines: ptLines,
      products: DEMO_PRODUCTS,
      bomLines: DEMO_BOM_LINES,
      materials: DEMO_MATERIALS,
      suppliers: DEMO_SUPPLIERS,
    }).filter((r) => r.material.category !== 'labor');
    const matTotal = lokeMats.reduce((acc, r) => acc + (r.estimated_cost ?? 0), 0);
    const expectedCustoms = (matTotal + 100) * 0.10;
    expect(totalAllocatedCustoms).toBeCloseTo(expectedCustoms, 0);
  });

  it('should allocate by quantity correctly', () => {
    const order = {
      ...DEMO_ORDERS[0],
      shipping_cost: 600,
      shipping_cost_type: 'fixed',
      customs_cost: null,
      customs_type: 'fixed',
      cost_allocation_method: 'by_quantity',
      additional_costs: [],
    };
    const result = applyLandedCostAllocation(order, ptLines, reqMats);
    const totalShipping = result
      .filter((r) => r.material.category !== 'labor')
      .reduce((acc, r) => acc + (r.allocated_shipping ?? 0), 0);
    expect(totalShipping).toBeCloseTo(600, 0);
  });

  it('should allocate equally across non-labor materials', () => {
    const order = {
      ...DEMO_ORDERS[0],
      shipping_cost: 600,
      shipping_cost_type: 'fixed',
      customs_cost: null,
      customs_type: 'fixed',
      cost_allocation_method: 'equally',
      additional_costs: [],
    };
    const result = applyLandedCostAllocation(order, ptLines, reqMats);
    const nonLaborItems = result.filter((r) => r.material.category !== 'labor');
    const perItem = 600 / nonLaborItems.length;
    nonLaborItems.forEach((item) => {
      expect(item.allocated_shipping).toBeCloseTo(perItem, 0);
    });
  });

  it('should handle per_unit shipping', () => {
    const order = {
      ...DEMO_ORDERS[0],
      shipping_cost: 10,
      shipping_cost_type: 'per_unit',
      customs_cost: null,
      customs_type: 'fixed',
      cost_allocation_method: 'by_value',
      additional_costs: [],
    };
    const result = applyLandedCostAllocation(order, ptLines, reqMats);
    // 22 units × 10 = 220 total shipping
    const totalShipping = result
      .filter((r) => r.material.category !== 'labor')
      .reduce((acc, r) => acc + (r.allocated_shipping ?? 0), 0);
    expect(totalShipping).toBeCloseTo(220, 0);
  });

  it('should handle fixed additional costs', () => {
    const order = {
      ...DEMO_ORDERS[0],
      shipping_cost: null,
      customs_cost: null,
      cost_allocation_method: 'by_value',
      additional_costs: [{ id: 'ac1', name: 'Test', cost_type: 'fixed', amount: 300, notes: '' }],
    };
    const result = applyLandedCostAllocation(order, ptLines, reqMats);
    const totalAdditional = result
      .filter((r) => r.material.category !== 'labor')
      .reduce((acc, r) => acc + (r.allocated_additional ?? 0), 0);
    expect(totalAdditional).toBeCloseTo(300, 0);
  });

  it('should handle per_unit additional costs', () => {
    const order = {
      ...DEMO_ORDERS[0],
      shipping_cost: null,
      customs_cost: null,
      cost_allocation_method: 'by_value',
      additional_costs: [{ id: 'ac1', name: 'Test', cost_type: 'per_unit', amount: 5, notes: '' }],
    };
    const result = applyLandedCostAllocation(order, ptLines, reqMats);
    // 22 units × 5 = 110
    const totalAdditional = result
      .filter((r) => r.material.category !== 'labor')
      .reduce((acc, r) => acc + (r.allocated_additional ?? 0), 0);
    expect(totalAdditional).toBeCloseTo(110, 0);
  });
});

// ─── Product Cost Summary ─────────────────────────────────────────────────────

describe('calculateProductCostSummary', () => {
  it('should calculate LOKE cost summary with default multiplier', () => {
    const lokeBOM = DEMO_BOM_LINES.filter((b) => b.product_id === 'prod-loke');
    const summary = calculateProductCostSummary({ bomLines: lokeBOM, materials: DEMO_MATERIALS });

    expect(summary.labor_cost).toBeCloseTo(120, 2);
    expect(summary.total_unit_cost).toBeCloseTo(198.70, 1);
    expect(summary.pricing_multiplier).toBe(3.5);
    expect(summary.recommended_selling_price).toBeCloseTo(198.70 * 3.5, 0);
  });

  it('should apply custom multiplier', () => {
    const lokeBOM = DEMO_BOM_LINES.filter((b) => b.product_id === 'prod-loke');
    const summary = calculateProductCostSummary({
      bomLines: lokeBOM,
      materials: DEMO_MATERIALS,
      pricingMultiplier: 4.0,
    });
    expect(summary.pricing_multiplier).toBe(4.0);
    expect(summary.recommended_selling_price).toBeCloseTo(summary.total_unit_cost * 4.0, 2);
  });
});

// ─── Order Cost Summary ───────────────────────────────────────────────────────

describe('calculateOrderCostSummary', () => {
  it('should sum all costs and compute average per unit', () => {
    const ptLines = DEMO_ORDER_LINES.filter((l) => l.order_id === 'ord-2026-portugal');
    const order = DEMO_ORDERS.find((o) => o.id === 'ord-2026-portugal');
    const reqMats = calculateRequiredMaterials({
      orderLines: ptLines,
      products: DEMO_PRODUCTS,
      bomLines: DEMO_BOM_LINES,
      materials: DEMO_MATERIALS,
      suppliers: DEMO_SUPPLIERS,
    });
    const summary = calculateOrderCostSummary({ order, orderLines: ptLines, requiredMaterials: reqMats });

    expect(summary.total_units).toBe(22);
    expect(summary.total_materials_cost).toBeGreaterThan(0);
    expect(summary.average_cost_per_unit).toBeCloseTo(summary.total_landed_cost / 22, 2);
  });
});

// ─── Approaching Orders ───────────────────────────────────────────────────────

describe('getApproachingOrders', () => {
  it('should return orders within threshold days', () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const far = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const past = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const orders = [
      { ...DEMO_ORDERS[0], id: '1', target_date: soon, status: 'confirmed' },
      { ...DEMO_ORDERS[0], id: '2', target_date: far, status: 'draft' },
      { ...DEMO_ORDERS[0], id: '3', target_date: past, status: 'draft' },
      { ...DEMO_ORDERS[0], id: '4', target_date: soon, status: 'completed' },
    ];

    const result = getApproachingOrders(orders, 30);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });

  it('should not include completed or cancelled orders', () => {
    const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const orders = [
      { ...DEMO_ORDERS[0], id: 'a', target_date: soon, status: 'completed' },
      { ...DEMO_ORDERS[0], id: 'b', target_date: soon, status: 'cancelled' },
    ];
    const result = getApproachingOrders(orders, 30);
    expect(result.length).toBe(0);
  });
});

// ─── Resolve Additional Costs ─────────────────────────────────────────────────

describe('resolveAdditionalCosts', () => {
  it('should handle fixed costs', () => {
    const costs = [{ id: '1', name: 'Test', cost_type: 'fixed', amount: 100, notes: '' }];
    expect(resolveAdditionalCosts(costs, 10, 1000)).toBe(100);
  });

  it('should handle per_unit costs', () => {
    const costs = [{ id: '1', name: 'Test', cost_type: 'per_unit', amount: 5, notes: '' }];
    expect(resolveAdditionalCosts(costs, 10, 1000)).toBe(50);
  });

  it('should handle percentage costs', () => {
    const costs = [{ id: '1', name: 'Test', cost_type: 'percentage', amount: 10, notes: '' }];
    expect(resolveAdditionalCosts(costs, 10, 1000)).toBe(100);
  });

  it('should sum multiple costs', () => {
    const costs = [
      { id: '1', name: 'Fixed', cost_type: 'fixed', amount: 100, notes: '' },
      { id: '2', name: 'PerUnit', cost_type: 'per_unit', amount: 5, notes: '' },
    ];
    expect(resolveAdditionalCosts(costs, 10, 1000)).toBe(150);
  });
});
