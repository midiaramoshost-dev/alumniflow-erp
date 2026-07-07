
-- Convites de usuários
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT,
  role public.app_role NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar todos os convites
CREATE POLICY "Admins gerenciam convites"
ON public.invitations FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_invitations_token ON public.invitations(token);

-- Função para aceitar convite: valida token, atribui role, marca como usado
CREATE OR REPLACE FUNCTION public.accept_invitation(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.invitations;
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_invite FROM public.invitations WHERE token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;
  IF v_invite.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  -- Atribui role (idempotente)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, v_invite.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.invitations
    SET used_at = now(), used_by = v_uid
    WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'role', v_invite.role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;
