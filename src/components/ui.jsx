'use client';

import React from 'react';

// ─── Utility ──────────────────────────────────────────────────────────────────

export function formatCurrency(amount, currency = 'EUR') {
  if (amount == null || isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between px-8 pt-8 pb-6 border-b border-[#e5e5e5]">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-[#737373] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

const BUTTON_VARIANTS = {
  primary: 'bg-[#0a0a0a] text-white hover:bg-[#262626] active:bg-[#404040]',
  secondary: 'bg-white border border-[#e5e5e5] text-[#0a0a0a] hover:bg-[#f5f5f5] active:bg-[#e5e5e5]',
  ghost: 'text-[#525252] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]',
  danger: 'bg-white border border-[#e5e5e5] text-red-600 hover:bg-red-50',
};

const BUTTON_SIZES = {
  sm: 'text-[12px] px-2.5 py-1.5',
  md: 'text-[13px] px-3.5 py-2',
};

export function Button({ variant = 'secondary', size = 'md', loading, disabled, className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium tracking-tight transition-colors rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? (<><Spinner size="sm" />{children}</>) : children}
    </button>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

const BADGE_VARIANTS = {
  default: 'bg-[#0a0a0a] text-white',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-red-50 text-red-700 border border-red-200',
  muted: 'bg-[#f5f5f5] text-[#737373]',
};

export function Badge({ variant = 'default', children }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${BADGE_VARIANTS[variant]}`}>
      {children}
    </span>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

const STATUS_VARIANT_MAP = {
  active: 'success',
  archived: 'muted',
  draft: 'muted',
  confirmed: 'default',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

const STATUS_LABEL_MAP = {
  active: 'Active',
  archived: 'Archived',
  draft: 'Draft',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }) {
  return (
    <Badge variant={STATUS_VARIANT_MAP[status] ?? 'muted'}>
      {STATUS_LABEL_MAP[status] ?? status}
    </Badge>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-[#e5e5e5] rounded-lg ${className}`}>
      {children}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

export function StatCard({ label, value, sub }) {
  return (
    <Card className="p-5">
      <p className="text-[12px] text-[#737373] uppercase tracking-wider font-medium">{label}</p>
      <p className="text-[28px] font-semibold tracking-tight mt-1">{value}</p>
      {sub && <p className="text-[12px] text-[#737373] mt-1">{sub}</p>}
    </Card>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

export function Table({ children, className = '' }) {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full text-[13px]">{children}</table>
    </div>
  );
}

export function Thead({ children }) {
  return <thead className="border-b border-[#e5e5e5]">{children}</thead>;
}

export function Tbody({ children }) {
  return <tbody>{children}</tbody>;
}

export function Th({ children, className = '' }) {
  return (
    <th className={`text-left text-[11px] font-medium text-[#737373] uppercase tracking-wider px-4 py-3 ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }) {
  return (
    <td className={`px-4 py-3 text-[13px] border-b border-[#f0f0f0] ${className}`}>
      {children}
    </td>
  );
}

export function Tr({ children, onClick, className = '' }) {
  const clickable = onClick ? 'cursor-pointer hover:bg-[#fafafa]' : '';
  return (
    <tr onClick={onClick} className={`${clickable} ${className}`}>
      {children}
    </tr>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-[15px] font-medium text-[#0a0a0a]">{title}</p>
      {description && <p className="text-[13px] text-[#737373] mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-[12px] font-medium text-[#525252]">{label}</label>}
      <input
        className="border border-[#e5e5e5] rounded px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] focus:border-[#0a0a0a] disabled:bg-[#f5f5f5] disabled:text-[#737373]"
        {...props}
      />
      {error && <p className="text-[12px] text-red-600">{error}</p>}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-[12px] font-medium text-[#525252]">{label}</label>}
      <textarea
        rows={3}
        className="border border-[#e5e5e5] rounded px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] focus:border-[#0a0a0a] resize-y"
        {...props}
      />
      {error && <p className="text-[12px] text-red-600">{error}</p>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-[12px] font-medium text-[#525252]">{label}</label>}
      <select
        className="border border-[#e5e5e5] rounded px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] focus:border-[#0a0a0a] disabled:bg-[#f5f5f5]"
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 'md' }) {
  const s = size === 'sm' ? 'w-3 h-3' : 'w-5 h-5';
  return (
    <svg className={`${s} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Warning ──────────────────────────────────────────────────────────────────

export function Warning({ children }) {
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded px-3 py-2 text-[12px]">
      {children}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function Section({ title, actions, children, className = '' }) {
  return (
    <div className={className}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-[13px] font-semibold text-[#0a0a0a] uppercase tracking-wider">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex border-b border-[#e5e5e5]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-5 py-3 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
            active === tab.id
              ? 'border-[#0a0a0a] text-[#0a0a0a]'
              : 'border-transparent text-[#737373] hover:text-[#0a0a0a]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const MODAL_SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, size = 'md', children, footer }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className={`relative bg-white rounded-lg shadow-xl w-full mx-4 ${MODAL_SIZES[size]} max-h-[90vh] flex flex-col`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5e5] shrink-0">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <button onClick={onClose} className="text-[#737373] hover:text-[#0a0a0a] text-xl leading-none">×</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#e5e5e5] shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
