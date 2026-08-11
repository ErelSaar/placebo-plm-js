'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, Card, Input, Textarea, Select, Warning, Section,
  Table, Thead, Tbody, Th, Td, Tr, EmptyState,
} from '@/components/ui';
import { orderRepository, orderLineRepository } from '@/lib/data/orders';
import { productRepository } from '@/lib/data/products';
import { v4 as uuidv4 } from 'uuid';

export default function NewOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [lines, setLines] = useState([]);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    order_number: '',
    order_name: '',
    season: '',
    order_date: new Date().toISOString().slice(0, 10),
    target_date: '',
    production_country: '',
    production_factory: '',
    shipping_destination: '',
    destination_address: '',
    order_currency: 'EUR',
    notes: '',
  });

  useEffect(() => {
    setProducts(productRepository.getAll().filter((p) => p.status === 'active'));
  }, []);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase();
    return !productSearch ||
      p.name.toLowerCase().includes(q) ||
      p.style_code.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q);
  });

  function addLine(product) {
    const newLine = {
      id: uuidv4(),
      product_id: product.id,
      product,
      color: product.colors?.[0] ?? '',
      size: product.sizes?.[0] ?? '',
      quantity: 1,
    };
    setLines((prev) => [...prev, newLine]);
  }

  function updateLine(lineId, field, value) {
    setLines((prev) => prev.map((l) => l.id === lineId ? { ...l, [field]: value } : l));
  }

  function removeLine(lineId) {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  }

  function hasDuplicate() {
    const keys = lines.map((l) => `${l.product_id}|${l.color}|${l.size}`);
    return keys.length !== new Set(keys).size;
  }

  function validate(status) {
    const errs = {};

    if (!form.order_number?.trim()) {
      errs.order_number = 'Order number is required';
    } else if (orderRepository.orderNumberExists(form.order_number)) {
      errs.order_number = 'Order number already exists';
    }

    if (!form.order_name?.trim()) {
      errs.order_name = 'Order name is required';
    }

    if (!form.season) {
      errs.season = 'Season is required';
    }

    if (!form.order_currency?.trim()) {
      errs.order_currency = 'Currency is required';
    }

    if (!form.order_date) {
      errs.order_date = 'Order date is required';
    }

    if (!form.target_date) {
      errs.target_date = 'Target date is required';
    }

    if (!form.production_country?.trim()) {
      errs.production_country = 'Production country is required';
    }

    if (!form.production_factory?.trim()) {
      errs.production_factory = 'Production factory is required';
    }

    if (!form.shipping_destination?.trim()) {
      errs.shipping_destination = 'Shipping destination is required';
    }

    if (!form.destination_address?.trim()) {
      errs.destination_address = 'Destination address is required';
    }

    if (status === 'confirmed' && lines.length === 0) {
      errs.lines = 'At least one product is required to confirm an order';
    }

    if (hasDuplicate()) {
      errs.lines = 'Duplicate product + color + size combinations are not allowed';
    }

    return errs;
  }

  function handleSave(status) {
    const errs = validate(status);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const orderId = uuidv4();
    orderRepository.create({
      id: orderId,
      ...form,
      status,
      shipping_cost: null,
      shipping_cost_type: 'fixed',
      customs_cost: null,
      customs_type: 'fixed',
      cost_allocation_method: 'by_value',
      additional_costs: [],
    });

    const orderLines = lines.map((l) => ({
      id: l.id,
      order_id: orderId,
      product_id: l.product_id,
      color: l.color,
      size: l.size,
      quantity: Number(l.quantity),
    }));
    orderLineRepository.saveMany(orderId, orderLines);
    router.push(`/orders/${orderId}`);
  }

  return (
    <div>
      <PageHeader
        title="New Order"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => router.push('/orders')}>Cancel</Button>
            <Button onClick={() => handleSave('draft')}>Save as Draft</Button>
            <Button variant="primary" onClick={() => handleSave('confirmed')}>Confirm Order</Button>
          </div>
        }
      />

      <div className="px-8 py-6 grid grid-cols-3 gap-6">
        {/* Left: Order form */}
        <div className="col-span-2 space-y-6">
          <Card className="p-6">
            <Section title="Order Details">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Order Number *" value={form.order_number} onChange={(e) => set('order_number', e.target.value)} error={errors.order_number} />
                <Input label="Order Name *" value={form.order_name} onChange={(e) => set('order_name', e.target.value)} error={errors.order_name} />
                <Select label="Season" value={form.season} onChange={(e) => set('season', e.target.value)} error={errors.season}>
                  <option value="spring">Spring</option>
                  <option value="summer">Summer</option>
                  <option value="autumn">Autumn</option>
                  <option value="winter">Winter</option>
                </Select>
                <Input label="Currency" value={form.order_currency} onChange={(e) => set('order_currency', e.target.value)} error={errors.order_currency} />
                <Input label="Order Date" type="date" value={form.order_date} onChange={(e) => set('order_date', e.target.value)} error={errors.order_date} />
                <Input label="Target Date" type="date" value={form.target_date} onChange={(e) => set('target_date', e.target.value)} error={errors.target_date} />
                <Input label="Production Country" value={form.production_country} onChange={(e) => set('production_country', e.target.value)} error={errors.production_country} />
                <Input label="Production Factory" value={form.production_factory} onChange={(e) => set('production_factory', e.target.value)} error={errors.production_factory} />
                <Input label="Shipping Destination" value={form.shipping_destination} onChange={(e) => set('shipping_destination', e.target.value)} error={errors.shipping_destination} />
                <Input label="Destination Address" value={form.destination_address} onChange={(e) => set('destination_address', e.target.value)} error={errors.destination_address} />
                <Textarea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} error={errors.notes} className="col-span-2" />
              </div>
            </Section>
          </Card>

          <Card className="p-6">
            <Section title={`Products (${lines.length})`}>
              {errors.lines && <Warning>{errors.lines}</Warning>}
              {lines.length === 0 ? (
                <p className="text-[13px] text-[#737373] py-4">No products added yet. Use the panel on the right to add products.</p>
              ) : (
                <Table>
                  <Thead>
                    <tr>
                      <Th>Product</Th>
                      <Th>Color</Th>
                      <Th>Size</Th>
                      <Th>Quantity</Th>
                      <Th></Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {lines.map((line) => (
                      <Tr key={line.id}>
                        <Td className="font-medium">{line.product?.name ?? line.product_id}</Td>
                        <Td>
                          {line.product?.colors?.length > 0 ? (
                            <select
                              value={line.color}
                              onChange={(e) => updateLine(line.id, 'color', e.target.value)}
                              className="border border-[#e5e5e5] rounded px-2 py-1 text-[13px] focus:outline-none"
                            >
                              {line.product.colors.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <input
                              value={line.color}
                              onChange={(e) => updateLine(line.id, 'color', e.target.value)}
                              placeholder="Color"
                              className="border border-[#e5e5e5] rounded px-2 py-1 text-[13px] w-32 focus:outline-none"
                            />
                          )}
                        </Td>
                        <Td>
                          {line.product?.sizes?.length > 0 ? (
                            <select
                              value={line.size}
                              onChange={(e) => updateLine(line.id, 'size', e.target.value)}
                              className="border border-[#e5e5e5] rounded px-2 py-1 text-[13px] focus:outline-none"
                            >
                              {line.product.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <input
                              value={line.size}
                              onChange={(e) => updateLine(line.id, 'size', e.target.value)}
                              placeholder="Size"
                              className="border border-[#e5e5e5] rounded px-2 py-1 text-[13px] w-20 focus:outline-none"
                            />
                          )}
                        </Td>
                        <Td>
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => updateLine(line.id, 'quantity', e.target.value)}
                            className="border border-[#e5e5e5] rounded px-2 py-1 text-[13px] w-20 focus:outline-none"
                          />
                        </Td>
                        <Td>
                          <Button size="sm" variant="ghost" onClick={() => removeLine(line.id)}>Remove</Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </Section>
          </Card>
        </div>

        {/* Right: Product search panel */}
        <div>
          <Card className="p-5 sticky top-4">
            <p className="text-[13px] font-semibold mb-3">Add Products</p>
            <Input
              placeholder="Search products..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="mb-3"
            />
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => addLine(p)}
                  className="flex items-center justify-between px-3 py-2 rounded hover:bg-[#f5f5f5] cursor-pointer"
                >
                  <div>
                    <p className="text-[13px] font-medium">{p.name}</p>
                    <p className="text-[11px] text-[#737373]">{p.style_code}</p>
                  </div>
                  <span className="text-[12px] text-[#737373]">+</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
