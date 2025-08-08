'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) alert(error.message);
    else setSent(true);
  };

  return (
    <main>
      <h1>Entrar por e‑mail (sem senha)</h1>
      <p style={{ marginTop: 8, marginBottom: 12 }}>
        Receba um <strong>link de acesso</strong> diretamente no seu e‑mail — <em>sem senhas!</em>
      </p>

      {sent ? (
        <p>Enviamos um link para <strong>{email}</strong>. Verifique sua caixa de entrada.</p>
      ) : (
        <form onSubmit={onSubmit} style={{ display:'grid', gap:8, maxWidth:360 }}>
          <input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding:8 }}
          />
          <button disabled={loading} type="submit">
            {loading ? 'Enviando...' : 'Receber link de acesso'}
          </button>
        </form>
      )}

      <p style={{ marginTop: 16 }}>
        Prefere usar senha? <a href="/login-password">Entrar com senha</a> •
        &nbsp;Novo por aqui? <a href="/signup">Criar conta</a>
      </p>
    </main>
  );
}
