'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  id: string;
  status: 'pending'|'confirmed'|'out_for_delivery'|'delivered'|'canceled';
  total_cents: number;
  created_at: string;
  profiles: { email: string | null } | null;
};

const STATUSES = ['pending','confirmed','out_for_delivery','delivered','canceled'] as const;

export default function AdminPage() {
  const [orders, setOrders] = useState<Row[]>([]);
  const [email, setEmail] = useState('rafael.rr.amaral@gmail.com'); // seu e-mail admin
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id,status,total_cents,created_at,profiles(email)')
      .gte('created_at', new Date(Date.now()-1000*60*60*24*7).toISOString()) // últimos 7 dias
      .order('created_at', { ascending:false });

    if (error) return alert(error.message);
    setOrders(data as any);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (order_id: string, new_status: string) => {
    setBusy(true);
    const res = await fetch('/api/admin/update-order', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ order_id, new_status, admin_email: email })
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(()=>({error:'Erro'}));
      alert(j.error || 'Falha');
      return;
    }
    await load();
  };

  return (
    <main>
      <h1>Admin — Pedidos (últimos 7 dias)</h1>
      <div style={{ margin:'8px 0' }}>
        <label>Seu e‑mail admin: </label>
        <input value={email} onChange={e=>setEmail(e.target.value)} style={{ padding:6, minWidth:320 }} />
      </div>
      {busy && <p>Atualizando…</p>}

      <table style={{ width:'100%', background:'#fff', borderRadius:8, marginTop:12 }}>
        <thead>
          <tr><th>Pedido</th><th>Cliente</th><th>Criado</th><th>Total</th><th>Status</th><th>Ação</th></tr>
        </thead>
        <tbody>
          {orders.map(o=>(
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>{o.profiles?.email ?? '-'}</td>
              <td>{new Date(o.created_at).toLocaleString()}</td>
              <td>R$ {(o.total_cents/100).toFixed(2)}</td>
              <td>{o.status}</td>
              <td>
                <select
                  value={o.status}
                  onChange={(e)=>updateStatus(o.id, e.target.value)}
                  disabled={busy}
                >
                  {STATUSES.map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
