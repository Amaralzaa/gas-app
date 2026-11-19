-- =============================================================================
-- Porto Gás — consolidação idempotente do schema (NÃO APLICAR automaticamente)
-- Alinha o projeto gbjsmqaecxzdmcvqcpbs ao que o app precisa.
-- Não apaga coverage_areas nem orders existentes.
-- Funções SECURITY DEFINER ficam no schema private (não exposto pelo PostgREST),
-- com search_path vazio e nomes totalmente qualificados.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Papel do usuário autenticado (não usa user_metadata: é editável pelo cliente)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION private.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_user_role() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_gestor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.current_user_role() = 'gestor'
$$;

REVOKE ALL ON FUNCTION private.is_gestor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_gestor() TO anon, authenticated, service_role;

-- Consulta mínima para cupom de indicação, sem abrir a linha inteira do perfil.
CREATE OR REPLACE FUNCTION private.lookup_referral_code(p_code text)
RETURNS TABLE (id uuid, name text, referral_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.name, p.referral_code
  FROM public.profiles AS p
  WHERE p.referral_code IS NOT NULL
    AND upper(btrim(p.referral_code)) = upper(btrim(p_code))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.lookup_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.lookup_referral_code(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lookup_referral_code(p_code text)
RETURNS TABLE (id uuid, name text, referral_code text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT r.id, r.name, r.referral_code
  FROM private.lookup_referral_code(p_code) AS r
$$;

REVOKE ALL ON FUNCTION public.lookup_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_referral_code(text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- profiles: colunas que o app grava + trava de papel
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allowed_tabs jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT pg_catalog.now();

UPDATE public.profiles
SET allowed_tabs = '[]'::jsonb
WHERE allowed_tabs IS NULL;

-- Cadastro público nasce sempre cliente. Gestor promove depois, via SQL ou painel.
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_name text;
  v_phone text;
BEGIN
  v_email := COALESCE(NULLIF(btrim(NEW.email), ''), NEW.id::text || '@sem-email.local');
  v_name := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), ''), 'Cliente');
  v_phone := NULLIF(btrim(NEW.raw_user_meta_data ->> 'phone'), '');

  INSERT INTO public.profiles (
    id, email, name, role, phone, points, addresses, allowed_tabs, referral_code
  )
  VALUES (
    NEW.id,
    v_email,
    v_name,
    'cliente',
    v_phone,
    0,
    '[]'::jsonb,
    '[]'::jsonb,
    NULL
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

-- Backfill dos auth.users já existentes (profiles estava vazia). Papel cliente.
INSERT INTO public.profiles (
  id, email, name, role, phone, points, addresses, allowed_tabs
)
SELECT
  u.id,
  COALESCE(NULLIF(btrim(u.email), ''), u.id::text || '@sem-email.local'),
  COALESCE(NULLIF(btrim(u.raw_user_meta_data ->> 'name'), ''), 'Cliente'),
  'cliente',
  NULLIF(btrim(u.raw_user_meta_data ->> 'phone'), ''),
  0,
  '[]'::jsonb,
  '[]'::jsonb
FROM auth.users AS u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles AS p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role' OR private.current_user_role() = 'gestor' THEN
    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
  END IF;

  -- O próprio usuário edita cadastro, mas não se promove.
  NEW.role := OLD.role;
  NEW.allowed_tabs := OLD.allowed_tabs;
  NEW.email := OLD.email;
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_profile_columns() FROM PUBLIC;

DROP TRIGGER IF EXISTS protect_profile_columns ON public.profiles;
CREATE TRIGGER protect_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_profile_columns();

-- -----------------------------------------------------------------------------
-- orders: colunas usadas pelo app + status Atribuído (o gestor grava esse status)
-- customer_id passa a aceitar NULL para venda de balcão do entregador.
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_person_location jsonb,
  ADD COLUMN IF NOT EXISTS rating integer,
  ADD COLUMN IF NOT EXISTS service_rating smallint,
  ADD COLUMN IF NOT EXISTS delivery_rating smallint,
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_scheduled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_date text,
  ADD COLUMN IF NOT EXISTS scheduled_date_iso text,
  ADD COLUMN IF NOT EXISTS scheduled_period text,
  ADD COLUMN IF NOT EXISTS scheduled_period_name text,
  ADD COLUMN IF NOT EXISTS scheduled_time_range text,
  ADD COLUMN IF NOT EXISTS selected_freebie text,
  ADD COLUMN IF NOT EXISTS referral_id text,
  ADD COLUMN IF NOT EXISTS is_force_activated boolean DEFAULT false;

ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY[
    'Pendente'::text,
    'Atribuído'::text,
    'Em Rota'::text,
    'Concluído'::text,
    'Cancelado'::text
  ]));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_rating_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_rating_check
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_service_rating_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_service_rating_check
  CHECK (service_rating IS NULL OR (service_rating >= 1 AND service_rating <= 5));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_rating_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_rating_check
  CHECK (delivery_rating IS NULL OR (delivery_rating >= 1 AND delivery_rating <= 5));

CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_delivery_person_id_idx ON public.orders (delivery_person_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders (status);

CREATE OR REPLACE FUNCTION private.enforce_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.role() = 'service_role' OR private.current_user_role() = 'gestor' THEN
    RETURN NEW;
  END IF;

  v_role := private.current_user_role();

  IF v_role = 'cliente' THEN
    IF OLD.customer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'cliente so altera o proprio pedido';
    END IF;
    NEW.customer_id := OLD.customer_id;
    NEW.items := OLD.items;
    NEW.total := OLD.total;
    NEW.discount := OLD.discount;
    NEW.delivery_person_id := OLD.delivery_person_id;
    NEW.payment_method := OLD.payment_method;
    NEW.address := OLD.address;
    IF OLD.status = 'Pendente' AND NEW.status = 'Cancelado' THEN
      IF NEW.cancelled_at IS NULL THEN
        NEW.cancelled_at := pg_catalog.now();
      END IF;
      RETURN NEW;
    END IF;
    IF OLD.status = 'Concluído' AND NEW.status = 'Concluído' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'cliente so pode cancelar pedido pendente ou avaliar pedido concluido';
  END IF;

  IF v_role = 'entregador' THEN
    IF OLD.delivery_person_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'entregador so atualiza pedidos atribuidos a ele';
    END IF;
    NEW.customer_id := OLD.customer_id;
    NEW.items := OLD.items;
    NEW.total := OLD.total;
    NEW.discount := OLD.discount;
    NEW.delivery_person_id := OLD.delivery_person_id;
    NEW.address := OLD.address;
    IF OLD.status IS NOT DISTINCT FROM NEW.status
       OR (OLD.status = 'Atribuído' AND NEW.status = 'Em Rota')
       OR (OLD.status = 'Pendente' AND NEW.status = 'Em Rota')
       OR (OLD.status = 'Em Rota' AND NEW.status = 'Concluído') THEN
      IF NEW.status = 'Concluído' AND NEW.completed_at IS NULL THEN
        NEW.completed_at := pg_catalog.now();
      END IF;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'transicao de status nao permitida para entregador';
  END IF;

  RAISE EXCEPTION 'sem permissao para atualizar pedido';
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_order_update() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_order_update ON public.orders;
CREATE TRIGGER enforce_order_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_order_update();

-- -----------------------------------------------------------------------------
-- referrals: o app grava status Confirmado além de Validado
-- -----------------------------------------------------------------------------
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_status_check
  CHECK (status = ANY (ARRAY[
    'Pendente'::text,
    'Validado'::text,
    'Confirmado'::text,
    'Rejeitado'::text
  ]));

-- -----------------------------------------------------------------------------
-- products — P13, P20 e P45 sem preço inventado
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id text PRIMARY KEY,
  name text NOT NULL,
  price numeric(10,2),
  image text,
  description text,
  category text DEFAULT 'Gás GLP',
  unit text,
  brand text,
  is_active boolean DEFAULT true,
  pix_discount jsonb DEFAULT '{"enabled": false, "type": "fixed", "value": 0}'::jsonb,
  cash_discount jsonb DEFAULT '{"enabled": false, "type": "fixed", "value": 0}'::jsonb,
  created_at timestamptz DEFAULT pg_catalog.now(),
  updated_at timestamptz DEFAULT pg_catalog.now()
);

COMMENT ON COLUMN public.products.price IS
  'NULL ou 0 = definir preço. Nao gravar valor comercial inventado.';

INSERT INTO public.products (id, name, price, description, category, unit, is_active)
VALUES
  ('p13', 'Gás de Cozinha P13 (Recarga)', NULL, 'definir preço', 'Gás GLP', '13kg', true),
  ('p20', 'Gás GLP P20', NULL, 'definir preço', 'Gás GLP', '20kg', true),
  ('p45', 'Cilindro de Gás P45', NULL, 'definir preço', 'Gás GLP', '45kg', true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- business_settings — taxas nulas até o gestor definir
-- Horários abaixo são o recorte já usado na interface; o dono confirma em Meu Negócio.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_settings (
  id text PRIMARY KEY DEFAULT 'default',
  name text NOT NULL DEFAULT 'Porto Gás Distribuidora',
  trade_name text,
  cnpj text,
  phone text,
  whatsapp text,
  email text,
  logo_url text,
  address jsonb,
  opening_hours jsonb,
  delivery_periods jsonb,
  is_open_override boolean,
  min_order_value numeric(10,2),
  delivery_fee numeric(10,2),
  updated_at timestamptz DEFAULT pg_catalog.now()
);

INSERT INTO public.business_settings (
  id, name, trade_name, phone, whatsapp, email, address, opening_hours, delivery_periods,
  is_open_override, min_order_value, delivery_fee
)
VALUES (
  'default',
  'Porto Gás Distribuidora',
  'Porto Gás',
  NULL,
  NULL,
  NULL,
  '{"street":"","number":"","neighborhood":"","city":"São Gonçalo","state":"RJ","cep":"","complement":""}'::jsonb,
  '{
    "monday": {"isOpen": true, "open": "08:00", "close": "19:00"},
    "tuesday": {"isOpen": true, "open": "08:00", "close": "19:00"},
    "wednesday": {"isOpen": true, "open": "08:00", "close": "19:00"},
    "thursday": {"isOpen": true, "open": "08:00", "close": "19:00"},
    "friday": {"isOpen": true, "open": "08:00", "close": "19:00"},
    "saturday": {"isOpen": true, "open": "08:00", "close": "18:00"},
    "sunday": {"isOpen": true, "open": "08:00", "close": "14:00"}
  }'::jsonb,
  '[
    {"id":"manha","name":"Manhã","startTime":"08:00","endTime":"13:00","active":true,"icon":"sun"},
    {"id":"tarde","name":"Tarde","startTime":"13:00","endTime":"19:00","active":true,"icon":"sunset"},
    {"id":"noite","name":"Noite","startTime":"19:00","endTime":"22:00","active":false,"icon":"moon"}
  ]'::jsonb,
  NULL,
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN public.business_settings.delivery_fee IS
  'NULL = taxa ainda nao definida (nao cobrar). 0 = entrega sem taxa, definido pelo gestor.';
COMMENT ON COLUMN public.business_settings.min_order_value IS
  'NULL = pedido minimo ainda nao definido.';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "profiles_all" ON public.profiles;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR private.is_gestor()
    OR (
      private.current_user_role() = 'entregador'
      AND (role = 'cliente' OR id = auth.uid())
    )
  );

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR private.is_gestor())
  WITH CHECK (id = auth.uid() OR private.is_gestor());

-- Sem INSERT para authenticated: a linha nasce no trigger SECURITY DEFINER.

-- orders
DROP POLICY IF EXISTS "Permitir inserção de pedidos para usuários autenticados" ON public.orders;
DROP POLICY IF EXISTS "Permitir inserção de pedidos" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "orders_all" ON public.orders;
DROP POLICY IF EXISTS orders_select ON public.orders;
DROP POLICY IF EXISTS orders_insert ON public.orders;
DROP POLICY IF EXISTS orders_update ON public.orders;
DROP POLICY IF EXISTS orders_delete ON public.orders;

CREATE POLICY orders_select ON public.orders
  FOR SELECT TO authenticated
  USING (
    private.is_gestor()
    OR customer_id = auth.uid()
    OR delivery_person_id = auth.uid()
    OR (
      private.current_user_role() = 'entregador'
      AND delivery_person_id IS NULL
      AND status = 'Pendente'
    )
  );

CREATE POLICY orders_insert ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_gestor()
    OR (
      private.current_user_role() = 'cliente'
      AND customer_id = auth.uid()
      AND status = 'Pendente'
    )
    OR (
      private.current_user_role() = 'entregador'
      AND delivery_person_id = auth.uid()
      AND status IN ('Pendente', 'Concluído')
    )
  );

CREATE POLICY orders_update ON public.orders
  FOR UPDATE TO authenticated
  USING (
    private.is_gestor()
    OR (private.current_user_role() = 'cliente' AND customer_id = auth.uid())
    OR (private.current_user_role() = 'entregador' AND delivery_person_id = auth.uid())
  )
  WITH CHECK (
    private.is_gestor()
    OR (private.current_user_role() = 'cliente' AND customer_id = auth.uid())
    OR (private.current_user_role() = 'entregador' AND delivery_person_id = auth.uid())
  );

CREATE POLICY orders_delete ON public.orders
  FOR DELETE TO authenticated
  USING (private.is_gestor());

-- products: leitura pública, escrita só do gestor
DROP POLICY IF EXISTS products_select ON public.products;
DROP POLICY IF EXISTS products_write ON public.products;
DROP POLICY IF EXISTS "products_all_access" ON public.products;

CREATE POLICY products_select ON public.products
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY products_write ON public.products
  FOR ALL TO authenticated
  USING (private.is_gestor())
  WITH CHECK (private.is_gestor());

-- coverage_areas
DROP POLICY IF EXISTS "Authenticated users can manage coverage" ON public.coverage_areas;
DROP POLICY IF EXISTS "Anyone can read coverage" ON public.coverage_areas;
DROP POLICY IF EXISTS "coverage_all" ON public.coverage_areas;
DROP POLICY IF EXISTS coverage_select ON public.coverage_areas;
DROP POLICY IF EXISTS coverage_write ON public.coverage_areas;

CREATE POLICY coverage_select ON public.coverage_areas
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY coverage_write ON public.coverage_areas
  FOR ALL TO authenticated
  USING (private.is_gestor())
  WITH CHECK (private.is_gestor());

-- business_settings
DROP POLICY IF EXISTS business_settings_select ON public.business_settings;
DROP POLICY IF EXISTS business_settings_write ON public.business_settings;
DROP POLICY IF EXISTS "business_settings_all" ON public.business_settings;

CREATE POLICY business_settings_select ON public.business_settings
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY business_settings_write ON public.business_settings
  FOR ALL TO authenticated
  USING (private.is_gestor())
  WITH CHECK (private.is_gestor());

-- expenses
DROP POLICY IF EXISTS "expenses_all" ON public.expenses;
DROP POLICY IF EXISTS expenses_select ON public.expenses;
DROP POLICY IF EXISTS expenses_insert ON public.expenses;
DROP POLICY IF EXISTS expenses_update ON public.expenses;
DROP POLICY IF EXISTS expenses_delete ON public.expenses;

CREATE POLICY expenses_select ON public.expenses
  FOR SELECT TO authenticated
  USING (
    private.is_gestor()
    OR (private.current_user_role() = 'entregador' AND user_id = auth.uid())
  );

CREATE POLICY expenses_insert ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_gestor()
    OR (private.current_user_role() = 'entregador' AND user_id = auth.uid())
  );

CREATE POLICY expenses_update ON public.expenses
  FOR UPDATE TO authenticated
  USING (private.is_gestor())
  WITH CHECK (private.is_gestor());

CREATE POLICY expenses_delete ON public.expenses
  FOR DELETE TO authenticated
  USING (private.is_gestor());

-- referrals
DROP POLICY IF EXISTS "Authenticated users can manage referrals" ON public.referrals;
DROP POLICY IF EXISTS "Anyone can read referrals" ON public.referrals;
DROP POLICY IF EXISTS "referrals_all" ON public.referrals;
DROP POLICY IF EXISTS referrals_select ON public.referrals;
DROP POLICY IF EXISTS referrals_insert ON public.referrals;
DROP POLICY IF EXISTS referrals_update ON public.referrals;
DROP POLICY IF EXISTS referrals_delete ON public.referrals;

CREATE POLICY referrals_select ON public.referrals
  FOR SELECT TO authenticated
  USING (
    private.is_gestor()
    OR private.current_user_role() = 'entregador'
    OR referrer_id = auth.uid()::text
    OR referee_id = auth.uid()::text
  );

CREATE POLICY referrals_insert ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_gestor()
    OR private.current_user_role() = 'entregador'
    OR referrer_id = auth.uid()::text
    OR referee_id = auth.uid()::text
  );

CREATE POLICY referrals_update ON public.referrals
  FOR UPDATE TO authenticated
  USING (
    private.is_gestor()
    OR private.current_user_role() = 'entregador'
    OR referrer_id = auth.uid()::text
    OR referee_id = auth.uid()::text
  )
  WITH CHECK (
    private.is_gestor()
    OR private.current_user_role() = 'entregador'
    OR referrer_id = auth.uid()::text
    OR referee_id = auth.uid()::text
  );

CREATE POLICY referrals_delete ON public.referrals
  FOR DELETE TO authenticated
  USING (
    private.is_gestor()
    OR referrer_id = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- Privilégios de tabela. RLS continua sendo o controle fino.
-- TRUNCATE sai de anon e authenticated.
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.products, public.coverage_areas, public.business_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders, public.profiles, public.expenses, public.referrals, public.business_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coverage_areas TO authenticated;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE ON TABLE public.%I FROM anon, authenticated',
      r.tablename
    );
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- Realtime (idempotente)
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;

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

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END $$;
