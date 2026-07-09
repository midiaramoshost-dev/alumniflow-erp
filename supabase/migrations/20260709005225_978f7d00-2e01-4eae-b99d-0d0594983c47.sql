
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS data_corte_entrada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_corte_saida TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_usinagem_entrada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_usinagem_saida TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_montagem_entrada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_montagem_saida TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_vidracaria_entrada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_vidracaria_saida TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_acabamento_entrada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_acabamento_saida TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_conferencia_entrada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_conferencia_saida TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vidraceiro_nome TEXT,
  ADD COLUMN IF NOT EXISTS acabador_nome TEXT;

-- Backfill saídas com as datas já registradas (mantém histórico)
UPDATE public.obras SET data_corte_saida = data_corte::timestamptz
  WHERE data_corte IS NOT NULL AND data_corte_saida IS NULL;
UPDATE public.obras SET data_usinagem_saida = data_usinagem::timestamptz
  WHERE data_usinagem IS NOT NULL AND data_usinagem_saida IS NULL;
UPDATE public.obras SET data_montagem_saida = data_montagem::timestamptz
  WHERE data_montagem IS NOT NULL AND data_montagem_saida IS NULL;
UPDATE public.obras SET data_conferencia_saida = data_conferencia::timestamptz
  WHERE data_conferencia IS NOT NULL AND data_conferencia_saida IS NULL;
