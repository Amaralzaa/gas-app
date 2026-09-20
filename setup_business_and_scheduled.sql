-- ==============================================================================
-- SCHEMA ATUALIZAÇÃO: BUSINESS SETTINGS & PEDIDOS AGENDADOS
-- Execute este script no SQL Editor do seu projeto Supabase
-- ==============================================================================

-- 1. Novas colunas para suportar agendamento de pedidos na tabela orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS scheduled_date TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS scheduled_period TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS scheduled_time_range TEXT;

-- 2. Criar tabela business_settings (Informações institucionais, logo e horários)
CREATE TABLE IF NOT EXISTS public.business_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  name TEXT NOT NULL DEFAULT 'Porto Gás Distribuidora',
  trade_name TEXT DEFAULT 'Porto Gás & Água',
  cnpj TEXT DEFAULT '',
  phone TEXT DEFAULT '(21) 99999-9999',
  whatsapp TEXT DEFAULT '(21) 99999-9999',
  email TEXT DEFAULT 'contato@portogas.com.br',
  logo_url TEXT,
  address JSONB DEFAULT '{"street":"Rua Principal","number":"100","neighborhood":"Centro","city":"Niterói","state":"RJ","cep":"24020-000","complement":""}'::jsonb,
  opening_hours JSONB DEFAULT '{
    "monday": {"isOpen": true, "open": "08:00", "close": "19:00"},
    "tuesday": {"isOpen": true, "open": "08:00", "close": "19:00"},
    "wednesday": {"isOpen": true, "open": "08:00", "close": "19:00"},
    "thursday": {"isOpen": true, "open": "08:00", "close": "19:00"},
    "friday": {"isOpen": true, "open": "08:00", "close": "19:00"},
    "saturday": {"isOpen": true, "open": "08:00", "close": "18:00"},
    "sunday": {"isOpen": true, "open": "08:00", "close": "14:00"}
  }'::jsonb,
  is_open_override BOOLEAN DEFAULT NULL,
  min_order_value NUMERIC(10,2) DEFAULT 0,
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir registro inicial se não existir
INSERT INTO public.business_settings (id, name, trade_name, phone, whatsapp, email)
VALUES ('default', 'Porto Gás Distribuidora', 'Porto Gás & Água', '(21) 99999-9999', '(21) 99999-9999', 'contato@portogas.com.br')
ON CONFLICT (id) DO NOTHING;

-- 3. Habilitar RLS e criar políticas
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_settings_all" ON public.business_settings;
CREATE POLICY "business_settings_all" ON public.business_settings FOR ALL USING (true) WITH CHECK (true);

-- 4. Habilitar Realtime
ALTER TABLE public.business_settings REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'business_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.business_settings;
  END IF;
END $$;
