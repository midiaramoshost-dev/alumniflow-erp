
-- 1) Trigger de validação entrada/saída por setor
CREATE OR REPLACE FUNCTION public.obras_validar_setores()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pares text[][] := ARRAY[
    ARRAY['Corte',       'data_corte_entrada',       'data_corte_saida'],
    ARRAY['Usinagem',    'data_usinagem_entrada',    'data_usinagem_saida'],
    ARRAY['Montagem',    'data_montagem_entrada',    'data_montagem_saida'],
    ARRAY['Vidraçaria',  'data_vidracaria_entrada',  'data_vidracaria_saida'],
    ARRAY['Acabamento',  'data_acabamento_entrada',  'data_acabamento_saida'],
    ARRAY['Conferência', 'data_conferencia_entrada', 'data_conferencia_saida']
  ];
  par text[];
  v_ent timestamptz;
  v_sai timestamptz;
  v_row jsonb := to_jsonb(NEW);
BEGIN
  FOREACH par SLICE 1 IN ARRAY pares LOOP
    v_ent := NULLIF(v_row ->> par[2], '')::timestamptz;
    v_sai := NULLIF(v_row ->> par[3], '')::timestamptz;

    IF v_sai IS NOT NULL AND v_ent IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = format('%s: não é possível registrar saída sem entrada.', par[1]),
        HINT = par[2];
    END IF;

    IF v_ent IS NOT NULL AND v_sai IS NOT NULL AND v_sai < v_ent THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = format('%s: saída não pode ser anterior à entrada.', par[1]),
        HINT = par[3];
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS obras_validar_setores_trg ON public.obras;
CREATE TRIGGER obras_validar_setores_trg
BEFORE INSERT OR UPDATE ON public.obras
FOR EACH ROW EXECUTE FUNCTION public.obras_validar_setores();

-- 2) RLS: separar ALL em políticas específicas com escopo por criador
DROP POLICY IF EXISTS "Obras gerenciadas por admin/producao/financeiro" ON public.obras;

CREATE POLICY "Obras: inserir por papel autorizado"
ON public.obras
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'producao'::app_role)
     OR has_role(auth.uid(), 'financeiro_obra'::app_role))
    AND created_by = auth.uid()
  )
);

CREATE POLICY "Obras: atualizar próprias ou admin"
ON public.obras
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'producao'::app_role)
     OR has_role(auth.uid(), 'financeiro_obra'::app_role))
    AND created_by = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'producao'::app_role)
     OR has_role(auth.uid(), 'financeiro_obra'::app_role))
    AND created_by = auth.uid()
  )
);

CREATE POLICY "Obras: excluir próprias ou admin"
ON public.obras
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'producao'::app_role)
     OR has_role(auth.uid(), 'financeiro_obra'::app_role))
    AND created_by = auth.uid()
  )
);
