'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, Card, Input, Textarea, Select, Warning, Section,
  Table, Thead, Tbody, Th, Td, Tr, EmptyState, formatCurrency,
} from '@/components/ui';
import { orderRepository, orderLineRepository, orderAdditionalCostRepository } from '@/lib/data/backend-orders';
import { productRepository } from '@/lib/data/backend-products';
import { auditRepository } from '@/lib/data/backend-audit';
import { v4 as uuidv4 } from 'uuid';
import { getItems } from '@/lib/data/storage';
import { STORAGE_KEYS } from '@/lib/constants';
import { recordRepository } from '@/lib/data/action-record';
import { loadCurrencies } from '@/lib/data/currency';
import { getRate, convertCurrency, roundForDisplay } from '@/lib/currency';

export default function NewOrderPage() {
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [lines, setLines] = useState([]);
  const [additionalCosts, setAdditionalCosts] = useState([]);
  const [errors, setErrors] = useState({});
  const [currencies, setCurrencies] = useState([]);

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
    shipping_cost: '',
    order_currency: 'EUR',
    notes: '',
  });

  const currentUser = getItems(STORAGE_KEYS.logged_user);

  // =========================
  // LOAD
  // =========================

  useEffect(() => {
    async function load() {
      try {
        const allProducts = await productRepository.getAll();

        setProducts(
          allProducts.filter(
            (p) => p.status === 'active'
          )
        );

        const loadedCurrencies = await loadCurrencies();
        setCurrencies(loadedCurrencies);
      } catch (err) {
        console.error('Failed to load new order data:', err);
      }
    }

    load();
  }, []);

  // =========================
  // FORM
  // =========================

  function set(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  // =========================
  // PRODUCT SEARCH
  // =========================

  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase();

    return (
      !productSearch ||
      p.name?.toLowerCase().includes(q) ||
      p.style_code?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    );
  });

  // =========================
  // LINES
  // =========================

  function addLine(product) {
    const newLine = {
      product_id: product.id,
      product,
      color: product.colors?.[0] ?? '',
      size: product.sizes?.[0] ?? '',
      quantity: 1,
    };

    setLines((prev) => [
      ...prev,
      {
        ...newLine,
        // Temporary frontend ID only.
        // Backend will generate the real order_line ID.
        _tempId: crypto.randomUUID(),
      },
    ]);
  }

  function updateLine(lineId, field, value) {
    setLines((prev) =>
      prev.map((line) =>
        line._tempId === lineId
          ? {
            ...line,
            [field]: value,
          }
          : line
      )
    );
  }

  function removeLine(lineId) {
    setLines((prev) =>
      prev.filter(
        (line) => line._tempId !== lineId
      )
    );
  }

  function hasDuplicate() {
    const keys = lines.map(
      (l) =>
        `${l.product_id}|${l.color}|${l.size}`
    );

    return (
      keys.length !== new Set(keys).size
    );
  }

  // =========================
  // ADDITIONAL COSTS
  // =========================

  function addAdditionalCost() {
    setAdditionalCosts((prev) => [
      ...prev,
      {
        _tempId: crypto.randomUUID(),
        cost_type: '',
        amount: '',
        currency: form.order_currency || 'EUR',
        description: '',
      },
    ]);
  }

  function updateAdditionalCost(tempId, field, value) {
    setAdditionalCosts((prev) =>
      prev.map((c) =>
        c._tempId === tempId ? { ...c, [field]: value } : c
      )
    );
  }

  function removeAdditionalCost(tempId) {
    setAdditionalCosts((prev) =>
      prev.filter((c) => c._tempId !== tempId)
    );
  }

  // =========================
  // TOTALS
  // =========================

  function toOrderCurrency(amount, fromCurrency) {
    if (amount == null || isNaN(amount)) return null;
    const orderCurrency = form.order_currency || 'EUR';
    if (fromCurrency === orderCurrency) return amount;
    const rate = getRate(fromCurrency, orderCurrency, currencies);
    if (!rate) return null;
    return convertCurrency(amount, fromCurrency, orderCurrency, rate.rate);
  }

  const orderLinesTotal = lines.reduce((total, line) => {
    const price = line.product?.selling_price;
    if (price == null) return total;
    const converted = toOrderCurrency(price, line.product?.currency || form.order_currency);
    if (converted === null) return total;
    return total + Number(line.quantity) * converted;
  }, 0);

  const additionalCostsTotal = additionalCosts.reduce((total, cost) => {
    const amount = Number(cost.amount);
    if (!cost.amount || isNaN(amount) || amount < 0) return total;
    const converted = toOrderCurrency(amount, cost.currency || form.order_currency);
    if (converted === null) return total;
    return total + converted;
  }, 0);

  // shipping_cost is entered in the order currency — no conversion needed
  const shippingTotal = roundForDisplay(Number(form.shipping_cost) || 0);

  const orderTotal = roundForDisplay(orderLinesTotal + shippingTotal + additionalCostsTotal);

  // =========================
  // VALIDATION
  // =========================

  function validate(status) {
    const errs = {};

    if (!form.order_number?.trim()) {
      errs.order_number = 'Order number is required';
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

    // Validate additional costs (skip fully blank rows — they are omitted on save)
    additionalCosts.forEach((cost, i) => {
      const hasType = !!cost.cost_type;
      const hasAmount = cost.amount !== '' && cost.amount !== null && cost.amount !== undefined;
      const blank = !hasType && !hasAmount && !cost.description?.trim();
      if (blank) return; // will be skipped on save

      if (!hasType) {
        errs[`additional_cost_${i}_type`] = 'Cost type is required';
      }
      if (!hasAmount || isNaN(Number(cost.amount)) || Number(cost.amount) < 0) {
        errs[`additional_cost_${i}_amount`] = 'Amount must be a non-negative number';
      }
      if (!cost.currency) {
        errs[`additional_cost_${i}_currency`] = 'Currency is required';
      }
    });

    return errs;
  }

  // =========================
  // SAVE
  // =========================

  async function handleSave(status) {
    const errs = validate(status);

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    try {
      const order = {
        ...form,
        status,
        shipping_cost: form.shipping_cost !== '' ? Number(form.shipping_cost) : null,
        shipping_cost_type: 'fixed',
        customs_cost: null,
        customs_type: 'fixed',
        cost_allocation_method: 'by_value',
        spam: false,
      };

      // Database creates the ID.
      const createdResponse = await orderRepository.create(order);

      // Backend returns:
      // { success: true, order: {...} }
      const createdOrder = createdResponse.order;

      if (!createdOrder?.id) {
        throw new Error('Order was created but no ID was returned');
      }

      // Create order lines only after the order exists.
      for (const line of lines) {
        await orderLineRepository.create({
          order_id: createdOrder.id,
          product_id: line.product_id,
          color: line.color,
          size: line.size,
          quantity: Number(line.quantity),
          destination: line.destination ?? null,
        });
      }

      // Save additional costs — skip fully blank rows.
      const costsToSave = additionalCosts.filter(
        (c) => c.cost_type || (c.amount !== '' && c.amount !== null)
      );
      for (const cost of costsToSave) {
        await orderAdditionalCostRepository.create({
          order_id: createdOrder.id,
          cost_type: cost.cost_type,
          amount: Number(cost.amount),
          currency: cost.currency || form.order_currency,
          description: cost.description || null,
        });
      }

      // One audit record for the new order.
      await auditRepository.create({
        user_id: currentUser.id,
        action: 'create',
        entity_type: 'order',
        entity_id: createdOrder.id,
        before: null,
        after: {
          ...createdOrder,
          lines,
          additional_costs: costsToSave,
        },
      });

      router.push(`/orders/${createdOrder.id}`);

    } catch (err) {
      console.error('Failed to create order:', err);
    }
  }

  // =========================
  // RENDER
  // =========================

  return (
    <div>
      <PageHeader
        title="New Order"
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                router.push('/orders')
              }
            >
              Cancel
            </Button>

            <Button
              onClick={() =>
                handleSave('draft')
              }
            >
              Save as Draft
            </Button>

            <Button
              variant="primary"
              onClick={() =>
                handleSave('confirmed')
              }
            >
              Confirm Order
            </Button>
          </div>
        }
      />

      <div className="px-8 py-6 grid grid-cols-3 gap-6">

        {/* =========================
            LEFT
        ========================= */}

        <div className="col-span-2 space-y-6">

          {/* ORDER DETAILS */}

          <Card className="p-6">
            <Section title="Order Details">

              <div className="grid grid-cols-2 gap-4">

                <Input
                  label="Order Number *"
                  value={form.order_number}
                  onChange={(e) =>
                    set(
                      'order_number',
                      e.target.value
                    )
                  }
                  error={errors.order_number}
                />

                <Input
                  label="Order Name *"
                  value={form.order_name}
                  onChange={(e) =>
                    set(
                      'order_name',
                      e.target.value
                    )
                  }
                  error={errors.order_name}
                />

                <Select
                  label="Season"
                  value={form.season}
                  onChange={(e) =>
                    set(
                      'season',
                      e.target.value
                    )
                  }
                  error={errors.season}
                >
                  <option value="">
                    Select season
                  </option>

                  <option value="fall / winter">
                    Fall / Winter
                  </option>

                  <option value="spring / summer">
                    Spring / Summer
                  </option>
                </Select>

                {currencies.length === 0 ? (
                  <Input
                    label="Currency"
                    value={
                      form.order_currency ||
                      'EUR'
                    }
                    onChange={(e) =>
                      set(
                        'order_currency',
                        e.target.value
                      )
                    }
                    error={
                      errors.order_currency
                    }
                  />
                ) : (
                  <Select
                    label="Currency"
                    value={
                      form.order_currency ||
                      'EUR'
                    }
                    onChange={(e) =>
                      set(
                        'order_currency',
                        e.target.value
                      )
                    }
                    error={
                      errors.order_currency
                    }
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
                  label="Order Date"
                  type="date"
                  value={form.order_date}
                  onChange={(e) =>
                    set(
                      'order_date',
                      e.target.value
                    )
                  }
                  error={errors.order_date}
                />

                <Input
                  label="Target Date"
                  type="date"
                  value={form.target_date}
                  onChange={(e) =>
                    set(
                      'target_date',
                      e.target.value
                    )
                  }
                  error={errors.target_date}
                />

                <Input
                  label="Production Country"
                  value={
                    form.production_country
                  }
                  onChange={(e) =>
                    set(
                      'production_country',
                      e.target.value
                    )
                  }
                  error={
                    errors.production_country
                  }
                />

                <Input
                  label="Production Factory"
                  value={
                    form.production_factory
                  }
                  onChange={(e) =>
                    set(
                      'production_factory',
                      e.target.value
                    )
                  }
                  error={
                    errors.production_factory
                  }
                />

                <Input
                  label="Shipping Destination"
                  value={
                    form.shipping_destination
                  }
                  onChange={(e) =>
                    set(
                      'shipping_destination',
                      e.target.value
                    )
                  }
                  error={
                    errors.shipping_destination
                  }
                />

                <Input
                  label="Destination Address"
                  value={
                    form.destination_address
                  }
                  onChange={(e) =>
                    set(
                      'destination_address',
                      e.target.value
                    )
                  }
                  error={
                    errors.destination_address
                  }
                />

                <Input
                  label="Shipping Cost (optional)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.shipping_cost}
                  onChange={(e) =>
                    set('shipping_cost', e.target.value)
                  }
                />

                <Textarea
                  label="Notes"
                  value={form.notes}
                  onChange={(e) =>
                    set(
                      'notes',
                      e.target.value
                    )
                  }
                  error={errors.notes}
                  className="col-span-2"
                />

              </div>

            </Section>
          </Card>

          {/* PRODUCTS */}

          <Card className="p-6">
            <Section
              title={`Products (${lines.length})`}
            >

              {errors.lines && (
                <Warning>
                  {errors.lines}
                </Warning>
              )}

              {lines.length === 0 ? (
                <p className="text-[13px] text-[#737373] py-4">
                  No products added yet. Use
                  the panel on the right to add
                  products.
                </p>
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
                      <Tr
                        key={line._tempId}
                      >

                        <Td className="font-medium">
                          {line.product?.name ??
                            line.product_id}
                        </Td>

                        <Td>
                          {line.product?.colors
                            ?.length > 0 ? (
                            <select
                              value={line.color}
                              onChange={(e) =>
                                updateLine(
                                  line._tempId,
                                  'color',
                                  e.target.value
                                )
                              }
                              className="border border-[#e5e5e5] rounded px-2 py-1 text-[13px] focus:outline-none"
                            >
                              {line.product.colors.map(
                                (c) => (
                                  <option
                                    key={c}
                                    value={c}
                                  >
                                    {c}
                                  </option>
                                )
                              )}
                            </select>
                          ) : (
                            <input
                              value={line.color}
                              onChange={(e) =>
                                updateLine(
                                  line._tempId,
                                  'color',
                                  e.target.value
                                )
                              }
                              placeholder="Color"
                              className="border border-[#e5e5e5] rounded px-2 py-1 text-[13px] w-32 focus:outline-none"
                            />
                          )}
                        </Td>

                        <Td>
                          {line.product?.sizes
                            ?.length > 0 ? (
                            <select
                              value={line.size}
                              onChange={(e) =>
                                updateLine(
                                  line._tempId,
                                  'size',
                                  e.target.value
                                )
                              }
                              className="border border-[#e5e5e5] rounded px-2 py-1 text-[13px] focus:outline-none"
                            >
                              {line.product.sizes.map(
                                (s) => (
                                  <option
                                    key={s}
                                    value={s}
                                  >
                                    {s}
                                  </option>
                                )
                              )}
                            </select>
                          ) : (
                            <input
                              value={line.size}
                              onChange={(e) =>
                                updateLine(
                                  line._tempId,
                                  'size',
                                  e.target.value
                                )
                              }
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
                            onChange={(e) =>
                              updateLine(
                                line._tempId,
                                'quantity',
                                e.target.value
                              )
                            }
                            className="border border-[#e5e5e5] rounded px-2 py-1 text-[13px] w-20 focus:outline-none"
                          />
                        </Td>

                        <Td>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              removeLine(
                                line._tempId
                              )
                            }
                          >
                            Remove
                          </Button>
                        </Td>

                      </Tr>
                    ))}

                  </Tbody>

                </Table>
              )}

            </Section>
          </Card>

          {/* ADDITIONAL COSTS */}

          <Card className="p-6">
            <Section
              title="Additional Costs"
              actions={
                <Button size="sm" onClick={addAdditionalCost}>
                  + Add Cost
                </Button>
              }
            >

              {additionalCosts.length === 0 ? (
                <p className="text-[13px] text-[#737373] py-4">
                  No additional costs. Click &quot;+ Add Cost&quot; to add
                  customs, pattern costs, or other charges.
                </p>
              ) : (
                <div className="space-y-4">
                  {additionalCosts.map((cost, i) => (
                    <div key={cost._tempId} className="flex items-end gap-3">
                      <div
                        className="grid gap-3 items-end flex-1 min-w-0"
                        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))' }}
                      >

                        <Select
                          label="Cost Type *"
                          value={cost.cost_type}
                          onChange={(e) =>
                            updateAdditionalCost(
                              cost._tempId,
                              'cost_type',
                              e.target.value
                            )
                          }
                          error={errors[`additional_cost_${i}_type`]}
                        >
                          <option value="">Select type</option>
                          <option value="customs">Customs</option>
                          <option value="pattern_cost">Pattern Cost</option>
                          <option value="other">Other</option>
                        </Select>

                        <Input
                          label="Amount *"
                          type="number"
                          min="0"
                          step="0.01"
                          value={cost.amount}
                          onChange={(e) =>
                            updateAdditionalCost(
                              cost._tempId,
                              'amount',
                              e.target.value
                            )
                          }
                          error={errors[`additional_cost_${i}_amount`]}
                        />

                        {currencies.length === 0 ? (
                          <Input
                            label="Currency *"
                            value={cost.currency}
                            onChange={(e) =>
                              updateAdditionalCost(
                                cost._tempId,
                                'currency',
                                e.target.value
                              )
                            }
                            error={errors[`additional_cost_${i}_currency`]}
                          />
                        ) : (
                          <Select
                            label="Currency *"
                            value={cost.currency}
                            onChange={(e) =>
                              updateAdditionalCost(
                                cost._tempId,
                                'currency',
                                e.target.value
                              )
                            }
                            error={errors[`additional_cost_${i}_currency`]}
                          >
                            {currencies.map((c) => (
                              <option key={c.quote} value={c.quote}>
                                {c.quote}
                              </option>
                            ))}
                          </Select>
                        )}

                        <Input
                          label="Description (optional)"
                          value={cost.description}
                          onChange={(e) =>
                            updateAdditionalCost(
                              cost._tempId,
                              'description',
                              e.target.value
                            )
                          }
                        />

                      </div>

                      <div className="pb-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            removeAdditionalCost(cost._tempId)
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </Section>
          </Card>

          {/* ORDER SUMMARY */}

          <Card className="p-6">
            <Section title="Order Summary">
              <div className="space-y-2 text-[13px]">

                <div className="flex justify-between">
                  <span className="text-[#525252]">Order Lines Total</span>
                  <span>
                    {formatCurrency(
                      roundForDisplay(orderLinesTotal),
                      form.order_currency || 'EUR'
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#525252]">Shipping</span>
                  <span>
                    {formatCurrency(
                      shippingTotal,
                      form.order_currency || 'EUR'
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#525252]">Additional Costs</span>
                  <span>
                    {formatCurrency(
                      roundForDisplay(additionalCostsTotal),
                      form.order_currency || 'EUR'
                    )}
                  </span>
                </div>

                <div className="border-t border-[#e5e5e5] pt-2 flex justify-between font-semibold">
                  <span>Order Total</span>
                  <span>
                    {formatCurrency(orderTotal, form.order_currency || 'EUR')}
                  </span>
                </div>

              </div>
              {lines.some((l) => l.product?.selling_price == null) && (
                <p className="text-[11px] text-[#737373] mt-3">
                  * Some products have no selling price set — their value is
                  excluded from the Order Lines Total.
                </p>
              )}
            </Section>
          </Card>

        </div>

        {/* =========================
            RIGHT
        ========================= */}

        <div>

          <Card className="p-5 sticky top-4">

            <p className="text-[13px] font-semibold mb-3">
              Add Products
            </p>

            <Input
              placeholder="Search products..."
              value={productSearch}
              onChange={(e) =>
                setProductSearch(
                  e.target.value
                )
              }
              className="mb-3"
            />

            <div className="space-y-1 max-h-96 overflow-y-auto">

              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() =>
                    addLine(p)
                  }
                  className="flex items-center justify-between px-3 py-2 rounded hover:bg-[#f5f5f5] cursor-pointer"
                >

                  <div>
                    <p className="text-[13px] font-medium">
                      {p.name}
                    </p>

                    <p className="text-[11px] text-[#737373]">
                      {p.style_code}
                    </p>
                  </div>

                  <span className="text-[12px] text-[#737373]">
                    +
                  </span>

                </div>
              ))}

            </div>

          </Card>

        </div>

      </div>
    </div>
  );
}
