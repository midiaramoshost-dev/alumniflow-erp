ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS data_conferencia DATE,
  ADD COLUMN IF NOT EXISTS conferido_por TEXT;