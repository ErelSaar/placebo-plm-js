'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, StatusBadge, Card, Section, Input, Textarea, Select,
  Modal, Warning, Tabs, Table, Thead, Tbody, Th, Td, Tr, EmptyState,
  formatCurrency, formatDate, Badge,
} from '@/components/ui';
import { orderRepository, orderLineRepository } from '@/lib/data/orders';
import { productRepository } from '@/lib/data/products';
import { materialRepository } from '@/lib/data/materials';
import { supplierRepository } from '@/lib/data/suppliers';
import { bomRepository } from '@/lib/data/bom';
import {
  calculateRequiredMaterials,
  applyLandedCostAllocation,
  buildSupplierSummary,
  calculateOrderCostSummary,
} from '@/lib/calculations';
import { exportOrderToExcel } from '@/lib/exports/excel';
import { exportOrderToPDF } from '@/lib/exports/pdf';
import { v4 as uuidv4 } from 'uuid';
import { initializePermission, getPermission } from "../../../lib/permissions";

const TABS = [
  { id: 'products', label: 'Products' },
  { id: 'materials', label: 'Required Materials' },
  { id: 'supplier', label: 'Supplier Summary' },
  { id: 'costs', label: 'Cost Breakdown' },
];

const ORDER_STATUSES = ['draft', 'confirmed', 'in_progress', 'completed', 'cancelled'];

export default function OrderDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [orderLines, setOrderLines] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bomLines, setBomLines] = useState([]);
  const [activeTab, setActiveTab] = useState('products');
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({});
  const [costsModal, setCostsModal] = useState(false);
  const [costsForm, setCostsForm] = useState({});
  const [lineModal, setLineModal] = useState(false);
  const [lineForm, setLineForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [allProductsList, setAllProductsList] = useState([]);

  function load() {
    const o = orderRepository.getById(id);
    if (!o) { router.push('/orders'); return; }
    setOrder(o);
    setMetaForm(o);
    setCostsForm({
      shipping_cost: o.shipping_cost ?? '',
      shipping_cost_type: o.shipping_cost_type ?? 'fixed',
      customs_cost: o.customs_cost ?? '',
      customs_type: o.customs_type ?? 'fixed',
      cost_allocation_method: o.cost_allocation_method ?? 'by_value',
      additional_costs: o.additional_costs ?? [],
    });

    const lines = orderLineRepository.getByOrder(id);
    setOrderLines(lines);

    const allProducts = productRepository.getAll();
    setProducts(allProducts);
    setAllProductsList(allProducts.filter((p) => p.status === 'active'));

    const allMaterials = materialRepository.getAll();
    setMaterials(allMaterials);

    const allSuppliers = supplierRepository.getAll();
    setSuppliers(allSuppliers);

    const allBOM = bomRepository.getAll();
    setBomLines(allBOM);
    initializePermission();
  }

  useEffect(() => { load(); }, [id]);

  const permission = getPermission('order');

  if (!order) return null;

  // ─── Computed data ────────────────────────────────────────────────────────

  const requiredMaterialsBase = calculateRequiredMaterials({
    orderLines,
    products,
    bomLines,
    materials,
    suppliers,
  });

  const requiredMaterials = applyLandedCostAllocation(order, orderLines, requiredMaterialsBase);
  const supplierSummary = buildSupplierSummary(requiredMaterials, order.shipping_destination);
  const costSummary = calculateOrderCostSummary({ order, orderLines, requiredMaterials });

  const productMap = new Map(products.map((p) => [p.id, p]));
  const totalUnits = orderLines.reduce((acc, l) => acc + l.quantity, 0);
  const pricingMultiplier = 3.5; // use product-level multiplier in exports, 3.5 as default for display

  // ─── Meta edit ────────────────────────────────────────────────────────────

  function handleSaveMeta() {
    orderRepository.update(id, metaForm);
    setEditingMeta(false);
    load();
  }

  function setMeta(field, value) {
    setMetaForm((prev) => ({ ...prev, [field]: value }));
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  function handleStatusChange(status) {
    orderRepository.update(id, { status });
    load();
  }

  // ─── Costs ────────────────────────────────────────────────────────────────

  function handleSaveCosts() {
    orderRepository.update(id, {
      shipping_cost: costsForm.shipping_cost !== '' ? Number(costsForm.shipping_cost) : null,
      shipping_cost_type: costsForm.shipping_cost_type,
      customs_cost: costsForm.customs_cost !== '' ? Number(costsForm.customs_cost) : null,
      customs_type: costsForm.customs_type,
      cost_allocation_method: costsForm.cost_allocation_method,
      additional_costs: costsForm.additional_costs,
    });
    setCostsModal(false);
    load();
  }

  function addAdditionalCost() {
    setCostsForm((prev) => ({
      ...prev,
      additional_costs: [
        ...prev.additional_costs,
        { id: uuidv4(), name: '', cost_type: 'fixed', amount: '', notes: '' },
      ],
    }));
  }

  function updateAdditionalCost(index, field, value) {
    setCostsForm((prev) => {
      const costs = [...prev.additional_costs];
      costs[index] = { ...costs[index], [field]: value };
      return { ...prev, additional_costs: costs };
    });
  }

  function removeAdditionalCost(index) {
    setCostsForm((prev) => ({
      ...prev,
      additional_costs: prev.additional_costs.filter((_, i) => i !== index),
    }));
  }

  function setCosts(field, value) {
    setCostsForm((prev) => ({ ...prev, [field]: value }));
  }

  // ─── Order Lines ──────────────────────────────────────────────────────────

  function openAddLine() {
    setLineForm({ id: uuidv4(), product_id: '', color: '', size: '', quantity: 1, isNew: true });
    setLineModal(true);
  }

  function openEditLine(line) {
    setLineForm({ ...line, isNew: false });
    setLineModal(true);
  }

  function handleSaveLine() {
    if (!lineForm.product_id || !lineForm.quantity) return;
    const key = `${lineForm.product_id}|${lineForm.color}|${lineForm.size}`;
    const duplicate = orderLines.some(
      (l) => `${l.product_id}|${l.color}|${l.size}` === key && l.id !== lineForm.id
    );
    if (duplicate) { alert('This product + color + size combination already exists in this order.'); return; }

    const updated = lineForm.isNew
      ? [...orderLines, { id: lineForm.id, order_id: id, product_id: lineForm.product_id, color: lineForm.color, size: lineForm.size, quantity: Number(lineForm.quantity) }]
      : orderLines.map((l) => l.id === lineForm.id ? { ...l, ...lineForm, quantity: Number(lineForm.quantity) } : l);
    orderLineRepository.saveMany(id, updated);
    setLineModal(false);
    load();
  }

  function handleRemoveLine(lineId) {
    const updated = orderLines.filter((l) => l.id !== lineId);
    orderLineRepository.saveMany(id, updated);
    load();
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  function handleDelete() {
    orderRepository.remove(id);
    router.push('/orders');
  }

  // ─── Exports ──────────────────────────────────────────────────────────────

  function handleExportExcel() {
    exportOrderToExcel({
      order,
      orderLines,
      products,
      requiredMaterials,
      supplierSummary,
      costSummary,
      pricingMultiplier,
    });
  }

  function handleExportPDF() {
    exportOrderToPDF({
      order,
      orderLines,
      products,
      requiredMaterials,
      supplierSummary,
      costSummary,
      pricingMultiplier,
    });
  }

  // ─── Per-product cost computation ─────────────────────────────────────────

  function getProductLineCosts(line) {
    const productBOMReqs = requiredMaterials.filter((rm) =>
      rm.products.some((p) => p.product.id === line.product_id)
    );

    let materialCostPerUnit = 0;
    let laborCostPerUnit = 0;
    let logisticsPerUnit = 0;

    for (const rm of productBOMReqs) {
      const productEntry = rm.products.find((p) => p.product.id === line.product_id);
      if (!productEntry || rm.unit_cost == null) continue;
      const unitContrib = rm.unit_cost * productEntry.bom_quantity;
      if (rm.material.category === 'labor') {
        laborCostPerUnit += unitContrib;
      } else {
        materialCostPerUnit += unitContrib;
        if (rm.total_quantity > 0) {
          const unitFraction = (productEntry.bom_quantity * productEntry.quantity) / rm.total_quantity;
          logisticsPerUnit += (
            ((rm.allocated_shipping ?? 0) + (rm.allocated_customs ?? 0) + (rm.allocated_additional ?? 0))
            * unitFraction
          ) / line.quantity;
        }
      }
    }

    const totalUnitCost = materialCostPerUnit + laborCostPerUnit + logisticsPerUnit;
    const product = productMap.get(line.product_id);
    const multiplier = product?.pricing_multiplier ?? 3.5;
    return {
      materialCostPerUnit: Math.round(materialCostPerUnit * 100) / 100,
      laborCostPerUnit: Math.round(laborCostPerUnit * 100) / 100,
      logisticsPerUnit: Math.round(logisticsPerUnit * 100) / 100,
      totalUnitCost: Math.round(totalUnitCost * 100) / 100,
      rsp: Math.round(totalUnitCost * multiplier * 100) / 100,
    };
  }

  const lineProduct = lineForm ? productMap.get(lineForm.product_id) : null;

  return (
    <div>
      <PageHeader
        title={order.order_number}
        subtitle={order.order_name}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
            {permission === 0 ? <Select value="" disabled className="w-36"><option value="">Unavailable</option></Select> : <Select value={order.status} onChange={(e) => handleStatusChange(e.target.value)} className="w-36">{ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</Select>}
            <Button onClick={() => setCostsModal(true)} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">Costs</Button>
            <Button onClick={handleExportExcel} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">Export Excel</Button>
            <Button onClick={handleExportPDF} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">Export PDF</Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">Delete</Button>
          </div>
        }
      />

      {/* Order meta info */}
      <div className="px-8 pt-4 pb-2">
        {editingMeta ? (
          <Card className="p-4">
            <div className="grid grid-cols-4 gap-4">
              <Input label="Order Number" value={metaForm.order_number || ''} onChange={(e) => setMeta('order_number', e.target.value)} />
              <Input label="Order Name" value={metaForm.order_name || ''} onChange={(e) => setMeta('order_name', e.target.value)} />
              <Input label="Season" value={metaForm.season || ''} onChange={(e) => setMeta('season', e.target.value)} />
              <Input label="Currency" value={metaForm.order_currency || ''} onChange={(e) => setMeta('order_currency', e.target.value)} />
              <Input label="Order Date" type="date" value={metaForm.order_date || ''} onChange={(e) => setMeta('order_date', e.target.value)} />
              <Input label="Target Date" type="date" value={metaForm.target_date || ''} onChange={(e) => setMeta('target_date', e.target.value)} />
              <Input label="Production Country" value={metaForm.production_country || ''} onChange={(e) => setMeta('production_country', e.target.value)} />
              <Input label="Shipping Destination" value={metaForm.shipping_destination || ''} onChange={(e) => setMeta('shipping_destination', e.target.value)} />
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={() => { setEditingMeta(false); setMetaForm(order); }}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveMeta}>Save</Button>
            </div>
          </Card>
        ) : (
          <div className="flex items-center gap-6 text-[13px] text-[#737373]">
            <span>Season: <span className="text-[#0a0a0a]">{order.season || '—'}</span></span>
            <span>Country: <span className="text-[#0a0a0a]">{order.production_country || '—'}</span></span>
            <span>Shipping to: <span className="text-[#0a0a0a]">{order.shipping_destination || '—'}</span></span>
            <span>Target: <span className="text-[#0a0a0a]">{formatDate(order.target_date)}</span></span>
            <span>Units: <span className="text-[#0a0a0a] font-medium">{totalUnits}</span></span>
            <Button size="sm" variant="ghost" onClick={() => setEditingMeta(true)}>Edit Details</Button>
          </div>
        )}
      </div>

      <div className="px-8 pt-4">
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      <div className="px-8 py-6">

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] text-[#737373]">{orderLines.length} line{orderLines.length !== 1 ? 's' : ''}</p>
              <Button variant="primary" onClick={openAddLine} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:bg-[#f5f5f5] disabled:text-[#737373] disabled:opacity-40">+ Add Product</Button>
            </div>
            {orderLines.length === 0 ? (
              <EmptyState title="No products" description="Add products to this order." action={<Button variant="primary" onClick={openAddLine}>+ Add Product</Button>} />
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>Product</Th>
                    <Th>Style Code</Th>
                    <Th>Color</Th>
                    <Th>Size</Th>
                    <Th>Quantity</Th>
                    <Th>Unit Cost</Th>
                    <Th>RSP</Th>
                    <Th></Th>
                  </tr>
                </Thead>
                <Tbody>
                  {orderLines.map((line) => {
                    const product = productMap.get(line.product_id);
                    const costs = getProductLineCosts(line);
                    return (
                      <Tr key={line.id}>
                        <Td className="font-medium">{product?.name ?? '—'}</Td>
                        <Td>{product?.style_code ?? '—'}</Td>
                        <Td>{line.color}</Td>
                        <Td>{line.size}</Td>
                        <Td>{line.quantity}</Td>
                        <Td>{formatCurrency(costs.totalUnitCost)}</Td>
                        <Td>{formatCurrency(costs.rsp)}</Td>
                        <Td>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditLine(line)} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">Edit</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleRemoveLine(line.id)} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">Remove</Button>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            )}
          </div>
        )}

        {/* Required Materials Tab */}
        {activeTab === 'materials' && (
          <div>
            {requiredMaterials.length === 0 ? (
              <EmptyState title="No materials" description="Add products with BOM data to see required materials." />
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>Material</Th>
                    <Th>Category</Th>
                    <Th>Supplier</Th>
                    <Th>Qty Required</Th>
                    <Th>UOM</Th>
                    <Th>Unit Cost</Th>
                    <Th>Mat. Cost</Th>
                    <Th>Shipping</Th>
                    <Th>Customs</Th>
                    <Th>Additional</Th>
                    <Th>Landed Cost</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {requiredMaterials.map((rm) => (
                    <Tr key={rm.material.id}>
                      <Td className="font-medium">
                        {rm.material.name}
                        {rm.warnings.length > 0 && (
                          <span className="ml-1 text-amber-600 text-[11px]" title={rm.warnings.join(', ')}>⚠</span>
                        )}
                      </Td>
                      <Td>{rm.material.category}</Td>
                      <Td>{rm.material.supplier?.name ?? <span className="text-amber-600">—</span>}</Td>
                      <Td>{rm.total_quantity}</Td>
                      <Td>{rm.material.unit_of_measurement}</Td>
                      <Td>{rm.unit_cost != null ? formatCurrency(rm.unit_cost) : '—'}</Td>
                      <Td>{rm.estimated_cost != null ? formatCurrency(rm.estimated_cost) : '—'}</Td>
                      <Td>{rm.allocated_shipping != null ? formatCurrency(rm.allocated_shipping) : '—'}</Td>
                      <Td>{rm.allocated_customs != null ? formatCurrency(rm.allocated_customs) : '—'}</Td>
                      <Td>{rm.allocated_additional != null ? formatCurrency(rm.allocated_additional) : '—'}</Td>
                      <Td className="font-medium">{rm.total_landed_cost != null ? formatCurrency(rm.total_landed_cost) : '—'}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </div>
        )}

        {/* Supplier Summary Tab */}
        {activeTab === 'supplier' && (
          <div>
            {supplierSummary.length === 0 ? (
              <EmptyState title="No supplier data" description="Add products with materials and suppliers to see the supplier summary." />
            ) : (
              <div className="space-y-6">
                {supplierSummary.map((group, idx) => (
                  <Card key={group.supplier?.id ?? 'none'} className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-[14px] font-semibold">{group.supplier?.name ?? 'No Supplier'}</p>
                        {group.supplier?.country && <p className="text-[12px] text-[#737373]">{group.supplier.country}</p>}
                        {group.shipping_destination && (
                          <p className="text-[12px] text-[#737373]">Ships to: {group.shipping_destination}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] text-[#737373]">Total Landed Cost</p>
                        <p className="text-[18px] font-semibold">{group.total_landed_cost != null ? formatCurrency(group.total_landed_cost) : '—'}</p>
                      </div>
                    </div>
                    <Table>
                      <Thead>
                        <tr>
                          <Th>Material</Th>
                          <Th>Category</Th>
                          <Th>Qty</Th>
                          <Th>UOM</Th>
                          <Th>Mat. Cost</Th>
                          <Th>Shipping</Th>
                          <Th>Customs</Th>
                          <Th>Additional</Th>
                          <Th>Landed Cost</Th>
                        </tr>
                      </Thead>
                      <Tbody>
                        {group.materials.map((rm) => (
                          <Tr key={rm.material.id}>
                            <Td className="font-medium">{rm.material.name}</Td>
                            <Td>{rm.material.category}</Td>
                            <Td>{rm.total_quantity}</Td>
                            <Td>{rm.material.unit_of_measurement}</Td>
                            <Td>{rm.estimated_cost != null ? formatCurrency(rm.estimated_cost) : '—'}</Td>
                            <Td>{formatCurrency(rm.allocated_shipping ?? 0)}</Td>
                            <Td>{formatCurrency(rm.allocated_customs ?? 0)}</Td>
                            <Td>{formatCurrency(rm.allocated_additional ?? 0)}</Td>
                            <Td className="font-medium">{rm.total_landed_cost != null ? formatCurrency(rm.total_landed_cost) : '—'}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                    <div className="flex justify-end gap-6 mt-3 pt-3 border-t border-[#f0f0f0] text-[13px]">
                      <span>Materials: <strong>{formatCurrency(group.total_estimated_cost)}</strong></span>
                      <span>Shipping: <strong>{formatCurrency(group.total_shipping)}</strong></span>
                      <span>Customs: <strong>{formatCurrency(group.total_customs)}</strong></span>
                      <span>Additional: <strong>{formatCurrency(group.total_additional)}</strong></span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cost Breakdown Tab */}
        {activeTab === 'costs' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Order totals */}
            <Card className="p-6">
              <Section title="Order Cost Summary">
                <div className="space-y-2">
                  <CostRow label="Materials" value={costSummary.total_materials_cost} />
                  <CostRow label="Labor (Sewing)" value={costSummary.total_labor_cost} />
                  <CostRow label="Shipping" value={costSummary.total_shipping_cost} />
                  <CostRow label="Customs" value={costSummary.total_customs_cost} />
                  <CostRow label="Additional Costs" value={costSummary.total_additional_cost} />
                  <div className="border-t border-[#e5e5e5] pt-2">
                    <CostRow label="Total Landed Cost" value={costSummary.total_landed_cost} bold />
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#e5e5e5] space-y-2">
                    <CostRow label="Total Units" value={null} text={String(costSummary.total_units)} />
                    <CostRow label="Average Cost / Unit" value={costSummary.average_cost_per_unit} bold />
                    <CostRow label={`Avg. RSP (×${pricingMultiplier})`} value={costSummary.average_cost_per_unit * pricingMultiplier} />
                  </div>
                </div>
              </Section>
            </Card>

            {/* Per-product breakdown */}
            <Card className="p-6">
              <Section title="Per Product">
                {orderLines.length === 0 ? (
                  <p className="text-[13px] text-[#737373]">No products in this order.</p>
                ) : (
                  <Table>
                    <Thead>
                      <tr>
                        <Th>Product</Th>
                        <Th>Color</Th>
                        <Th>Mat.</Th>
                        <Th>Labor</Th>
                        <Th>Log.</Th>
                        <Th>Total</Th>
                        <Th>RSP</Th>
                      </tr>
                    </Thead>
                    <Tbody>
                      {orderLines.map((line) => {
                        const product = productMap.get(line.product_id);
                        const costs = getProductLineCosts(line);
                        return (
                          <Tr key={line.id}>
                            <Td className="font-medium text-[12px]">{product?.name ?? '—'}</Td>
                            <Td className="text-[12px]">{line.color}</Td>
                            <Td className="text-[12px]">{formatCurrency(costs.materialCostPerUnit)}</Td>
                            <Td className="text-[12px]">{formatCurrency(costs.laborCostPerUnit)}</Td>
                            <Td className="text-[12px]">{formatCurrency(costs.logisticsPerUnit)}</Td>
                            <Td className="text-[12px] font-semibold">{formatCurrency(costs.totalUnitCost)}</Td>
                            <Td className="text-[12px]">{formatCurrency(costs.rsp)}</Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                )}
              </Section>
            </Card>
          </div>
        )}
      </div>

      {/* Costs Modal */}
      <Modal
        open={costsModal}
        onClose={() => setCostsModal(false)}
        title="Order Costs"
        size="lg"
        footer={<>
          <Button onClick={() => { setCostsModal(false); setCostsForm({ shipping_cost: order.shipping_cost ?? '', shipping_cost_type: order.shipping_cost_type ?? 'fixed', customs_cost: order.customs_cost ?? '', customs_type: order.customs_type ?? 'fixed', cost_allocation_method: order.cost_allocation_method ?? 'by_value', additional_costs: order.additional_costs ?? [] }); }}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveCosts}>Save Costs</Button>
        </>}
      >
        <div className="space-y-6">
          {/* Shipping */}
          <Section title="Shipping">
            <div className="grid grid-cols-2 gap-4">
              <Select label="Type" value={costsForm.shipping_cost_type} onChange={(e) => setCosts('shipping_cost_type', e.target.value)}>
                <option value="fixed">Fixed</option>
                <option value="per_unit">Per Unit</option>
              </Select>
              <Input
                label={costsForm.shipping_cost_type === 'per_unit' ? 'Cost per Unit' : 'Fixed Amount'}
                type="number"
                step="0.01"
                value={costsForm.shipping_cost}
                onChange={(e) => setCosts('shipping_cost', e.target.value)}
              />
            </div>
          </Section>

          {/* Customs */}
          <Section title="Customs">
            <div className="grid grid-cols-2 gap-4">
              <Select label="Type" value={costsForm.customs_type} onChange={(e) => setCosts('customs_type', e.target.value)}>
                <option value="fixed">Fixed</option>
                <option value="percentage">Percentage of (Materials + Shipping)</option>
              </Select>
              <Input
                label={costsForm.customs_type === 'percentage' ? 'Percentage (%)' : 'Fixed Amount'}
                type="number"
                step="0.01"
                value={costsForm.customs_cost}
                onChange={(e) => setCosts('customs_cost', e.target.value)}
              />
            </div>
          </Section>

          {/* Additional Costs */}
          <Section
            title="Additional Costs"
            actions={<Button size="sm" onClick={addAdditionalCost}>+ Add</Button>}
          >
            {costsForm.additional_costs.length === 0 ? (
              <p className="text-[13px] text-[#737373]">No additional costs.</p>
            ) : (
              <div className="space-y-3">
                {costsForm.additional_costs.map((ac, idx) => (
                  <div key={ac.id} className="grid grid-cols-4 gap-3 items-end">
                    <Input label="Name" value={ac.name} onChange={(e) => updateAdditionalCost(idx, 'name', e.target.value)} />
                    <Select label="Type" value={ac.cost_type} onChange={(e) => updateAdditionalCost(idx, 'cost_type', e.target.value)}>
                      <option value="fixed">Fixed</option>
                      <option value="per_unit">Per Unit</option>
                      <option value="percentage">Percentage</option>
                    </Select>
                    <Input label="Amount" type="number" step="0.01" value={ac.amount} onChange={(e) => updateAdditionalCost(idx, 'amount', e.target.value)} />
                    <Button variant="danger" size="sm" onClick={() => removeAdditionalCost(idx)}>Remove</Button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Allocation Method */}
          <Section title="Cost Allocation">
            <Select
              label="Allocation Method"
              value={costsForm.cost_allocation_method}
              onChange={(e) => setCosts('cost_allocation_method', e.target.value)}
            >
              <option value="by_value">By Material Value</option>
              <option value="by_quantity">By Quantity</option>
              <option value="equally">Equally</option>
            </Select>
            <p className="text-[12px] text-[#737373] mt-2">
              Determines how shipping, customs and additional costs are distributed across materials.
              Labor is always excluded from logistics allocation.
            </p>
          </Section>
        </div>
      </Modal>

      {/* Add/Edit Line Modal */}
      <Modal
        open={lineModal}
        onClose={() => setLineModal(false)}
        title={lineForm?.isNew ? 'Add Product' : 'Edit Order Line'}
        size="md"
        footer={<>
          <Button onClick={() => setLineModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveLine}>{lineForm?.isNew ? 'Add' : 'Save'}</Button>
        </>}
      >
        {lineForm && (
          <div className="space-y-4">
            {lineForm.isNew && (
              <Select
                label="Product *"
                value={lineForm.product_id}
                onChange={(e) => setLineForm((prev) => {
                  const p = productMap.get(e.target.value);
                  return { ...prev, product_id: e.target.value, color: p?.colors?.[0] ?? '', size: p?.sizes?.[0] ?? '' };
                })}
              >
                <option value="">Select product...</option>
                {allProductsList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            )}
            {lineProduct?.colors?.length > 0 ? (
              <Select label="Color" value={lineForm.color} onChange={(e) => setLineForm((prev) => ({ ...prev, color: e.target.value }))}>
                {lineProduct.colors.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            ) : (
              <Input label="Color" value={lineForm.color} onChange={(e) => setLineForm((prev) => ({ ...prev, color: e.target.value }))} />
            )}
            {lineProduct?.sizes?.length > 0 ? (
              <Select label="Size" value={lineForm.size} onChange={(e) => setLineForm((prev) => ({ ...prev, size: e.target.value }))}>
                {lineProduct.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            ) : (
              <Input label="Size" value={lineForm.size} onChange={(e) => setLineForm((prev) => ({ ...prev, size: e.target.value }))} />
            )}
            <Input
              label="Quantity *"
              type="number"
              min="1"
              value={lineForm.quantity}
              onChange={(e) => setLineForm((prev) => ({ ...prev, quantity: e.target.value }))}
            />
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete Order"
        size="sm"
        footer={<>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete Order</Button>
        </>}
      >
        <p className="text-[13px]">
          Are you sure you want to delete order <strong>{order.order_number}</strong>? All order lines will also be removed. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

function CostRow({ label, value, bold, text }) {
  return (
    <div className={`flex items-center justify-between py-1`}>
      <span className={`text-[13px] ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`text-[13px] font-mono ${bold ? 'font-semibold' : ''}`}>
        {text !== undefined ? text : (value != null ? formatCurrency(value) : '—')}
      </span>
    </div>
  );
}
