// Central de acesso por rota (single source of truth).
// Mapeia prefixos de rota → papéis permitidos.
// Se um prefixo não estiver listado, é acessível a qualquer usuário autenticado.

import type { AppRole } from "@/lib/roles";

export type RouteAccess = {
  path: string; // prefixo (ex: "/clientes")
  roles?: AppRole[]; // undefined = qualquer autenticado
};

export const ROUTE_ACCESS: RouteAccess[] = [
  { path: "/dashboard" }, // todos
  { path: "/configuracoes" }, // todos
  { path: "/pedidos" }, // todos
  { path: "/pipeline" }, // todos

  { path: "/direct", roles: ["admin", "vendedor"] },
  { path: "/clientes", roles: ["admin", "vendedor"] },
  { path: "/vendas", roles: ["admin", "vendedor"] },
  { path: "/comercial", roles: ["admin", "vendedor"] },

  { path: "/perfis", roles: ["admin", "producao"] },
  { path: "/vidros", roles: ["admin", "producao"] },
  { path: "/acessorios", roles: ["admin", "producao"] },
  { path: "/producao", roles: ["admin", "producao", "cortador", "usinador", "montador", "vidraceiro", "acabamento", "conferente"] },
  { path: "/controle-fabril", roles: ["admin", "producao", "cortador", "usinador", "montador", "vidraceiro", "acabamento", "conferente", "medidor", "tecnico"] },
  { path: "/materiais", roles: ["admin", "producao"] },

  { path: "/obras", roles: ["admin", "producao", "financeiro_obra", "instalador"] },
  { path: "/financeiro", roles: ["admin", "financeiro_obra"] },

  { path: "/admin", roles: ["admin"] },
  { path: "/exportar", roles: ["admin"] },
];

export function getRouteAccess(pathname: string): RouteAccess | undefined {
  // Escolhe o match mais específico (prefixo mais longo).
  const matches = ROUTE_ACCESS.filter(
    (r) => pathname === r.path || pathname.startsWith(r.path + "/"),
  );
  matches.sort((a, b) => b.path.length - a.path.length);
  return matches[0];
}

export function canAccessRoute(pathname: string, userRoles: AppRole[]): boolean {
  const entry = getRouteAccess(pathname);
  if (!entry || !entry.roles) return true; // não restrito
  if (userRoles.includes("admin")) return true; // admin acessa tudo
  return entry.roles.some((r) => userRoles.includes(r));
}

// Retorna a primeira rota que o usuário pode acessar, priorizando /dashboard.
export function firstAllowedRoute(userRoles: AppRole[]): string {
  if (canAccessRoute("/dashboard", userRoles)) return "/dashboard";
  const preferred = [
    "/pedidos",
    "/pipeline",
    "/direct",
    "/clientes",
    "/comercial",
    "/vendas",
    "/producao",
    "/controle-fabril",
    "/obras",
    "/materiais",
    "/financeiro",
    "/admin",
    "/configuracoes",
  ];
  for (const p of preferred) {
    if (canAccessRoute(p, userRoles)) return p;
  }
  return "/configuracoes";
}
