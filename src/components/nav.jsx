'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, logout } from '@/lib/auth';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/products', label: 'Products' },
  { href: '/materials', label: 'Materials' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/orders', label: 'Orders' },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  function isActive(href) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-56 bg-white border-r border-[#e5e5e5] flex flex-col z-40">
      <div className="px-6 py-6 border-b border-[#e5e5e5]">
        <p className="text-[13px] font-bold tracking-[0.15em] uppercase">PLACEBO</p>
        <p className="text-[11px] text-[#737373] tracking-wider mt-0.5">PLM System</p>
      </div>

      <nav className="flex-1 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2 rounded text-[13px] font-medium mb-1 transition-colors ${
              isActive(item.href)
                ? 'bg-[#0a0a0a] text-white'
                : 'text-[#525252] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-[#e5e5e5] space-y-2">
        {user && (
          <p className="text-[11px] text-[#737373] px-2 truncate">{user.username}</p>
        )}
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-1.5 rounded text-[12px] text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
