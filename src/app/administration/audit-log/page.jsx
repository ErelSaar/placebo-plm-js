'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader, Table, Thead, Tbody, Th, Td, Tr,
  EmptyState, Input, Select, Badge,
} from '@/components/ui';
import { initializePermission, getPermission } from '@/lib/permissions';
import { getRegisteredUsers } from '@/lib/auth';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'material_created', label: 'Material Created' },
  { value: 'material_edited', label: 'Material Edited' },
  { value: 'material_deleted', label: 'Material Deleted' },
  { value: 'product_created', label: 'Product Created' },
  { value: 'product_edited', label: 'Product Edited' },
  { value: 'product_deleted', label: 'Product Deleted' },
  { value: 'order_created', label: 'Order Created' },
  { value: 'order_updated', label: 'Order Updated' },
  { value: 'user_role_changed', label: 'User Role Changed' },
];

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'Material', label: 'Material' },
  { value: 'Product', label: 'Product' },
  { value: 'Order', label: 'Order' },
  { value: 'User', label: 'User' },
  { value: 'Supplier', label: 'Supplier' },
];

const ACTION_BADGE_VARIANT = {
  material_created: 'success',
  material_edited: 'warning',
  material_deleted: 'danger',
  product_created: 'success',
  product_edited: 'warning',
  product_deleted: 'danger',
  order_created: 'success',
  order_updated: 'warning',
  user_role_changed: 'muted',
};

function formatActionLabel(action) {
  const match = ACTION_OPTIONS.find((o) => o.value === action);
  return match ? match.label : action;
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogPage() {
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    initializePermission();
    const permission = getPermission();
    if (permission < 3) {
      router.replace('/');
      return;
    }
    // Load registered users for the user filter dropdown
    setUsers(getRegisteredUsers());
    // TODO: Replace with real API call — e.g. setLogs(await fetchAuditLogs())
    setLogs([]);
  }, []);

  const permission = getPermission();
  if (permission < 3) return null;

  const filtered = logs.filter((entry) => {
    const matchSearch =
      !search ||
      (entry.user || '').toLowerCase().includes(search.toLowerCase()) ||
      (entry.entity || '').toLowerCase().includes(search.toLowerCase()) ||
      (entry.details || '').toLowerCase().includes(search.toLowerCase());

    const matchUser = !userFilter || entry.username === userFilter;
    const matchAction = !actionFilter || entry.action === actionFilter;
    const matchEntityType = !entityTypeFilter || entry.entityType === entityTypeFilter;

    const entryDate = entry.timestamp ? new Date(entry.timestamp) : null;
    const matchDateFrom = !dateFrom || (entryDate && entryDate >= new Date(dateFrom));
    const matchDateTo = !dateTo || (entryDate && entryDate <= new Date(dateTo + 'T23:59:59'));

    return matchSearch && matchUser && matchAction && matchEntityType && matchDateFrom && matchDateTo;
  });

  const hasFilters = search || userFilter || actionFilter || entityTypeFilter || dateFrom || dateTo;

  function clearFilters() {
    setSearch('');
    setUserFilter('');
    setActionFilter('');
    setEntityTypeFilter('');
    setDateFrom('');
    setDateTo('');
  }

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="History of important actions performed in the PLM"
      />

      <div className="px-8 py-6">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Input
            placeholder="Search user, record, or details…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-44"
          >
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.username}>
                {u.name || u.username}
              </option>
            ))}
          </Select>
          <Select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-44"
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="w-36"
          >
            {ENTITY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-[#e5e5e5] rounded px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] focus:border-[#0a0a0a]"
            title="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-[#e5e5e5] rounded px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] focus:border-[#0a0a0a]"
            title="To date"
          />
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-[13px] text-[#737373] hover:text-[#0a0a0a] px-2 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <EmptyState
            title="No activity recorded yet"
            description="Audit log entries will appear here once backend logging is connected."
          />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Date & Time</Th>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Action</Th>
                <Th>Entity Type</Th>
                <Th>Record</Th>
                <Th>Details</Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((entry, i) => (
                <Tr key={entry.id ?? i}>
                  <Td className="whitespace-nowrap text-[#737373]">
                    {formatDateTime(entry.timestamp)}
                  </Td>
                  <Td className="font-medium">{entry.user || '—'}</Td>
                  <Td>
                    <Badge variant="muted">{entry.userRole || '—'}</Badge>
                  </Td>
                  <Td>
                    <Badge variant={ACTION_BADGE_VARIANT[entry.action] ?? 'muted'}>
                      {formatActionLabel(entry.action)}
                    </Badge>
                  </Td>
                  <Td>{entry.entityType || '—'}</Td>
                  <Td>{entry.entity || '—'}</Td>
                  <Td className="text-[#737373] max-w-xs truncate">{entry.details || '—'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
