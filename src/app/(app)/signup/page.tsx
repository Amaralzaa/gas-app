'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) { setBusy(false); alert(error.message); return; }

    // completa perfil (nome/telefone) após criação
    const user = data.user;
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        email,
        display_name: name || null,
        phone: phone || null
      });
    }

    setBusy(false);
    alert('Cadastro criado! Verifique seu e-mail se a confirmação estiver habilitada.');
    window.location.href = '/';
  };

  return (
    <main>
      <h1>Criar conta</h1>
      <form onSubmit={onSubmit} style={{ display:'grid', gap:8, maxWidth:360 }}>
        <input type="text" placeholder="Nome" value={name} onChange={e=>setName(e.target.value)} />
        <input type="tel" placeholder="Telefone (opcional no cadastro)" value={phone} onChange={e=>setPhone(e.target.value)} />
        <input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button disabled={busy} type="submit">{busy ? 'Enviando…' : 'Criar conta'}</button>
      </form>
    </main>
  );
}
