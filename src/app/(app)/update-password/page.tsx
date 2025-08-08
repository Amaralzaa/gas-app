'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Quando o usuário chega por link do e-mail, o Supabase injeta a sessão na URL/hash.
    // O supabase-js trata isso automaticamente; só precisamos aguardar 1 tick.
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) alert(error.message);
    else { alert('Senha atualizada!'); window.location.href = '/login-password'; }
  };

  if (!ready) return <main><p>Carregando…</p></main>;

  return (
    <main>
      <h1>Definir nova senha</h1>
      <form onSubmit={onSubmit} style={{ display:'grid', gap:8, maxWidth:360 }}>
        <input type="password" placeholder="Nova senha" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button disabled={busy} type="submit">{busy ? 'Salvando…' : 'Salvar'}</button>
      </form>
    </main>
  );
}
