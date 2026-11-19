-- =============================================================================
-- Rollback da consolidação 20261119000000
-- Restaura o estado descrito no export de 2026-11-18:
--   coverage_areas (11) e orders (2) permanecem
--   profiles, expenses e referrals voltam a ficar vazios
--   products e business_settings não existiam
--   sem trigger em auth.users, sem funções de papel
--   políticas e CHECKs originais
-- Aplicar só se a migration 20261119000000 tiver sido aplicada e
-- nenhum dado de produção posterior precisar ser preservado.
-- O DELETE em profiles apaga também contas criadas depois da migration.
-- =============================================================================

-- Realtime das tabelas novas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.products;
  END IF;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS protect_profile_columns ON public.profiles;
DROP TRIGGER IF EXISTS enforce_order_update ON public.orders;

-- Políticas novas
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;

DROP POLICY IF EXISTS orders_select ON public.orders;
DROP POLICY IF EXISTS orders_insert ON public.orders;
DROP POLICY IF EXISTS orders_update ON public.orders;
DROP POLICY IF EXISTS orders_delete ON public.orders;

DROP POLICY IF EXISTS products_select ON public.products;
DROP POLICY IF EXISTS products_write ON public.products;

DROP POLICY IF EXISTS coverage_select ON public.coverage_areas;
DROP POLICY IF EXISTS coverage_write ON public.coverage_areas;

DROP POLICY IF EXISTS business_settings_select ON public.business_settings;
DROP POLICY IF EXISTS business_settings_write ON public.business_settings;

DROP POLICY IF EXISTS expenses_select ON public.expenses;
DROP POLICY IF EXISTS expenses_insert ON public.expenses;
DROP POLICY IF EXISTS expenses_update ON public.expenses;
DROP POLICY IF EXISTS expenses_delete ON public.expenses;

DROP POLICY IF EXISTS referrals_select ON public.referrals;
DROP POLICY IF EXISTS referrals_insert ON public.referrals;
DROP POLICY IF EXISTS referrals_update ON public.referrals;
DROP POLICY IF EXISTS referrals_delete ON public.referrals;

DROP FUNCTION IF EXISTS public.lookup_referral_code(text);
DROP FUNCTION IF EXISTS private.lookup_referral_code(text);
DROP FUNCTION IF EXISTS private.protect_profile_columns();
DROP FUNCTION IF EXISTS private.enforce_order_update();
DROP FUNCTION IF EXISTS private.handle_new_user();
DROP FUNCTION IF EXISTS private.is_gestor();
DROP FUNCTION IF EXISTS private.current_user_role();
DROP SCHEMA IF EXISTS private;

-- Tabelas que não existiam
DROP TABLE IF EXISTS public.products;
DROP TABLE IF EXISTS public.business_settings;

-- profiles estava vazia
DELETE FROM public.profiles;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS allowed_tabs;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS updated_at;

-- orders: colunas acrescentadas
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_rating_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_service_rating_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_rating_check;

ALTER TABLE public.orders DROP COLUMN IF EXISTS delivery_person_location;
ALTER TABLE public.orders DROP COLUMN IF EXISTS rating;
ALTER TABLE public.orders DROP COLUMN IF EXISTS service_rating;
ALTER TABLE public.orders DROP COLUMN IF EXISTS delivery_rating;
ALTER TABLE public.orders DROP COLUMN IF EXISTS feedback;
ALTER TABLE public.orders DROP COLUMN IF EXISTS cancellation_reason;
ALTER TABLE public.orders DROP COLUMN IF EXISTS cancelled_at;
ALTER TABLE public.orders DROP COLUMN IF EXISTS completed_at;
ALTER TABLE public.orders DROP COLUMN IF EXISTS is_scheduled;
ALTER TABLE public.orders DROP COLUMN IF EXISTS scheduled_date;
ALTER TABLE public.orders DROP COLUMN IF EXISTS scheduled_date_iso;
ALTER TABLE public.orders DROP COLUMN IF EXISTS scheduled_period;
ALTER TABLE public.orders DROP COLUMN IF EXISTS scheduled_period_name;
ALTER TABLE public.orders DROP COLUMN IF EXISTS scheduled_time_range;
ALTER TABLE public.orders DROP COLUMN IF EXISTS selected_freebie;
ALTER TABLE public.orders DROP COLUMN IF EXISTS referral_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS is_force_activated;

DROP INDEX IF EXISTS public.orders_customer_id_idx;
DROP INDEX IF EXISTS public.orders_delivery_person_id_idx;
DROP INDEX IF EXISTS public.orders_status_idx;

-- customer_id volta a ser obrigatório. Falha se alguma venda de balcão (NULL) existir.
ALTER TABLE public.orders ALTER COLUMN customer_id SET NOT NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY[
    'Pendente'::text,
    'Em Rota'::text,
    'Concluído'::text,
    'Cancelado'::text
  ]));

ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_status_check
  CHECK (status = ANY (ARRAY[
    'Pendente'::text,
    'Validado'::text,
    'Rejeitado'::text
  ]));

-- Políticas originais do export
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO public
  USING (auth.uid() = id);

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated users can manage coverage" ON public.coverage_areas
  FOR ALL TO public
  USING (true);

CREATE POLICY "Anyone can read coverage" ON public.coverage_areas
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated users can manage referrals" ON public.referrals
  FOR ALL TO public
  USING (true);

CREATE POLICY "Anyone can read referrals" ON public.referrals
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Permitir inserção de pedidos para usuários autenticados" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT TO public
  USING ((auth.uid() = customer_id) OR (auth.role() = 'service_role'::text));

-- expenses não tinha política no export. RLS desligado devolve o acesso anterior.
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;

-- TRUNCATE de volta para anon/authenticated, como no default do projeto antes do REVOKE
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
      'GRANT TRUNCATE ON TABLE public.%I TO anon, authenticated',
      r.tablename
    );
  END LOOP;
END $$;
