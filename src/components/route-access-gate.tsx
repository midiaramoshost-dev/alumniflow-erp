import { useRouterState, Link } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { canAccessRoute, getRouteAccess, firstAllowedRoute } from "@/lib/route-access";
import { roleLabel } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type ReactNode } from "react";

export function RouteAccessGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { loading, user, roles } = useAuth();

  if (loading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (canAccessRoute(pathname, roles)) return <>{children}</>;

  const entry = getRouteAccess(pathname);
  const required = entry?.roles ?? [];
  const landing = firstAllowedRoute(roles);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-5 rounded-lg border border-dashed p-10 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <ShieldAlert className="h-10 w-10 text-destructive" />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">
          Seu perfil não tem permissão para acessar esta área.
        </p>
      </div>

      <div className="w-full space-y-3 rounded-md bg-muted/40 p-4 text-left text-sm">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Perfis necessários
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {required.length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : (
              required.map((r) => (
                <Badge key={r} variant="default">
                  {roleLabel(r)}
                </Badge>
              ))
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Seus perfis atuais
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {roles.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Nenhum perfil atribuído
              </span>
            ) : (
              roles.map((r) => (
                <Badge key={r} variant="secondary">
                  {roleLabel(r)}
                </Badge>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" asChild>
          <Link to={landing}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao início
          </Link>
        </Button>
      </div>
    </div>
  );
}
