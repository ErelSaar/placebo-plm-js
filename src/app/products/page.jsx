'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, StatusBadge, Table, Thead, Tbody, Th, Td, Tr,
  EmptyState, Input, Select, Modal, Textarea,
} from '@/components/ui';
// import { productRepository } from '@/lib/data/products';
import { productRepository } from '@/lib/data/backend-products.js';
import { auditRepository } from '@/lib/data/backend-audit.js';
import { PRODUCT_CATEGORIES, STORAGE_KEYS } from '@/lib/constants';
import { recordRepository } from '@/lib/data/action-record';
import { v4 as uuidv4 } from 'uuid';
import { initializePermission, getPermission } from "../../lib/permissions";
import { getItems } from '@/lib/data/storage';
import { apiRequest } from '@/lib/data/aws-storage';

const BLANK = {
  name: '',
  style_code: '',
  description: '',
  season: '',
  category: 'outerwear',
  status: 'active',
  images: [],
  colors: [],
  sizes: [],
  sku: '',
  selling_price: '',
  currency: 'EUR',
  notes: '',
  pricing_multiplier: 3.5,
};

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [currencies, setCurrencies] = useState([]);

  async function load() {
    initializePermission();
    const data = await productRepository.getAll()
    setProducts(data);
  }

  useEffect(() => {
    const testCurrency = async () => {
      try {
        const data = await apiRequest("currencies", "get");
        setCurrencies(data);
      } catch (error) {
        console.error("Failed to retrieve currencies:", error);
      }
    };
    testCurrency();
    load();
  }, []);

  const permission = getPermission('products');

  console.log(products)

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      p.name.toLowerCase().includes(q) ||
      (p.style_code || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || p.status === statusFilter;
    const matchCat = !categoryFilter || p.category === categoryFilter;
    return matchSearch && matchStatus && matchCat;
  });

  function openModal() {
    setForm(BLANK);
    setErrors({});
    setModal(true);
  }

  async function validate() {
    const errs = {};
    const all = await productRepository.getAll();
    if (!form.name.trim()) errs.name = 'Name is required';

    if (!form.selling_price || Number(form.selling_price) <= 0) {
      errs.selling_price = 'Selling price must be greater than 0';
    }

    if (!form.season?.trim()) {
      errs.season = 'Season is required';
    }

    if (!form.style_code.trim()) {
      errs.style_code = 'Style code is required';
    } else if (all.some((p) => p.style_code === form.style_code)) {
      errs.style_code = 'Style code must be unique';
    }

    if (!form.sku.trim()) {
      errs.sku = 'SKU is required';
    } else if (all.some((p) => p.sku === form.sku)) {
      errs.sku = 'SKU must be unique';
    }

    return errs;
  }

  async function handleSave() {
    const errs = await validate();

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const currentUser = getItems(STORAGE_KEYS.logged_user);

    const product = {
      ...form,
      selling_price: form.selling_price !== '' ? Number(form.selling_price) : null,
      pricing_multiplier: Number(form.pricing_multiplier) || 3.5,
    };

    const result = await productRepository.create(product);

    const createdProduct = result.product;
    const id = createdProduct.id;

    await auditRepository.create({
      org_id: currentUser.org_id,
      user_id: currentUser.id,
      action: 'create',
      entity_type: 'product',
      entity_id: id,
      before: null,
      after: product,
    });

    setModal(false);
    await load();
    router.push(`/products/${id}`);
  }

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${filtered.length} product${filtered.length !== 1 ? 's' : ''}`}
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
            + Add Product
          </Button>
        }
      />

      <div className="px-8 py-6">
        <div className="flex gap-3 mb-6">
          <Input
            placeholder="Search by name, style code, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-40">
            <option value="">All Categories</option>
            {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="draft">Draft</option>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No products found" description="Add your first product to get started." action={<Button variant="primary" onClick={openModal}>+ Add Product</Button>} />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Product</Th>
                <Th>Style Code</Th>
                <Th>SKU</Th>
                <Th>Season</Th>
                <Th>Category</Th>
                <Th>Selling Price</Th>
                <Th>Status</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((p) => (
                <Tr key={p.id} onClick={() => router.push(`/products/${p.id}`)}>
                  <Td className="font-medium">{p.name}</Td>
                  <Td>{p.style_code}</Td>
                  <Td>{p.sku}</Td>
                  <Td>{p.season || '—'}</Td>
                  <Td>{p.category}</Td>
                  <Td>{p.selling_price != null ? `€${p.selling_price}` : '—'}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add Product"
        size="lg"
        footer={<>
          <Button onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Create Product</Button>
        </>}
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Product Name *" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} className="col-span-2" />
          <Input label="Style Code *" value={form.style_code} onChange={(e) => set('style_code', e.target.value)} error={errors.style_code} />
          <Input label="SKU *" value={form.sku} onChange={(e) => set('sku', e.target.value)} error={errors.sku} />
          <Select label="Season" value={form.season} error={errors.season} onChange={(e) => set('season', e.target.value)}>
            <option value="">Select season</option>
            <option value="fall_winter">Fall / Winter</option>
            <option value="spring_summer">Spring / Summer</option>
          </Select>
          <Select label="Category" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Selling Price" type="number" value={form.selling_price} min={0} error={errors.selling_price} onChange={(e) => set('selling_price', e.target.value)} />
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
          <Textarea label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} className="col-span-2" />
          <Textarea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} className="col-span-2" />
        </div>
      </Modal>
    </div>
  );
}
