'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCart, setQty, removeItem, totalCents } from '@/lib/cart';
import { supabase } from '@/lib/supabaseClient';
import { useUser } from '@/lib/useUser';

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

function fmtBRL(cents: number) { return (cents / 100).toFixed(2); }
function iso(d: Date) { return d.toISOString().slice(0, 10); }

export default function CartPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  // carrinho
  const [items, setItems] = useState(getCart());
  const subtotal = useMemo(() => totalCents(items), [items]);

  // cupom (placeholder)  ⇐ declare ANTES de usar em `total`
  const [coupon, setCoupon] = useState('');
  const [discountCents, setDiscountCents] = useState(0);

  // total usa discountCents
  const total = useMemo(() => Math.max(subtotal - discountCents, 0), [subtotal, discountCents]);

  // endereços
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>('');

  // entrega
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('regular');
  const [scheduledDate, setScheduledDate] = useState<string>(''); // YYYY-MM-DD
  const [scheduledPeriod, setScheduledPeriod] = useState<Period | ''>('');

  // pagamento
  const [pay, setPay] = useState<Pay>('cash');

  useEffect(() => {
    const t = setInterval(() => setItems(getCart()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('addresses')
        .select('id,label,street,number,complement,district,city,state,cep')
        .order('created_at', { ascending: false });
      setAddresses((data ?? []) as Address[]);
      setDiscountCents(prev => Math.min(prev, subtotal));
    })();
  }, [user, subtotal]);

  if (loading) return <main><h1>Carrinho</h1><p>Verificando sessão…</p></main>;

  // cupom
  const applyCoupon = () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    if (code === 'PORTO10') {
      setDiscountCents(Math.min(1000, subtotal));
      alert('Cupom aplicado: R$ 10,00');
    } else {
      alert('Cupom inválido (demonstração)');
    }
  };

  // entrega programada helpers
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const dateTabs = [
    { label: 'Hoje', value: iso(today), hint: today.toLocaleDateString() },
    { label: 'Amanhã', value: iso(tomorrow), hint: tomorrow.toLocaleDateString() },
  ];
  const chooseScheduled = () => {
    setDeliveryType('scheduled');
    if (!scheduledDate) setScheduledDate(dateTabs[0].value);
    if (!scheduledPeriod) setScheduledPeriod('morning');
  };

  // ir para /checkout
  const goToCheckout = () => {
    if (!items.length) { alert('Seu carrinho está vazio.'); return; }
    if (!addressId) { alert('Selecione um endereço de entrega.'); return; }
    if (deliveryType === 'scheduled' && (!scheduledDate || !scheduledPeriod)) {
      alert('Escolha data e período da entrega programada.');
      return;
    }
    sessionStorage.setItem('checkout_payload', JSON.stringify({
      addressId,
      discountCents,
      deliveryType,
      scheduledDate,
      scheduledPeriod,
      paymentMethod: pay,
    }));
    router.push('/checkout');
  };

  return (
    <main>
      <h1>Carrinho</h1>
      <a href="/address">Gerenciar endereços</a>

      {/* itens */}
      {!items.length ? (
        <p>Seu carrinho está vazio.</p>
      ) : (
        <table style={{ width:'100%', background:'#fff', borderRadius:8, marginTop:12 }}>
          <thead><tr><th style={{textAlign:'left'}}>Item</th><th>Qtd</th><th>Preço</th><th>Subtotal</th><th></th></tr></thead>
          <tbody>
          {items.map(i => (
            <tr key={i.sku}>
              <td>{i.name}</td>
              <td>
                <input type="number" min={1} value={i.qty}
                  onChange={(e)=>{ setQty(i.sku, Number(e.target.value)); setItems(getCart()); }}
                  style={{ width:70 }}/>
              </td>
              <td>R$ {fmtBRL(i.price_cents)}</td>
              <td>R$ {fmtBRL(i.price_cents*i.qty)}</td>
              <td><button onClick={()=>{ removeItem(i.sku); setItems(getCart()); }}>Remover</button></td>
            </tr>
          ))}
          </tbody>
        </table>
      )}

      {/* cupom */}
      <div style={{ marginTop:12, background:'#fff', padding:12, borderRadius:8 }}>
        <label style={{ display:'block', marginBottom:8 }}>Tem um cupom?</label>
        <div style={{ display:'flex', gap:8 }}>
          <input value={coupon} onChange={e=>setCoupon(e.target.value)} placeholder="Ex.: PORTO10" style={{ flex:1, padding:8 }}/>
          <button onClick={applyCoupon}>Aplicar</button>
        </div>
      </div>

      {/* tipo de entrega */}
      <div style={{ marginTop:12, background:'#fff', padding:12, borderRadius:8 }}>
        <h3 style={{ marginTop:0 }}>Tipo de Entrega</h3>

        <div style={{ display:'grid', gap:8 }}>
          <label style={{ display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #cfe8ff', padding:10, borderRadius:8 }}>
            <span>
              <input type="radio" name="dtype" checked={deliveryType==='regular'} onChange={()=>setDeliveryType('regular')} style={{ marginRight:8 }}/>
              Entrega Padrão <small style={{ color:'#666' }}>até 60 minutos</small>
            </span>
            <strong>R$ {fmtBRL(total)}</strong>
          </label>

          <div style={{ border:'1px solid #cfe8ff', borderRadius:8, padding:10 }}>
            <label style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>
                <input type="radio" name="dtype" checked={deliveryType==='scheduled'} onChange={chooseScheduled} style={{ marginRight:8 }}/>
                Entrega Programada <small style={{ color:'#666' }}>você escolhe o horário</small>
              </span>
              <strong>R$ {fmtBRL(total)}</strong>
            </label>

            {deliveryType==='scheduled' && (
              <div style={{ marginTop:10 }}>
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  {dateTabs.map(t => (
                    <button key={t.value} onClick={()=>setScheduledDate(t.value)}
                      style={{
                        padding:'6px 10px', borderRadius:8,
                        border: scheduledDate===t.value ? '2px solid #1976d2' : '1px solid #ddd',
                        background: scheduledDate===t.value ? '#e3f2fd' : '#fff'
                      }}>
                      {t.label} <small style={{ opacity:.8 }}>({t.hint})</small>
                    </button>
                  ))}
                </div>
                <div style={{ display:'grid', gap:8 }}>
                  <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', border:'1px solid #eee', padding:8, borderRadius:8 }}>
                    <span><input type="radio" name="period" checked={scheduledPeriod==='morning'} onChange={()=>setScheduledPeriod('morning')} style={{ marginRight:8 }}/>
                      Período da manhã <small style={{ color:'#666' }}>08:00 – 11:00</small> ☀️</span>
                  </label>
                  <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', border:'1px solid #eee', padding:8, borderRadius:8 }}>
                    <span><input type="radio" name="period" checked={scheduledPeriod==='afternoon'} onChange={()=>setScheduledPeriod('afternoon')} style={{ marginRight:8 }}/>
                      Período da tarde <small style={{ color:'#666' }}>14:00 – 17:00</small> ⛅</span>
                  </label>
                  <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', border:'1px solid #eee', padding:8, borderRadius:8 }}>
                    <span><input type="radio" name="period" checked={scheduledPeriod==='night'} onChange={()=>setScheduledPeriod('night')} style={{ marginRight:8 }}/>
                      Período da noite <small style={{ color:'#666' }}>18:00 – 21:00</small> 🌙</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* pagamento */}
      <div style={{ marginTop:12, background:'#fff', padding:12, borderRadius:8 }}>
        <h3 style={{ marginTop:0 }}>Forma de Pagamento</h3>
        <div style={{ display:'grid', gap:8 }}>
          {(['pix','cash','credit_card','debit_card'] as Pay[]).map(opt => (
            <label key={opt} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', border:'1px solid #e5e5e5', padding:10, borderRadius:8 }}>
              <span>
                <input type="radio" name="pay" checked={pay===opt} onChange={()=>setPay(opt)} style={{ marginRight:8 }}/>
                {PAY_LABEL[opt]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* resumo + endereço + ir para checkout */}
      <div style={{ marginTop:16, background:'#fff', padding:12, borderRadius:8 }}>
        <div>Subtotal: <strong>R$ {fmtBRL(subtotal)}</strong></div>
        <div>Desconto: <strong>- R$ {fmtBRL(discountCents)}</strong></div>
        <div style={{ fontSize:18 }}>Total: <strong>R$ {fmtBRL(total)}</strong></div>

        <div style={{ marginTop:12 }}>
          <label>Endereço de entrega:</label><br />
          <select value={addressId} onChange={e=>setAddressId(e.target.value)} style={{ padding:6, minWidth:320 }}>
            <option value="">Selecione…</option>
            {addresses.map(a => (
              <option key={a.id} value={a.id}>
                {(a.label || 'Sem apelido')} — {a.street}, {a.number || 's/n'} ({a.city}/{a.state}) CEP {a.cep}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop:12, opacity:.5 }}>
          <button disabled title="Em breve">Brindes (em breve)</button>
        </div>

        <button onClick={goToCheckout} disabled={!items.length} style={{ marginTop:12 }}>
          Revisar e finalizar
        </button>
      </div>
    </main>
  );
}
