'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PageHeader,
  Table,
  Thead,
  Tbody,
  Th,
  Td,
  Tr,
  EmptyState,
  Input,
  Select,
  Badge,
} from '@/components/ui';
import { initializePermission, getPermission } from '@/lib/permissions';
import { auditRepository } from '@/lib/data/backend-audit';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'material created', label: 'Material Created' },
  { value: 'material edited', label: 'Material Edited' },
  { value: 'material deleted', label: 'Material Deleted' },
  { value: 'product created', label: 'Product Created' },
  { value: 'product edited', label: 'Product Edited' },
  { value: 'product deleted', label: 'Product Deleted' },
  { value: 'order created', label: 'Order Created' },
  { value: 'order updated', label: 'Order Updated' },
  { value: 'user role changed', label: 'User Role Changed' },
  { value: 'restore', label: 'Record Restored' },
  { value: 'HARD_delete', label: 'Permanently Deleted' },
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
  create: 'success',
  update: 'warning',
  delete: 'danger',
  restore: 'safety',
  HARD_delete: 'danger',
};

function formatActionLabel(action, entityType) {
  const normalizedAction = action?.toLowerCase();
  const normalizedEntity = entityType?.toLowerCase();

  if (normalizedAction === 'create') {
    return `${normalizedEntity} created`;
  }

  if (normalizedAction === 'delete') {
    return `${normalizedEntity} deleted`;
  }

  if (normalizedAction === 'update') {
    if (normalizedEntity === 'order') {
      return 'order updated';
    }

    if (normalizedEntity === 'user') {
      return 'user role changed';
    }

    return `${normalizedEntity} edited`;
  }

  if (normalizedAction === 'restore') {
    return `${normalizedEntity} restored`;
  }

  if (normalizedAction === 'hard_delete') {
    return 'Permanently Deleted';
  }

  return action || '—';
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
    }
  }, [router]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        const filters = {
          search,
          user: userFilter,
          action: actionFilter,
          entity_type: entityTypeFilter,

          dateFrom: dateFrom
            ? `${dateFrom}T00:00:00`
            : '',

          dateTo: dateTo
            ? `${dateTo}T23:59:59.999999`
            : '',
        };

        const result = await auditRepository.getAll(filters);

        setLogs(result || []);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
        setLogs([]);
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [
    search,
    userFilter,
    actionFilter,
    entityTypeFilter,
    dateFrom,
    dateTo,
  ]);

  const permission = getPermission();

  if (permission < 3) {
    return null;
  }

  const hasFilters =
    search ||
    userFilter ||
    actionFilter ||
    entityTypeFilter ||
    dateFrom ||
    dateTo;

  function clearFilters() {
    setSearch('');
    setUserFilter('');
    setActionFilter('');
    setEntityTypeFilter('');
    setDateFrom('');
    setDateTo('');
  }

  const userOptions = [
    ...new Map(
      logs
        .filter((entry) => entry.user_id)
        .map((entry) => [
          entry.user_id,
          {
            id: entry.user_id,
            name: entry.name || entry.username || entry.user_id,
          },
        ])
    ).values(),
  ];

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

            {userOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>

          <Select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-44"
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>

          <Select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="w-36"
          >
            {ENTITY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
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
        {logs.length === 0 ? (
          <EmptyState
            title="No activity recorded yet"
            description="No audit log entries match the current filters."
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
              </tr>
            </Thead>

            <Tbody>
              {logs.map((entry, i) => (
                <Tr key={entry.id ?? i}>
                  <Td className="whitespace-nowrap text-[#737373]">
                    {formatDateTime(entry.created_at)}
                  </Td>

                  <Td className="font-medium">
                    {entry.name || entry.username || '—'}
                  </Td>

                  <Td>
                    <Badge variant="muted">
                      {entry.role || '—'}
                    </Badge>
                  </Td>

                  <Td>
                    <Badge
                      variant={
                        ACTION_BADGE_VARIANT[entry.action] ?? 'muted'
                      }
                    >
                      {formatActionLabel(
                        entry.action,
                        entry.entity_type
                      )}
                    </Badge>
                  </Td>

                  <Td>
                    {entry.entity_type || '—'}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}