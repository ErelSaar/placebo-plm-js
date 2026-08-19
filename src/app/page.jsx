'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader, StatCard, Card, StatusBadge, formatDate } from '@/components/ui';
import { productRepository } from '@/lib/data/backend-products';
import { materialRepository } from '@/lib/data/backend-materials';
import { supplierRepository } from '@/lib/data/backend-suppliers';
import { bomLineRepository } from '@/lib/data/backend-bom_lines';
import { orderRepository, orderLineRepository } from '@/lib/data/backend-orders';
import { getApproachingOrders } from '@/lib/calculations';
import { initializePermission } from '@/lib/permissions';

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [products, materials, suppliers, orders, orderLines, bomLines] = await Promise.all([
          productRepository.getAll(),
          materialRepository.getAll(),
          supplierRepository.getAll(),
          orderRepository.getAll(),
          orderLineRepository.getAll(),
          bomLineRepository.getAll(),
        ]);

        // Exclude soft-deleted records (backend does not filter spam automatically)
        const liveProducts = products.filter((p) => !p.spam);
        const liveOrders = orders.filter((o) => !o.spam);
        const liveMaterials = materials.filter((m) => !m.spam);
        const liveSuppliers = suppliers.filter((s) => !s.spam);

        // Active Products: status === 'active', not spam
        const activeProducts = liveProducts.filter((p) => p.status === 'active');

        // Active Orders: only confirmed or in_progress, not spam
        const activeOrders = liveOrders.filter(
          (o) => o.status === 'confirmed' || o.status === 'in_progress'
        );

        // Total Units: sum quantities from lines belonging to active orders only
        const activeOrderIds = new Set(activeOrders.map((o) => o.id));
        const totalUnits = orderLines
          .filter((l) => activeOrderIds.has(l.order_id))
          .reduce((acc, l) => acc + Number(l.quantity || 0), 0);

        // Approaching Deadlines: non-completed/cancelled, non-spam, within 60 days
        const approaching = getApproachingOrders(liveOrders, 60);

        // Products Missing BOM data (active, non-spam products only)
        const missingBOM = activeProducts.filter((p) => {
          const bom = bomLines.filter((b) => b.product_id === p.id);
          return bom.length === 0;
        });

        // Recent Orders: latest 5 non-spam orders by created_at
        const recentOrders = [...liveOrders]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);

        setData({
          stats: {
            activeProducts: activeProducts.length,
            activeOrders: activeOrders.length,
            totalUnits,
            materials: liveMaterials.filter((m) => m.status === 'active').length,
            suppliers: liveSuppliers.filter((s) => s.status === 'active').length,
          },
          recentOrders,
          approaching,
          missingBOM,
          orderLines,
        });
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      }
    }

    load();
  }, []);

  if (!data) return null;
  initializePermission();

  const { stats, recentOrders, approaching, missingBOM, orderLines } = data;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="PLACEBO PLM — AW 26/27" />

      <div className="px-8 py-6 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="Active Products" value={stats.activeProducts} />
          <StatCard label="Active Orders" value={stats.activeOrders} />
          <StatCard label="Total Units" value={stats.totalUnits} />
          <StatCard label="Materials" value={stats.materials} />
          <StatCard label="Suppliers" value={stats.suppliers} />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Recent Orders */}
          <Card>
            <div className="px-5 py-4 border-b border-[#e5e5e5] flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider">Recent Orders</h2>
              <Link href="/orders" className="text-[12px] text-[#737373] hover:text-[#0a0a0a]">
                View all →
              </Link>
            </div>
            <div>
              {recentOrders.length === 0 ? (
                <p className="px-5 py-8 text-[13px] text-[#737373] text-center">No orders yet</p>
              ) : (
                recentOrders.map((order) => {
                  const lines = orderLines.filter((l) => l.order_id === order.id);
                  const units = lines.reduce((acc, l) => acc + l.quantity, 0);
                  return (
                    <Link
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="flex items-center justify-between px-5 py-3 border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors last:border-0"
                    >
                      <div>
                        <p className="text-[13px] font-medium">{order.order_number}</p>
                        <p className="text-[12px] text-[#737373]">{order.name}</p>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p className="text-[12px] text-[#737373]">{units} units</p>
                          <p className="text-[11px] text-[#a3a3a3]">{formatDate(order.order_date)}</p>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </Card>

          {/* Right column */}
          <div className="space-y-6">
            {/* Approaching Deadlines */}
            <Card>
              <div className="px-5 py-4 border-b border-[#e5e5e5]">
                <h2 className="text-[13px] font-semibold uppercase tracking-wider">Approaching Deadlines</h2>
                <p className="text-[12px] text-[#737373] mt-0.5">Active orders within 60 days</p>
              </div>
              <div>
                {approaching.length === 0 ? (
                  <p className="px-5 py-6 text-[13px] text-[#737373] text-center">No approaching deadlines</p>
                ) : (
                  approaching.map((order) => {
                    const target = new Date(order.target_date);
                    const days = Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24));
                    return (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="flex items-center justify-between px-5 py-3 border-b border-[#f0f0f0] hover:bg-[#fafafa] last:border-0"
                      >
                        <div>
                          <p className="text-[13px] font-medium">{order.order_number}</p>
                          <p className="text-[12px] text-[#737373]">{formatDate(order.target_date)}</p>
                        </div>
                        <span className={`text-[12px] font-medium ${days <= 14 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-[#737373]'}`}>
                          {days}d
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Products Missing BOM */}
            {missingBOM.length > 0 && (
              <Card>
                <div className="px-5 py-4 border-b border-[#e5e5e5]">
                  <h2 className="text-[13px] font-semibold uppercase tracking-wider">Products Missing BOM</h2>
                  <p className="text-[12px] text-[#737373] mt-0.5">No materials defined</p>
                </div>
                <div>
                  {missingBOM.map((p) => (
                    <Link
                      key={p.id}
                      href={`/products/${p.id}`}
                      className="flex items-center justify-between px-5 py-3 border-b border-[#f0f0f0] hover:bg-[#fafafa] last:border-0"
                    >
                      <div>
                        <p className="text-[13px] font-medium">{p.name}</p>
                        <p className="text-[12px] text-[#737373]">{p.style_code}</p>
                      </div>
                      <span className="text-[12px] text-amber-600">No BOM</span>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
