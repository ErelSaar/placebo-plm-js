import './globals.css';
import { DemoInit } from '@/components/demo-init';
import { AuthGuard } from '@/components/auth-guard';
import { LayoutShell } from '@/components/layout-shell';

export const metadata = {
  title: 'PLACEBO PLM',
  description: 'Product Lifecycle Management for PLACEBO Design Lab',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>
          <DemoInit />
          <LayoutShell>{children}</LayoutShell>
        </AuthGuard>
      </body>
    </html>
  );
}
