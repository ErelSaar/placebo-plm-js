'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Button, Table, Thead, Tbody, Th, Td, Tr,
  EmptyState, Modal,
} from '@/components/ui';
import { initializePermission, getPermission } from '@/lib/permissions';
import { supplierRepository } from '@/lib/data/suppliers';
import { materialRepository } from '@/lib/data/materials';
import { productRepository } from '@/lib/data/products';
import { orderRepository, orderLineRepository } from '@/lib/data/orders';
import { bomRepository } from '@/lib/data/bom';
import { recordRepository } from '@/lib/data/action-record';
import { getItems } from '@/lib/data/storage';
import { STORAGE_KEYS } from '@/lib/constants';

const TABS = ['Suppliers', 'Materials', 'Products', 'Orders'];

export default function SpamPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Suppliers');
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [confirmHardDelete, setConfirmHardDelete] = useState(null); // { id, name, type }
  const currentUser = getItems(STORAGE_KEYS.logged_user);

  useEffect(() => {
    initializePermission();
    const permission = getPermission();
    if (permission < 4) {
      router.replace('/');
      return;
    }
    loadAll();
  }, []);

  const permission = getPermission();
  if (permission < 4) return null;

  function loadAll() {
    setSuppliers(supplierRepository.getSpam());
    setMaterials(materialRepository.getSpam());
    setProducts(productRepository.getSpam());
    setOrders(orderRepository.getSpam());
  }

  function handleRestore(type, id, name) {
    if (type === 'Supplier') supplierRepository.restore(id);
    if (type === 'Material') materialRepository.restore(id);
    if (type === 'Product') productRepository.restore(id);
    if (type === 'Order') orderRepository.restore(id);

    recordRepository.create({
      user_id: currentUser?.id,
      action: 'restore',
      entity_type: type,
      entity_id: id,
      before: null,
      after: null,
    });

    loadAll();
  }

  function handleHardDelete() {
    if (!confirmHardDelete) return;
    // Guard: only owner may hard-delete (enforced here in addition to UI hiding)
    if (getPermission() < 4) return;

    const { id, type } = confirmHardDelete;

    if (type === 'Supplier') supplierRepository.hardDelete(id);
    if (type === 'Material') {
      // Also remove BOM lines that reference this material
      const allBOM = bomRepository.getAll();
      allBOM.filter((b) => b.material_id === id).forEach((b) => bomRepository.remove(b.id));
      materialRepository.hardDelete(id);
    }
    if (type === 'Product') {
      // Also remove BOM lines and order lines for this product
      bomRepository.removeByProduct(id);
      const allOrders = orderRepository.getAll();
      for (const order of allOrders) {
        const lines = orderLineRepository.getByOrder(order.id).filter((l) => l.product_id !== id);
        orderLineRepository.saveMany(order.id, lines);
      }
      productRepository.hardDelete(id);
    }
    if (type === 'Order') {
      // orderRepository.hardDelete also removes order lines
      orderRepository.hardDelete(id);
    }

    recordRepository.create({
      user_id: currentUser?.id,
      action: 'HARD_delete',
      entity_type: type,
      entity_id: id,
      before: null,
      after: null,
    });

    setConfirmHardDelete(null);
    loadAll();
  }

  const tabClass = (tab) =>
    `px-4 py-2 text-[13px] font-medium rounded transition-colors ${
      activeTab === tab
        ? 'bg-[#0a0a0a] text-white'
        : 'text-[#525252] hover:bg-[#f5f5f5]'
    }`;

  const rowClass = 'opacity-60';

  return (
    <div>
      <PageHeader
        title="Spam"
        subtitle="Soft-deleted records — visible only to Owner"
      />

      <div className="px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={tabClass(tab)}>
              {tab}
              {tab === 'Suppliers' && suppliers.length > 0 && (
                <span className="ml-1.5 text-[11px] opacity-70">({suppliers.length})</span>
              )}
              {tab === 'Materials' && materials.length > 0 && (
                <span className="ml-1.5 text-[11px] opacity-70">({materials.length})</span>
              )}
              {tab === 'Products' && products.length > 0 && (
                <span className="ml-1.5 text-[11px] opacity-70">({products.length})</span>
              )}
              {tab === 'Orders' && orders.length > 0 && (
                <span className="ml-1.5 text-[11px] opacity-70">({orders.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Suppliers */}
        {activeTab === 'Suppliers' && (
          suppliers.length === 0 ? (
            <EmptyState title="No deleted suppliers" description="Deleted suppliers will appear here." />
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>Supplier</Th>
                  <Th>Country</Th>
                  <Th>Currency</Th>
                  <Th>Deleted</Th>
                  <Th></Th>
                </tr>
              </Thead>
              <Tbody>
                {suppliers.map((s) => (
                  <Tr key={s.id} className={rowClass}>
                    <Td className="font-medium line-through text-[#a3a3a3]">{s.name}</Td>
                    <Td>{s.country || '—'}</Td>
                    <Td>{s.currency}</Td>
                    <Td className="text-[#737373]">{s.updated_at ? new Date(s.updated_at).toLocaleDateString('en-GB') : '—'}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleRestore('Supplier', s.id, s.name)}>Restore</Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirmHardDelete({ id: s.id, name: s.name, type: 'Supplier' })}>
                          Delete Permanently
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )
        )}

        {/* Materials */}
        {activeTab === 'Materials' && (
          materials.length === 0 ? (
            <EmptyState title="No deleted materials" description="Deleted materials will appear here." />
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>Material</Th>
                  <Th>Category</Th>
                  <Th>Deleted</Th>
                  <Th></Th>
                </tr>
              </Thead>
              <Tbody>
                {materials.map((m) => (
                  <Tr key={m.id} className={rowClass}>
                    <Td className="font-medium line-through text-[#a3a3a3]">{m.name}</Td>
                    <Td>{m.category}</Td>
                    <Td className="text-[#737373]">{m.updated_at ? new Date(m.updated_at).toLocaleDateString('en-GB') : '—'}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleRestore('Material', m.id, m.name)}>Restore</Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirmHardDelete({ id: m.id, name: m.name, type: 'Material' })}>
                          Delete Permanently
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )
        )}

        {/* Products */}
        {activeTab === 'Products' && (
          products.length === 0 ? (
            <EmptyState title="No deleted products" description="Deleted products will appear here." />
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Style Code</Th>
                  <Th>Season</Th>
                  <Th>Deleted</Th>
                  <Th></Th>
                </tr>
              </Thead>
              <Tbody>
                {products.map((p) => (
                  <Tr key={p.id} className={rowClass}>
                    <Td className="font-medium line-through text-[#a3a3a3]">{p.name}</Td>
                    <Td>{p.style_code}</Td>
                    <Td>{p.season || '—'}</Td>
                    <Td className="text-[#737373]">{p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-GB') : '—'}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleRestore('Product', p.id, p.name)}>Restore</Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirmHardDelete({ id: p.id, name: p.name, type: 'Product' })}>
                          Delete Permanently
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )
        )}

        {/* Orders */}
        {activeTab === 'Orders' && (
          orders.length === 0 ? (
            <EmptyState title="No deleted orders" description="Deleted orders will appear here." />
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>Order Number</Th>
                  <Th>Name</Th>
                  <Th>Season</Th>
                  <Th>Deleted</Th>
                  <Th></Th>
                </tr>
              </Thead>
              <Tbody>
                {orders.map((o) => (
                  <Tr key={o.id} className={rowClass}>
                    <Td className="font-medium line-through text-[#a3a3a3]">{o.order_number}</Td>
                    <Td>{o.order_name}</Td>
                    <Td>{o.season || '—'}</Td>
                    <Td className="text-[#737373]">{o.updated_at ? new Date(o.updated_at).toLocaleDateString('en-GB') : '—'}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleRestore('Order', o.id, o.order_number)}>Restore</Button>
                        <Button size="sm" variant="danger" onClick={() => setConfirmHardDelete({ id: o.id, name: o.order_number, type: 'Order' })}>
                          Delete Permanently
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )
        )}
      </div>

      {/* Hard Delete Confirmation Modal */}
      <Modal
        open={!!confirmHardDelete}
        onClose={() => setConfirmHardDelete(null)}
        title="Permanently Delete Record"
        size="sm"
        footer={
          <>
            <Button onClick={() => setConfirmHardDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleHardDelete}>Delete Permanently</Button>
          </>
        }
      >
        <p className="text-[13px]">
          Are you sure you want to permanently delete <strong>{confirmHardDelete?.name}</strong>?{' '}
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
