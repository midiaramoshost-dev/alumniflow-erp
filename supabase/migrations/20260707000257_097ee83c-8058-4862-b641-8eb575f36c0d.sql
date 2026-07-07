
-- Auto-create OP + Obra when orçamento is approved
CREATE OR REPLACE FUNCTION public.criar_op_e_obra_ao_aprovar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op_id UUID;
  v_op_numero BIGINT;
  v_titulo TEXT;
BEGIN
  IF NEW.status IN ('aprovado','convertido')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    v_titulo := COALESCE('Orçamento #' || NEW.numero || ' - ' || COALESCE(NEW.cliente_nome,'Cliente'), 'Orçamento aprovado');

    -- Create OP if none exists for this orçamento
    SELECT id, numero INTO v_op_id, v_op_numero
      FROM public.ordens_producao
      WHERE orcamento_id = NEW.id
      LIMIT 1;

    IF v_op_id IS NULL THEN
      INSERT INTO public.ordens_producao (
        orcamento_id, orcamento_numero, cliente_id, cliente_nome,
        titulo, etapa, prioridade, created_by
      ) VALUES (
        NEW.id, NEW.numero, NEW.cliente_id, NEW.cliente_nome,
        v_titulo, 'aguardando', 'media', NEW.created_by
      )
      RETURNING id, numero INTO v_op_id, v_op_numero;
    END IF;

    -- Create Obra if none exists for this orçamento
    IF NOT EXISTS (SELECT 1 FROM public.obras WHERE orcamento_id = NEW.id) THEN
      INSERT INTO public.obras (
        titulo, cliente_id, cliente_nome,
        orcamento_id, orcamento_numero,
        ordem_producao_id, ordem_producao_numero,
        status, valor, created_by
      ) VALUES (
        v_titulo, NEW.cliente_id, NEW.cliente_nome,
        NEW.id, NEW.numero,
        v_op_id, v_op_numero,
        'planejamento', COALESCE(NEW.total, 0), NEW.created_by
      );
    ELSE
      -- Ensure OP link is set
      UPDATE public.obras
        SET ordem_producao_id = v_op_id,
            ordem_producao_numero = v_op_numero,
            updated_at = now()
        WHERE orcamento_id = NEW.id AND ordem_producao_id IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orc_aprovado_cria_op_obra ON public.orcamentos;
CREATE TRIGGER trg_orc_aprovado_cria_op_obra
  AFTER UPDATE OF status ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_op_e_obra_ao_aprovar();


-- Sync Obra status when OP etapa changes
CREATE OR REPLACE FUNCTION public.sync_obra_com_op()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status public.obra_status;
  v_progresso INTEGER;
BEGIN
  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    v_new_status := CASE NEW.etapa
      WHEN 'aguardando' THEN 'planejamento'::public.obra_status
      WHEN 'corte' THEN 'aguardando_material'::public.obra_status
      WHEN 'montagem' THEN 'aguardando_material'::public.obra_status
      WHEN 'vidracaria' THEN 'aguardando_material'::public.obra_status
      WHEN 'acabamento' THEN 'aguardando_material'::public.obra_status
      WHEN 'finalizado' THEN 'em_medicao'::public.obra_status
      WHEN 'entregue' THEN 'em_instalacao'::public.obra_status
      WHEN 'cancelada' THEN 'cancelada'::public.obra_status
      ELSE NULL
    END;

    v_progresso := CASE NEW.etapa
      WHEN 'aguardando' THEN 5
      WHEN 'corte' THEN 20
      WHEN 'montagem' THEN 40
      WHEN 'vidracaria' THEN 60
      WHEN 'acabamento' THEN 75
      WHEN 'finalizado' THEN 85
      WHEN 'entregue' THEN 95
      ELSE 0
    END;

    IF v_new_status IS NOT NULL THEN
      UPDATE public.obras
        SET status = v_new_status,
            progresso = GREATEST(progresso, v_progresso),
            updated_at = now()
        WHERE ordem_producao_id = NEW.id
          AND status NOT IN ('concluida','cancelada');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_op_sync_obra ON public.ordens_producao;
CREATE TRIGGER trg_op_sync_obra
  AFTER UPDATE OF etapa ON public.ordens_producao
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_obra_com_op();


-- When Obra is marked concluida, stamp data_entrega_real
CREATE OR REPLACE FUNCTION public.obra_marcar_entrega()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.data_entrega_real IS NULL THEN
      NEW.data_entrega_real := CURRENT_DATE;
    END IF;
    NEW.progresso := 100;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obra_entrega ON public.obras;
CREATE TRIGGER trg_obra_entrega
  BEFORE UPDATE OF status ON public.obras
  FOR EACH ROW
  EXECUTE FUNCTION public.obra_marcar_entrega();
