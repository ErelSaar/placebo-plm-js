'use client';

import { usePathname } from 'next/navigation';
import { Nav } from '@/components/nav';

export function LayoutShell({ children }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Nav />
      <main className="ml-56 min-h-screen bg-[#fafafa]">{children}</main>
    </>
  );
}
