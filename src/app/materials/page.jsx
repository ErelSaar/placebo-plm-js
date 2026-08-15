'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, StatusBadge, Table, Thead, Tbody, Th, Td, Tr,
  EmptyState, Input, Select, Modal, Textarea, Warning,
} from '@/components/ui';
import { materialRepository } from '@/lib/data/materials';
import { supplierRepository } from '@/lib/data/suppliers';
import { MATERIAL_CATEGORY_GROUPS, MATERIAL_CATEGORIES, STORAGE_KEYS } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid';
import { initializePermission, getPermission } from "../../lib/permissions";
import { recordRepository } from '@/lib/data/action-record';
import { getItems } from '@/lib/data/storage';
import { loadCurrencies } from '@/lib/data/currency';

const BLANK = {
  name: '',
  internal_code: '',
  category: 'fabric',
  color: '',
  description: '',
  supplier_id: '',
  supplier_item_code: '',
  unit_of_measurement: '',
  unit_cost: '',
  currency: 'EUR',
  lead_time: '',
  minimum_order_quantity: '',
  notes: '',
  status: 'active',
};

export default function MaterialsPage() {
  const router = useRouter();
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [grouped, setGrouped] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
    const [currencies, setCurrencies] = useState([]);
  const currentUser = getItems(STORAGE_KEYS.logged_user);

  function load() {
    setMaterials(materialRepository.getAll());
    setSuppliers(supplierRepository.getAll());
    initializePermission();
  }

  useEffect(() => {
    load();
    loadCurrencies()
      .then(setCurrencies)
      .catch((err) => console.error("Failed to load currencies:", err));
  }, []);

  const permission = getPermission('materials');

  const filtered = materials.filter((m) => {
    const matchSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.internal_code || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || m.category === categoryFilter;
    const matchStatus = !statusFilter || m.status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const showGrouped = grouped && !search && !categoryFilter;

  function openModal() {
    setForm(BLANK);
    setErrors({});
    setModal(true);
  }

  function validate() {
    const errs = {};

    if (!form.name?.trim()) {
      errs.name = 'Material name is required';
    }

    if (!form.internal_code?.trim()) {
      errs.internal_code = 'Internal code is required';
    }

    // if (!form.color?.trim()) {
    //   errs.color = 'color is required';
    // }

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

    // if (form.minimum_order_quantity === '' || form.minimum_order_quantity == null || Number(form.minimum_order_quantity) <= 0) {
    //   errs.minimum_order_quantity = 'Minimum order quantity must be greater than 0';
    // }

    return errs;
  }
  
  function handleSave() {
    const errs = validate();

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const id = uuidv4();

    const material = {
      id,
      ...form,
      supplier_id: form.supplier_id || null,
      unit_cost: form.unit_cost !== '' ? Number(form.unit_cost) : null,
      lead_time: form.lead_time !== '' ? Number(form.lead_time) : null,
      minimum_order_quantity:
        form.minimum_order_quantity !== ''
          ? Number(form.minimum_order_quantity)
          : null,
    };

    materialRepository.create(material);

    recordRepository.create({
      user_id: currentUser.id,
      action: 'CREATE',
      entity_type: 'material',
      entity_id: id,
      before: null,
      after: material,
    });

    setModal(false);
    load();
    router.push(`/materials/${id}`);
  }

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function supplierName(supplier_id) {
    return suppliers.find((s) => s.id === supplier_id)?.name ?? '—';
  }

  const MaterialRow = ({ m }) => (
    <Tr onClick={() => router.push(`/materials/${m.id}`)}>
      <Td className="font-medium">{m.name}</Td>
      <Td>{m.internal_code || '—'}</Td>
      <Td>{m.category}</Td>
      <Td>{m.color || '—'}</Td>
      <Td>{supplierName(m.supplier_id)}</Td>
      <Td>{m.unit_cost != null ? `€${m.unit_cost}` : '—'}</Td>
      <Td>{m.unit_of_measurement || '—'}</Td>
      <Td><StatusBadge status={m.status} /></Td>
    </Tr>
  );

  return (
    <div>
      <PageHeader
        title="Materials"
        subtitle={`${filtered.length} material${filtered.length !== 1 ? 's' : ''}`}
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
            + Add Material
          </Button>
        }
      />

      <div className="px-8 py-6">
        <div className="flex gap-3 mb-6 flex-wrap">
          <Input
            placeholder="Search materials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-40">
            <option value="">All Categories</option>
            {MATERIAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant={grouped ? 'primary' : 'secondary'} onClick={() => setGrouped(true)}>Grouped</Button>
            <Button size="sm" variant={!grouped ? 'primary' : 'secondary'} onClick={() => setGrouped(false)}>Flat</Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No materials found" description="Add your first material to get started." action={<Button variant="primary" onClick={openModal}>+ Add Material</Button>} />
        ) : showGrouped ? (
          <div className="space-y-6">
            {MATERIAL_CATEGORY_GROUPS.map((group) => {
              const groupMats = filtered.filter((m) => group.categories.includes(m.category));
              if (groupMats.length === 0) return null;
              return (
                <div key={group.key}>
                  <h3 className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider mb-3">
                    {group.label} <span className="text-[#a3a3a3]">({groupMats.length})</span>
                  </h3>
                  <Table>
                    <Thead>
                      <tr>
                        <Th>Material</Th>
                        <Th>Code</Th>
                        <Th>Category</Th>
                        <Th>Color</Th>
                        <Th>Supplier</Th>
                        <Th>Unit Cost</Th>
                        <Th>UOM</Th>
                        <Th>Status</Th>
                      </tr>
                    </Thead>
                    <Tbody>
                      {groupMats.map((m) => <MaterialRow key={m.id} m={m} />)}
                    </Tbody>
                  </Table>
                </div>
              );
            })}
          </div>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Material</Th>
                <Th>Code</Th>
                <Th>Category</Th>
                <Th>Color</Th>
                <Th>Supplier</Th>
                <Th>Unit Cost</Th>
                <Th>UOM</Th>
                <Th>Status</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((m) => <MaterialRow key={m.id} m={m} />)}
            </Tbody>
          </Table>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add Material"
        size="lg"
        footer={<>
          <Button onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Create Material</Button>
        </>}
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Material Name *" value={form.name} error={errors.name} onChange={(e) => set('name', e.target.value)} className="col-span-2" />
          <Input label="Internal Code" value={form.internal_code} error={errors.internal_code} onChange={(e) => set('internal_code', e.target.value)} />
          <Select label="Category *" value={form.category} onChange={(e) => set('category', e.target.value)} error={errors.category}>
            {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Color" value={form.color} error={errors.color} onChange={(e) => set('color', e.target.value)} />
          <Select label="Supplier" value={form.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
            <option value="">No Supplier</option>
            {suppliers.filter((s) => s.status === 'active').map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Input label="Supplier Item Code" value={form.supplier_item_code} error={errors.supplier_item_code} onChange={(e) => set('supplier_item_code', e.target.value)} />
          <Input label="Unit Cost" type="number" step="0.001" value={form.unit_cost} min={0} error={errors.unit_cost} onChange={(e) => set('unit_cost', e.target.value)} />
          {currencies.length === 0 ? (
            <Input
              label="Currency"
              value={form.currency || 'EUR'}
              onChange={(e) => set('currency', e.target.value)}
            />
          ) : (
            <Select
              label="Currency"
              value={form.currency || 'EUR'}
              onChange={(e) => set('currency', e.target.value)}
            >
              {currencies.map((currency) => (
                <option key={currency.quote} value={currency.quote}>
                  {currency.quote}
                </option>
              ))}
            </Select>
          )}
          <Input label="Unit of Measurement" value={form.unit_of_measurement} error={errors.unit_of_measurement} onChange={(e) => set('unit_of_measurement', e.target.value)} />
          <Input label="Lead Time (days)" type="number" value={form.lead_time} min={0} error={errors.lead_time} onChange={(e) => set('lead_time', e.target.value)} />
          <Input label="Min. Order Qty" type="number" value={form.minimum_order_quantity} min={0} error={errors.minimum_order_quantity} onChange={(e) => set('minimum_order_quantity', e.target.value)} />
          <Textarea label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} className="col-span-2" />
          <Textarea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} className="col-span-2" />
        </div>
      </Modal>
    </div>
  );
}
