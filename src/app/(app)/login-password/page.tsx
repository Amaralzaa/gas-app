'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPasswordPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) alert(error.message);
    else window.location.href = '/orders';
  };

  return (
    <main>
      <h1>Entrar com senha</h1>
      <form onSubmit={onSubmit} style={{ display:'grid', gap:8, maxWidth:360 }}>
        <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button disabled={busy} type="submit">{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p style={{ marginTop:8 }}>
        <a href="/reset-password">Esqueci minha senha</a>
      </p>
    </main>
  );
}
