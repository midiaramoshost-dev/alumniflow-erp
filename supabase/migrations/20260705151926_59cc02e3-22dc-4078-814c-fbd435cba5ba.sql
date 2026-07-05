
-- ============ ORDENS DE PRODUCAO ============
CREATE SEQUENCE IF NOT EXISTS public.op_numero_seq START 2000;

CREATE TABLE public.ordens_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGINT NOT NULL UNIQUE DEFAULT nextval('public.op_numero_seq'),
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  orcamento_numero BIGINT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  etapa TEXT NOT NULL DEFAULT 'aguardando' CHECK (etapa IN ('aguardando','corte','montagem','vidracaria','acabamento','finalizado','entregue','cancelada')),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta','urgente')),
  progresso INTEGER NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  data_inicio DATE,
  data_previsao DATE,
  data_entrega DATE,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER SEQUENCE public.op_numero_seq OWNED BY public.ordens_producao.numero;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_producao TO authenticated;
GRANT ALL ON public.ordens_producao TO service_role;
GRANT USAGE ON SEQUENCE public.op_numero_seq TO authenticated, service_role;

ALTER TABLE public.ordens_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem OPs"
  ON public.ordens_producao FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Producao cria OPs"
  ON public.ordens_producao FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'producao') OR
    public.has_role(auth.uid(), 'vendedor')
  );

CREATE POLICY "Producao atualiza OPs"
  ON public.ordens_producao FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'producao') OR
    public.has_role(auth.uid(), 'vendedor')
  );

CREATE POLICY "Admin apaga OPs"
  ON public.ordens_producao FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ordens_producao_updated_at
  BEFORE UPDATE ON public.ordens_producao
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ HISTORICO DE ETAPAS ============
CREATE TABLE public.ordem_producao_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id UUID NOT NULL REFERENCES public.ordens_producao(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL,
  iniciada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluida_em TIMESTAMPTZ,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_op_etapas_ordem ON public.ordem_producao_etapas(ordem_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordem_producao_etapas TO authenticated;
GRANT ALL ON public.ordem_producao_etapas TO service_role;

ALTER TABLE public.ordem_producao_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem etapas"
  ON public.ordem_producao_etapas FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Producao gerencia etapas"
  ON public.ordem_producao_etapas FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'producao')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'producao')
  );

-- ============ TRIGGER: registra mudanca de etapa ============
CREATE OR REPLACE FUNCTION public.registrar_mudanca_etapa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ordem_producao_etapas (ordem_id, etapa, responsavel_id)
      VALUES (NEW.id, NEW.etapa, NEW.responsavel_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    UPDATE public.ordem_producao_etapas
      SET concluida_em = now()
      WHERE ordem_id = NEW.id AND concluida_em IS NULL;
    INSERT INTO public.ordem_producao_etapas (ordem_id, etapa, responsavel_id)
      VALUES (NEW.id, NEW.etapa, NEW.responsavel_id);
    IF NEW.etapa = 'entregue' AND NEW.data_entrega IS NULL THEN
      NEW.data_entrega := CURRENT_DATE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_op_registra_etapa_ins
  AFTER INSERT ON public.ordens_producao
  FOR EACH ROW EXECUTE FUNCTION public.registrar_mudanca_etapa();

CREATE TRIGGER trg_op_registra_etapa_upd
  BEFORE UPDATE ON public.ordens_producao
  FOR EACH ROW EXECUTE FUNCTION public.registrar_mudanca_etapa();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordens_producao;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordem_producao_etapas;
ALTER TABLE public.ordens_producao REPLICA IDENTITY FULL;
ALTER TABLE public.ordem_producao_etapas REPLICA IDENTITY FULL;
