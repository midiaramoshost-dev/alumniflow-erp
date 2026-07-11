import { createFileRoute, Outlet, redirect, useRouterState, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { RouteAccessGate } from "@/components/route-access-gate";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const titles: Record<string, string> = {
  dashboard: "Dashboard",
  direct: "Direct",
  pedidos: "Pedidos",
  pipeline: "Pipeline",
  clientes: "Clientes",
  perfis: "Perfis de Alumínio",
  vidros: "Vidros",
  acessorios: "Acessórios",
  vendas: "Vendas",
  comercial: "Comercial",
  producao: "Produção",
  "controle-fabril": "Controle Fabril",
  obras: "Obras",
  materiais: "Materiais",
  financeiro: "Financeiro",
  admin: "Admin Master",
  exportar: "Exportar dados",
  configuracoes: "Configurações",
};

function AuthLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  const title = titles[segment] ?? "Dashboard";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/40">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center gap-2 md:gap-3 border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 px-3 md:px-6 safe-top">
            <SidebarTrigger className="-ml-1 hover:bg-accent rounded-md" />
            <div className="hidden md:block h-6 w-px bg-border" aria-hidden />
            <Breadcrumb className="min-w-0 flex-1">
              <BreadcrumbList className="text-[13px] flex-nowrap">
                <BreadcrumbItem className="hidden sm:flex">
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard" className="font-display font-semibold tracking-tight text-foreground/80 hover:text-foreground transition-colors">
                      CRM CRISTIANO
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:flex" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-foreground truncate max-w-[55vw] sm:max-w-none">{title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1.5 md:gap-2 shrink-0">
              <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-muted-foreground border border-border/70 rounded-md px-2 py-1 bg-muted/40">
                <span className="uppercase tracking-wider font-medium">ambiente</span>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="font-semibold text-foreground/80">Produção</span>
              </div>
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
            <RouteAccessGate>
              <Outlet />
            </RouteAccessGate>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
