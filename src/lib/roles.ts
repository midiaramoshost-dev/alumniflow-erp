// Central catálogo de papéis (roles) do sistema.
// Adicione aqui para propagar em toda a UI.

export type AppRole =
  | "admin"
  | "vendedor"
  | "producao"
  | "financeiro_obra"
  | "medidor"
  | "tecnico"
  | "cortador"
  | "usinador"
  | "montador"
  | "vidraceiro"
  | "acabamento"
  | "instalador"
  | "conferente";

export type RoleDef = {
  key: AppRole;
  label: string;
  description: string;
  tone: string;
  group: "Gestão" | "Comercial" | "Produção" | "Instalação" | "Financeiro";
};

export const ROLES: RoleDef[] = [
  { key: "admin", label: "Administrador", description: "Acesso total ao sistema", tone: "bg-primary/10 text-primary", group: "Gestão" },
  { key: "vendedor", label: "Vendedor", description: "Clientes, orçamentos e comercial", tone: "bg-blue-500/10 text-blue-600", group: "Comercial" },
  { key: "medidor", label: "Medidor", description: "Realiza medições em obra", tone: "bg-sky-500/10 text-sky-600", group: "Comercial" },
  { key: "tecnico", label: "Técnico", description: "Avaliação técnica e projetos", tone: "bg-indigo-500/10 text-indigo-600", group: "Comercial" },
  { key: "producao", label: "Produção (Geral)", description: "Coordenação da fábrica", tone: "bg-amber-500/10 text-amber-600", group: "Produção" },
  { key: "cortador", label: "Cortador", description: "Setor de corte de perfis", tone: "bg-orange-500/10 text-orange-600", group: "Produção" },
  { key: "usinador", label: "Usinador", description: "Setor de usinagem", tone: "bg-yellow-500/10 text-yellow-700", group: "Produção" },
  { key: "montador", label: "Montador", description: "Setor de montagem", tone: "bg-lime-500/10 text-lime-700", group: "Produção" },
  { key: "vidraceiro", label: "Vidraceiro", description: "Setor de vidraçaria", tone: "bg-cyan-500/10 text-cyan-700", group: "Produção" },
  { key: "acabamento", label: "Acabamento", description: "Setor de acabamento", tone: "bg-teal-500/10 text-teal-700", group: "Produção" },
  { key: "conferente", label: "Conferente", description: "Conferência final de produção", tone: "bg-violet-500/10 text-violet-700", group: "Produção" },
  { key: "instalador", label: "Instalador", description: "Instalação em obra", tone: "bg-fuchsia-500/10 text-fuchsia-700", group: "Instalação" },
  { key: "financeiro_obra", label: "Financeiro/Obra", description: "Financeiro e acompanhamento de obras", tone: "bg-emerald-500/10 text-emerald-600", group: "Financeiro" },
];

export const ALL_ROLES: AppRole[] = ROLES.map((r) => r.key);

export const ROLE_LABELS: Record<AppRole, string> = ROLES.reduce(
  (acc, r) => {
    acc[r.key] = r.label;
    return acc;
  },
  {} as Record<AppRole, string>,
);

export const roleLabel = (r: string) => ROLE_LABELS[r as AppRole] ?? r;
