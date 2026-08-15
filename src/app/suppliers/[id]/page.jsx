'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, StatusBadge, Card, Section, Input, Textarea, Select,
  Modal, formatCurrency,
} from '@/components/ui';
import { supplierRepository } from '@/lib/data/suppliers';
import { materialRepository } from '@/lib/data/materials';
import { productRepository } from '@/lib/data/products';
import { bomRepository } from '@/lib/data/bom';
import { orderRepository, orderLineRepository } from '@/lib/data/orders';
import { calculateRequiredMaterials } from '@/lib/calculations';
import { getItems } from '@/lib/data/storage';
import { STORAGE_KEYS } from '@/lib/constants';
import { recordRepository } from '@/lib/data/action-record';

export default function SupplierDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [supplier, setSupplier] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeOrderValue, setActiveOrderValue] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errors, setErrors] = useState({});
  const currentUser = getItems(STORAGE_KEYS.logged_user);

  function load() {
    const s = supplierRepository.getById(id);
    if (!s) { router.push('/suppliers'); return; }
    setSupplier(s);
    setForm(s);

    const allMaterials = materialRepository.getAll();
    const supplierMats = allMaterials.filter((m) => m.supplier_id === id);
    setMaterials(supplierMats);

    const allProducts = productRepository.getAll();
    const allBOM = bomRepository.getAll();
    const supplierMatIds = new Set(supplierMats.map((m) => m.id));
    const relatedProductIds = new Set(
      allBOM.filter((b) => supplierMatIds.has(b.material_id)).map((b) => b.product_id)
    );
    setProducts(allProducts.filter((p) => relatedProductIds.has(p.id)));

    // Active order value
    const allOrders = orderRepository.getAll().filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
    const allOrderLines = orderLineRepository.getAll();
    const allSuppliers = supplierRepository.getAll();
    let totalValue = 0;
    for (const order of allOrders) {
      const lines = allOrderLines.filter((l) => l.order_id === order.id);
      if (lines.length === 0) continue;
      const reqMats = calculateRequiredMaterials({
        orderLines: lines,
        products: allProducts,
        bomLines: allBOM,
        materials: allMaterials,
        suppliers: allSuppliers,
      });
      const supplierMatsInOrder = reqMats.filter((rm) => rm.material.supplier_id === id);
      totalValue += supplierMatsInOrder.reduce((acc, rm) => acc + (rm.estimated_cost ?? 0), 0);
    }
    setActiveOrderValue(totalValue);
  }

  useEffect(() => { load(); }, [id]);

  if (!supplier) return null;

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate() {
    const errs = {};

    if (!form.name?.trim()) {
      errs.name = 'Supplier name is required';
    }

    if (!form.country?.trim()) {
      errs.country = 'Country is required';
    }

    if (!form.currency?.trim()) {
      errs.currency = 'Currency is required';
    }

    if (!form.contact_person?.trim()) {
      errs.contact_person = 'Contact person is required';
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Invalid email address';
    }

    if (form.phone && !/^[+0-9\s\-()]+$/.test(form.phone)) {
      errs.phone = 'Invalid phone number';
    }

    if (form.website && !/^https?:\/\/.+/i.test(form.website)) {
      errs.website = 'Website must start with http:// or https://';
    }

    if (
      form.lead_time !== '' &&
      form.lead_time != null &&
      (Number(form.lead_time) < 0 || Number.isNaN(Number(form.lead_time)))
    ) {
      errs.lead_time = 'Lead time must be 0 or greater';
    }

    if (
      form.minimum_order_quantity !== '' &&
      form.minimum_order_quantity != null &&
      (Number(form.minimum_order_quantity) < 0 ||
        Number.isNaN(Number(form.minimum_order_quantity)))
    ) {
      errs.minimum_order_quantity = 'Minimum order quantity must be 0 or greater';
    }

    return errs;
  }

  function handleSave() {
    const errs = validate();

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const before = supplierRepository.getById(id);

    const updatedSupplier = supplierRepository.update(id, {
      ...form,
      lead_time: form.lead_time ? Number(form.lead_time) : null,
      minimum_order_quantity: form.minimum_order_quantity
        ? Number(form.minimum_order_quantity)
        : null,
    });

    recordRepository.create({
      user_id: currentUser.id,
      action: 'UPDATE',
      entity_type: 'supplier',
      entity_id: id,
      before,
      after: updatedSupplier,
    });

    setEditing(false);
    load();
  }

  function handleArchive() {
    const oldSupplier = supplierRepository.getById(id);

    if (!oldSupplier) return;

    const newStatus =
      oldSupplier.status === 'archived' ? 'active' : 'archived';

    const updatedSupplier = {
      ...oldSupplier,
      status: newStatus,
    };

    supplierRepository.update(id, {
      status: newStatus,
    });

    recordRepository.create({
      user_id: currentUser.id,
      action: newStatus === 'archived' ? 'ARCHIVE' : 'RESTORE',
      entity_type: 'supplier',
      entity_id: id,
      before: oldSupplier,
      after: updatedSupplier,
    });

    load();
  }

  function handleDelete() {
    supplierRepository.softDelete(id);

    recordRepository.create({
      user_id: currentUser.id,
      action: 'DELETE',
      entity_type: 'Supplier',
      entity_id: id,
      before: supplier,
      after: null,
    });

    router.push('/suppliers');
  }

  return (
    <div>
      <PageHeader
        title={supplier.name}
        subtitle={supplier.country || 'No country specified'}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={supplier.status} />
            {editing ? (
              <>
                <Button onClick={() => { setEditing(false); setForm(supplier); }}>Cancel</Button>
                <Button variant="primary" onClick={handleSave}>Save Changes</Button>
              </>
            ) : (
              <>
                <Button onClick={() => setEditing(true)}>Edit</Button>
                <Button onClick={handleArchive}>{supplier.status === 'archived' ? 'Restore' : 'Archive'}</Button>
                <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
              </>
            )}
          </div>
        }
      />

      <div className="px-8 py-6 space-y-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Main info */}
          <Card className="col-span-2 p-6">
            <Section title="Supplier Information">
              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Supplier Name" value={form.name || ''} error={errors.name} onChange={(e) => set('name', e.target.value)} className="col-span-2" />
                  <Input label="Country" value={form.country || ''} error={errors.country} onChange={(e) => set('country', e.target.value)} />
                  <Input label="Currency" value={form.currency || ''} error={errors.currency} onChange={(e) => set('currency', e.target.value)} />
                  <Input label="Contact Person" value={form.contact_person || ''} error={errors.contact_person} onChange={(e) => set('contact_person', e.target.value)} />
                  <Input label="Email" type="email" value={form.email || ''} error={errors.email} onChange={(e) => set('email', e.target.value)} />
                  <Input label="Phone" value={form.phone || ''} error={errors.phone} onChange={(e) => set('phone', e.target.value)} />
                  <Input label="Website" value={form.website || ''} error={errors.website} onChange={(e) => set('website', e.target.value)} />
                  <Input label="Lead Time (days)" type="number" value={form.lead_time ?? ''} error={errors.lead_time} min={0} onChange={(e) => set('lead_time', e.target.value)} />
                  <Input label="Payment Terms" value={form.payment_terms || ''} onChange={(e) => set('payment_terms', e.target.value)} />
                  <Input label="Minimum Order Qty" type="number" value={form.minimum_order_quantity ?? ''} error={errors.name} onChange={(e) => set('minimum_order_quantity', e.target.value)} />
                  <Textarea label="Notes" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} className="col-span-2" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <Field label="Country" value={supplier.country} />
                  <Field label="Currency" value={supplier.currency} />
                  <Field label="Contact Person" value={supplier.contact_person} />
                  <Field label="Email" value={supplier.email} />
                  <Field label="Phone" value={supplier.phone} />
                  <Field label="Website" value={supplier.website} />
                  <Field label="Lead Time" value={supplier.lead_time != null ? `${supplier.lead_time} days` : null} />
                  <Field label="Payment Terms" value={supplier.payment_terms} />
                  <Field label="Min. Order Qty" value={supplier.minimum_order_quantity} />
                  {supplier.notes && <Field label="Notes" value={supplier.notes} className="col-span-2" />}
                </div>
              )}
            </Section>
          </Card>

          {/* Side stats */}
          <div className="space-y-4">
            <Card className="p-5">
              <p className="text-[12px] text-[#737373] uppercase tracking-wider font-medium">Active Order Value</p>
              <p className="text-[24px] font-semibold mt-1">{formatCurrency(activeOrderValue)}</p>
              <p className="text-[12px] text-[#737373] mt-1">Across active orders</p>
            </Card>
            <Card className="p-5">
              <p className="text-[12px] text-[#737373] uppercase tracking-wider font-medium">Materials</p>
              <p className="text-[24px] font-semibold mt-1">{materials.length}</p>
            </Card>
          </div>
        </div>

        {/* Materials */}
        <Card className="p-6">
          <Section title="Materials Supplied">
            {materials.length === 0 ? (
              <p className="text-[13px] text-[#737373]">No materials assigned to this supplier.</p>
            ) : (
              <div className="space-y-2">
                {materials.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => router.push(`/materials/${m.id}`)}
                    className="flex items-center justify-between py-2 px-3 rounded hover:bg-[#f5f5f5] cursor-pointer"
                  >
                    <div>
                      <span className="text-[13px] font-medium">{m.name}</span>
                      <span className="text-[12px] text-[#737373] ml-2">{m.category}</span>
                    </div>
                    <span className="text-[13px]">
                      {m.unit_cost != null ? `€${m.unit_cost} / ${m.unit_of_measurement}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </Card>

        {/* Products */}
        {products.length > 0 && (
          <Card className="p-6">
            <Section title="Products Using This Supplier">
              <div className="space-y-2">
                {products.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/products/${p.id}`)}
                    className="flex items-center justify-between py-2 px-3 rounded hover:bg-[#f5f5f5] cursor-pointer"
                  >
                    <span className="text-[13px] font-medium">{p.name}</span>
                    <span className="text-[12px] text-[#737373]">{p.style_code}</span>
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
        title="Delete Supplier"
        size="sm"
        footer={<>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </>}
      >
        <p className="text-[13px]">Are you sure you want to delete <strong>{supplier.name}</strong>? The supplier will be moved to Spam and can be restored by an Owner.</p>
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
