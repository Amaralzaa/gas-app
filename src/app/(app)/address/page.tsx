'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useUser } from '@/lib/useUser';

type Address = {
  id: string;
  label: string | null;
  street: string; number: string | null; complement: string | null;
  district: string | null; city: string; state: string; cep: string; is_default: boolean | null;
};

function onlyDigits(s: string) { return (s || '').replace(/\D/g, ''); }

export default function AddressPage() {
  const { user, loading } = useUser();
  const [items, setItems] = useState<Address[]>([]);
  const [form, setForm] = useState<Partial<Address>>({ city:'', state:'', street:'', cep:'' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.from('addresses').select('*').order('created_at', { ascending: false });
      if (!error && data) setItems(data as Address[]);
    })();
  }, [user]);

  if (loading) return <main><h1>Meus endereços</h1><p>Verificando sessão…</p></main>;
  if (!user) return <main><h1>Meus endereços</h1><p>Você precisa <a href="/login">entrar</a>.</p></main>;

  async function fetchViaCep(cepRaw: string) {
    const cep = onlyDigits(cepRaw);
    if (cep.length !== 8) return; // CEP incompleto
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await resp.json();
      if (j.erro) { alert('CEP não encontrado.'); return; }
      setForm(f => ({
        ...f,
        cep: cepRaw,
        street: j.logradouro || f.street || '',
        district: j.bairro || f.district || '',
        city: j.localidade || f.city || '',
        state: j.uf || f.state || ''
      }));
    } catch (e) {
      console.error(e);
      alert('Falha ao buscar CEP.');
    }
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      label: form.label ?? null,
      street: form.street ?? '',
      number: form.number ?? null,
      complement: form.complement ?? null,
      district: form.district ?? null,
      city: form.city ?? '',
      state: form.state ?? '',
      cep: form.cep ?? '',
      is_default: form.is_default ?? false,
      user_id: user.id,
    };
    const { error } = await supabase.from('addresses').insert(payload);
    setBusy(false);
    if (error) return alert(error.message);
    setForm({ city:'', state:'', street:'', cep:'', number:'', complement:'', district:'', label:'' });
    const { data } = await supabase.from('addresses').select('*').order('created_at', { ascending: false });
    setItems((data ?? []) as Address[]);
  };

  const onDelete = async (id: string) => {
    if (!confirm('Excluir este endereço?')) return;
    const { error } = await supabase.from('addresses').delete().eq('id', id);
    if (error) return alert(error.message);
    setItems(items.filter(i => i.id !== id));
  };

  return (
    <main>
      <h1>Meus endereços</h1>

      <form onSubmit={onSave} style={{ display:'grid', gap:8, maxWidth:520, background:'#fff', padding:12, borderRadius:8 }}>
        <input placeholder="Apelido (ex: Casa)" value={form.label ?? ''} onChange={e=>setForm(f=>({...f, label:e.target.value}))} />
        <input
          placeholder="CEP"
          value={form.cep ?? ''}
          onChange={e=>setForm(f=>({...f, cep:e.target.value}))}
          onBlur={(e)=>fetchViaCep(e.target.value)}
          required
        />
        <input placeholder="Rua" value={form.street ?? ''} onChange={e=>setForm(f=>({...f, street:e.target.value}))} required />
        <input placeholder="Número" value={form.number ?? ''} onChange={e=>setForm(f=>({...f, number:e.target.value}))} />
        <input placeholder="Complemento" value={form.complement ?? ''} onChange={e=>setForm(f=>({...f, complement:e.target.value}))} />
        <input placeholder="Bairro" value={form.district ?? ''} onChange={e=>setForm(f=>({...f, district:e.target.value}))} />
        <div style={{ display:'flex', gap:8 }}>
          <input placeholder="Cidade" value={form.city ?? ''} onChange={e=>setForm(f=>({...f, city:e.target.value}))} required />
          <input placeholder="UF" value={form.state ?? ''} onChange={e=>setForm(f=>({...f, state:e.target.value}))} required style={{ width:80 }} />
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:8 }}>
          <input type="checkbox" checked={!!form.is_default} onChange={e=>setForm(f=>({...f, is_default:e.target.checked}))} />
          Marcar como padrão
        </label>
        <button disabled={busy} type="submit">{busy ? 'Salvando…' : 'Salvar endereço'}</button>
      </form>

      <h2>Salvos</h2>
      <ul style={{ listStyle:'none', padding:0 }}>
        {items.map(a => (
          <li key={a.id} style={{ background:'#fff', padding:12, margin:'8px 0', borderRadius:8, display:'flex', justifyContent:'space-between' }}>
            <div>
              <strong>{a.label || 'Sem apelido'}</strong><br />
              {a.street}, {a.number || 's/n'} {a.complement ? `- ${a.complement}` : ''}<br />
              {a.district ? `${a.district} - ` : ''}{a.city}/{a.state} • CEP {a.cep}<br />
              {a.is_default ? 'Padrão ✅' : ''}
            </div>
            <button onClick={() => onDelete(a.id)}>Excluir</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
