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
  Zap,
  User as UserIcon,
  Ruler,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { canAccessRoute } from "@/lib/route-access";
import type { AppRole } from "@/lib/roles";

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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  soon?: boolean;
};

const nav: { label: string; items: NavItem[] }[] = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Direct", url: "/direct", icon: Zap },
      { title: "Pedidos", url: "/pedidos", icon: Workflow },
      { title: "Pipeline", url: "/pipeline", icon: Workflow },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Clientes", url: "/clientes", icon: Users },
      { title: "Perfis de Alumínio", url: "/perfis", icon: Layers },
      { title: "Vidros", url: "/vidros", icon: Square },
      { title: "Acessórios", url: "/acessorios", icon: Package },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Vendas", url: "/vendas", icon: ShoppingCart },
      { title: "Comercial", url: "/comercial", icon: Briefcase },
      { title: "Produção", url: "/producao", icon: Factory },
      { title: "Controle Fabril", url: "/controle-fabril", icon: Cog },
      { title: "Obras", url: "/obras", icon: Building },
      { title: "Materiais", url: "/materiais", icon: Boxes },
      { title: "Financeiro", url: "/financeiro", icon: Wallet },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Admin Master", url: "/admin", icon: ShieldCheck },
      { title: "Exportar dados", url: "/exportar", icon: FileSpreadsheet },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { roles: userRoles } = useAuth();
  const visibleNav = nav
    .map((g) => ({ ...g, items: g.items.filter((it) => canAccessRoute(it.url, userRoles)) }))
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
