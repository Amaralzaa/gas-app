'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { addToCart } from '@/lib/cart';

type Product = { sku: string; name: string; price_cents: number };

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('products').select('sku,name,price_cents')
        .eq('enabled', true).order('sku');
      if (!error && data) setProducts(data as Product[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <main><h1>Catálogo</h1><p>Carregando…</p></main>;

  return (
    <main>
      <h1>Catálogo</h1>
      <a href="/cart">Ir para o carrinho</a>
      <ul style={{ listStyle:'none', padding:0 }}>
        {products.map((p) => (
          <li key={p.sku} style={{ background:'#fff', padding:12, margin:'12px 0', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:16, fontWeight:600 }}>{p.name}</div>
              <div>R$ {(p.price_cents/100).toFixed(2)}</div>
            </div>
            <button onClick={() => { addToCart(p, 1); alert('Adicionado ao carrinho.'); }}>
              Adicionar
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
