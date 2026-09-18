-- ==============================================================================
-- SCHEMA COMPLETO GÁS EXPRESS (SUPABASE)
-- Execute este script no SQL Editor do seu novo projeto Supabase
-- ==============================================================================

-- 1. Habilitar extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- TABELA: profiles (Perfis de Usuários)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT NOT NULL DEFAULT 'Usuário',
  role TEXT NOT NULL DEFAULT 'cliente' CHECK (role IN ('cliente', 'gestor', 'entregador', 'admin')),
  phone TEXT,
  points INTEGER DEFAULT 0,
  addresses JSONB DEFAULT '[]'::jsonb,
  location JSONB,
  allowed_tabs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- TABELA: orders (Pedidos de Gás e Água)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY DEFAULT ('PED-' || floor(random() * (9999 - 1000 + 1) + 1000)::text),
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT 'Cliente',
  phone TEXT DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  coupon_code TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Atribuído', 'Em Rota', 'Concluído', 'Cancelado')),
  payment_method TEXT NOT NULL DEFAULT 'Pix',
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_arrival TIMESTAMPTZ,
  delivery_person_id TEXT,
  delivery_person_location JSONB,
  rating INTEGER,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- TABELA: coverage_areas (Áreas de Entrega e Bairros)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coverage_areas (
  id TEXT PRIMARY KEY,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  allowed_ceps JSONB DEFAULT '[]'::jsonb,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  boundary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- TABELA: expenses (Despesas dos Entregadores e Operação)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  user_id TEXT NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- TABELA: referrals (Indicações - Indique e Ganhe)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referrals (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  referrer_id TEXT NOT NULL,
  referrer_name TEXT NOT NULL,
  referee_id TEXT,
  referee_name TEXT NOT NULL,
  referee_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Validado', 'Rejeitado')),
  order_id TEXT,
  points_awarded INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  validated_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- SEED INICIAL: Bairros Padrão de Niterói
-- ------------------------------------------------------------------------------
INSERT INTO public.coverage_areas (id, neighborhood, city, allowed_ceps, center_lat, center_lng)
VALUES 
  ('cov-1', 'Icaraí', 'Niterói', '["24220", "24230"]'::jsonb, -22.905, -43.110),
  ('cov-2', 'Santa Rosa', 'Niterói', '["24240"]'::jsonb, -22.902, -43.098),
  ('cov-3', 'Ingá', 'Niterói', '["24210"]'::jsonb, -22.904, -43.125),
  ('cov-4', 'Centro', 'Niterói', '["24020", "24030"]'::jsonb, -22.885, -43.122)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- TRIGGER: Criar Profile Automaticamente ao Criar Usuário no Auth
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, phone, points, addresses, allowed_tabs)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'cliente'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    0,
    '[]'::jsonb,
    '[]'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = CASE WHEN EXCLUDED.name <> 'Usuário' THEN EXCLUDED.name ELSE public.profiles.name END,
    phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE public.profiles.phone END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- POLÍTICAS DE ACESSO (Row Level Security - RLS)
-- Para fase de testes nos smartphones, liberamos acesso para anon e autenticados
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_all" ON public.profiles;
CREATE POLICY "profiles_all" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- Orders
DROP POLICY IF EXISTS "orders_all" ON public.orders;
CREATE POLICY "orders_all" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- Coverage Areas
DROP POLICY IF EXISTS "coverage_all" ON public.coverage_areas;
CREATE POLICY "coverage_all" ON public.coverage_areas FOR ALL USING (true) WITH CHECK (true);

-- Expenses
DROP POLICY IF EXISTS "expenses_all" ON public.expenses;
CREATE POLICY "expenses_all" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

-- Referrals
DROP POLICY IF EXISTS "referrals_all" ON public.referrals;
CREATE POLICY "referrals_all" ON public.referrals FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- HABILITAR REALTIME (Para atualização instantânea nos smartphones)
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
