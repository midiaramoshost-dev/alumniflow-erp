
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role public.app_role NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, module, action)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permissoes visiveis a autenticados"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Somente admin insere permissoes"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Somente admin atualiza permissoes"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Somente admin remove permissoes"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed default matrix
DO $$
DECLARE
  r public.app_role;
  m TEXT;
  a TEXT;
  modules TEXT[] := ARRAY['comercial','clientes','vendas','pedidos','producao','controle_fabril','obras','materiais','vidros','acessorios','perfis','financeiro','exportar','admin'];
  actions TEXT[] := ARRAY['view','create','edit','delete'];
  default_allowed BOOLEAN;
BEGIN
  FOR r IN SELECT unnest(enum_range(NULL::public.app_role)) LOOP
    FOREACH m IN ARRAY modules LOOP
      FOREACH a IN ARRAY actions LOOP
        default_allowed := CASE
          WHEN r = 'admin' THEN true
          WHEN r = 'vendedor' AND m IN ('comercial','clientes','vendas','pedidos') THEN true
          WHEN r = 'producao' AND m IN ('pedidos','producao','controle_fabril','obras','materiais','vidros','acessorios','perfis') AND a IN ('view','create','edit') THEN true
          WHEN r = 'financeiro_obra' AND m IN ('financeiro','obras','clientes') AND a IN ('view','create','edit') THEN true
          ELSE false
        END;
        INSERT INTO public.role_permissions (role, module, action, allowed)
          VALUES (r, m, a, default_allowed)
          ON CONFLICT (role, module, action) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND rp.module = _module
      AND rp.action = _action
      AND rp.allowed = true
  );
$$;
