-- Remove a política antiga que pode estar barrando
DROP POLICY IF EXISTS "Permitir inserção de pedidos" ON public.orders;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.orders;

-- Cria uma política nova mais permissiva para inserção de pedidos
CREATE POLICY "Permitir inserção de pedidos para usuários autenticados" 
ON public.orders 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- (Opcional) Caso o gestor também não esteja conseguindo atualizar (UPDATE) os pedidos:
-- CREATE POLICY "Permitir atualização de pedidos" ON public.orders FOR UPDATE TO authenticated USING (true);
