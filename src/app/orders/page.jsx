'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, StatusBadge, Table, Thead, Tbody, Th, Td, Tr,
  EmptyState, Input, Select, formatDate,
} from '@/components/ui';
import { orderRepository, orderLineRepository } from '@/lib/data/orders';
import { initializePermission, getPermission } from "../../lib/permissions";

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [orderLines, setOrderLines] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const all = orderRepository.getAll().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setOrders(all);
    setOrderLines(orderLineRepository.getAll());
    initializePermission();
  }, []);

  const permission = getPermission('orders');

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      o.order_number.toLowerCase().includes(q) ||
      o.order_name.toLowerCase().includes(q);
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <PageHeader
    title="Orders"
    subtitle={`${filtered.length} order${filtered.length !== 1 ? 's' : ''}`}
    actions={
        <Button
            variant="primary"
            onClick={() => router.push('/orders/new')}
            disabled={permission === 0}
            className="
                disabled:cursor-not-allowed
                disabled:bg-[#f5f5f5]
                disabled:text-[#737373]
                disabled:opacity-40
            "
        >
            + New Order
        </Button>
    }
/>

      <div className="px-8 py-6">
        <div className="flex gap-3 mb-6">
          <Input
            placeholder="Search by order number or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No orders found" description="Create your first production order." action={<Button variant="primary" onClick={() => router.push('/orders/new')}>+ New Order</Button>} />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Order Number</Th>
                <Th>Name</Th>
                <Th>Season</Th>
                <Th>Products</Th>
                <Th>Units</Th>
                <Th>Order Date</Th>
                <Th>Target Date</Th>
                <Th>Status</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((o) => {
                const lines = orderLines.filter((l) => l.order_id === o.id);
                const productCount = new Set(lines.map((l) => l.product_id)).size;
                const totalUnits = lines.reduce((acc, l) => acc + l.quantity, 0);
                return (
                  <Tr key={o.id} onClick={() => router.push(`/orders/${o.id}`)}>
                    <Td className="font-medium">{o.order_number}</Td>
                    <Td>{o.order_name}</Td>
                    <Td>{o.season || '—'}</Td>
                    <Td>{productCount}</Td>
                    <Td>{totalUnits}</Td>
                    <Td>{formatDate(o.order_date)}</Td>
                    <Td>{formatDate(o.target_date)}</Td>
                    <Td><StatusBadge status={o.status} /></Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
