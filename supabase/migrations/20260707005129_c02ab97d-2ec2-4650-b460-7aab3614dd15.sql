CREATE SEQUENCE IF NOT EXISTS public.clientes_proposta_seq START 1000;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS numero_proposta TEXT,
  ADD COLUMN IF NOT EXISTS data_venda DATE,
  ADD COLUMN IF NOT EXISTS valor_total NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comissao_percentual NUMERIC(5,2);

CREATE INDEX IF NOT EXISTS idx_clientes_vendedor ON public.clientes(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_clientes_numero_proposta ON public.clientes(numero_proposta);