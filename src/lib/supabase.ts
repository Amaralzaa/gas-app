import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const supabaseUrl: string = env.VITE_SUPABASE_URL || 'https://rulknyshcpsqnsmsoypt.supabase.co';
const supabaseAnonKey: string = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_spSaz4-lfvSkx93sT3onHA_1ZD4BMUU';


export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      return await fn();
    }
  }
});
