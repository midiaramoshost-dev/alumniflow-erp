ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS data_medicao DATE,
  ADD COLUMN IF NOT EXISTS data_envio_tecnico DATE,
  ADD COLUMN IF NOT EXISTS data_compra_vidros DATE,
  ADD COLUMN IF NOT EXISTS data_compra_acessorios DATE,
  ADD COLUMN IF NOT EXISTS data_compra_perfis DATE,
  ADD COLUMN IF NOT EXISTS data_corte DATE,
  ADD COLUMN IF NOT EXISTS cortador_nome TEXT,
  ADD COLUMN IF NOT EXISTS data_usinagem DATE,
  ADD COLUMN IF NOT EXISTS usinador_nome TEXT,
  ADD COLUMN IF NOT EXISTS data_montagem DATE,
  ADD COLUMN IF NOT EXISTS montador_nome TEXT;