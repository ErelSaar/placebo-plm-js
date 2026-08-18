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
  Modal,
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

// ─── Snapshot helpers ─────────────────────────────────────────────────────────

function toLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toDisplayValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value
      .map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)))
      .join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Fields that are typically internal / low-value noise
const SKIP_FIELDS = new Set(['spam', 'created_at', 'updated_at']);

function getEntityName(log) {
  const candidates = [log.after, log.before].filter(Boolean);
  for (const obj of candidates) {
    const name =
      obj.name ||
      obj.order_name ||
      obj.username ||
      obj.email ||
      null;
    if (name) return name;
  }
  return null;
}

// ─── Snapshot modal ───────────────────────────────────────────────────────────

function SnapshotModal({ open, onClose, title, before, after }) {
  if (!open) return null;

  const isUpdate = before && after;
  const obj = after || before || {};
  const keys = Object.keys(obj).filter((k) => !SKIP_FIELDS.has(k));

  // For updates, collect all keys from both objects
  const allKeys = isUpdate
    ? [...new Set([...Object.keys(before), ...Object.keys(after)]).values()].filter(
        (k) => !SKIP_FIELDS.has(k)
      )
    : keys;

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[#e5e5e5]">
            <th className="text-left py-2 pr-4 font-medium text-[#737373] w-2/5">Field</th>
            {isUpdate ? (
              <>
                <th className="text-left py-2 pr-4 font-medium text-[#737373]">Before</th>
                <th className="text-left py-2 font-medium text-[#737373]">After</th>
              </>
            ) : (
              <th className="text-left py-2 font-medium text-[#737373]">Value</th>
            )}
          </tr>
        </thead>
        <tbody>
          {allKeys.map((key) => {
            const beforeVal = isUpdate ? before[key] : undefined;
            const afterVal = isUpdate ? after[key] : obj[key];
            const changed =
              isUpdate && JSON.stringify(beforeVal) !== JSON.stringify(afterVal);

            return (
              <tr
                key={key}
                className={`border-b border-[#f0f0f0] ${changed ? 'bg-amber-50' : ''}`}
              >
                <td className="py-2 pr-4 text-[#737373] font-medium">{toLabel(key)}</td>
                {isUpdate ? (
                  <>
                    <td className={`py-2 pr-4 ${changed ? 'text-red-600 line-through' : ''}`}>
                      {toDisplayValue(beforeVal)}
                    </td>
                    <td className={`py-2 ${changed ? 'text-green-700 font-medium' : ''}`}>
                      {toDisplayValue(afterVal)}
                    </td>
                  </>
                ) : (
                  <td className="py-2">{toDisplayValue(afterVal)}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Modal>
  );
}

// ─── Snapshot trigger button ──────────────────────────────────────────────────

function ViewButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 text-[12px] border border-[#e5e5e5] rounded hover:bg-[#f5f5f5] text-[#737373] hover:text-[#0a0a0a] transition-colors"
    >
      View
    </button>
  );
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
  const [snapshotModal, setSnapshotModal] = useState(null); // { title, before, after }

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
                <Th>Entity / Record</Th>
                <Th>Before</Th>
                <Th>After</Th>
              </tr>
            </Thead>

            <Tbody>
              {logs.map((entry, i) => {
                const entityName = getEntityName(entry);
                const hasBefore = !!entry.before;
                const hasAfter = !!entry.after;
                const isUpdate = entry.action?.toLowerCase() === 'update';

                return (
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

                    <Td className="text-[#737373]">
                      {entityName || <span className="text-[#b0b0b0] text-[12px]">{entry.entity_id || '—'}</span>}
                    </Td>

                    <Td>
                      {hasBefore ? (
                        <ViewButton
                          onClick={() =>
                            setSnapshotModal({
                              title: isUpdate
                                ? `${entry.entity_type || 'Record'} — Changes`
                                : `${entry.entity_type || 'Record'} — Before`,
                              before: entry.before,
                              after: isUpdate ? entry.after : null,
                            })
                          }
                        />
                      ) : (
                        <span className="text-[#b0b0b0]">—</span>
                      )}
                    </Td>

                    <Td>
                      {hasAfter && !isUpdate ? (
                        <ViewButton
                          onClick={() =>
                            setSnapshotModal({
                              title: `${entry.entity_type || 'Record'} — After`,
                              before: null,
                              after: entry.after,
                            })
                          }
                        />
                      ) : isUpdate ? (
                        <span className="text-[12px] text-[#b0b0b0] italic">see Before</span>
                      ) : (
                        <span className="text-[#b0b0b0]">—</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>

      <SnapshotModal
        open={!!snapshotModal}
        onClose={() => setSnapshotModal(null)}
        title={snapshotModal?.title || ''}
        before={snapshotModal?.before || null}
        after={snapshotModal?.after || null}
      />
    </div>
  );
}