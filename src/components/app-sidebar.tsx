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
  const routerState = useRouterState({ select: (r) => r.location });
  const pathname = routerState.pathname;
  const currentEtapa =
    (routerState.search as { etapa?: string } | undefined)?.etapa ?? "cliente";
  const { roles: userRoles } = useAuth();
  const visibleNav = nav
    .map((g) => ({ ...g, items: g.items.filter((it) => canAccessRoute(it.url, userRoles)) }))
    .filter((g) => g.items.length > 0);

  const directSubs: {
    etapa: "cliente" | "medicao" | "servico" | "materiais" | "revisao";
    label: string;
    icon: typeof UserIcon;
    roles: AppRole[];
  }[] = [
    { etapa: "cliente", label: "Cliente", icon: UserIcon, roles: ["admin", "vendedor"] },
    { etapa: "medicao", label: "Medição", icon: Ruler, roles: ["admin", "vendedor", "medidor"] },
    { etapa: "servico", label: "Serviço", icon: ClipboardList, roles: ["admin", "vendedor", "tecnico"] },
    { etapa: "materiais", label: "Materiais", icon: Package, roles: ["admin", "vendedor", "tecnico", "producao"] },
    { etapa: "revisao", label: "Revisão", icon: CheckCircle2, roles: ["admin", "vendedor"] },
  ];
  const roleAllows = (allowed: AppRole[]) =>
    userRoles.includes("admin") || allowed.some((r) => userRoles.includes(r));


  return (
    <Sidebar collapsible="icon" className="bg-gradient-sidebar border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60 bg-transparent">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant ring-1 ring-white/10">
            <Building2 className="h-4 w-4 text-primary-foreground" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-sidebar" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-display text-[13px] font-bold tracking-tight text-sidebar-foreground truncate">
                CRM CRISTIANO
              </span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/50 font-medium truncate">
                Esquadrias · Vidraçaria
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

                      {item.url === "/direct" && !collapsed && pathname === "/direct" && (
                        <SidebarMenuSub>
                          {directSubs.map((sub) => {
                            const allowed = roleAllows(sub.roles);
                            const isActive = currentEtapa === sub.etapa;
                            const SubIcon = sub.icon;
                            return (
                              <SidebarMenuSubItem key={sub.etapa}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isActive}
                                  className={!allowed ? "opacity-60" : ""}
                                  title={
                                    allowed
                                      ? sub.label
                                      : "Etapa restrita ao seu perfil"
                                  }
                                >
                                  <Link to="/direct" search={{ etapa: sub.etapa }}>
                                    <SubIcon className="h-3.5 w-3.5" />
                                    <span>{sub.label}</span>
                                    {!allowed && (
                                      <span className="ml-auto text-[9px] uppercase text-muted-foreground">
                                        restrito
                                      </span>
                                    )}
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
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
