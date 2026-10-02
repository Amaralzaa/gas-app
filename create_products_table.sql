-- ==============================================================================
-- SCHEMA ATUALIZAÇÃO: TABELA DE PRODUTOS (GÁS & ÁGUA) COM DESCONTOS PIX/DINHEIRO
-- Execute este script no SQL Editor do seu projeto Supabase
-- ==============================================================================

-- 1. Criar tabela products
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image TEXT,
  description TEXT,
  category TEXT DEFAULT 'Gás GLP',
  unit TEXT,
  brand TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  pix_discount JSONB DEFAULT '{"enabled": false, "type": "fixed", "value": 0}'::jsonb,
  cash_discount JSONB DEFAULT '{"enabled": false, "type": "fixed", "value": 0}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS e permitir leitura/escrita
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_all_access" ON public.products;
CREATE POLICY "products_all_access" ON public.products FOR ALL USING (true) WITH CHECK (true);

-- 3. Habilitar Realtime
ALTER TABLE public.products REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END $$;

-- 4. Inserir produtos padrão se a tabela estiver vazia
INSERT INTO public.products (id, name, price, category, unit, brand, image, description, is_active, pix_discount, cash_discount)
VALUES 
  (
    'p13', 
    'Gás de Cozinha P13 (Recarga)', 
    115.00, 
    'Gás GLP', 
    '13kg', 
    'Nacional / Ultragaz', 
    'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&auto=format&fit=crop&q=80',
    'Recarga de botijão P13 com troca de vasilhame vazio. Padrão residencial ANP.',
    true,
    '{"enabled": true, "type": "fixed", "value": 10.00}'::jsonb,
    '{"enabled": true, "type": "fixed", "value": 10.00}'::jsonb
  ),
  (
    'p45', 
    'Cilindro de Gás P45 (Industrial / Condomínio)', 
    450.00, 
    'Gás GLP', 
    '45kg', 
    'Nacional / Ultragaz', 
    'https://images.unsplash.com/photo-1527018606412-a72518e3fb37?w=600&auto=format&fit=crop&q=80',
    'Cilindro de 45kg ideal para condomínios, restaurantes, padarias e indústrias.',
    true,
    '{"enabled": true, "type": "fixed", "value": 30.00}'::jsonb,
    '{"enabled": true, "type": "fixed", "value": 30.00}'::jsonb
  ),
  (
    'water20', 
    'Água Mineral Galão 20L (Recarga)', 
    18.00, 
    'Água Mineral', 
    '20L', 
    'Fonte Natural', 
    'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80',
    'Galão de 20 litros de água mineral pura e cristalina com troca de garrafão.',
    true,
    '{"enabled": true, "type": "fixed", "value": 2.00}'::jsonb,
    '{"enabled": true, "type": "fixed", "value": 2.00}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
