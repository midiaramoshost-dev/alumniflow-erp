
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor', 'producao', 'financeiro_obra');

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========================================
-- USER ROLES
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- Trigger: auto-create profile + default role on signup
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.email);

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first_user;

  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendedor');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- Common updated_at trigger
-- =========================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================
-- CLIENTES
-- =========================================
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL DEFAULT 'PF' CHECK (tipo IN ('PF','PJ')),
  nome TEXT NOT NULL,
  documento TEXT,
  email TEXT,
  telefone TEXT,
  celular TEXT,
  cep TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Auth update clientes" ON public.clientes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete clientes" ON public.clientes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================
-- PERFIS DE ALUMÍNIO
-- =========================================
CREATE TABLE public.perfis_aluminio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  linha TEXT,
  cor TEXT,
  acabamento TEXT,
  comprimento_barra_mm INTEGER NOT NULL DEFAULT 6000,
  peso_kg_m NUMERIC(10,3),
  preco_kg NUMERIC(10,2),
  preco_metro NUMERIC(10,2),
  estoque_atual NUMERIC(10,2) DEFAULT 0,
  estoque_minimo NUMERIC(10,2) DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis_aluminio TO authenticated;
GRANT ALL ON public.perfis_aluminio TO service_role;
ALTER TABLE public.perfis_aluminio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view perfis" ON public.perfis_aluminio FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage perfis" ON public.perfis_aluminio FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update perfis" ON public.perfis_aluminio FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete perfis" ON public.perfis_aluminio FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'producao'));
CREATE TRIGGER trg_perfis_updated BEFORE UPDATE ON public.perfis_aluminio
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================
-- VIDROS
-- =========================================
CREATE TABLE public.vidros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  tipo TEXT,
  espessura_mm NUMERIC(6,2),
  cor TEXT,
  preco_m2 NUMERIC(10,2),
  estoque_m2 NUMERIC(10,2) DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vidros TO authenticated;
GRANT ALL ON public.vidros TO service_role;
ALTER TABLE public.vidros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view vidros" ON public.vidros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert vidros" ON public.vidros FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update vidros" ON public.vidros FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete vidros" ON public.vidros FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'producao'));
CREATE TRIGGER trg_vidros_updated BEFORE UPDATE ON public.vidros
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================
-- ACESSORIOS
-- =========================================
CREATE TABLE public.acessorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  categoria TEXT,
  unidade TEXT NOT NULL DEFAULT 'UN',
  preco_unitario NUMERIC(10,2),
  estoque_atual NUMERIC(10,2) DEFAULT 0,
  estoque_minimo NUMERIC(10,2) DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acessorios TO authenticated;
GRANT ALL ON public.acessorios TO service_role;
ALTER TABLE public.acessorios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view acessorios" ON public.acessorios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert acessorios" ON public.acessorios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update acessorios" ON public.acessorios FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete acessorios" ON public.acessorios FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'producao'));
CREATE TRIGGER trg_acessorios_updated BEFORE UPDATE ON public.acessorios
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
