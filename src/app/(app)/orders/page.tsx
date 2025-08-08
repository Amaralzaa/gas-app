'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useUser } from '@/lib/useUser';

type Status = 'pending'|'confirmed'|'out_for_delivery'|'delivered'|'canceled';
type OrderRow = {
  id: string;
  status: Status;
  total_cents: number;
  discount_cents: number;
  created_at: string;
};

const STATUS_LABEL: Record<Status,string> = {
  pending: 'Pedido recebido',
  confirmed: 'Pedido confirmado',
  out_for_delivery: 'Pedido em andamento',
  delivered: 'Pedido entregue',
  canceled: 'Pedido cancelado',
};

export default function OrdersPage() {
  const { user, loading } = useUser();
  const [tab, setTab] = useState<'active'|'history'>('active');
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [busy, setBusy] = useState(false);

  const active = ['pending','confirmed','out_for_delivery'] as Status[];
  const history = ['delivered','canceled'] as Status[];

  const load = async () => {
    if (!user) return;
    setBusy(true);
    const wanted = tab === 'active' ? active : history;

    const { data, error } = await supabase
      .from('orders')
      .select('id,status,total_cents,discount_cents,created_at')
      .in('status', wanted)
      .order('created_at', { ascending: false });

    setBusy(false);
    if (error) { alert(error.message); return; }
    setRows((data ?? []) as any);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, tab]);

  if (loading) return <main style={{ padding:16 }}><h1>Meus pedidos</h1><p>Carregando…</p></main>;
  if (!user) return <main style={{ padding:16 }}><h1>Meus pedidos</h1><p>Você precisa <a href="/login">entrar</a>.</p></main>;

  return (
    <main style={{ padding:16 }}>
      {/* Header com Atualizar + Novo pedido */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
        <h1 style={{ margin:0 }}>Meus Pedidos</h1>
        <div style={{ display:'flex', gap:8 }}>
          <a href="/catalog"><button>Novo pedido</button></a>
          <button onClick={load} title="Atualizar">⟳</button>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display:'flex', gap:8, margin:'12px 0' }}>
        <button
          onClick={()=>setTab('active')}
          style={{
            padding:'8px 12px', borderRadius:8,
            border: tab==='active' ? '2px solid #2e7d32' : '1px solid #ddd',
            background: tab==='active' ? '#e8f5e9' : '#fff'
          }}
        >
          Em andamento
        </button>
        <button
          onClick={()=>setTab('history')}
          style={{
            padding:'8px 12px', borderRadius:8,
            border: tab==='history' ? '2px solid #1976d2' : '1px solid #ddd',
            background: tab==='history' ? '#e3f2fd' : '#fff'
          }}
        >
          Histórico
        </button>
      </div>

      {busy && <p>Carregando…</p>}

      {/* Estado vazio em andamento */}
      {tab==='active' && rows.length===0 && !busy && (
        <div style={{ textAlign:'center', padding:'32px 12px', background:'#fff', borderRadius:12 }}>
          <h3>Você não possui pedidos em andamento</h3>
          <p style={{ color:'#666' }}>Aproveite nossas promoções e faça seu pedido!</p>
          <a href="/catalog">
            <button style={{ background:'#8bc34a', color:'#fff', border:0, padding:'10px 16px', borderRadius:8, cursor:'pointer' }}>
              Realizar um novo pedido
            </button>
          </a>
          <div style={{ marginTop:8 }}>
            <button onClick={()=>setTab('history')} style={{ background:'#fff', border:'1px solid #ccc', padding:'8px 12px', borderRadius:8 }}>
              Pedidos anteriores
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {rows.length > 0 && (
        <ul style={{ listStyle:'none', padding:0, marginTop:8 }}>
          {rows.map(o => (
            <li key={o.id} style={{ background:'#fff', borderRadius:12, padding:12, margin:'8px 0', border:'1px solid #eee' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:600 }}>Pedido {o.id.slice(0,8)}</div>
                  <div style={{ color:'#666', fontSize:13 }}>
                    {new Date(o.created_at).toLocaleString()}
                  </div>
                </div>
                <span
                  style={{
                    padding:'4px 8px', borderRadius:999,
                    background:
                      o.status==='delivered' ? '#e8f5e9' :
                      o.status==='canceled' ? '#ffebee' : '#e3f2fd',
                    color:
                      o.status==='delivered' ? '#2e7d32' :
                      o.status==='canceled' ? '#c62828' : '#1565c0',
                    border:
                      o.status==='delivered' ? '1px solid #a5d6a7' :
                      o.status==='canceled' ? '1px solid #ef9a9a' : '1px solid #90caf9'
                  }}
                >
                  {STATUS_LABEL[o.status]}
                </span>
              </div>

              <div style={{ marginTop:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>Total</div>
                <div style={{ fontWeight:700 }}>R$ {(o.total_cents/100).toFixed(2)}</div>
              </div>

              <div style={{ marginTop:8 }}>
                <a href={`/orders/${o.id}`}><button>Detalhes</button></a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Histórico vazio */}
      {tab==='history' && rows.length===0 && !busy && (
        <div style={{ textAlign:'center', padding:'24px', color:'#666' }}>
          <p>Nenhum pedido anterior.</p>
          <a href="/catalog">Comece um pedido agora</a>
        </div>
      )}
    </main>
  );
}
