
-- Tighten critical RLS policies flagged as errors by the security scan

-- profiles: own row or admin only
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable by owner or admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- vendedores: admin or the linked user themselves
DROP POLICY IF EXISTS "Autenticados podem ver vendedores" ON public.vendedores;
CREATE POLICY "Vendedores visíveis para admin ou o próprio"
  ON public.vendedores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- clientes: SELECT restricted to admin/vendedor; UPDATE to admin or creator
DROP POLICY IF EXISTS "Auth view clientes" ON public.clientes;
CREATE POLICY "Clientes visíveis para admin ou vendedor"
  ON public.clientes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));

DROP POLICY IF EXISTS "Auth update clientes" ON public.clientes;
CREATE POLICY "Clientes editáveis por admin ou criador"
  ON public.clientes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

-- financeiro_lancamentos: restrict to admin/financeiro_obra
DROP POLICY IF EXISTS "Authenticated podem ler lancamentos" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "Authenticated podem inserir lancamentos" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "Authenticated podem atualizar lancamentos" ON public.financeiro_lancamentos;

CREATE POLICY "Lancamentos leitura financeiro/admin"
  ON public.financeiro_lancamentos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro_obra'));

CREATE POLICY "Lancamentos insert financeiro/admin"
  ON public.financeiro_lancamentos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro_obra'));

CREATE POLICY "Lancamentos update financeiro/admin"
  ON public.financeiro_lancamentos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro_obra'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro_obra'));

-- Inventory writes: restrict to admin/producao (leitura segue autenticados)
DROP POLICY IF EXISTS "Auth insert acessorios" ON public.acessorios;
DROP POLICY IF EXISTS "Auth update acessorios" ON public.acessorios;
CREATE POLICY "Acessorios insert admin/producao"
  ON public.acessorios FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'producao'));
CREATE POLICY "Acessorios update admin/producao"
  ON public.acessorios FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'producao'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'producao'));

DROP POLICY IF EXISTS "Auth manage perfis" ON public.perfis_aluminio;
DROP POLICY IF EXISTS "Auth update perfis" ON public.perfis_aluminio;
CREATE POLICY "Perfis insert admin/producao"
  ON public.perfis_aluminio FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'producao'));
CREATE POLICY "Perfis update admin/producao"
  ON public.perfis_aluminio FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'producao'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'producao'));

DROP POLICY IF EXISTS "Auth insert vidros" ON public.vidros;
DROP POLICY IF EXISTS "Auth update vidros" ON public.vidros;
CREATE POLICY "Vidros insert admin/producao"
  ON public.vidros FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'producao'));
CREATE POLICY "Vidros update admin/producao"
  ON public.vidros FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'producao'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'producao'));
