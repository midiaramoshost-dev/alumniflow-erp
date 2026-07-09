import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Layers,
  Square,
  Package,
  ShoppingCart,
  Factory,
  Building,
  Workflow,
  Wallet,
  Settings,
  Building2,
  Boxes,
  Briefcase,
  Cog,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type AppRole = "admin" | "vendedor" | "producao" | "financeiro_obra";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles?: AppRole[]; // if omitted, visible to any authenticated user
  soon?: boolean;
};

const nav: { label: string; items: NavItem[] }[] = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Pedidos", url: "/pedidos", icon: Workflow },
      { title: "Pipeline", url: "/pipeline", icon: Workflow },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Clientes", url: "/clientes", icon: Users, roles: ["admin", "vendedor"] },
      { title: "Perfis de Alumínio", url: "/perfis", icon: Layers, roles: ["admin", "producao"] },
      { title: "Vidros", url: "/vidros", icon: Square, roles: ["admin", "producao"] },
      { title: "Acessórios", url: "/acessorios", icon: Package, roles: ["admin", "producao"] },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Vendas", url: "/vendas", icon: ShoppingCart, roles: ["admin", "vendedor"] },
      { title: "Comercial", url: "/comercial", icon: Briefcase, roles: ["admin", "vendedor"] },
      { title: "Produção", url: "/producao", icon: Factory, roles: ["admin", "producao"] },
      { title: "Controle Fabril", url: "/controle-fabril", icon: Cog, roles: ["admin", "producao"] },
      { title: "Obras", url: "/obras", icon: Building, roles: ["admin", "producao", "financeiro_obra"] },
      { title: "Materiais", url: "/materiais", icon: Boxes, roles: ["admin", "producao"] },
      { title: "Financeiro", url: "/financeiro", icon: Wallet, roles: ["admin", "financeiro_obra"] },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Admin Master", url: "/admin", icon: ShieldCheck, roles: ["admin"] },
      { title: "Exportar dados", url: "/exportar", icon: FileSpreadsheet, roles: ["admin"] },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { roles: userRoles } = useAuth();
  const canSee = (item: NavItem) =>
    !item.roles || item.roles.some((r) => userRoles.includes(r));
  const visibleNav = nav
    .map((g) => ({ ...g, items: g.items.filter(canSee) }))
    .filter((g) => g.items.length > 0);


  return (
    <Sidebar collapsible="icon" className="bg-gradient-sidebar border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/60 bg-transparent">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-primary shadow-elegant">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-sidebar-foreground">CRM CRISTIANO</span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                ERP Esquadrias
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-transparent">
        {visibleNav.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname === item.url;
                  const disabled = "soon" in item && item.soon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild={!disabled}
                        isActive={active}
                        tooltip={item.title}
                        className={disabled ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        {disabled ? (
                          <div className="flex items-center gap-2 w-full">
                            <item.icon className="h-4 w-4" />
                            {!collapsed && (
                              <>
                                <span>{item.title}</span>
                                <span className="ml-auto text-[9px] uppercase tracking-wider rounded bg-sidebar-accent px-1.5 py-0.5">
                                  em breve
                                </span>
                              </>
                            )}
                          </div>
                        ) : (
                          <Link to={item.url}>
                            <item.icon className="h-4 w-4" />
                            {!collapsed && <span>{item.title}</span>}
                          </Link>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
