
DO $$ BEGIN
  CREATE TYPE public.financeiro_tipo AS ENUM ('receita','despesa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.financeiro_status AS ENUM ('pendente','pago','atrasado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.financeiro_lancamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo public.financeiro_tipo NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status public.financeiro_status NOT NULL DEFAULT 'pendente',
  forma_pagamento TEXT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  orcamento_numero BIGINT,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  obra_numero BIGINT,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_lancamentos TO authenticated;
GRANT ALL ON public.financeiro_lancamentos TO service_role;

ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated podem ler lancamentos"
  ON public.financeiro_lancamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated podem inserir lancamentos"
  ON public.financeiro_lancamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated podem atualizar lancamentos"
  ON public.financeiro_lancamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin pode deletar lancamentos"
  ON public.financeiro_lancamentos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_financeiro_updated_at
  BEFORE UPDATE ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_fin_venc ON public.financeiro_lancamentos (data_vencimento);
CREATE INDEX idx_fin_status ON public.financeiro_lancamentos (status);
CREATE INDEX idx_fin_tipo ON public.financeiro_lancamentos (tipo);

CREATE OR REPLACE FUNCTION public.criar_receber_ao_aprovar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status IN ('aprovado','convertido')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos WHERE orcamento_id = NEW.id) THEN
    INSERT INTO public.financeiro_lancamentos (
      tipo, descricao, categoria, valor,
      data_vencimento, status,
      cliente_id, cliente_nome,
      orcamento_id, orcamento_numero,
      created_by
    ) VALUES (
      'receita',
      'Recebimento Orçamento #' || NEW.numero || ' - ' || COALESCE(NEW.cliente_nome,'Cliente'),
      'Vendas',
      COALESCE(NEW.total, 0),
      CURRENT_DATE + (COALESCE(NEW.validade_dias, 15) || ' days')::interval,
      'pendente',
      NEW.cliente_id, NEW.cliente_nome,
      NEW.id, NEW.numero,
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_criar_receber_ao_aprovar ON public.orcamentos;
CREATE TRIGGER trg_criar_receber_ao_aprovar
  AFTER UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.criar_receber_ao_aprovar();

CREATE OR REPLACE FUNCTION public.financeiro_marcar_pago()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status = 'pago' AND NEW.data_pagamento IS NULL THEN
    NEW.data_pagamento := CURRENT_DATE;
  END IF;
  IF NEW.status <> 'pago' THEN
    NEW.data_pagamento := NULL;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_financeiro_marcar_pago ON public.financeiro_lancamentos;
CREATE TRIGGER trg_financeiro_marcar_pago
  BEFORE INSERT OR UPDATE ON public.financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.financeiro_marcar_pago();
