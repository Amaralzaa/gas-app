'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/lib/useUser';
import { supabase } from '@/lib/supabaseClient';

type ProfileLite = { display_name: string | null; phone: string | null };

export default function UserMenu() {
  const { user, loading } = useUser();
  const [p, setP] = useState<ProfileLite | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return setP(null);
      const { data } = await supabase
        .from('profiles')
        .select('display_name, phone')
        .eq('id', user.id)
        .single();
      setP((data as ProfileLite) ?? null);
    })();
  }, [user]);

  if (loading) return <span>…</span>;

  if (!user) {
    return (
      <div style={{ display:'flex', gap:12 }}>
        <a href="/login">Entrar (sem senha)</a>
        <a href="/login-password">Entrar com senha</a>
        <a href="/signup">Criar conta</a>
      </div>
    );
  }

  const label = p?.display_name?.trim()
    || p?.phone?.trim()
    || user.email
    || 'Minha conta';

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpen(v=>!v)}>{label}</button>
      {open && (
        <div
          style={{
            position:'absolute', right:0, top:'110%',
            background:'#fff', border:'1px solid #ddd', borderRadius:8,
            minWidth:220, padding:8, boxShadow:'0 4px 12px rgba(0,0,0,.08)'
          }}
        >
          <a href="/profile" style={{ display:'block', padding:8 }}>Meu perfil</a>
          <a href="/address" style={{ display:'block', padding:8 }}>Endereços</a>
          <a href="/orders" style={{ display:'block', padding:8 }}>Meus pedidos</a>
          <hr />
          <button onClick={logout} style={{ width:'100%' }}>Sair</button>
        </div>
      )}
    </div>
  );
}
