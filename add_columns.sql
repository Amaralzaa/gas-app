-- Execute este script no SQL Editor do seu Supabase para adicionar as novas colunas
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_rating smallint;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_rating smallint;
