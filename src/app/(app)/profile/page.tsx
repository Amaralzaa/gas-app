'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useUser } from '@/lib/useUser';

type Profile = {
  email: string | null;
  display_name: string | null;
  phone: string | null;
  cpf?: string | null;
};

function digitsOnly(s: string) { return (s || '').replace(/\D/g, ''); }
function formatPhoneBR(s: string) {
  const d = digitsOnly(s).slice(0, 13); // +55DD9NNNNNNN ~ 13 d
  if (d.length <= 2) return d;
  if (d.length <= 4) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 8) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`;
}
function toE164(s: string) {
  const d = digitsOnly(s);
  if (!d) return '';
  // assume BR: se começar com 55 mantém; senão, prefixa
  return d.startsWith('55') ? `+${d}` : `+55${d}`;
}

// Validação de CPF (algoritmo simples)
function isValidCPF(cpfRaw: string) {
  const c = digitsOnly(cpfRaw);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0, rest;
  for (let i=1;i<=9;i++) sum += parseInt(c.substring(i-1,i))*(11-i);
  rest = (sum*10)%11; if (rest===10||rest===11) rest=0;
  if (rest !== parseInt(c.substring(9,10))) return false;
  sum=0;
  for (let i=1;i<=10;i++) sum += parseInt(c.substring(i-1,i))*(12-i);
  rest=(sum*10)%11; if (rest===10||rest===11) rest=0;
  return rest === parseInt(c.substring(10,11));
}
function formatCPF(s: string) {
  const d = digitsOnly(s).slice(0,11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
}

export default function ProfilePage() {
  const { user, loading } = useUser();
  const [p, setP] = useState<Profile>({ email: '', display_name: '', phone: '', cpf: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('email, display_name, phone, cpf')
        .eq('id', user.id)
        .single();
      if (!error && data) {
        const prof = data as Profile;
        setP({
          email: prof.email ?? '',
          display_name: prof.display_name ?? '',
          phone: prof.phone ?? '',
          cpf: prof.cpf ?? ''
        });
      }
    })();
  }, [user]);

  if (loading) return <main><h1>Meu perfil</h1><p>Carregando…</p></main>;
  if (!user) return <main><h1>Meu perfil</h1><p>Você precisa <a href="/login">entrar</a>.</p></main>;

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // telefone obrigatório
    if (!digitsOnly(p.phone || '').length) {
      alert('Informe seu telefone (obrigatório).');
      return;
    }

    // validar CPF se preenchido
    if ((p.cpf ?? '').trim()) {
      if (!isValidCPF(p.cpf!)) {
        if (!confirm('CPF parece inválido. Deseja salvar assim mesmo?')) return;
      }
    }

    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      display_name: (p.display_name || '').trim() || null,
      phone: toE164(p.phone || ''), // salva em E.164 (+55...)
      cpf: (p.cpf || '').trim() || null
    }).eq('id', user.id);
    setBusy(false);
    if (error) return alert(error.message);
    alert('Perfil atualizado!');
    // recarrega para refletir no header
    window.location.reload();
  };

  return (
    <main>
      <h1>Meu perfil</h1>
      <form onSubmit={onSave} style={{ display:'grid', gap:8, maxWidth:420, background:'#fff', padding:12, borderRadius:8 }}>
        <label>E‑mail
          <input value={p.email ?? ''} readOnly style={{ width:'100%', padding:8, background:'#f2f2f2' }} />
        </label>
        <label>Nome
          <input
            value={p.display_name ?? ''}
            onChange={e=>setP({...p, display_name:e.target.value})}
            style={{ width:'100%', padding:8 }}
            placeholder="Seu nome"
          />
        </label>
        <label>Telefone (obrigatório)
          <input
            value={formatPhoneBR(p.phone ?? '')}
            onChange={e=>setP({...p, phone:e.target.value})}
            style={{ width:'100%', padding:8 }}
            placeholder="(21) 9XXXX-XXXX"
            required
          />
        </label>
        <label>CPF (opcional)
          <input
            value={formatCPF(p.cpf ?? '')}
            onChange={e=>setP({...p, cpf:e.target.value})}
            style={{ width:'100%', padding:8 }}
            placeholder="000.000.000-00"
          />
        </label>
        <div style={{ display:'flex', gap:8 }}>
          <a href="/address">Endereços</a>
          <a href="/orders">Meus pedidos</a>
        </div>
        <button disabled={busy} type="submit">{busy ? 'Salvando…' : 'Salvar'}</button>
      </form>
    </main>
  );
}
