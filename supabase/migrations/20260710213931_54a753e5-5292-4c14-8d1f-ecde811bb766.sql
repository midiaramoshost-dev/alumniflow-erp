
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS medidor_nome TEXT,
  ADD COLUMN IF NOT EXISTS data_medicao DATE,
  ADD COLUMN IF NOT EXISTS servico_descricao TEXT;
