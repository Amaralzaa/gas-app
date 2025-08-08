'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:3000/update-password'
    });
    setBusy(false);
    if (error) alert(error.message);
    else alert('Enviamos um e-mail com instruções para redefinir sua senha.');
  };

  return (
    <main>
      <h1>Redefinir senha</h1>
      <form onSubmit={onSubmit} style={{ display:'grid', gap:8, maxWidth:360 }}>
        <input type="email" placeholder="Seu e-mail" value={email} onChange={e=>setEmail(e.target.value)} required />
        <button disabled={busy} type="submit">{busy ? 'Enviando…' : 'Enviar link'}</button>
      </form>
    </main>
  );
}
