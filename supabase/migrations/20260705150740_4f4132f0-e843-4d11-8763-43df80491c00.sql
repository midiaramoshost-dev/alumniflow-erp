
-- ============ ORCAMENTOS ============
CREATE SEQUENCE IF NOT EXISTS public.orcamento_numero_seq START 1000;

CREATE TABLE public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGINT NOT NULL UNIQUE DEFAULT nextval('public.orcamento_numero_seq'),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','aprovado','rejeitado','convertido')),
  data_orcamento DATE NOT NULL DEFAULT CURRENT_DATE,
  validade_dias INTEGER NOT NULL DEFAULT 15,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER SEQUENCE public.orcamento_numero_seq OWNED BY public.orcamentos.numero;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO authenticated;
GRANT ALL ON public.orcamentos TO service_role;
GRANT USAGE ON SEQUENCE public.orcamento_numero_seq TO authenticated, service_role;

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem orcamentos"
  ON public.orcamentos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Vendas criam orcamentos"
  ON public.orcamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'vendedor') OR
    public.has_role(auth.uid(), 'financeiro_obra')
  );

CREATE POLICY "Vendas atualizam orcamentos"
  ON public.orcamentos FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'vendedor') OR
    public.has_role(auth.uid(), 'financeiro_obra')
  );

CREATE POLICY "Admin apaga orcamentos"
  ON public.orcamentos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_orcamentos_updated_at
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ ORCAMENTO_ITENS ============
CREATE TABLE public.orcamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 1,
  descricao TEXT NOT NULL,
  tipo TEXT,
  largura_mm INTEGER,
  altura_mm INTEGER,
  quantidade NUMERIC(10,2) NOT NULL DEFAULT 1,
  perfil_id UUID REFERENCES public.perfis_aluminio(id) ON DELETE SET NULL,
  vidro_id UUID REFERENCES public.vidros(id) ON DELETE SET NULL,
  preco_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orcamento_itens_orcamento ON public.orcamento_itens(orcamento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_itens TO authenticated;
GRANT ALL ON public.orcamento_itens TO service_role;

ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem itens"
  ON public.orcamento_itens FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Vendas gerenciam itens"
  ON public.orcamento_itens FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'vendedor') OR
    public.has_role(auth.uid(), 'financeiro_obra')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'vendedor') OR
    public.has_role(auth.uid(), 'financeiro_obra')
  );

CREATE TRIGGER trg_orcamento_itens_updated_at
  BEFORE UPDATE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ TRIGGER: recalcula total do orcamento ============
CREATE OR REPLACE FUNCTION public.recalcular_orcamento_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orcamento_id UUID;
  v_subtotal NUMERIC(14,2);
BEGIN
  v_orcamento_id := COALESCE(NEW.orcamento_id, OLD.orcamento_id);
  SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
    FROM public.orcamento_itens
    WHERE orcamento_id = v_orcamento_id;
  UPDATE public.orcamentos
    SET subtotal = v_subtotal,
        total = GREATEST(v_subtotal - COALESCE(desconto, 0), 0),
        updated_at = now()
    WHERE id = v_orcamento_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalcular_orcamento_ins
  AFTER INSERT ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_orcamento_total();

CREATE TRIGGER trg_recalcular_orcamento_upd
  AFTER UPDATE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_orcamento_total();

CREATE TRIGGER trg_recalcular_orcamento_del
  AFTER DELETE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_orcamento_total();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.orcamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orcamento_itens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.perfis_aluminio;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vidros;
ALTER PUBLICATION supabase_realtime ADD TABLE public.acessorios;

ALTER TABLE public.orcamentos REPLICA IDENTITY FULL;
ALTER TABLE public.orcamento_itens REPLICA IDENTITY FULL;
