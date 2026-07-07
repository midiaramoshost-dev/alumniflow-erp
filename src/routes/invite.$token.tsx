import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, ShieldAlert, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

type AcceptResult = { ok: boolean; role?: string; error?: string };

const errorMessages: Record<string, string> = {
  not_authenticated: "Você precisa entrar para aceitar o convite.",
  invalid: "Convite inválido ou não encontrado.",
  already_used: "Este convite já foi utilizado.",
  expired: "Este convite expirou.",
};

function InvitePage() {
  const { token } = useParams({ from: "/invite/$token" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Guarda o token e manda para /auth; volta aqui após autenticar
      try {
        sessionStorage.setItem("pending_invite", token);
      } catch {
        /* ignore */
      }
      navigate({ to: "/auth" });
      return;
    }

    let cancelled = false;
    (async () => {
      setStatus("working");
      const { data, error } = await (
        supabase as unknown as {
          rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: AcceptResult | null; error: { message: string } | null }>;
        }
      ).rpc("accept_invitation", { _token: token });

      if (cancelled) return;

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      const result = data as AcceptResult | null;
      if (!result?.ok) {
        setStatus("error");
        setMessage(errorMessages[result?.error ?? ""] ?? "Não foi possível aceitar o convite.");
        return;
      }
      try {
        sessionStorage.removeItem("pending_invite");
      } catch {
        /* ignore */
      }
      setStatus("success");
      setMessage(`Nível de acesso concedido: ${result.role}`);
      toast.success("Convite aceito!");
      setTimeout(() => navigate({ to: "/dashboard" }), 1500);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-primary shadow-elegant">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">CRM CRISTIANO</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Convite de acesso</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8">
            {(status === "idle" || status === "working") && (
              <div className="text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin inline mr-2" />
                Processando convite…
              </div>
            )}
            {status === "success" && (
              <div>
                <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-3" />
                <p className="font-medium">Convite aceito com sucesso!</p>
                <p className="text-sm text-muted-foreground mt-1">{message}</p>
              </div>
            )}
            {status === "error" && (
              <div>
                <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
                <p className="font-medium">Não foi possível aceitar</p>
                <p className="text-sm text-muted-foreground mt-1">{message}</p>
                <Button className="mt-6" onClick={() => navigate({ to: "/dashboard" })}>
                  Ir ao painel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
