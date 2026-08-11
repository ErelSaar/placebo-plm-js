'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader, StatCard, Card, StatusBadge, formatDate } from '@/components/ui';
import { productRepository } from '@/lib/data/products';
import { materialRepository } from '@/lib/data/materials';
import { supplierRepository } from '@/lib/data/suppliers';
import { bomRepository } from '@/lib/data/bom';
import { orderRepository, orderLineRepository } from '@/lib/data/orders';
import { getApproachingOrders } from '@/lib/calculations';
import { initializePermission } from '@/lib/permissions';

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const products = productRepository.getAll();
    const materials = materialRepository.getAll();
    const suppliers = supplierRepository.getAll();
    const orders = orderRepository.getAll();
    const orderLines = orderLineRepository.getAll();
    const bomLines = bomRepository.getAll();

    const activeProducts = products.filter((p) => p.status === 'active');
    const activeOrders = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
    const totalUnits = orderLines.reduce((acc, l) => acc + l.quantity, 0);
    const approaching = getApproachingOrders(orders, 60);

    // Products missing BOM data
    const missingBOM = activeProducts.filter((p) => {
      const bom = bomLines.filter((b) => b.product_id === p.id);
      return bom.length === 0;
    });

    // Recent orders sorted by created_at desc
    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    setData({
      stats: {
        activeProducts: activeProducts.length,
        activeOrders: activeOrders.length,
        totalUnits,
        materials: materials.filter((m) => m.status === 'active').length,
        suppliers: suppliers.filter((s) => s.status === 'active').length,
      },
      recentOrders,
      approaching,
      missingBOM,
      orderLines,
    });
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
                        <p className="text-[12px] text-[#737373]">{order.order_name}</p>
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
