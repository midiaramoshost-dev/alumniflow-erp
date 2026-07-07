CREATE TABLE public.vendedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  documento TEXT,
  percentual_comissao NUMERIC(5,2) NOT NULL DEFAULT 0,
  percentual_comissao_meta NUMERIC(5,2),
  meta_mensal NUMERIC(14,2),
  tipo_comissao TEXT NOT NULL DEFAULT 'venda',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedores TO authenticated;
GRANT ALL ON public.vendedores TO service_role;

ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver vendedores"
  ON public.vendedores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins gerenciam vendedores (insert)"
  ON public.vendedores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins gerenciam vendedores (update)"
  ON public.vendedores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins gerenciam vendedores (delete)"
  ON public.vendedores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_vendedores_updated_at
  BEFORE UPDATE ON public.vendedores
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_vendedores_ativo ON public.vendedores(ativo);
CREATE INDEX idx_vendedores_user_id ON public.vendedores(user_id);