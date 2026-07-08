
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS percentual_comissao numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_comissao numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margem_percentual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imposto_percentual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_impostos numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias integer,
  ADD COLUMN IF NOT EXISTS obra_endereco text,
  ADD COLUMN IF NOT EXISTS obra_numero text,
  ADD COLUMN IF NOT EXISTS obra_bairro text,
  ADD COLUMN IF NOT EXISTS obra_cidade text,
  ADD COLUMN IF NOT EXISTS obra_estado text,
  ADD COLUMN IF NOT EXISTS obra_cep text,
  ADD COLUMN IF NOT EXISTS obra_ambiente text,
  ADD COLUMN IF NOT EXISTS obra_pavimento text,
  ADD COLUMN IF NOT EXISTS obra_referencia text;

ALTER TABLE public.orcamento_itens
  ADD COLUMN IF NOT EXISTS cor_perfil text,
  ADD COLUMN IF NOT EXISTS acabamento_perfil text,
  ADD COLUMN IF NOT EXISTS valor_perfil numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_vidro numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_acessorios numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acessorios jsonb NOT NULL DEFAULT '[]'::jsonb;
