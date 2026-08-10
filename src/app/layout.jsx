import './globals.css';
import { Nav } from '@/components/nav';
import { DemoInit } from '@/components/demo-init';

export const metadata = {
  title: 'PLACEBO PLM',
  description: 'Product Lifecycle Management for PLACEBO Design Lab',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <DemoInit />
        <Nav />
        <main className="ml-56 min-h-screen bg-[#fafafa]">{children}</main>
      </body>
    </html>
  );
}
