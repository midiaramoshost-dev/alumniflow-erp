import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, Mail, Lock, User, Eye, EyeOff, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

const signUpSchema = signInSchema.extend({
  full_name: z.string().trim().min(2, "Informe seu nome").max(100),
});

type Mode = "signin" | "signup";

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [showPw, setShowPw] = useState(false);

  const pendingInvite = () => {
    try {
      return sessionStorage.getItem("pending_invite");
    } catch {
      return null;
    }
  };
  const postAuthRedirect = () => {
    const token = pendingInvite();
    if (token) {
      sessionStorage.removeItem("pending_invite");
      navigate({ to: "/invite/$token", params: { token } });
    } else {
      navigate({ to: "/dashboard" });
    }
  };

  if (loading) return null;
  if (user) {
    const token = pendingInvite();
    if (token) return <Navigate to="/invite/$token" params={{ token }} replace />;
    return <Navigate to="/dashboard" replace />;
  }

  const onSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
    postAuthRedirect();
  };

  const onSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
      full_name: fd.get("full_name"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: parsed.data.full_name },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Você já pode entrar.");
    setMode("signin");
  };

  const onGoogle = async () => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      setBusy(false);
      toast.error("Falha ao entrar com Google");
      return;
    }
    if (!res.redirected) postAuthRedirect();
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#0b1120] p-4 overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[15%] -left-[10%] h-[45%] w-[45%] rounded-full bg-blue-600/25 blur-[140px]" />
        <div className="absolute -bottom-[15%] -right-[10%] h-[45%] w-[45%] rounded-full bg-cyan-500/15 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md animate-fade-in">
        <div
          className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-blue-950/40"
          style={{ backdropFilter: "blur(24px) saturate(140%)" }}
        >
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-600/40 ring-1 ring-white/20">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7 text-white"
              >
                <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" />
                <path d="M3 21h18M9 7h1M9 11h1M14 7h1M14 11h1M10 21v-4h4v4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              CRM <span className="text-blue-400">CRISTIANO</span>
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              Gestão para esquadrias e vidraçaria
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-8 flex border-b border-white/10">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors ${
                mode === "signin"
                  ? "border-b-2 border-blue-500 text-white"
                  : "border-b-2 border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors ${
                mode === "signup"
                  ? "border-b-2 border-blue-500 text-white"
                  : "border-b-2 border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Criar conta
            </button>
          </div>

          {/* Forms */}
          {mode === "signin" ? (
            <form onSubmit={onSignIn} className="space-y-5">
              <Field
                id="si-email"
                name="email"
                type="email"
                label="E-mail"
                placeholder="seu@email.com"
                autoComplete="email"
                icon={<Mail className="h-4 w-4" />}
                required
              />
              <PasswordField
                id="si-password"
                label="Senha"
                autoComplete="current-password"
                show={showPw}
                onToggle={() => setShowPw((s) => !s)}
                rightSlot={
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-400 hover:text-blue-300"
                    onClick={() =>
                      toast.info("Peça um novo link de convite ao administrador.")
                    }
                  >
                    Esqueceu?
                  </button>
                }
              />
              <SubmitButton busy={busy} label="Entrar no sistema" />
            </form>
          ) : (
            <form onSubmit={onSignUp} className="space-y-5">
              <Field
                id="su-name"
                name="full_name"
                label="Nome completo"
                placeholder="Seu nome"
                icon={<User className="h-4 w-4" />}
                required
              />
              <Field
                id="su-email"
                name="email"
                type="email"
                label="E-mail"
                placeholder="seu@email.com"
                autoComplete="email"
                icon={<Mail className="h-4 w-4" />}
                required
              />
              <PasswordField
                id="su-password"
                label="Senha"
                autoComplete="new-password"
                show={showPw}
                onToggle={() => setShowPw((s) => !s)}
                minLength={6}
              />
              <SubmitButton busy={busy} label="Criar conta" />
              <p className="text-center text-xs text-slate-500">
                O primeiro usuário criado será automaticamente Administrador.
              </p>
            </form>
          )}

          {/* Divider */}
          <div className="relative my-8 flex items-center">
            <div className="h-px flex-1 bg-white/10" />
            <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              ou
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Google */}
          <button
            type="button"
            disabled={busy}
            onClick={onGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 py-3 text-sm font-medium text-white transition-all hover:bg-white/10 disabled:opacity-60"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09A6.98 6.98 0 0 1 5.5 12c0-.73.13-1.44.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            Continuar com Google
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} CRM CRISTIANO · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function Field({
  id,
  name,
  type = "text",
  label,
  placeholder,
  autoComplete,
  icon,
  required,
}: {
  id: string;
  name: string;
  type?: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  icon?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
            {icon}
          </span>
        )}
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-white/10 bg-white/5 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition-all focus:border-blue-500 focus:bg-white/[0.07] focus:ring-2 focus:ring-blue-500/40 ${
            icon ? "pl-10 pr-4" : "px-4"
          }`}
        />
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  minLength,
  show,
  onToggle,
  rightSlot,
}: {
  id: string;
  label: string;
  autoComplete?: string;
  minLength?: number;
  show: boolean;
  onToggle: () => void;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
        >
          {label}
        </label>
        {rightSlot}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
          <Lock className="h-4 w-4" />
        </span>
        <input
          id={id}
          name="password"
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className="w-full rounded-lg border border-white/10 bg-white/5 py-3 pl-10 pr-11 text-sm text-white placeholder:text-slate-500 outline-none transition-all focus:border-blue-500 focus:bg-white/[0.07] focus:ring-2 focus:ring-blue-500/40"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-3 flex items-center text-slate-500 transition-colors hover:text-slate-200"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function SubmitButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="group flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 active:scale-[0.98] disabled:opacity-70"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}
