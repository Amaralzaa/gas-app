'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Period = 'morning'|'afternoon'|'night'|null;
type Pay = 'pix'|'cash'|'credit_card'|'debit_card'|null;

const PERIOD_LABEL: Record<Exclude<Period,null>, string> = {
  morning: 'Manhã (08:00–11:00)',
  afternoon: 'Tarde (14:00–17:00)',
  night: 'Noite (18:00–21:00)',
};
const PAY_LABEL: Record<Exclude<Pay,null>, string> = {
  pix: 'PIX na máquina',
  cash: 'Dinheiro',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
};

function fmtBRL(cents: number) { return (cents / 100).toFixed(2); }

type Order = {
  id: string;
  status: 'pending'|'confirmed'|'out_for_delivery'|'delivered'|'canceled';
  created_at: string;
  total_cents: number;
  discount_cents: number;
  delivery_type: 'regular'|'scheduled';
  scheduled_date: string | null;
  scheduled_period: Period;
  payment_method: Pay;
  address_id: string | null;
};

type Address = {
  id: string;
  label: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  state: string;
  cep: string;
} | null;

type Item = { quantity: number; unit_price_cents: number; products: { name: string; sku: string } | null };

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [address, setAddress] = useState<Address>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      setError(null);

      // 1) Pedido
      const { data: o, error: e1 } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (e1 || !o) {
        setError(e1?.message || 'Pedido não encontrado.');
        setLoading(false);
        return;
      }
      setOrder(o as Order);

      // 2) Endereço
      if (o.address_id) {
        const { data: a } = await supabase
          .from('addresses')
          .select('*')
          .eq('id', o.address_id)
          .single();
        setAddress((a as Address) ?? null);
      }

      // 3) Itens (com produto)
      const { data: its } = await supabase
        .from('order_items')
        .select('quantity, unit_price_cents, products(name, sku)')
        .eq('order_id', id);
      setItems((its as Item[]) ?? []);

      setLoading(false);
    })();
  }, [id]);

  if (loading) return <main style={{ padding:16 }}><p>Carregando pedido…</p></main>;
  if (error) return <main style={{ padding:16 }}><p style={{ color:'#c00' }}>{error}</p></main>;
  if (!order) return <main style={{ padding:16 }}><p>Pedido não encontrado.</p></main>;

  const subtotal = items.reduce((s, it) => s + it.unit_price_cents * it.quantity, 0);

  return (
    <main style={{ padding:16, display:'grid', gap:12 }}>
      <button onClick={()=>router.back()}>&larr; Voltar</button>
      <h1 style={{ margin:0 }}>Pedido {order.id.slice(0,8)}</h1>
      <div style={{ color:'#666' }}>{new Date(order.created_at).toLocaleString()}</div>

      {/* Status */}
      <section style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:12 }}>
        <strong>Status:</strong> {order.status}
      </section>

      {/* Entrega */}
      <section style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:12 }}>
        <strong>Entrega:</strong>{' '}
        {order.delivery_type === 'regular'
          ? 'Padrão (até 60 minutos)'
          : `Programada — ${order.scheduled_date ? new Date(order.scheduled_date).toLocaleDateString() : '?'} • ${
              order.scheduled_period ? PERIOD_LABEL[order.scheduled_period] : '?'
            }`}
      </section>

      {/* Pagamento */}
      <section style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:12 }}>
        <strong>Pagamento:</strong>{' '}
        {order.payment_method ? PAY_LABEL[order.payment_method] : '-'}
      </section>

      {/* Endereço */}
      {address && (
        <section style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:12 }}>
          <strong>Endereço de entrega</strong>
          <div>{address.label || 'Sem apelido'}</div>
          <div>{address.street}, {address.number || 's/n'} {address.complement ? `- ${address.complement}` : ''}</div>
          <div>{address.district ? `${address.district} — ` : ''}{address.city}/{address.state} • CEP {address.cep}</div>
        </section>
      )}

      {/* Itens */}
      <section style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:12 }}>
        <strong>Itens</strong>
        <ul style={{ marginTop:8 }}>
          {items.map((it, i) => (
            <li key={i}>
              {it.products?.name || it.products?.sku || 'Produto'} — {it.quantity} x R$ {(it.unit_price_cents/100).toFixed(2)}
            </li>
          ))}
        </ul>
      </section>

      {/* Totais */}
      <section style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:12 }}>
        <div>Subtotal: <strong>R$ {(subtotal/100).toFixed(2)}</strong></div>
        <div>Desconto: <strong>- R$ {(order.discount_cents/100).toFixed(2)}</strong></div>
        <div style={{ fontSize:18 }}>Total: <strong>R$ {(order.total_cents/100).toFixed(2)}</strong></div>
      </section>
    </main>
  );
}
