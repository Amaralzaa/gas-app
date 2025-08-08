// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Porto Gás', description: 'Entrega de gás' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily:'system-ui, Arial, sans-serif', background:'#f7f7f7' }}>
        {children}
      </body>
    </html>
  );
}
