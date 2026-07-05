
-- Enum status obra
DO $$ BEGIN
  CREATE TYPE public.obra_status AS ENUM (
    'planejamento','aguardando_material','em_medicao','em_instalacao','concluida','cancelada'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.obra_cronograma_status AS ENUM (
    'pendente','em_andamento','concluida','atrasada'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Sequence for numero
CREATE SEQUENCE IF NOT EXISTS public.obras_numero_seq START 3000;

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL DEFAULT nextval('public.obras_numero_seq') UNIQUE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  orcamento_numero INTEGER,
  ordem_producao_id UUID REFERENCES public.ordens_producao(id) ON DELETE SET NULL,
  ordem_producao_numero INTEGER,
  status public.obra_status NOT NULL DEFAULT 'planejamento',
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responsavel_nome TEXT,
  logradouro TEXT,
  numero_endereco TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  data_inicio_prevista DATE,
  data_entrega_prevista DATE,
  data_entrega_real DATE,
  valor NUMERIC(14,2) DEFAULT 0,
  progresso INTEGER NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT ALL ON public.obras TO service_role;
GRANT USAGE ON SEQUENCE public.obras_numero_seq TO authenticated;

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Obras visíveis para autenticados" ON public.obras
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Obras gerenciadas por admin/producao/financeiro" ON public.obras
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'producao') OR
    public.has_role(auth.uid(), 'financeiro_obra')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'producao') OR
    public.has_role(auth.uid(), 'financeiro_obra')
  );

CREATE TRIGGER trg_obras_updated_at BEFORE UPDATE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Medições
CREATE TABLE IF NOT EXISTS public.obra_medicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  ambiente TEXT NOT NULL,
  largura_mm INTEGER,
  altura_mm INTEGER,
  quantidade INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT,
  data_medicao DATE NOT NULL DEFAULT CURRENT_DATE,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_medicoes TO authenticated;
GRANT ALL ON public.obra_medicoes TO service_role;

ALTER TABLE public.obra_medicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Medições visíveis" ON public.obra_medicoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Medições gerenciadas" ON public.obra_medicoes
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'producao') OR
    public.has_role(auth.uid(), 'financeiro_obra')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'producao') OR
    public.has_role(auth.uid(), 'financeiro_obra')
  );

CREATE TRIGGER trg_obra_medicoes_updated_at BEFORE UPDATE ON public.obra_medicoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Cronograma
CREATE TABLE IF NOT EXISTS public.obra_cronograma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 1,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_prevista DATE,
  data_conclusao DATE,
  status public.obra_cronograma_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_cronograma TO authenticated;
GRANT ALL ON public.obra_cronograma TO service_role;

ALTER TABLE public.obra_cronograma ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cronograma visível" ON public.obra_cronograma
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cronograma gerenciado" ON public.obra_cronograma
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'producao') OR
    public.has_role(auth.uid(), 'financeiro_obra')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'producao') OR
    public.has_role(auth.uid(), 'financeiro_obra')
  );

CREATE TRIGGER trg_obra_cronograma_updated_at BEFORE UPDATE ON public.obra_cronograma
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Materiais
CREATE TABLE IF NOT EXISTS public.obra_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  unidade TEXT DEFAULT 'un',
  quantidade_prevista NUMERIC(14,3) NOT NULL DEFAULT 0,
  quantidade_utilizada NUMERIC(14,3) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_materiais TO authenticated;
GRANT ALL ON public.obra_materiais TO service_role;

ALTER TABLE public.obra_materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Materiais obra visíveis" ON public.obra_materiais
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Materiais obra gerenciados" ON public.obra_materiais
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'producao') OR
    public.has_role(auth.uid(), 'financeiro_obra')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'producao') OR
    public.has_role(auth.uid(), 'financeiro_obra')
  );

CREATE TRIGGER trg_obra_materiais_updated_at BEFORE UPDATE ON public.obra_materiais
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.obras;
ALTER PUBLICATION supabase_realtime ADD TABLE public.obra_medicoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.obra_cronograma;
ALTER PUBLICATION supabase_realtime ADD TABLE public.obra_materiais;
