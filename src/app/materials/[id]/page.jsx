'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, StatusBadge, Card, Section, Input, Textarea, Select,
  Modal, Warning, formatCurrency,
} from '@/components/ui';
import { materialRepository } from '@/lib/data/materials';
import { supplierRepository } from '@/lib/data/suppliers';
import { productRepository } from '@/lib/data/products';
import { bomRepository } from '@/lib/data/bom';
import { orderRepository, orderLineRepository } from '@/lib/data/orders';
import { calculateRequiredMaterials } from '@/lib/calculations';
import { MATERIAL_CATEGORIES } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid';
import { initializePermission, getPermission } from "../../../lib/permissions";

export default function MaterialDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [material, setMaterial] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [usedInProducts, setUsedInProducts] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errors, setErrors] = useState({});

  function load() {
    const m = materialRepository.getById(id);
    if (!m) { router.push('/materials'); return; }
    setMaterial(m);
    setForm(m);
    setSuppliers(supplierRepository.getAll());

    // Used in products
    const allBOM = bomRepository.getAll();
    const bomForMat = allBOM.filter((b) => b.material_id === id);
    const allProducts = productRepository.getAll();
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    // Calculate how much is required across active orders
    const allOrders = orderRepository.getAll().filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
    const allOrderLines = orderLineRepository.getAll();
    const allMaterials = materialRepository.getAll();
    const allSuppliers = supplierRepository.getAll();

    let totalRequired = 0;
    if (allOrders.length > 0) {
      const allActiveLines = allOrderLines.filter((l) =>
        allOrders.some((o) => o.id === l.order_id)
      );
      if (allActiveLines.length > 0) {
        const reqMats = calculateRequiredMaterials({
          orderLines: allActiveLines,
          products: allProducts,
          bomLines: allBOM,
          materials: allMaterials,
          suppliers: allSuppliers,
        });
        const thisMatReq = reqMats.find((rm) => rm.material.id === id);
        if (thisMatReq) totalRequired = thisMatReq.total_quantity;
      }
    }

    const usedIn = bomForMat.map((b) => ({
      product: productMap.get(b.product_id),
      quantity_per_unit: b.quantity_per_unit,
    })).filter((u) => u.product);

    setUsedInProducts({ items: usedIn, totalRequired, uom: m.unit_of_measurement });

    initializePermission();
  }

  useEffect(() => { load(); }, [id]);

  const permission = getPermission('material');

  if (!material) return null;

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate() {
  const errs = {};

  if (!form.name?.trim()) {
    errs.name = 'Material name is required';
  }

  if (!form.internal_code?.trim()) {
    errs.internal_code = 'Internal code is required';
  }

  if (!form.category) {
    errs.category = 'Category is required';
  }

  if (!form.supplier_item_code?.trim()) {
    errs.supplier_item_code = 'Supplier item code is required';
  }

  if (form.unit_cost === '' || form.unit_cost == null || Number(form.unit_cost) <= 0) {
    errs.unit_cost = 'Unit cost must be greater than 0';
  }

  if (!form.currency?.trim()) {
    errs.currency = 'Currency is required';
  }

  if (!form.unit_of_measurement?.trim()) {
    errs.unit_of_measurement = 'Unit of measurement is required';
  }

  if (form.lead_time === '' || form.lead_time == null || Number(form.lead_time) <= 0) {
    errs.lead_time = 'Lead time must be greater than 0';
  }

  if (form.minimum_order_quantity === '' || form.minimum_order_quantity == null || Number(form.minimum_order_quantity) <= 0) {
    errs.minimum_order_quantity = 'Minimum order quantity must be greater than 0';
  }

  return errs;
}

  function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    materialRepository.update(id, {
      ...form,
      supplier_id: form.supplier_id || null,
      unit_cost: form.unit_cost !== '' && form.unit_cost != null ? Number(form.unit_cost) : null,
      lead_time: form.lead_time !== '' && form.lead_time != null ? Number(form.lead_time) : null,
      minimum_order_quantity: form.minimum_order_quantity !== '' && form.minimum_order_quantity != null ? Number(form.minimum_order_quantity) : null,
    });
    setEditing(false);
    load();
  }

  function handleArchive() {
    materialRepository.update(id, { status: material.status === 'archived' ? 'active' : 'archived' });
    load();
  }

  function handleDuplicate() {
    const newId = uuidv4();
    materialRepository.create({
      ...material,
      id: newId,
      name: `${material.name} (Copy)`,
      internal_code: material.internal_code ? `${material.internal_code}-COPY` : '',
    });
    router.push(`/materials/${newId}`);
  }

  function handleDelete() {
    // Remove all BOM lines referencing this material
    const allBOM = bomRepository.getAll();
    const toRemove = allBOM.filter((b) => b.material_id === id);
    toRemove.forEach((b) => bomRepository.remove(b.id));
    materialRepository.remove(id);
    router.push('/materials');
  }

  const supplierName = material.supplier_id
    ? suppliers.find((s) => s.id === material.supplier_id)?.name ?? '—'
    : '—';

  return (
    <div>
      <PageHeader
        title={material.name}
        subtitle={`${material.category} · ${material.internal_code || 'No code'}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={material.status} />
            {editing ? (
              <>
                <Button onClick={() => { setEditing(false); setForm(material); }} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">Cancel</Button>
                <Button variant="primary" onClick={handleSave} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">Save Changes</Button>
              </>
            ) : (
              <>
                <Button onClick={() => setEditing(true)} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">Edit</Button>
                <Button onClick={handleDuplicate} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">Duplicate</Button>
                <Button onClick={handleArchive} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">{material.status === 'archived' ? 'Restore' : 'Archive'}</Button>
                <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={permission === 0} className="disabled:cursor-not-allowed disabled:opacity-40">Delete</Button>
              </>
            )}
          </div>
        }
      />

      {!material.supplier_id && (
        <div className="px-8 pt-4">
          <Warning>No supplier assigned to this material.</Warning>
        </div>
      )}
      {material.unit_cost == null && (
        <div className="px-8 pt-4">
          <Warning>No unit cost set — costing calculations will be incomplete.</Warning>
        </div>
      )}

      <div className="px-8 py-6 space-y-6">
        <div className="grid grid-cols-3 gap-6">
          <Card className="col-span-2 p-6">
            <Section title="Material Information">
              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Material Name" value={form.name || ''} error={errors.name} onChange={(e) => set('name', e.target.value)} className="col-span-2" />
                  <Input label="Internal Code" value={form.internal_code || ''} error={errors.internal_code} onChange={(e) => set('internal_code', e.target.value)} />
                  <Select label="Category" value={form.category || ''} error={errors.category} onChange={(e) => set('category', e.target.value)}>
                    {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <Select label="Supplier" value={form.supplier_id || ''} onChange={(e) => set('supplier_id', e.target.value)}>
                    <option value="">No Supplier</option>
                    {suppliers.filter((s) => s.status === 'active').map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                  <Input label="Supplier Item Code" value={form.supplier_item_code || ''} error={errors.supplier_item_code} onChange={(e) => set('supplier_item_code', e.target.value)} />
                  <Input label="Unit Cost" type="number" step="0.001" value={form.unit_cost ?? ''} min={0} error={errors.unit_cost} onChange={(e) => set('unit_cost', e.target.value)} />
                  <Input label="Currency" value={form.currency || ''} error={errors.currency} onChange={(e) => set('currency', e.target.value)} />
                  <Input label="Unit of Measurement" value={form.unit_of_measurement || ''} error={errors.unit_of_measurement} onChange={(e) => set('unit_of_measurement', e.target.value)} />
                  <Input label="Lead Time (days)" type="number" value={form.lead_time ?? ''} error={errors.lead_time} onChange={(e) => set('lead_time', e.target.value)} />
                  <Input label="Min. Order Qty" type="number" value={form.minimum_order_quantity ?? ''} error={errors.minimum_order_quantity} onChange={(e) => set('minimum_order_quantity', e.target.value)} />
                  <Textarea label="Description" value={form.description || ''} onChange={(e) => set('description', e.target.value)} className="col-span-2" />
                  <Textarea label="Notes" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} className="col-span-2" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <Field label="Category" value={material.category} />
                  <Field label="Supplier" value={supplierName} />
                  <Field label="Supplier Item Code" value={material.supplier_item_code} />
                  <Field label="Unit Cost" value={material.unit_cost != null ? `€${material.unit_cost}` : null} />
                  <Field label="Currency" value={material.currency} />
                  <Field label="Unit of Measurement" value={material.unit_of_measurement} />
                  <Field label="Lead Time" value={material.lead_time != null ? `${material.lead_time} days` : null} />
                  <Field label="Min. Order Qty" value={material.minimum_order_quantity} />
                  {material.description && <Field label="Description" value={material.description} className="col-span-2" />}
                  {material.notes && <Field label="Notes" value={material.notes} className="col-span-2" />}
                </div>
              )}
            </Section>
          </Card>

          <Card className="p-5">
            <p className="text-[12px] text-[#737373] uppercase tracking-wider font-medium">Required in Active Orders</p>
            <p className="whitespace-nowrap">
              <span className="text-[28px] font-semibold">
                {usedInProducts?.totalRequired > 0 ? usedInProducts.totalRequired : '0'}
              </span>
              {usedInProducts?.uom && (
                <span className="text-[12px] text-[#737373] ml-1">{usedInProducts.uom}</span>
              )}
            </p>
          </Card>
        </div>

        {usedInProducts?.items?.length > 0 && (
          <Card className="p-6">
            <Section title="Used In Products">
              <div className="space-y-2">
                {usedInProducts.items.map(({ product, quantity_per_unit }) => (
                  <div
                    key={product.id}
                    onClick={() => router.push(`/products/${product.id}`)}
                    className="flex items-center justify-between py-2 px-3 rounded hover:bg-[#f5f5f5] cursor-pointer"
                  >
                    <div>
                      <span className="text-[13px] font-medium">{product.name}</span>
                      <span className="text-[12px] text-[#737373] ml-2">{product.style_code}</span>
                    </div>
                    <span className="text-[13px] text-[#737373]">
                      {quantity_per_unit} {material.unit_of_measurement} / unit
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </Card>
        )}
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete Material"
        size="sm"
        footer={<>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </>}
      >
        <p className="text-[13px]">Are you sure you want to delete <strong>{material.name}</strong>? This will also remove it from any BOM lines. This cannot be undone.</p>
      </Modal>
    </div>
  );
}

function Field({ label, value, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium text-[#737373] uppercase tracking-wider">{label}</p>
      <p className="text-[13px] mt-0.5">{value || '—'}</p>
    </div>
  );
}
