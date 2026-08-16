'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, StatusBadge, Card, Section, Input, Textarea, Select,
  Modal, formatCurrency,
} from '@/components/ui';
import { supplierRepository } from '@/lib/data/backend-suppliers';
import { materialRepository } from '@/lib/data/backend-materials';
import { productRepository } from '@/lib/data/backend-products';
import { bomLineRepository } from '@/lib/data/backend-bom_lines';
import { auditRepository } from '@/lib/data/backend-audit';
import { orderRepository, orderLineRepository } from '@/lib/data/orders';
import { calculateRequiredMaterials } from '@/lib/calculations';
import { getItems } from '@/lib/data/storage';
import { STORAGE_KEYS } from '@/lib/constants';
import { loadCurrencies } from '@/lib/data/currency';

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
  const [currencies, setCurrencies] = useState([]);

  const currentUser = getItems(STORAGE_KEYS.logged_user);

  async function load() {
    try {
      const supplierResponse = await supplierRepository.getById(id);

      const s = supplierResponse?.supplier || supplierResponse;

      if (!s) {
        router.push('/suppliers');
        return;
      }

      setSupplier(s);

      setForm({
        name: s.name || '',
        country: s.country || '',
        contact_name: s.contact_name || '',
        contact_email: s.contact_email || '',
        contact_phone: s.contact_phone || '',
        website: s.website || '',
        currency: s.currency || 'EUR',
        lead_time_days: s.lead_time_days ?? '',
        payment_terms: s.payment_terms || '',
        minimum_order_quantity: s.minimum_order_quantity ?? '',
        notes: s.notes || '',
        status: s.status || 'active',
        spam: s.spam ?? false,
      });

      const allMaterialsResponse = await materialRepository.getAll();
      const allMaterials = allMaterialsResponse?.materials || allMaterialsResponse || [];

      const supplierMats = allMaterials.filter(
        (m) => m.supplier_id === id
      );

      setMaterials(supplierMats);

      const allProductsResponse = await productRepository.getAll();
      const allProducts =
        allProductsResponse?.products || allProductsResponse || [];

      const allBOMResponse = await bomLineRepository.getAll();
      const allBOM = allBOMResponse?.bom_lines || allBOMResponse || [];

      const supplierMatIds = new Set(
        supplierMats.map((m) => m.id)
      );

      const relatedProductIds = new Set(
        allBOM
          .filter((b) => supplierMatIds.has(b.material_id))
          .map((b) => b.product_id)
      );

      setProducts(
        allProducts.filter((p) => relatedProductIds.has(p.id))
      );

      // Active order value
      const allOrdersResponse = await orderRepository.getAll();
      const allOrders =
        allOrdersResponse?.orders || allOrdersResponse || [];

      const activeOrders = allOrders.filter(
        (o) =>
          o.status !== 'completed' &&
          o.status !== 'cancelled'
      );

      const allOrderLinesResponse = await orderLineRepository.getAll();
      const allOrderLines =
        allOrderLinesResponse?.orderLines ||
        allOrderLinesResponse ||
        [];

      const allSuppliersResponse = await supplierRepository.getAll();
      const allSuppliers =
        allSuppliersResponse?.suppliers ||
        allSuppliersResponse ||
        [];

      let totalValue = 0;

      for (const order of activeOrders) {
        const lines = allOrderLines.filter(
          (l) => l.order_id === order.id
        );

        if (lines.length === 0) continue;

        const reqMats = calculateRequiredMaterials({
          orderLines: lines,
          products: allProducts,
          bomLines: allBOM,
          materials: allMaterials,
          suppliers: allSuppliers,
        });

        const supplierMatsInOrder = reqMats.filter(
          (rm) => rm.material.supplier_id === id
        );

        totalValue += supplierMatsInOrder.reduce(
          (acc, rm) => acc + (rm.estimated_cost ?? 0),
          0
        );
      }

      setActiveOrderValue(totalValue);
    } catch (err) {
      console.error('Failed to load supplier:', err);
    }
  }

  useEffect(() => {
    load();

    loadCurrencies()
      .then(setCurrencies)
      .catch((err) =>
        console.error('Failed to load currencies:', err)
      );
  }, [id]);

  if (!supplier) return null;

  function set(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
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

    if (!form.contact_name?.trim()) {
      errs.contact_name = 'Contact person is required';
    }

    if (
      form.contact_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)
    ) {
      errs.contact_email = 'Invalid email address';
    }

    if (
      form.contact_phone &&
      !/^[+0-9\s\-()]+$/.test(form.contact_phone)
    ) {
      errs.contact_phone = 'Invalid phone number';
    }

    if (
      form.website &&
      !/^https?:\/\/.+/i.test(form.website)
    ) {
      errs.website =
        'Website must start with http:// or https://';
    }

    if (
      form.lead_time_days !== '' &&
      form.lead_time_days != null &&
      (
        Number(form.lead_time_days) < 0 ||
        Number.isNaN(Number(form.lead_time_days))
      )
    ) {
      errs.lead_time_days =
        'Lead time must be 0 or greater';
    }

    if (
      form.minimum_order_quantity !== '' &&
      form.minimum_order_quantity != null &&
      (
        Number(form.minimum_order_quantity) < 0 ||
        Number.isNaN(Number(form.minimum_order_quantity))
      )
    ) {
      errs.minimum_order_quantity =
        'Minimum order quantity must be 0 or greater';
    }

    return errs;
  }

  async function handleSave() {
    const errs = validate();

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    try {
      const beforeResponse =
        await supplierRepository.getById(id);

      const before =
        beforeResponse?.supplier ||
        beforeResponse;

      const updatedSupplier =
        await supplierRepository.update(id, {
          ...form,

          lead_time_days:
            form.lead_time_days !== '' &&
              form.lead_time_days != null
              ? Number(form.lead_time_days)
              : null,

          minimum_order_quantity:
            form.minimum_order_quantity !== '' &&
              form.minimum_order_quantity != null
              ? Number(form.minimum_order_quantity)
              : null,
        });

      const after =
        updatedSupplier?.supplier ||
        updatedSupplier;

      await auditRepository.create({
        user_id: currentUser.id,
        action: 'update',
        entity_type: 'supplier',
        entity_id: id,
        before,
        after,
      });

      setEditing(false);

      await load();
    } catch (err) {
      console.error('Failed to update supplier:', err);
    }
  }

  async function handleArchive() {
    try {
      const oldSupplierResponse =
        await supplierRepository.getById(id);

      const oldSupplier =
        oldSupplierResponse?.supplier ||
        oldSupplierResponse;

      if (!oldSupplier) return;

      const newStatus =
        oldSupplier.status === 'archived'
          ? 'active'
          : 'archived';

      const response =
        await supplierRepository.update(id, {
          status: newStatus,
        });

      const updatedSupplier =
        response?.supplier ||
        response;

      await auditRepository.create({
        user_id: currentUser.id,
        action:
          newStatus === 'archived'
            ? 'archive'
            : 'restore',
        entity_type: 'supplier',
        entity_id: id,
        before: oldSupplier,
        after: updatedSupplier,
      });

      await load();
    } catch (err) {
      console.error(
        'Failed to archive/restore supplier:',
        err
      );
    }
  }

  async function handleDelete() {
    try {
      const beforeResponse = await supplierRepository.getById(id);

      const before =
        beforeResponse?.supplier ||
        beforeResponse;

      const updatedSupplier = await supplierRepository.update(id, {
        spam: true,
      });

      const after =
        updatedSupplier?.supplier ||
        updatedSupplier;

      await auditRepository.create({
        user_id: currentUser.id,
        action: 'update',
        entity_type: 'supplier',
        entity_id: id,
        before,
        after,
      });

      await auditRepository.create({
        user_id: currentUser.id,
        action: 'update',
        entity_type: 'supplier',
        entity_id: id,
        before,
        after,
      });

      router.push('/suppliers');
    } catch (err) {
      console.error('Failed to soft-delete supplier:', err);
    }
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
                <Button
                  onClick={() => {
                    setEditing(false);
                    setForm({
                      name: supplier.name ?? '',
                      country: supplier.country ?? '',
                      contact_name: supplier.contact_name ?? '',
                      contact_email: supplier.contact_email ?? '',
                      contact_phone: supplier.contact_phone ?? '',
                      website: supplier.website ?? '',
                      currency: supplier.currency ?? 'EUR',
                      lead_time_days: supplier.lead_time_days ?? '',
                      payment_terms: supplier.payment_terms ?? '',
                      minimum_order_quantity: supplier.minimum_order_quantity ?? '',
                      notes: supplier.notes ?? '',
                      status: supplier.status ?? 'active',
                      spam: supplier.spam ?? false,
                    });
                    setErrors({});
                  }}
                >
                  Cancel
                </Button>

                <Button variant="primary" onClick={handleSave}>
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setEditing(true)}>
                  Edit
                </Button>

                <Button onClick={handleArchive}>
                  {supplier.status === 'archived' ? 'Restore' : 'Archive'}
                </Button>

                <Button
                  variant="danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
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

                  <Input
                    label="Supplier Name"
                    value={form.name ?? ''}
                    error={errors.name}
                    onChange={(e) => set('name', e.target.value)}
                    className="col-span-2"
                  />

                  <Input
                    label="Country"
                    value={form.country ?? ''}
                    error={errors.country}
                    onChange={(e) => set('country', e.target.value)}
                  />

                  {currencies.length === 0 ? (
                    <Input
                      label="Currency"
                      value={form.currency ?? 'EUR'}
                      error={errors.currency}
                      onChange={(e) => set('currency', e.target.value)}
                    />
                  ) : (
                    <Select
                      label="Currency"
                      value={form.currency ?? 'EUR'}
                      error={errors.currency}
                      onChange={(e) => set('currency', e.target.value)}
                    >
                      {currencies.map((c) => (
                        <option key={c.quote} value={c.quote}>
                          {c.quote}
                        </option>
                      ))}
                    </Select>
                  )}

                  <Input
                    label="Contact Person"
                    value={form.contact_name ?? ''}
                    error={errors.contact_name}
                    onChange={(e) =>
                      set('contact_name', e.target.value)
                    }
                  />

                  <Input
                    label="Email"
                    type="email"
                    value={form.contact_email ?? ''}
                    error={errors.contact_email}
                    onChange={(e) =>
                      set('contact_email', e.target.value)
                    }
                  />

                  <Input
                    label="Phone"
                    value={form.contact_phone ?? ''}
                    error={errors.contact_phone}
                    onChange={(e) =>
                      set('contact_phone', e.target.value)
                    }
                  />

                  <Input
                    label="Website"
                    value={form.website ?? ''}
                    error={errors.website}
                    onChange={(e) =>
                      set('website', e.target.value)
                    }
                  />

                  <Input
                    label="Lead Time (days)"
                    type="number"
                    value={form.lead_time_days ?? ''}
                    error={errors.lead_time_days}
                    min={0}
                    onChange={(e) =>
                      set('lead_time_days', e.target.value)
                    }
                  />

                  <Input
                    label="Payment Terms"
                    value={form.payment_terms ?? ''}
                    error={errors.payment_terms}
                    onChange={(e) =>
                      set('payment_terms', e.target.value)
                    }
                  />

                  <Input
                    label="Minimum Order Qty"
                    type="number"
                    value={form.minimum_order_quantity ?? ''}
                    error={errors.minimum_order_quantity}
                    min={0}
                    onChange={(e) =>
                      set(
                        'minimum_order_quantity',
                        e.target.value
                      )
                    }
                  />

                  <Textarea
                    label="Notes"
                    value={form.notes ?? ''}
                    onChange={(e) =>
                      set('notes', e.target.value)
                    }
                    className="col-span-2"
                  />

                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">

                  <Field
                    label="Country"
                    value={supplier.country}
                  />

                  <Field
                    label="Currency"
                    value={supplier.currency}
                  />

                  <Field
                    label="Contact Person"
                    value={supplier.contact_name}
                  />

                  <Field
                    label="Email"
                    value={supplier.contact_email}
                  />

                  <Field
                    label="Phone"
                    value={supplier.contact_phone}
                  />

                  <Field
                    label="Website"
                    value={supplier.website}
                  />

                  <Field
                    label="Lead Time"
                    value={
                      supplier.lead_time_days != null
                        ? `${supplier.lead_time_days} days`
                        : null
                    }
                  />

                  <Field
                    label="Payment Terms"
                    value={supplier.payment_terms}
                  />

                  <Field
                    label="Min. Order Qty"
                    value={supplier.minimum_order_quantity}
                  />

                  {supplier.notes && (
                    <Field
                      label="Notes"
                      value={supplier.notes}
                      className="col-span-2"
                    />
                  )}

                </div>
              )}
            </Section>
          </Card>

          {/* Side stats */}
          <div className="space-y-4">
            <Card className="p-5">
              <p className="text-[12px] text-[#737373] uppercase tracking-wider font-medium">
                Active Order Value
              </p>

              <p className="text-[24px] font-semibold mt-1">
                {formatCurrency(activeOrderValue)}
              </p>

              <p className="text-[12px] text-[#737373] mt-1">
                Across active orders
              </p>
            </Card>

            <Card className="p-5">
              <p className="text-[12px] text-[#737373] uppercase tracking-wider font-medium">
                Materials
              </p>

              <p className="text-[24px] font-semibold mt-1">
                {materials.length}
              </p>
            </Card>
          </div>
        </div>

        {/* Materials */}
        <Card className="p-6">
          <Section title="Materials Supplied">
            {materials.length === 0 ? (
              <p className="text-[13px] text-[#737373]">
                No materials assigned to this supplier.
              </p>
            ) : (
              <div className="space-y-2">
                {materials.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => router.push(`/materials/${m.id}`)}
                    className="flex items-center justify-between py-2 px-3 rounded hover:bg-[#f5f5f5] cursor-pointer"
                  >
                    <div>
                      <span className="text-[13px] font-medium">
                        {m.name}
                      </span>

                      <span className="text-[12px] text-[#737373] ml-2">
                        {m.category}
                      </span>
                    </div>

                    <span className="text-[13px]">
                      {m.unit_cost != null
                        ? `€${m.unit_cost} / ${m.unit_of_measurement}`
                        : '—'}
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
                    <span className="text-[13px] font-medium">
                      {p.name}
                    </span>

                    <span className="text-[12px] text-[#737373]">
                      {p.style_code}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </Card>
        )}
      </div>

      {/* Delete confirmation */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete Supplier"
        size="sm"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>

            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[13px]">
          Are you sure you want to delete{' '}
          <strong>{supplier.name}</strong>? The supplier will be moved to
          Spam and can be restored by an Owner.
        </p>
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
