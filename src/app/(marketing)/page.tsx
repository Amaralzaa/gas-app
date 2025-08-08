'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Landing() {
  const router = useRouter();

  // Se estiver logado, pula a landing e vai pro catálogo
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.replace('/orders');
    })();
  }, [router]);

  return (
    <main style={{ minHeight:'100vh', display:'grid', placeItems:'center', padding:'24px' }}>
      <div style={{ maxWidth: 640, textAlign:'center' }}>
        <Image src="/logo.png" alt="Porto Gás" width={220} height={110} style={{ margin:'0 auto 16px' }} />
        <h1 style={{ fontSize: '1.9rem', marginBottom: 8 }}>
          🎉 GANHE <span style={{ color:'#ff6a00' }}>R$ 10</span> na sua primeira compra!
        </h1>
        <p style={{ fontSize:'1.15rem', marginBottom: 24 }}>
          Entrega rápida e atendimento personalizado.
        </p>
        <div style={{ marginBottom: 28, color:'#333' }}>
          <strong>Representante autorizado Nacional Gás Butano.</strong><br/>
          Qualidade e segurança para sua família todos os dias.
        </div>

        <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
          <button
            onClick={()=>router.push('/signup')}
            style={{ background:'#ff6a00', color:'#fff', border:0, padding:'14px 20px', borderRadius:10, fontSize:'1.05rem', cursor:'pointer' }}
          >
            Aproveite agora!
          </button>
          <button
            onClick={()=>router.push('/orders')}
            style={{ background:'#005bbb', color:'#fff', border:0, padding:'14px 20px', borderRadius:10, fontSize:'1.05rem', cursor:'pointer' }}
          >
            Ver produtos
          </button>
        </div>
      </div>
    </main>
  );
}
