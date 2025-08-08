import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

export const adminClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
