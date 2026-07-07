
-- 1) Enums
CREATE TYPE public.pedido_etapa AS ENUM (
  'venda','avaliacao_tecnica','orcamento','corte','usinagem',
  'montagem','vidracaria','acabamento','entrega','concluido','cancelado'
);

CREATE TYPE public.pedido_acao AS ENUM (
  'criar','aceitar','concluir','devolver','comentar','anexar','cancelar','reabrir'
);

-- 2) Pedidos (fluxo unificado)
CREATE TABLE public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero BIGSERIAL NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  etapa public.pedido_etapa NOT NULL DEFAULT 'venda',
  prioridade TEXT NOT NULL DEFAULT 'media',
  valor_estimado NUMERIC(14,2),
  responsavel_atual_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  ordem_producao_id UUID REFERENCES public.ordens_producao(id) ON DELETE SET NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.pedidos_numero_seq TO authenticated;
GRANT ALL ON public.pedidos TO service_role;
GRANT ALL ON SEQUENCE public.pedidos_numero_seq TO service_role;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- 3) Histórico
CREATE TABLE public.pedido_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  acao public.pedido_acao NOT NULL,
  etapa_de public.pedido_etapa,
  etapa_para public.pedido_etapa,
  observacao TEXT,
  motivo TEXT,
  de_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  para_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pedido_historico TO authenticated;
GRANT ALL ON public.pedido_historico TO service_role;
ALTER TABLE public.pedido_historico ENABLE ROW LEVEL SECURITY;

-- 4) Anexos
CREATE TABLE public.pedido_anexos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  etapa public.pedido_etapa NOT NULL,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.pedido_anexos TO authenticated;
GRANT ALL ON public.pedido_anexos TO service_role;
ALTER TABLE public.pedido_anexos ENABLE ROW LEVEL SECURITY;

-- 5) Helpers
CREATE OR REPLACE FUNCTION public.pedido_etapa_papel(_etapa public.pedido_etapa)
RETURNS public.app_role LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _etapa
    WHEN 'venda' THEN 'vendedor'::public.app_role
    WHEN 'orcamento' THEN 'vendedor'::public.app_role
    WHEN 'avaliacao_tecnica' THEN 'producao'::public.app_role
    WHEN 'corte' THEN 'producao'::public.app_role
    WHEN 'usinagem' THEN 'producao'::public.app_role
    WHEN 'montagem' THEN 'producao'::public.app_role
    WHEN 'vidracaria' THEN 'producao'::public.app_role
    WHEN 'acabamento' THEN 'producao'::public.app_role
    WHEN 'entrega' THEN 'producao'::public.app_role
    ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION public.pedido_etapa_proxima(_etapa public.pedido_etapa)
RETURNS public.pedido_etapa LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _etapa
    WHEN 'venda' THEN 'avaliacao_tecnica'::public.pedido_etapa
    WHEN 'avaliacao_tecnica' THEN 'orcamento'::public.pedido_etapa
    WHEN 'orcamento' THEN 'corte'::public.pedido_etapa
    WHEN 'corte' THEN 'usinagem'::public.pedido_etapa
    WHEN 'usinagem' THEN 'montagem'::public.pedido_etapa
    WHEN 'montagem' THEN 'vidracaria'::public.pedido_etapa
    WHEN 'vidracaria' THEN 'acabamento'::public.pedido_etapa
    WHEN 'acabamento' THEN 'entrega'::public.pedido_etapa
    WHEN 'entrega' THEN 'concluido'::public.pedido_etapa
    ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION public.pedido_etapa_anterior(_etapa public.pedido_etapa)
RETURNS public.pedido_etapa LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _etapa
    WHEN 'avaliacao_tecnica' THEN 'venda'::public.pedido_etapa
    WHEN 'orcamento' THEN 'avaliacao_tecnica'::public.pedido_etapa
    WHEN 'corte' THEN 'orcamento'::public.pedido_etapa
    WHEN 'usinagem' THEN 'corte'::public.pedido_etapa
    WHEN 'montagem' THEN 'usinagem'::public.pedido_etapa
    WHEN 'vidracaria' THEN 'montagem'::public.pedido_etapa
    WHEN 'acabamento' THEN 'vidracaria'::public.pedido_etapa
    WHEN 'entrega' THEN 'acabamento'::public.pedido_etapa
    ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION public.pode_agir_no_pedido(_pedido_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_etapa public.pedido_etapa; v_role public.app_role;
BEGIN
  IF _user_id IS NULL THEN RETURN FALSE; END IF;
  IF public.has_role(_user_id, 'admin') THEN RETURN TRUE; END IF;
  SELECT etapa INTO v_etapa FROM public.pedidos WHERE id = _pedido_id;
  IF v_etapa IS NULL OR v_etapa IN ('concluido','cancelado') THEN RETURN FALSE; END IF;
  v_role := public.pedido_etapa_papel(v_etapa);
  IF v_role IS NULL THEN RETURN FALSE; END IF;
  RETURN public.has_role(_user_id, v_role);
END; $$;

-- 6) Ações
CREATE OR REPLACE FUNCTION public.pedido_aceitar(_pedido_id UUID)
RETURNS public.pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.pedidos; v_uid UUID := auth.uid();
BEGIN
  IF NOT public.pode_agir_no_pedido(_pedido_id, v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para agir nesta etapa'; END IF;
  UPDATE public.pedidos SET responsavel_atual_id = v_uid, updated_at = now()
    WHERE id = _pedido_id RETURNING * INTO v_row;
  INSERT INTO public.pedido_historico (pedido_id, acao, etapa_de, etapa_para, para_user_id, de_user_id)
    VALUES (_pedido_id, 'aceitar', v_row.etapa, v_row.etapa, v_uid, v_uid);
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.pedido_avancar(_pedido_id UUID, _observacao TEXT DEFAULT NULL)
RETURNS public.pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.pedidos; v_uid UUID := auth.uid(); v_prox public.pedido_etapa;
BEGIN
  IF NOT public.pode_agir_no_pedido(_pedido_id, v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para avançar esta etapa'; END IF;
  SELECT * INTO v_row FROM public.pedidos WHERE id = _pedido_id;
  v_prox := public.pedido_etapa_proxima(v_row.etapa);
  IF v_prox IS NULL THEN RAISE EXCEPTION 'Etapa final já atingida'; END IF;
  UPDATE public.pedidos SET etapa = v_prox, responsavel_atual_id = NULL, updated_at = now()
    WHERE id = _pedido_id RETURNING * INTO v_row;
  INSERT INTO public.pedido_historico (pedido_id, acao, etapa_de, etapa_para, observacao, de_user_id)
    VALUES (_pedido_id, 'concluir', public.pedido_etapa_anterior(v_prox), v_prox, _observacao, v_uid);
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.pedido_devolver(_pedido_id UUID, _motivo TEXT)
RETURNS public.pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.pedidos; v_uid UUID := auth.uid(); v_ant public.pedido_etapa;
BEGIN
  IF _motivo IS NULL OR length(trim(_motivo)) = 0 THEN
    RAISE EXCEPTION 'Informe o motivo da devolução'; END IF;
  IF NOT public.pode_agir_no_pedido(_pedido_id, v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para devolver esta etapa'; END IF;
  SELECT * INTO v_row FROM public.pedidos WHERE id = _pedido_id;
  v_ant := public.pedido_etapa_anterior(v_row.etapa);
  IF v_ant IS NULL THEN RAISE EXCEPTION 'Não há etapa anterior'; END IF;
  UPDATE public.pedidos SET etapa = v_ant, responsavel_atual_id = NULL, updated_at = now()
    WHERE id = _pedido_id RETURNING * INTO v_row;
  INSERT INTO public.pedido_historico (pedido_id, acao, etapa_de, etapa_para, motivo, de_user_id)
    VALUES (_pedido_id, 'devolver', public.pedido_etapa_proxima(v_ant), v_ant, _motivo, v_uid);
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.pedido_cancelar(_pedido_id UUID, _motivo TEXT)
RETURNS public.pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.pedidos; v_uid UUID := auth.uid();
BEGIN
  IF NOT (public.has_role(v_uid, 'admin') OR public.pode_agir_no_pedido(_pedido_id, v_uid)) THEN
    RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO v_row FROM public.pedidos WHERE id = _pedido_id;
  UPDATE public.pedidos SET etapa = 'cancelado', responsavel_atual_id = NULL, updated_at = now()
    WHERE id = _pedido_id RETURNING * INTO v_row;
  INSERT INTO public.pedido_historico (pedido_id, acao, etapa_de, etapa_para, motivo, de_user_id)
    VALUES (_pedido_id, 'cancelar', v_row.etapa, 'cancelado', _motivo, v_uid);
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.pedido_comentar(_pedido_id UUID, _observacao TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_etapa public.pedido_etapa;
BEGIN
  SELECT etapa INTO v_etapa FROM public.pedidos WHERE id = _pedido_id;
  IF v_etapa IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  INSERT INTO public.pedido_historico (pedido_id, acao, etapa_de, etapa_para, observacao, de_user_id)
    VALUES (_pedido_id, 'comentar', v_etapa, v_etapa, _observacao, v_uid);
END; $$;

-- 7) RLS
CREATE POLICY "auth_select_pedidos" ON public.pedidos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_pedidos" ON public.pedidos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "auth_update_pedidos" ON public.pedidos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.pode_agir_no_pedido(id, auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.pode_agir_no_pedido(id, auth.uid()));
CREATE POLICY "admin_delete_pedidos" ON public.pedidos
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "auth_select_hist" ON public.pedido_historico
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_hist" ON public.pedido_historico
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = de_user_id);

CREATE POLICY "auth_select_anexos" ON public.pedido_anexos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_anexos" ON public.pedido_anexos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by
    AND (public.has_role(auth.uid(),'admin') OR public.pode_agir_no_pedido(pedido_id, auth.uid())));
CREATE POLICY "auth_delete_anexos" ON public.pedido_anexos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR uploaded_by = auth.uid());

-- 8) Triggers
CREATE TRIGGER tg_pedidos_updated
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.pedido_registrar_criacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.pedido_historico (pedido_id, acao, etapa_de, etapa_para, de_user_id)
    VALUES (NEW.id, 'criar', NULL, NEW.etapa, NEW.created_by);
  RETURN NEW;
END; $$;

CREATE TRIGGER tg_pedidos_criacao
  AFTER INSERT ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedido_registrar_criacao();
