const { createClient } = require('@supabase/supabase-js');

// Using the same credentials from your existing scripts
const supabaseUrl = 'https://gbjsmqaecxzdmcvqcpbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdianNtcWFlY3h6ZG1jdnFjcGJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NzAzMTksImV4cCI6MjA5MTU0NjMxOX0.l1Rox5dIK1EmkOAjsAfW9lpa9QiGI7URn-pIJ1siQWA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateSchema() {
  console.log('Solicitando atualização de schema...');
  console.log('IMPORTANTE: Se o script falhar por permissão, execute o SQL abaixo no dashboard do Supabase.');

  const sql = `
-- 1. Adicionar coluna boundary na tabela coverage_areas
ALTER TABLE coverage_areas ADD COLUMN IF NOT EXISTS boundary JSONB;

-- 2. Criar tabela de indicações (referrals)
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  referrer_name TEXT NOT NULL,
  referee_id TEXT,
  referee_name TEXT NOT NULL,
  referee_phone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pendente', 'Validado', 'Rejeitado')),
  order_id TEXT,
  points_awarded INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ
);

-- 3. Habilitar RLS e criar políticas para referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'Anyone can read referrals') THEN
        CREATE POLICY "Anyone can read referrals" ON referrals FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'Authenticated users can manage referrals') THEN
        CREATE POLICY "Authenticated users can manage referrals" ON referrals FOR ALL USING (true);
    END IF;
END $$;
  `;

  console.log('\n--- COPIE E COLE ESTE SQL NO SQL EDITOR DO SUPABASE ---\n');
  console.log(sql);
  console.log('\n--- FIM DO SQL ---\n');

  // Since we cannot easily run 'ALTER TABLE' via the JS client without a custom edge function or Postgres function,
  // we primarily provide the SQL. But we'll try a simple select to see if table exists now.
  const { error: coverageError } = await supabase.from('coverage_areas').select('boundary').limit(1);
  if (coverageError) {
    console.log('Confirmado: A coluna "boundary" ainda não existe ou não está acessível.');
  } else {
    console.log('A coluna "boundary" parece já existir!');
  }

  const { error: referralError } = await supabase.from('referrals').select('*').limit(1);
  if (referralError) {
    console.log('Confirmado: A tabela "referrals" ainda não existe ou não está acessível.');
  } else {
    console.log('A tabela "referrals" já existe!');
  }
}

updateSchema();
