import { type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PageShell } from "@/components/page-shell";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

type AppRole = "admin" | "vendedor" | "producao" | "financeiro_obra";

export function RequireRole({
  roles,
  children,
}: {
  roles: AppRole[];
  children: ReactNode;
}) {
  const { loading, user, roles: userRoles } = useAuth();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  const allowed = userRoles.some((r) => roles.includes(r));
  if (!allowed) {
    return (
      <PageShell title="Acesso restrito" description="Você não tem permissão para esta página">
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-10 text-center">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <div>
            <p className="font-medium">Permissão insuficiente</p>
            <p className="text-sm text-muted-foreground">
              Esta área é restrita a: {roles.join(", ")}.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard">Voltar ao Dashboard</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return <>{children}</>;
}
