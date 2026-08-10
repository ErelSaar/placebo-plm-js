import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function fmt(n) {
  if (n == null) return '—';
  return `€${(Math.round(n * 100) / 100).toFixed(2)}`;
}

/**
 * Export an order to an A4 PDF document.
 *
 * @param {{ order, orderLines, products, requiredMaterials, supplierSummary, costSummary, pricingMultiplier }} data
 */
export function exportOrderToPDF(data) {
  const { order, orderLines, products, requiredMaterials, supplierSummary, costSummary, pricingMultiplier } = data;
  const productMap = new Map(products.map((p) => [p.id, p]));
  const currency = order.order_currency ?? 'EUR';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ─── Header ────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('PLACEBO', 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Product Lifecycle Management', 14, 23);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(order.order_number, 196, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(order.order_name, 196, 23, { align: 'right' });

  // ─── Order Info ─────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 30,
    head: [['Order Details', '', '', '']],
    body: [
      ['Status', order.status, 'Season', order.season ?? '—'],
      ['Order Date', order.order_date ?? '—', 'Target Date', order.target_date ?? '—'],
      ['Production Country', order.production_country ?? '—', 'Factory', order.production_factory ?? '—'],
      ['Shipping Destination', order.shipping_destination ?? '—', 'Currency', currency],
    ],
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fontSize: 9, fontStyle: 'bold', fillColor: [10, 10, 10], textColor: [255, 255, 255] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 2: { fontStyle: 'bold', cellWidth: 45 } },
  });

  let y = doc.lastAutoTable.finalY + 8;

  // ─── Products Table ─────────────────────────────────────────────────────
  const productRows = orderLines.map((line) => {
    const product = productMap.get(line.product_id);
    if (!product) return null;

    const productBOMReqs = requiredMaterials.filter((rm) =>
      rm.products.some((p) => p.product.id === line.product_id)
    );

    let matCost = 0;
    let laborCost = 0;
    for (const rm of productBOMReqs) {
      const pe = rm.products.find((p) => p.product.id === line.product_id);
      if (!pe || rm.unit_cost == null) continue;
      const contrib = rm.unit_cost * pe.bom_quantity;
      if (rm.material.category === 'labor') laborCost += contrib;
      else matCost += contrib;
    }

    const totalUnit = matCost + laborCost;
    const rsp = totalUnit * pricingMultiplier;

    return [
      product.name,
      line.color,
      line.size,
      line.quantity,
      fmt(matCost),
      fmt(laborCost),
      fmt(totalUnit),
      fmt(rsp),
    ];
  }).filter(Boolean);

  autoTable(doc, {
    startY: y,
    head: [['Product', 'Color', 'Size', 'Qty', `Mat. Cost`, `Labor`, `Unit Cost`, `RSP (${currency})`]],
    body: productRows,
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fontSize: 8, fontStyle: 'bold', fillColor: [10, 10, 10], textColor: [255, 255, 255] },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ─── Required Materials ─────────────────────────────────────────────────
  const matRows = requiredMaterials.map((rm) => [
    rm.material.name,
    rm.material.category,
    rm.material.supplier?.name ?? '—',
    `${rm.total_quantity} ${rm.material.unit_of_measurement}`,
    fmt(rm.unit_cost),
    fmt(rm.estimated_cost),
    fmt(rm.allocated_shipping),
    fmt(rm.total_landed_cost),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Material', 'Cat.', 'Supplier', 'Qty', 'Unit Cost', 'Mat. Cost', 'Shipping', 'Landed Cost']],
    body: matRows,
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fontSize: 7.5, fontStyle: 'bold', fillColor: [10, 10, 10], textColor: [255, 255, 255] },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ─── Cost Summary ──────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    head: [['Cost Summary', `Amount (${currency})`]],
    body: [
      ['Materials Cost', fmt(costSummary.total_materials_cost)],
      ['Labor (Sewing)', fmt(costSummary.total_labor_cost)],
      ['Shipping', fmt(costSummary.total_shipping_cost)],
      ['Customs', fmt(costSummary.total_customs_cost)],
      ['Additional Costs', fmt(costSummary.total_additional_cost)],
      ['Total Landed Cost', fmt(costSummary.total_landed_cost)],
      ['Total Units', String(costSummary.total_units)],
      ['Average Cost / Unit', fmt(costSummary.average_cost_per_unit)],
      [`Avg. RSP (×${pricingMultiplier})`, fmt(costSummary.average_cost_per_unit * pricingMultiplier)],
    ],
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fontSize: 9, fontStyle: 'bold', fillColor: [10, 10, 10], textColor: [255, 255, 255] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
  });

  doc.save(`${order.order_number}-export.pdf`);
}
