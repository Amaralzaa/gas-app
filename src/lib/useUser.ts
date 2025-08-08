'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function useUser() {
  const [user, setUser] = useState<import('@supabase/supabase-js').User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) {
        setUser(data.user ?? null);
        setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => { sub.subscription.unsubscribe(); mounted = false; };
  }, []);

  return { user, loading };
}
