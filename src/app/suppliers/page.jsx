'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, Badge, StatusBadge, Table, Thead, Tbody, Th, Td, Tr,
  EmptyState, Input, Select, Modal, Textarea,
} from '@/components/ui';
import { supplierRepository } from '@/lib/data/suppliers';
import { v4 as uuidv4 } from 'uuid';

const BLANK = {
  name: '',
  country: '',
  contact_person: '',
  email: '',
  phone: '',
  website: '',
  currency: 'EUR',
  lead_time: '',
  payment_terms: '',
  minimum_order_quantity: '',
  notes: '',
  status: 'active',
};

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});

  function load() {
    setSuppliers(supplierRepository.getAll());
  }

  useEffect(() => { load(); }, []);

  const filtered = suppliers.filter((s) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.country || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  function openModal() {
    setForm(BLANK);
    setErrors({});
    setModal(true);
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    return errs;
  }

  function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const id = uuidv4();
    supplierRepository.create({
      id,
      ...form,
      lead_time: form.lead_time ? Number(form.lead_time) : null,
      minimum_order_quantity: form.minimum_order_quantity ? Number(form.minimum_order_quantity) : null,
    });
    setModal(false);
    load();
    router.push(`/suppliers/${id}`);
  }

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle={`${filtered.length} supplier${filtered.length !== 1 ? 's' : ''}`}
        actions={<Button variant="primary" onClick={openModal}>+ Add Supplier</Button>}
      />

      <div className="px-8 py-6">
        <div className="flex gap-3 mb-6">
          <Input
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No suppliers found" description="Add your first supplier to get started." action={<Button variant="primary" onClick={openModal}>+ Add Supplier</Button>} />
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
                <Tr key={s.id} onClick={() => router.push(`/suppliers/${s.id}`)}>
                  <Td className="font-medium">{s.name}</Td>
                  <Td>{s.country || '—'}</Td>
                  <Td>{s.currency}</Td>
                  <Td>{s.lead_time != null ? `${s.lead_time}d` : '—'}</Td>
                  <Td>{s.payment_terms || '—'}</Td>
                  <Td><StatusBadge status={s.status} /></Td>
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
        footer={<>
          <Button onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Create Supplier</Button>
        </>}
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Supplier Name *" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} className="col-span-2" />
          <Input label="Country" value={form.country} onChange={(e) => set('country', e.target.value)} />
          <Input label="Currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} />
          <Input label="Contact Person" value={form.contact_person} onChange={(e) => set('contact_person', e.target.value)} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <Input label="Website" value={form.website} onChange={(e) => set('website', e.target.value)} />
          <Input label="Lead Time (days)" type="number" value={form.lead_time} onChange={(e) => set('lead_time', e.target.value)} />
          <Input label="Payment Terms" value={form.payment_terms} onChange={(e) => set('payment_terms', e.target.value)} />
          <Input label="Minimum Order Qty" type="number" value={form.minimum_order_quantity} onChange={(e) => set('minimum_order_quantity', e.target.value)} />
          <Textarea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} className="col-span-2" />
        </div>
      </Modal>
    </div>
  );
}
