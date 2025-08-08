'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useUser } from '@/lib/useUser';
import { getCart, clearCart, totalCents } from '@/lib/cart';

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
};

type DeliveryType = 'regular' | 'scheduled';
type Period = 'morning' | 'afternoon' | 'night';
type Pay = 'pix' | 'cash' | 'credit_card' | 'debit_card';

const PAY_LABEL: Record<Pay, string> = {
  pix: 'PIX na máquina',
  cash: 'Dinheiro',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
};

const PERIOD_LABEL: Record<Period, string> = {
  morning: 'Período da manhã (08:00 – 11:00)',
  afternoon: 'Período da tarde (14:00 – 17:00)',
  night: 'Período da noite (18:00 – 21:00)',
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ background:'#fff', border:'1px solid #e7e7e7', borderRadius:12, padding:16 }}>
    <h3 style={{ margin:'0 0 8px', color:'#114b8b' }}>{title}</h3>
    {children}
  </section>
);

function fmtBRL(cents: number) { return (cents/100).toFixed(2); }

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  // itens do carrinho (somente leitura aqui)
  const [items, setItems] = useState(getCart());
  const subtotal = useMemo(() => totalCents(items), [items]);

  // payload vindo do carrinho
  const [address, setAddress] = useState<Address | null>(null);
  const [discountCents, setDiscountCents] = useState(0);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('regular');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledPeriod, setScheduledPeriod] = useState<Period | ''>('');
  const [payment, setPayment] = useState<Pay>('cash');

  const total = Math.max(subtotal - discountCents, 0);
  const [busy, setBusy] = useState(false);

  // carrega snapshot salvo pelo carrinho
  useEffect(() => {
    const raw = sessionStorage.getItem('checkout_payload');
    if (!raw) { router.replace('/cart'); return; }
    const p = JSON.parse(raw);
    setDiscountCents(p.discountCents ?? 0);
    setDeliveryType(p.deliveryType ?? 'regular');
    setScheduledDate(p.scheduledDate ?? '');
    setScheduledPeriod(p.scheduledPeriod ?? '');
    setPayment(p.paymentMethod ?? 'cash');

    if (p.addressId) {
      supabase.from('addresses')
        .select('id,label,street,number,complement,district,city,state,cep')
        .eq('id', p.addressId)
        .single()
        .then(({ data }) => { if (data) setAddress(data as Address); });
    }
  }, [router]);

  if (loading) return <main style={{ padding:16 }}><h1>Finalização do Pedido</h1><p>Verificando sessão…</p></main>;
  if (!items.length) return <main style={{ padding:16 }}><p>Seu carrinho está vazio.</p></main>;
  if (!address) return <main style={{ padding:16 }}><p>Carregando endereço…</p></main>;

  const confirmOrder = async () => {
    if (!user) { alert('Faça login para continuar.'); router.push('/login'); return; }

    // exige telefone cadastrado
    const { data: prof, error: perr } = await supabase.from('profiles').select('phone').eq('id', user.id).single();
    if (perr) { alert(perr.message); return; }
    if (!prof?.phone) { alert('Informe seu telefone no perfil.'); router.push('/profile'); return; }

    setBusy(true);

    // cria pedido
    const { data: order, error: e1 } = await supabase.from('orders').insert({
      user_id: user.id,
      address_id: address.id,
      status: 'pending',
      delivery_type: deliveryType,
      scheduled_date: deliveryType === 'scheduled' ? scheduledDate : null,
      scheduled_period: deliveryType === 'scheduled' ? scheduledPeriod : null,
      payment_method: payment,
      discount_cents: discountCents,
      total_cents: total
    }).select('id').single();

    if (e1 || !order) { setBusy(false); alert(e1?.message || 'Erro ao criar pedido'); return; }

    // itens
    const skus = items.map(i => i.sku);
    const { data: prods, error: e2 } = await supabase
      .from('products').select('id,sku,price_cents').in('sku', skus);
    if (e2 || !prods) { setBusy(false); alert(e2?.message || 'Erro nos produtos'); return; }

    const orderItems = items.map(i => {
      const p = prods.find(px => px.sku === i.sku)!;
      return { order_id: order.id, product_id: p.id, quantity: i.qty, unit_price_cents: p.price_cents };
    });
    const { error: e3 } = await supabase.from('order_items').insert(orderItems);
    if (e3) { setBusy(false); alert(e3.message); return; }

    clearCart();
    sessionStorage.removeItem('checkout_payload');
    setBusy(false);
    router.replace(`/orders/${order.id}`);
  };

  return (
    <main style={{ maxWidth: 780, margin:'0 auto', padding:16, display:'grid', gap:12 }}>
      <h1 style={{ margin: '0 0 8px' }}>Finalização do Pedido</h1>

      {/* TOTAL DO PEDIDO */}
      <Card title="Total do Pedido">
        <div style={{ display:'grid', gap:8 }}>
          <Row label="Valor Total dos Produtos" value={`R$ ${fmtBRL(subtotal)}`} />
          <Row label="Descontos" value={`- R$ ${fmtBRL(discountCents)}`} />
          <div style={{ height:1, background:'#eaeaea', margin:'4px 0' }} />
          <Row label={<b>Valor Total do Pedido</b>} value={<b>R$ {fmtBRL(total)}</b>} />
        </div>
      </Card>

      {/* ENDEREÇO */}
      <Card title="Endereço de Entrega">
        <div style={{ lineHeight:1.5 }}>
          <div><b>{address.label || 'Sem apelido'}</b></div>
          <div>{address.street}, {address.number || 's/n'} {address.complement ? `- ${address.complement}` : ''}</div>
          <div>{address.district ? `${address.district} — ` : ''}{address.city}/{address.state} • CEP {address.cep}</div>
          <div style={{ marginTop:8, color:'#444' }}>
            {deliveryType === 'regular'
              ? <>Entrega Padrão — <small>até 60 minutos</small></>
              : <>Entrega Programada — <small>{new Date(scheduledDate).toLocaleDateString()} • {scheduledPeriod ? PERIOD_LABEL[scheduledPeriod as Period] : ''}</small></>}
          </div>
        </div>
        <a href="/cart" style={{ display:'inline-block', marginTop:10, color:'#0a63c9' }}>Alterar endereço ou entrega</a>
      </Card>

      {/* FORMA DE PAGAMENTO */}
      <Card title="Forma de Pagamento">
        <div style={{ display:'grid', gap:8 }}>
          {(['pix','cash','credit_card','debit_card'] as Pay[]).map(opt => (
            <label
              key={opt}
              style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                border:'1px solid #e5e5e5', padding:12, borderRadius:10
              }}
            >
              <span>
                <input
                  type="radio"
                  name="pay"
                  checked={payment===opt}
                  onChange={()=>setPayment(opt)}
                  style={{ marginRight:8 }}
                />
                {PAY_LABEL[opt]}
              </span>
            </label>
          ))}
        </div>
      </Card>

      {/* BOTÃO FINAL */}
      <button
        onClick={confirmOrder}
        disabled={busy}
        style={{
          background:'#8BC34A',
          color:'#fff',
          border:0,
          padding:'14px 18px',
          borderRadius:10,
          fontSize:'1.05rem',
          cursor:'pointer'
        }}
      >
        {busy ? 'Enviando…' : `Finalizar Pedido — R$ ${fmtBRL(total)}`}
      </button>

      {/* ITENS (opcional, ajuda o cliente a revisar) */}
      <Card title="Itens do Pedido">
        <ul style={{ margin:0, paddingLeft:16 }}>
          {items.map(i => (
            <li key={i.sku}>
              {i.qty}× {i.name} — R$ {fmtBRL(i.price_cents*i.qty)}
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}

/** Linha label/valor da seção de Total */
function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
