'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, StatusBadge, Card, Section, Input, Textarea, Select,
  Modal, Warning, Tabs, Table, Thead, Tbody, Th, Td, Tr, EmptyState,
  formatCurrency, Badge,
} from '@/components/ui';
import { productRepository } from '@/lib/data/products';
import { materialRepository } from '@/lib/data/materials';
import { supplierRepository } from '@/lib/data/suppliers';
import { bomRepository } from '@/lib/data/bom';
import { orderRepository, orderLineRepository } from '@/lib/data/orders';
import { calculateBOMCost, calculateProductCostSummary } from '@/lib/calculations';
import { MATERIAL_CATEGORY_GROUPS, PRODUCT_CATEGORIES } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid';
import { initializePermission, getPermission } from "../../../lib/permissions";

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'bom', label: 'Bill of Materials' },
  { id: 'costing', label: 'Costing' },
  { id: 'orders', label: 'Orders' },
];

export default function ProductDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bomLines, setBomLines] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [orders, setOrders] = useState([]);
  const [orderLines, setOrderLines] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bomModal, setBomModal] = useState(false);
  const [editBomLine, setEditBomLine] = useState(null);
  const [bomForm, setBomForm] = useState({ material_id: '', quantity_per_unit: '', notes: '' });
  const [multiplier, setMultiplier] = useState(3.5);
  const [errors, setErrors] = useState({});

  function load() {
    const p = productRepository.getById(id);
    if (!p) { router.push('/products'); return; }
    setProduct(p);
    setForm(p);
    setMultiplier(p.pricing_multiplier ?? 3.5);

    const allMaterials = materialRepository.getAll();
    setMaterials(allMaterials);
    setSuppliers(supplierRepository.getAll());

    const bom = bomRepository.getByProduct(id);
    setBomLines(bom);

    const allOrders = orderRepository.getAll();
    const allLines = orderLineRepository.getAll();
    const productOrderLines = allLines.filter((l) => l.product_id === id);
    const productOrderIds = new Set(productOrderLines.map((l) => l.order_id));
    setOrders(allOrders.filter((o) => productOrderIds.has(o.id)));
    setOrderLines(productOrderLines);
    initializePermission();
  }

  useEffect(() => { load(); }, [id]);

  const permission = getPermission('product');

  if (!product) return null;

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    productRepository.update(id, {
      ...form,
      selling_price: form.selling_price !== '' && form.selling_price != null ? Number(form.selling_price) : null,
    });
    setEditing(false);
    load();
  }

  function handleStatusChange(status) {
    productRepository.update(id, { status });
    load();
  }

  function handleDelete() {
    // Remove BOM lines and order lines first
    bomRepository.removeByProduct(id);
    const allOrderLines = orderLineRepository.getAll();
    const withoutThis = allOrderLines.filter((l) => l.product_id !== id);
    // Save back without this product's lines
    const allOrders = orderRepository.getAll();
    for (const order of allOrders) {
      const orderLinesToKeep = withoutThis.filter((l) => l.order_id === order.id);
      orderLineRepository.saveMany(order.id, orderLinesToKeep);
    }
    productRepository.remove(id);
    router.push('/products');
  }

  function handleMultiplierChange(val) {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setMultiplier(num);
      productRepository.update(id, { pricing_multiplier: num });
    }
  }

  // BOM
  function openAddBOM() {
    setEditBomLine(null);
    setBomForm({ material_id: '', quantity_per_unit: '', notes: '' });
    setBomModal(true);
  }

  function openEditBOM(line) {
    setEditBomLine(line);
    setBomForm({ material_id: line.material_id, quantity_per_unit: line.quantity_per_unit, notes: line.notes || '' });
    setBomModal(true);
  }

  function validate() {
    const errs = {};

    if (!form.name?.trim()) {
      errs.name = 'Name is required';
    }
    
    if (!form.season?.trim()) {
      errs.season = 'Season is required';
    }

    if (
      form.selling_price === '' ||
      form.selling_price == null ||
      Number(form.selling_price) <= 0
    ) {
      errs.selling_price = 'Selling price must be greater than 0';
    }

    return errs;
  }

  function handleSaveBOM() {
    if (!bomForm.material_id || bomForm.quantity_per_unit === '') return;
    if (editBomLine) {
      bomRepository.update(editBomLine.id, {
        material_id: bomForm.material_id,
        quantity_per_unit: Number(bomForm.quantity_per_unit),
        notes: bomForm.notes,
      });
    } else {
      bomRepository.create({
        id: uuidv4(),
        product_id: id,
        material_id: bomForm.material_id,
        quantity_per_unit: Number(bomForm.quantity_per_unit),
        notes: bomForm.notes,
        sort_order: bomLines.length + 1,
      });
    }
    setBomModal(false);
    load();
  }

  function handleDeleteBOM(lineId) {
    bomRepository.remove(lineId);
    load();
  }

  // Costing
  const costSummary = calculateProductCostSummary({
    bomLines,
    materials,
    pricingMultiplier: multiplier,
  });

  const bomMaterialMap = new Map(materials.map((m) => [m.id, m]));

  // Group BOM by category group
  const bomByGroup = MATERIAL_CATEGORY_GROUPS.map((group) => ({
    ...group,
    lines: bomLines.filter((b) => {
      const mat = bomMaterialMap.get(b.material_id);
      return mat && group.categories.includes(mat.category);
    }),
  })).filter((g) => g.lines.length > 0);

  return (
    <div>
      <PageHeader
        title={product.name}
        subtitle={`${product.style_code} · ${product.season || 'No season'}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={product.status} />
            {editing ? (
              <>
                <Button
                  disabled={permission === 0}
                  onClick={() => {
                    setEditing(false);
                    setForm(product);
                  }}
                >
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  disabled={permission === 0}
                  onClick={handleSave}
                >
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button
                  disabled={permission === 0}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>

                {permission === 0 ? (
                  <Select value="" disabled className="w-32">
                    <option value="">Unavailable</option>
                  </Select>
                ) : (
                  <Select
                    value={product.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-32"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="draft">Draft</option>
                  </Select>
                )}

                <Button
                  variant="danger"
                  disabled={permission === 0}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="px-8 pt-6">
        <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      <div className="px-8 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            <Card className="col-span-2 p-6">
              <Section title="Product Information">
                {editing ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Product Name" value={form.name || ''} error={errors.name} onChange={(e) => set('name', e.target.value)} className="col-span-2" />
                    <Input label="Style Code" value={form.style_code || ''} error={errors.style_code} onChange={(e) => set('style_code', e.target.value)} />
                    <Input label="SKU" value={form.sku || ''}  error={errors.sku} onChange={(e) => set('sku', e.target.value)} />
                    <Select label="Season" value={form.season} error={errors.season} onChange={(e) => set('season', e.target.value)}>
                      <option value="">Select season</option>
                      <option value="fall / winter">Fall / Winter</option>
                      <option value="spring / summer">Spring / Summer</option>
                    </Select>
                    <Select label="Category" value={form.category || ''} onChange={(e) => set('category', e.target.value)}>
                      {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                    <Input label="Selling Price" type="number" value={form.selling_price ?? ''} min={0} error={errors.selling_price} onChange={(e) => set('selling_price', e.target.value)} />
                    <Input label="Currency" value={form.currency || ''} onChange={(e) => set('currency', e.target.value)} />
                    <Input label="Pricing Multiplier" type="number" step="0.1" value={form.pricing_multiplier ?? 3.5} min={0.1} onChange={(e) => set('pricing_multiplier', e.target.value)} />
                    <Textarea label="Description" value={form.description || ''} onChange={(e) => set('description', e.target.value)} className="col-span-2" />
                    <Textarea label="Notes" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} className="col-span-2" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <Field label="Style Code" value={product.style_code} />
                    <Field label="SKU" value={product.sku} />
                    <Field label="Season" value={product.season} />
                    <Field label="Category" value={product.category} />
                    <Field label="Selling Price" value={product.selling_price != null ? formatCurrency(product.selling_price, product.currency) : null} />
                    <Field label="Currency" value={product.currency} />
                    <Field label="Pricing Multiplier" value={product.pricing_multiplier ?? 3.5} />
                    {product.colors?.length > 0 && <Field label="Colors" value={product.colors.join(', ')} className="col-span-2" />}
                    {product.sizes?.length > 0 && <Field label="Sizes" value={product.sizes.join(', ')} />}
                    {product.description && <Field label="Description" value={product.description} className="col-span-2" />}
                    {product.notes && <Field label="Notes" value={product.notes} className="col-span-2" />}
                  </div>
                )}
              </Section>
            </Card>

            <div className="space-y-4">
              <Card className="p-5">
                <p className="text-[12px] text-[#737373] uppercase tracking-wider font-medium">BOM Lines</p>
                <p className="text-[28px] font-semibold mt-1">{bomLines.length}</p>
                <p className="text-[12px] text-[#737373] mt-1">Materials defined</p>
              </Card>
              <Card className="p-5">
                <p className="text-[12px] text-[#737373] uppercase tracking-wider font-medium">Active Orders</p>
                <p className="text-[28px] font-semibold mt-1">{orders.filter((o) => o.status !== 'cancelled' && o.status !== 'completed').length}</p>
              </Card>
            </div>
          </div>
        )}

        {/* BOM Tab */}
        {activeTab === 'bom' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#737373]">Bill of Materials</h2>
              <Button
                variant="primary"
                onClick={openAddBOM}
                disabled={permission === 0}
                className="
                disabled:cursor-not-allowed
                disabled:bg-[#f5f5f5]
                disabled:text-[#737373]
                disabled:opacity-40   "
              >
                + Add Material
              </Button>
            </div>
            {bomLines.length === 0 ? (
              <EmptyState
                title="No BOM lines"
                description="Add materials to define what this product is made of."
                action={<Button variant="primary" onClick={openAddBOM}>+ Add Material</Button>}
              />
            ) : (
              <div className="space-y-6">
                {bomByGroup.map((group) => (
                  <div key={group.key}>
                    <h3 className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-3">{group.label}</h3>
                    <Table>
                      <Thead>
                        <tr>
                          <Th>Material</Th>
                          <Th>Category</Th>
                          <Th>Supplier</Th>
                          <Th>Qty / Unit</Th>
                          <Th>UOM</Th>
                          <Th>Unit Cost</Th>
                          <Th>Line Cost</Th>
                          <Th>Notes</Th>
                          <Th></Th>
                        </tr>
                      </Thead>
                      <Tbody>
                        {group.lines.map((line) => {
                          const mat = bomMaterialMap.get(line.material_id);
                          if (!mat) return null;
                          const supplierName = mat.supplier_id
                            ? suppliers.find((s) => s.id === mat.supplier_id)?.name ?? '—'
                            : '—';
                          const lineCost = mat.unit_cost != null ? Math.round(mat.unit_cost * line.quantity_per_unit * 100) / 100 : null;
                          return (
                            <Tr key={line.id}>
                              <Td className="font-medium">
                                {mat.name}
                                {!mat.supplier_id && <span className="ml-2 text-amber-600 text-[11px]">⚠ No supplier</span>}
                              </Td>
                              <Td>{mat.category}</Td>
                              <Td>{mat.supplier_id ? supplierName : <span className="text-[#a3a3a3]">—</span>}</Td>
                              <Td>{line.quantity_per_unit}</Td>
                              <Td>{mat.unit_of_measurement}</Td>
                              <Td>{mat.unit_cost != null ? `€${mat.unit_cost}` : <span className="text-amber-600">⚠ Missing</span>}</Td>
                              <Td>{lineCost != null ? `€${lineCost}` : '—'}</Td>
                              <Td className="text-[#737373]">{line.notes || '—'}</Td>
                              <Td>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => openEditBOM(line)} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">Edit</Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleDeleteBOM(line.id)} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">Remove</Button>
                                </div>
                              </Td>
                            </Tr>
                          );
                        })}
                      </Tbody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Costing Tab */}
        {activeTab === 'costing' && (
          <div className="max-w-2xl space-y-6">
            {costSummary.has_unknown_costs && (
              <Warning>Some materials are missing unit costs. Totals are incomplete.</Warning>
            )}
            <Card className="p-6">
              <Section title="Unit Cost Breakdown">
                <div className="space-y-3">
                  <CostRow label="Material Cost" value={costSummary.material_cost} />
                  <CostRow label="Sewing / Labor" value={costSummary.labor_cost} />
                  <CostRow label="Allocated Shipping" value={costSummary.allocated_shipping} muted />
                  <CostRow label="Allocated Customs" value={costSummary.allocated_customs} muted />
                  <CostRow label="Allocated Additional" value={costSummary.allocated_additional} muted />
                  <div className="border-t border-[#e5e5e5] pt-3">
                    <CostRow label="Total Unit Cost" value={costSummary.total_unit_cost} bold />
                  </div>
                </div>
              </Section>

              <div className="mt-6 pt-6 border-t border-[#e5e5e5]">
                <Section title="Pricing">
                  <div className="flex items-center gap-4 mb-4">
                    <label className="text-[12px] font-medium text-[#525252]">Pricing Multiplier</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={multiplier}
                      onChange={(e) => handleMultiplierChange(e.target.value)}
                      className="border border-[#e5e5e5] rounded px-3 py-1.5 text-[13px] w-24 focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
                    />
                  </div>
                  <CostRow label="Recommended Selling Price" value={costSummary.recommended_selling_price} bold />
                  <CostRow label="Current Selling Price" value={product.selling_price} muted />
                </Section>
              </div>
            </Card>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            {orders.length === 0 ? (
              <EmptyState title="No orders" description="This product hasn't been added to any orders yet." />
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Name</Th>
                    <Th>Color</Th>
                    <Th>Size</Th>
                    <Th>Quantity</Th>
                    <Th>Status</Th>
                    <Th>Target Date</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {orders.map((order) => {
                    const lines = orderLines.filter((l) => l.order_id === order.id);
                    return lines.map((line) => (
                      <Tr key={`${order.id}-${line.id}`} onClick={() => router.push(`/orders/${order.id}`)}>
                        <Td className="font-medium">{order.order_number}</Td>
                        <Td>{order.order_name}</Td>
                        <Td>{line.color}</Td>
                        <Td>{line.size}</Td>
                        <Td>{line.quantity}</Td>
                        <Td><StatusBadge status={order.status} /></Td>
                        <Td>{order.target_date || '—'}</Td>
                      </Tr>
                    ));
                  })}
                </Tbody>
              </Table>
            )}
          </div>
        )}
      </div>

      {/* BOM Modal */}
      <Modal
        open={bomModal}
        onClose={() => setBomModal(false)}
        title={editBomLine ? 'Edit BOM Line' : 'Add Material to BOM'}
        size="md"
        footer={<>
          <Button onClick={() => setBomModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveBOM}>{editBomLine ? 'Save Changes' : 'Add Material'}</Button>
        </>}
      >
        <div className="space-y-4">
          <Select
            label="Material *"
            value={bomForm.material_id}
            onChange={(e) => setBomForm((prev) => ({ ...prev, material_id: e.target.value }))}
          >
            <option value="">Select material...</option>
            {MATERIAL_CATEGORY_GROUPS.map((group) => {
              const groupMats = materials.filter((m) => group.categories.includes(m.category) && m.status === 'active');
              if (groupMats.length === 0) return null;
              return (
                <optgroup key={group.key} label={group.label}>
                  {groupMats.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
              );
            })}
          </Select>
          <Input
            label="Quantity per Unit *"
            type="number"
            step="0.001"
            min="0"
            value={bomForm.quantity_per_unit}
            onChange={(e) => setBomForm((prev) => ({ ...prev, quantity_per_unit: e.target.value }))}
          />
          <Input
            label="Notes"
            value={bomForm.notes}
            onChange={(e) => setBomForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete Product"
        size="sm"
        footer={<>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete Product</Button>
        </>}
      >
        <p className="text-[13px]">
          Are you sure you want to delete <strong>{product.name}</strong>? This will also remove all BOM lines and order lines for this product. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

function Field({ label, value, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium text-[#737373] uppercase tracking-wider">{label}</p>
      <p className="text-[13px] mt-0.5">{value != null && value !== '' ? String(value) : '—'}</p>
    </div>
  );
}

function CostRow({ label, value, bold, muted }) {
  return (
    <div className={`flex items-center justify-between py-1 ${muted ? 'opacity-60' : ''}`}>
      <span className={`text-[13px] ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`text-[13px] font-mono ${bold ? 'font-semibold' : ''}`}>
        {value != null ? formatCurrency(value) : '—'}
      </span>
    </div>
  );
}
