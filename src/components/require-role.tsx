import { type ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PageShell } from "@/components/page-shell";
import { ShieldAlert, Loader2, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { type AppRole, roleLabel } from "@/lib/roles";

export function RequireRole({
  roles,
  children,
}: {
  roles: AppRole[];
  children: ReactNode;
}) {
  const { loading, user, roles: userRoles } = useAuth();
  const router = useRouter();
  const notified = useRef(false);

  const allowed = !loading && !!user && userRoles.some((r) => roles.includes(r as AppRole));

  useEffect(() => {
    if (loading || !user) return;
    if (!allowed && !notified.current) {
      notified.current = true;
      toast.error("Acesso negado", {
        description: `Esta área requer perfil: ${roles.map(roleLabel).join(", ")}.`,
      });
    }
  }, [loading, user, allowed, roles]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  if (!allowed) {
    return (
      <PageShell title="Acesso restrito" description="Você não tem permissão para esta página">
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-5 rounded-lg border border-dashed p-10 text-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold">Permissão insuficiente</p>
            <p className="text-sm text-muted-foreground">
              Você não tem o perfil necessário para acessar esta área.
            </p>
          </div>

          <div className="w-full space-y-3 rounded-md bg-muted/40 p-4 text-left text-sm">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Perfis necessários
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {roles.map((r) => (
                  <Badge key={r} variant="default">
                    {roleLabel(r)}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Seus perfis atuais
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {userRoles.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Nenhum perfil atribuído
                  </span>
                ) : (
                  userRoles.map((r) => (
                    <Badge key={r} variant="secondary">
                      {roleLabel(r)}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Solicite ao administrador do sistema a permissão adequada.
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => router.history.back()}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <Button asChild>
              <Link to="/dashboard">Ir ao Dashboard</Link>
            </Button>
            <Button asChild variant="ghost">
              <a href="mailto:admin@crmcristiano.com?subject=Solicitação%20de%20acesso">
                <Mail className="mr-1 h-4 w-4" /> Solicitar acesso
              </a>
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return <>{children}</>;
}
