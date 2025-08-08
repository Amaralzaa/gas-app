// src/app/(app)/layout.tsx
import UserMenu from '@/components/UserMenu';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0' }}>
        <strong>Porto Gás</strong>
      <nav style={{ display:'flex', gap:12, alignItems:'center' }}>
        <a href="/orders">Pedidos</a>
        <a href="/catalog">Catálogo</a>
        <a href="/cart">Carrinho</a>
        <UserMenu />
      </nav>

      </header>
      <hr />
      {children}
    </div>
  );
}
