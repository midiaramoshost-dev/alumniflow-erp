
-- ============ 1. Estender pedidos ============
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS prazo_entrega DATE,
  ADD COLUMN IF NOT EXISTS forma_entrega TEXT,
  ADD COLUMN IF NOT EXISTS transportadora TEXT,
  ADD COLUMN IF NOT EXISTS endereco_entrega JSONB,
  ADD COLUMN IF NOT EXISTS observacoes_internas TEXT,
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS condicoes_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS parcelas INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impostos NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sinal_entrada NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_pagamento TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS prazos_por_etapa JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============ 2. Tabela pedido_itens ============
CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'produto', -- produto | servico
  descricao TEXT NOT NULL,
  perfil_id UUID REFERENCES public.perfis_aluminio(id) ON DELETE SET NULL,
  vidro_id UUID REFERENCES public.vidros(id) ON DELETE SET NULL,
  acessorio_id UUID REFERENCES public.acessorios(id) ON DELETE SET NULL,
  cor TEXT,
  acabamento TEXT,
  largura_mm NUMERIC(10,2),
  altura_mm NUMERIC(10,2),
  quantidade NUMERIC(10,2) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_itens TO authenticated;
GRANT ALL ON public.pedido_itens TO service_role;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pedido_itens" ON public.pedido_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write pedido_itens" ON public.pedido_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON public.pedido_itens(pedido_id);
CREATE TRIGGER trg_pedido_itens_updated_at BEFORE UPDATE ON public.pedido_itens
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ 3. Tabela pedido_checklist ============
CREATE TABLE IF NOT EXISTS public.pedido_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  etapa public.pedido_etapa NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  item TEXT NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT false,
  concluido_em TIMESTAMPTZ,
  concluido_por UUID,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_checklist TO authenticated;
GRANT ALL ON public.pedido_checklist TO service_role;
ALTER TABLE public.pedido_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pedido_checklist" ON public.pedido_checklist FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write pedido_checklist" ON public.pedido_checklist FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_pedido_checklist_pedido ON public.pedido_checklist(pedido_id, etapa);
CREATE TRIGGER trg_pedido_checklist_updated_at BEFORE UPDATE ON public.pedido_checklist
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ 4. Recalculo automático de totais ============
CREATE OR REPLACE FUNCTION public.recalcular_pedido_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pedido_id UUID;
  v_subtotal NUMERIC(14,2);
BEGIN
  v_pedido_id := COALESCE(NEW.pedido_id, OLD.pedido_id);
  SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
    FROM public.pedido_itens WHERE pedido_id = v_pedido_id;
  UPDATE public.pedidos
    SET subtotal = v_subtotal,
        valor_total = GREATEST(v_subtotal - COALESCE(desconto,0) + COALESCE(impostos,0), 0),
        saldo = GREATEST(GREATEST(v_subtotal - COALESCE(desconto,0) + COALESCE(impostos,0), 0) - COALESCE(sinal_entrada,0), 0),
        updated_at = now()
    WHERE id = v_pedido_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_pedido_itens_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.pedido_itens
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_pedido_total();

-- Recalcula saldo/total quando desconto/impostos/sinal mudam no próprio pedido
CREATE OR REPLACE FUNCTION public.pedido_recalc_saldo()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.valor_total := GREATEST(COALESCE(NEW.subtotal,0) - COALESCE(NEW.desconto,0) + COALESCE(NEW.impostos,0), 0);
  NEW.saldo := GREATEST(NEW.valor_total - COALESCE(NEW.sinal_entrada,0), 0);
  IF NEW.saldo = 0 AND NEW.valor_total > 0 THEN
    NEW.status_pagamento := 'pago';
  ELSIF COALESCE(NEW.sinal_entrada,0) > 0 AND NEW.saldo > 0 THEN
    NEW.status_pagamento := 'parcial';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_pedido_before_upd
  BEFORE INSERT OR UPDATE OF subtotal, desconto, impostos, sinal_entrada ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedido_recalc_saldo();

-- ============ 5. Financeiro automático ============
CREATE OR REPLACE FUNCTION public.pedido_criar_receber()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.valor_total,0) > 0
     AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos WHERE pedido_id = NEW.id) THEN
    INSERT INTO public.financeiro_lancamentos (
      tipo, descricao, categoria, valor, data_vencimento, status,
      cliente_id, cliente_nome, pedido_id, created_by
    ) VALUES (
      'receita',
      'Pedido #' || NEW.numero || ' - ' || COALESCE(NEW.cliente_nome,'Cliente'),
      'Vendas',
      NEW.valor_total,
      COALESCE(NEW.prazo_entrega, CURRENT_DATE + INTERVAL '15 days'),
      CASE WHEN NEW.status_pagamento = 'pago' THEN 'pago' ELSE 'pendente' END,
      NEW.cliente_id, NEW.cliente_nome, NEW.id, NEW.created_by
    );
  END IF;
  RETURN NEW;
END; $$;

-- Adiciona coluna pedido_id em financeiro_lancamentos se ainda não existir
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL;

CREATE TRIGGER trg_pedido_after_ins_receber
  AFTER INSERT OR UPDATE OF valor_total ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedido_criar_receber();
