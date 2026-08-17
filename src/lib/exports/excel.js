import * as XLSX from 'xlsx';

function fmt(n) {
  if (n == null) return '';
  return Math.round(n * 100) / 100;
}

/**
 * Export an order to a 5-sheet Excel workbook.
 *
 * @param {{ order, orderLines, products, requiredMaterials, supplierSummary, costSummary, pricingMultiplier }} data
 */
export function exportOrderToExcel(data) {
  const { order, orderLines, products, requiredMaterials, supplierSummary, costSummary, pricingMultiplier } = data;
  const productMap = new Map(products.map((p) => [p.id, p]));
  const wb = XLSX.utils.book_new();
  const currency = order.order_currency ?? 'EUR';

  // ─── Sheet 1: Order Summary ───────────────────────────────────────────────
  const totalUnits = orderLines.reduce((acc, l) => acc + l.quantity, 0);
  const productTypes = new Set(orderLines.map((l) => l.product_id)).size;

  const summaryRows = [
    ['PLACEBO – Order Export'],
    [],
    ['Order Number', order.order_number],
    ['Order Name', order.name],
    ['Status', order.status],
    ['Season', order.season],
    ['Production Country', order.production_country ?? ''],
    ['Production Factory', order.factory ?? ''],
    ['Shipping Destination', order.shipping_destination ?? ''],
    ['Order Date', order.order_date],
    ['Target Date', order.target_date],
    [],
    ['Total Product Types', productTypes],
    ['Total Units', totalUnits],
    ['Currency', currency],
    [],
    ['Materials Cost', fmt(costSummary.total_materials_cost)],
    ['Labor Cost', fmt(costSummary.total_labor_cost)],
    ['Shipping Cost', fmt(costSummary.total_shipping_cost)],
    ['Customs Cost', fmt(costSummary.total_customs_cost)],
    ['Additional Costs', fmt(costSummary.total_additional_cost)],
    ['Total Landed Cost', fmt(costSummary.total_landed_cost)],
    ['Average Cost per Unit', fmt(costSummary.average_cost_per_unit)],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{ wch: 28 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Order Summary');

  // ─── Sheet 2: Products ───────────────────────────────────────────────────
  const productHeader = [
    'Product', 'Style Code', 'Color', 'Size', 'SKU', 'Quantity',
    `Mat. Cost / Unit (${currency})`, `Sewing / Unit (${currency})`,
    `Logistics / Unit (${currency})`, `Total Unit Cost (${currency})`,
    `Rec. Selling Price (${currency})`,
  ];

  const productRows = [productHeader];

  for (const line of orderLines) {
    const product = productMap.get(line.product_id);
    if (!product) continue;

    const productBOMReqs = requiredMaterials.filter((rm) =>
      rm.products.some((p) => p.product.id === line.product_id)
    );

    let materialCostPerUnit = 0;
    let laborCostPerUnit = 0;
    let allocatedShippingPerUnit = 0;
    let allocatedCustomsPerUnit = 0;
    let allocatedAdditionalPerUnit = 0;

    for (const rm of productBOMReqs) {
      const productEntry = rm.products.find((p) => p.product.id === line.product_id);
      if (!productEntry || rm.unit_cost == null) continue;
      const unitContrib = rm.unit_cost * productEntry.bom_quantity;
      const isLabor = rm.material.category === 'labor';
      if (isLabor) {
        laborCostPerUnit += unitContrib;
      } else {
        materialCostPerUnit += unitContrib;
        if (rm.total_quantity > 0) {
          const unitFraction = (productEntry.bom_quantity * productEntry.quantity) / rm.total_quantity;
          allocatedShippingPerUnit += ((rm.allocated_shipping ?? 0) * unitFraction) / line.quantity;
          allocatedCustomsPerUnit += ((rm.allocated_customs ?? 0) * unitFraction) / line.quantity;
          allocatedAdditionalPerUnit += ((rm.allocated_additional ?? 0) * unitFraction) / line.quantity;
        }
      }
    }

    const totalUnitCost = materialCostPerUnit + laborCostPerUnit + allocatedShippingPerUnit + allocatedCustomsPerUnit + allocatedAdditionalPerUnit;
    const rsp = totalUnitCost * pricingMultiplier;
    const logisticsPerUnit = allocatedShippingPerUnit + allocatedCustomsPerUnit + allocatedAdditionalPerUnit;

    productRows.push([
      product.name,
      product.style_code,
      line.color,
      line.size,
      product.sku,
      line.quantity,
      fmt(materialCostPerUnit),
      fmt(laborCostPerUnit),
      fmt(logisticsPerUnit),
      fmt(totalUnitCost),
      fmt(rsp),
    ]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(productRows);
  ws2['!cols'] = productHeader.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws2, 'Products');

  // ─── Sheet 3: Required Materials ────────────────────────────────────────
  const matHeader = [
    'Material', 'Category', 'Supplier', 'Qty Required', 'Unit',
    `Unit Cost (${currency})`, `Materials Cost (${currency})`,
    `Allocated Shipping (${currency})`, `Allocated Customs (${currency})`,
    `Allocated Additional (${currency})`, `Total Landed Cost (${currency})`,
    'Products Using Material',
  ];

  const matRows = [matHeader];

  for (const rm of requiredMaterials) {
    const supplierName = rm.material.supplier?.name ?? 'No supplier';
    const productNames = rm.products.map((p) => p.product.name).join(', ');
    matRows.push([
      rm.material.name,
      rm.material.category,
      supplierName,
      rm.total_quantity,
      rm.material.unit_of_measure,
      fmt(rm.unit_cost),
      fmt(rm.estimated_cost),
      fmt(rm.allocated_shipping),
      fmt(rm.allocated_customs),
      fmt(rm.allocated_additional),
      fmt(rm.total_landed_cost),
      productNames,
    ]);
  }

  const ws3 = XLSX.utils.aoa_to_sheet(matRows);
  ws3['!cols'] = matHeader.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws3, 'Required Materials');

  // ─── Sheet 4: Supplier Summary ───────────────────────────────────────────
  const supHeader = [
    'Supplier', 'Country', 'Materials', 'Quantities', 'Shipping Destination',
    `Materials Cost (${currency})`, `Shipping (${currency})`,
    `Customs (${currency})`, `Additional (${currency})`, `Total Landed Cost (${currency})`,
  ];

  const supRows = [supHeader];

  for (const group of supplierSummary) {
    const supplierName = group.supplier?.name ?? 'No Supplier';
    const country = group.supplier?.country ?? '';
    const materialNames = group.materials.map((m) => m.material.name).join(', ');
    const quantities = group.materials.map((m) => `${m.total_quantity} ${m.material.unit_of_measure}`).join(', ');
    supRows.push([
      supplierName,
      country,
      materialNames,
      quantities,
      group.shipping_destination ?? order.shipping_destination ?? '',
      fmt(group.total_estimated_cost),
      fmt(group.total_shipping),
      fmt(group.total_customs),
      fmt(group.total_additional),
      fmt(group.total_landed_cost),
    ]);
  }

  const ws4 = XLSX.utils.aoa_to_sheet(supRows);
  ws4['!cols'] = supHeader.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws4, 'Supplier Summary');

  // ─── Sheet 5: Cost Breakdown ─────────────────────────────────────────────
  const avgRsp = costSummary.average_cost_per_unit * pricingMultiplier;

  const breakdownRows = [
    ['Cost Breakdown', ''],
    [],
    [`Currency: ${currency}`, ''],
    [],
    ['Category', `Amount (${currency})`],
    ['Materials', fmt(costSummary.total_materials_cost)],
    ['Labor (Sewing)', fmt(costSummary.total_labor_cost)],
    ['Shipping', fmt(costSummary.total_shipping_cost)],
    ['Customs', fmt(costSummary.total_customs_cost)],
    ['Additional Costs', fmt(costSummary.total_additional_cost)],
    ['Total Landed Cost', fmt(costSummary.total_landed_cost)],
    [],
    ['Total Units', costSummary.total_units],
    ['Average Cost per Unit', fmt(costSummary.average_cost_per_unit)],
    ['Pricing Multiplier', pricingMultiplier],
    ['Avg. Rec. Selling Price / Unit', fmt(avgRsp)],
  ];

  if (orderLines.length > 0) {
    breakdownRows.push([]);
    breakdownRows.push(['Per Product', `Rec. Selling Price (${currency})`]);
  }

  for (const line of orderLines) {
    const product = productMap.get(line.product_id);
    if (!product) continue;
    const productBOMReqs = requiredMaterials.filter((rm) =>
      rm.products.some((p) => p.product.id === line.product_id)
    );
    let totalUnit = 0;
    for (const rm of productBOMReqs) {
      const pe = rm.products.find((p) => p.product.id === line.product_id);
      if (!pe || rm.unit_cost == null) continue;
      totalUnit += rm.unit_cost * pe.bom_quantity;
    }
    breakdownRows.push([`${product.name} (${line.color})`, fmt(totalUnit * pricingMultiplier)]);
  }

  const ws5 = XLSX.utils.aoa_to_sheet(breakdownRows);
  ws5['!cols'] = [{ wch: 32 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'Cost Breakdown');

  // ─── Write file ──────────────────────────────────────────────────────────
  XLSX.writeFile(wb, `${order.order_number}-export.xlsx`);
}
