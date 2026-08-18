'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, Badge, StatusBadge, Table, Thead, Tbody, Th, Td, Tr,
  EmptyState, Input, Select, Modal, Textarea,
} from '@/components/ui';
import { supplierRepository } from '@/lib/data/backend-suppliers';
import { loadCurrencies } from '@/lib/data/currency';
import { v4 as uuidv4 } from 'uuid';
import { initializePermission, getPermission } from "../../lib/permissions";
import { getItems } from '@/lib/data/storage';
import { STORAGE_KEYS } from '@/lib/constants';
import { auditRepository } from '@/lib/data/backend-audit';

const BLANK = {
  name: '',
  country: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  website: '',
  lead_time_days: '',
  payment_terms: '',
  notes: '',
  status: 'active',
  spam: false,
};

export default function SuppliersPage() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [currencies, setCurrencies] = useState([]);

  const currentUser = getItems(STORAGE_KEYS.logged_user);

  async function load() {
    try {
      const data = await supplierRepository.getAll();
      setSuppliers(data);
      initializePermission();
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    }
  }

  useEffect(() => {
    load();

    loadCurrencies()
      .then(setCurrencies)
      .catch((err) =>
        console.error('Failed to load currencies:', err)
      );
  }, []);

  const permission = getPermission('suppliers');

  const filtered = suppliers.filter((s) => {
  const matchSearch =
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    (s.country || '').toLowerCase().includes(search.toLowerCase());

  const matchStatus =
    !statusFilter ||
    s.status === statusFilter;

  const matchSpam = s.spam === false;

  return matchSearch && matchStatus && matchSpam;
});

  function openModal() {
    setForm(BLANK);
    setErrors({});
    setModal(true);
  }

  function validate() {
    const errs = {};

    if (!form.name?.trim()) {
      errs.name = 'Supplier name is required';
    }

    if (!form.country?.trim()) {
      errs.country = 'Country is required';
    }

    if (!form.contact_name?.trim()) {
      errs.contact_name = 'Contact person is required';
    }

    if (!form.contact_email?.trim()) {
      errs.contact_email = 'Email is required';
    }

    if (!form.contact_phone?.trim()) {
      errs.contact_phone = 'Phone is required';
    }

    if (!form.website?.trim()) {
      errs.website = 'Website is required';
    }

    if (
      form.lead_time_days === '' ||
      form.lead_time_days == null ||
      Number(form.lead_time_days) <= 0
    ) {
      errs.lead_time_days = 'Lead time must be greater than 0';
    }

    if (!form.payment_terms?.trim()) {
      errs.payment_terms = 'Payment terms are required';
    }

    return errs;
  }

  async function handleSave() {
    const errs = validate();

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const id = uuidv4();

    const supplier = {
      id,
      ...form,

      lead_time_days:
        form.lead_time_days !== '' &&
          form.lead_time_days != null
          ? Number(form.lead_time_days)
          : null,

      spam: false,
    };

    try {
      const createdSupplier =
        await supplierRepository.create(supplier);

      const after =
        createdSupplier?.supplier ||
        createdSupplier;

      await auditRepository.create({
        user_id: currentUser.id,
        action: 'create',
        entity_type: 'supplier',
        entity_id: id,
        before: null,
        after,
      });

      setModal(false);

      await load();

      router.push(`/suppliers/${id}`);
    } catch (err) {
      console.error('Failed to create supplier:', err);
    }
  }

  function set(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }
  
  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle={`${filtered.length} supplier${filtered.length !== 1 ? 's' : ''}`}
        actions={
          <Button
            variant="primary"
            onClick={openModal}
            disabled={permission === 0}
            className="
            disabled:cursor-not-allowed
            disabled:bg-[#f5f5f5]
            disabled:text-[#737373]
            disabled:opacity-40
          "
          >
            + Add Supplier
          </Button>
        }
      />

      <div className="px-8 py-6">
        <div className="flex gap-3 mb-6">
          <Input
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-36"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No suppliers found"
            description="Add your first supplier to get started."
            action={
              <Button
                variant="primary"
                onClick={openModal}
                disabled={permission === 0}
              >
                + Add Supplier
              </Button>
            }
          />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Supplier</Th>
                <Th>Country</Th>
                <Th>Currency</Th>
                <Th>Lead Time</Th>
                <Th>Payment Terms</Th>
                <Th>Status</Th>
              </tr>
            </Thead>

            <Tbody>
              {filtered.map((s) => (
                <Tr
                  key={s.id}
                  onClick={() => router.push(`/suppliers/${s.id}`)}
                >
                  <Td className="font-medium">
                    {s.name}
                  </Td>

                  <Td>
                    {s.country || '—'}
                  </Td>

                  <Td>
                    {s.currency || '—'}
                  </Td>

                  <Td>
                    {s.lead_time_days != null
                      ? `${s.lead_time_days}d`
                      : '—'}
                  </Td>

                  <Td>
                    {s.payment_terms || '—'}
                  </Td>

                  <Td>
                    <StatusBadge status={s.status} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add Supplier"
        size="lg"
        footer={
          <>
            <Button onClick={() => setModal(false)}>
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={handleSave}
            >
              Create Supplier
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">

          <Input
            label="Supplier Name *"
            value={form.name}
            error={errors.name}
            onChange={(e) => set('name', e.target.value)}
            className="col-span-2"
          />

          <Input
            label="Country"
            value={form.country}
            error={errors.country}
            onChange={(e) => set('country', e.target.value)}
          />

          {currencies.length === 0 ? (
            <Input
              label="Currency"
              value={form.currency}
              error={errors.currency}
              onChange={(e) => set('currency', e.target.value)}
            />
          ) : (
            <Select
              label="Currency"
              value={form.currency}
              error={errors.currency}
              onChange={(e) => set('currency', e.target.value)}
            >
              {currencies.map((c) => (
                <option
                  key={c.quote}
                  value={c.quote}
                >
                  {c.quote}
                </option>
              ))}
            </Select>
          )}

          <Input
            label="Contact Person"
            value={form.contact_name}
            error={errors.contact_name}
            onChange={(e) => set('contact_name', e.target.value)}
          />

          <Input
            label="Email"
            type="email"
            value={form.contact_email}
            error={errors.contact_email}
            onChange={(e) => set('contact_email', e.target.value)}
          />

          <Input
            label="Phone"
            value={form.contact_phone}
            error={errors.contact_phone}
            onChange={(e) => set('contact_phone', e.target.value)}
          />

          <Input
            label="Website"
            value={form.website}
            error={errors.website}
            onChange={(e) => set('website', e.target.value)}
          />

          <Input
            label="Lead Time (days)"
            type="number"
            value={form.lead_time_days}
            min={0}
            error={errors.lead_time_days}
            onChange={(e) => set('lead_time_days', e.target.value)}
          />

          <Input
            label="Payment Terms"
            value={form.payment_terms}
            error={errors.payment_terms}
            onChange={(e) => set('payment_terms', e.target.value)}
          />

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            className="col-span-2"
          />

        </div>
      </Modal>
    </div>
  );
}
