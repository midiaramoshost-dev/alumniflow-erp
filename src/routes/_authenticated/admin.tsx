import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateUser, adminUpdateUser } from "@/lib/admin-users.functions";
import { UserPlus, Eye, EyeOff } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  Search,
  Loader2,
  Lock,
  Building,
  ShoppingCart,
  Factory,
  Wallet,
  Layers,
  Package,
  Square,
  Briefcase,
  Cog,
  Trash2,
  Pencil,
  Database,
  RefreshCw,
  Mail,
  Copy,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionsMatrix } from "@/components/permissions-matrix";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

import { ROLES as ROLE_CATALOG, type AppRole } from "@/lib/roles";

const ROLES: { key: AppRole; label: string; description: string }[] = ROLE_CATALOG.map((r) => ({
  key: r.key,
  label: r.label,
  description: r.description,
}));

type Profile = { id: string; full_name: string | null; email: string | null };
type UserRoleRow = { user_id: string; role: AppRole };

/** Column descriptor for the generic data manager. */
type Col = {
  key: string;
  label: string;
  editable?: boolean;
  type?: "text" | "number" | "date" | "textarea";
  className?: string;
};

type EntityDef = {
  key: string;
  label: string;
  table: string;
  select: string;
  orderBy: string;
  ascending?: boolean;
  searchCols: string[];
  columns: Col[];
  labelCol: string; // for delete confirmation
};

const ENTITIES: EntityDef[] = [
  {
    key: "clientes",
    label: "Clientes",
    table: "clientes",
    select: "id, nome, email, telefone, cidade, numero_proposta, valor_total_obra, vendedor_nome, forma_pagamento, data_venda",
    orderBy: "nome",
    ascending: true,
    searchCols: ["nome", "email", "telefone", "cidade", "numero_proposta", "vendedor_nome"],
    labelCol: "nome",
    columns: [
      { key: "nome", label: "Nome", editable: true },
      { key: "email", label: "E-mail", editable: true },
      { key: "telefone", label: "Telefone", editable: true },
      { key: "cidade", label: "Cidade", editable: true },
      { key: "numero_proposta", label: "Nº Proposta", editable: true },
      { key: "valor_total_obra", label: "Valor obra", type: "number", editable: true },
      { key: "vendedor_nome", label: "Vendedor", editable: true },
      { key: "forma_pagamento", label: "Pagamento", editable: true },
      { key: "data_venda", label: "Data venda", type: "date", editable: true },
    ],
  },
  {
    key: "orcamentos",
    label: "Orçamentos",
    table: "orcamentos",
    select: "id, numero, cliente_nome, status, total, validade_dias, created_at",
    orderBy: "created_at",
    ascending: false,
    searchCols: ["cliente_nome", "status"],
    labelCol: "numero",
    columns: [
      { key: "numero", label: "Nº" },
      { key: "cliente_nome", label: "Cliente", editable: true },
      { key: "status", label: "Status", editable: true },
      { key: "total", label: "Total", type: "number", editable: true },
      { key: "validade_dias", label: "Validade (dias)", type: "number", editable: true },
      { key: "created_at", label: "Criado" },
    ],
  },
  {
    key: "ordens_producao",
    label: "Ordens de Produção",
    table: "ordens_producao",
    select: "id, numero, titulo, cliente_nome, etapa, prioridade, data_entrega, created_at",
    orderBy: "created_at",
    ascending: false,
    searchCols: ["titulo", "cliente_nome", "etapa"],
    labelCol: "titulo",
    columns: [
      { key: "numero", label: "Nº" },
      { key: "titulo", label: "Título", editable: true },
      { key: "cliente_nome", label: "Cliente", editable: true },
      { key: "etapa", label: "Etapa", editable: true },
      { key: "prioridade", label: "Prioridade", editable: true },
      { key: "data_entrega", label: "Entrega", type: "date", editable: true },
    ],
  },
  {
    key: "obras",
    label: "Obras",
    table: "obras",
    select: "id, titulo, cliente_nome, status, progresso, valor, data_entrega_prevista, data_entrega_real",
    orderBy: "created_at",
    ascending: false,
    searchCols: ["titulo", "cliente_nome", "status"],
    labelCol: "titulo",
    columns: [
      { key: "titulo", label: "Título", editable: true },
      { key: "cliente_nome", label: "Cliente", editable: true },
      { key: "status", label: "Status", editable: true },
      { key: "progresso", label: "%", type: "number", editable: true },
      { key: "valor", label: "Valor", type: "number", editable: true },
      { key: "data_entrega_prevista", label: "Prev.", type: "date", editable: true },
      { key: "data_entrega_real", label: "Real", type: "date", editable: true },
    ],
  },
  {
    key: "financeiro_lancamentos",
    label: "Financeiro",
    table: "financeiro_lancamentos",
    select: "id, tipo, descricao, categoria, valor, status, data_vencimento, data_pagamento, cliente_nome",
    orderBy: "data_vencimento",
    ascending: false,
    searchCols: ["descricao", "categoria", "cliente_nome", "status", "tipo"],
    labelCol: "descricao",
    columns: [
      { key: "tipo", label: "Tipo", editable: true },
      { key: "descricao", label: "Descrição", editable: true },
      { key: "categoria", label: "Categoria", editable: true },
      { key: "valor", label: "Valor", type: "number", editable: true },
      { key: "status", label: "Status", editable: true },
      { key: "data_vencimento", label: "Vencimento", type: "date", editable: true },
      { key: "data_pagamento", label: "Pagamento", type: "date", editable: true },
      { key: "cliente_nome", label: "Cliente" },
    ],
  },
  {
    key: "vendedores",
    label: "Vendedores",
    table: "vendedores",
    select: "id, nome, email, telefone, percentual_comissao, ativo, meta_mensal",
    orderBy: "nome",
    ascending: true,
    searchCols: ["nome", "email", "telefone"],
    labelCol: "nome",
    columns: [
      { key: "nome", label: "Nome", editable: true },
      { key: "email", label: "E-mail", editable: true },
      { key: "telefone", label: "Telefone", editable: true },
      { key: "percentual_comissao", label: "% Comissão", type: "number", editable: true },
      { key: "meta_mensal", label: "Meta mensal", type: "number", editable: true },
      { key: "ativo", label: "Ativo" },
    ],
  },
  {
    key: "perfis_aluminio",
    label: "Perfis Alumínio",
    table: "perfis_aluminio",
    select: "id, codigo, descricao, cor, peso_kg_m, preco_kg, estoque_metros",
    orderBy: "codigo",
    ascending: true,
    searchCols: ["codigo", "descricao", "cor"],
    labelCol: "codigo",
    columns: [
      { key: "codigo", label: "Código", editable: true },
      { key: "descricao", label: "Descrição", editable: true },
      { key: "cor", label: "Cor", editable: true },
      { key: "peso_kg_m", label: "Kg/m", type: "number", editable: true },
      { key: "preco_kg", label: "R$/kg", type: "number", editable: true },
      { key: "estoque_metros", label: "Estoque (m)", type: "number", editable: true },
    ],
  },
  {
    key: "vidros",
    label: "Vidros",
    table: "vidros",
    select: "id, codigo, descricao, espessura_mm, tipo, preco_m2, estoque_m2",
    orderBy: "codigo",
    ascending: true,
    searchCols: ["codigo", "descricao", "tipo"],
    labelCol: "codigo",
    columns: [
      { key: "codigo", label: "Código", editable: true },
      { key: "descricao", label: "Descrição", editable: true },
      { key: "tipo", label: "Tipo", editable: true },
      { key: "espessura_mm", label: "Esp. (mm)", type: "number", editable: true },
      { key: "preco_m2", label: "R$/m²", type: "number", editable: true },
      { key: "estoque_m2", label: "Estoque m²", type: "number", editable: true },
    ],
  },
  {
    key: "acessorios",
    label: "Acessórios",
    table: "acessorios",
    select: "id, codigo, descricao, unidade, preco_unitario, estoque_quantidade",
    orderBy: "codigo",
    ascending: true,
    searchCols: ["codigo", "descricao"],
    labelCol: "codigo",
    columns: [
      { key: "codigo", label: "Código", editable: true },
      { key: "descricao", label: "Descrição", editable: true },
      { key: "unidade", label: "Unidade", editable: true },
      { key: "preco_unitario", label: "R$ un.", type: "number", editable: true },
      { key: "estoque_quantidade", label: "Estoque", type: "number", editable: true },
    ],
  },
];

function AdminPage() {
  const { user, hasRole, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Profile | null>(null);

  const isAdmin = hasRole("admin");
  const [creatingUser, setCreatingUser] = useState(false);




  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin", "profiles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const { data: roleRows } = useQuery({
    queryKey: ["admin", "user_roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as UserRoleRow[];
    },
  });

  const rolesByUser = useMemo(() => {
    const m = new Map<string, AppRole[]>();
    (roleRows ?? []).forEach((r) => {
      const list = m.get(r.user_id) ?? [];
      list.push(r.role);
      m.set(r.user_id, list);
    });
    return m;
  }, [roleRows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = profiles ?? [];
    if (!s) return base;
    return base.filter((p) =>
      [p.full_name, p.email].some((x) => (x ?? "").toLowerCase().includes(s)),
    );
  }, [profiles, q]);


  const { data: counts } = useQuery({
    queryKey: ["admin", "counts"],
    enabled: isAdmin,
    queryFn: async () => {
      const tables = ENTITIES.map((e) => e.table);
      const entries = await Promise.all(
        tables.map(async (t) => {
          const { count } = await (supabase as unknown as { from: (t: string) => any })
            .from(t)
            .select("*", { count: "exact", head: true });
          return [t, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
  });

  if (loading) {
    return (
      <PageShell title="Admin Master" description="Painel administrativo">
        <div className="py-20 text-center text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
          Carregando…
        </div>
      </PageShell>
    );
  }

  if (!isAdmin) {
    return (
      <PageShell title="Admin Master" description="Painel administrativo">
        <div className="max-w-md mx-auto text-center py-20">
          <ShieldAlert className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-lg font-semibold">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Somente administradores podem acessar este painel.
          </p>
          <Button className="mt-6" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
            Voltar
          </Button>
        </div>
      </PageShell>
    );
  }


  return (
    <PageShell
      title="Admin Master"
      description="Gestão completa do sistema, dados e permissões"
      actions={
        <Badge variant="default" className="gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Desbloqueado
        </Badge>
      }
    >
      {/* Overview */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
        <ModuleCard to="/clientes" icon={Users} label="Clientes" count={counts?.clientes} />
        <ModuleCard to="/vendas" icon={ShoppingCart} label="Orçamentos" count={counts?.orcamentos} />
        <ModuleCard to="/producao" icon={Factory} label="Prod. OPs" count={counts?.ordens_producao} />
        <ModuleCard to="/obras" icon={Building} label="Obras" count={counts?.obras} />
        <ModuleCard
          to="/financeiro"
          icon={Wallet}
          label="Financeiro"
          count={counts?.financeiro_lancamentos}
        />
        <ModuleCard to="/comercial" icon={Briefcase} label="Vendedores" count={counts?.vendedores} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <ModuleShortcut to="/perfis" icon={Layers} label="Perfis de alumínio" />
        <ModuleShortcut to="/vidros" icon={Square} label="Vidros" />
        <ModuleShortcut to="/acessorios" icon={Package} label="Acessórios" />
        <ModuleShortcut to="/controle-fabril" icon={Cog} label="Controle Fabril" />
      </div>

      <Tabs defaultValue="users" className="mt-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="users" className="gap-1">
            <Users className="h-3.5 w-3.5" /> Usuários
          </TabsTrigger>
          <TabsTrigger value="invites" className="gap-1">
            <Mail className="h-3.5 w-3.5" /> Convites
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Permissões
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1">
            <Database className="h-3.5 w-3.5" /> Gestão de dados
          </TabsTrigger>
        </TabsList>


        {/* Users & Roles */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" /> Usuários e níveis de acesso
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Atribua funções para controlar o que cada usuário pode fazer.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Buscar por nome ou e-mail…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={() => setCreatingUser(true)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Novo usuário
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Funções</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingProfiles && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                        Carregando…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingProfiles && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-sm">
                        Nenhum usuário encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((p) => {
                    const userRoles = rolesByUser.get(p.id) ?? [];
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.full_name ?? "—"}
                          {p.id === user?.id && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              você
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.email ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {userRoles.length === 0 && (
                              <span className="text-xs text-muted-foreground">sem funções</span>
                            )}
                            {userRoles.map((r) => (
                              <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                                {ROLES.find((x) => x.key === r)?.label ?? r}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invites */}
        <TabsContent value="invites" className="mt-4">
          <InvitesManager />
        </TabsContent>

        {/* Permissions matrix */}
        <TabsContent value="permissions" className="mt-4">
          <PermissionsMatrix />
        </TabsContent>

        {/* Data management */}
        <TabsContent value="data" className="mt-4">
          <DataManager />
        </TabsContent>

      </Tabs>

      <EditUserDialog
        profile={editing}
        currentRoles={editing ? (rolesByUser.get(editing.id) ?? []) : []}
        isSelf={editing?.id === user?.id}
        onOpenChange={(v) => !v && setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin", "profiles"] });
          qc.invalidateQueries({ queryKey: ["admin", "user_roles"] });
          setEditing(null);
        }}
      />

      <CreateUserDialog
        open={creatingUser}
        onOpenChange={setCreatingUser}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["admin", "profiles"] });
          qc.invalidateQueries({ queryKey: ["admin", "user_roles"] });
        }}
      />
    </PageShell>
  );
}

/* ---------------- Data Manager ---------------- */

function DataManager() {
  const [entityKey, setEntityKey] = useState<string>(ENTITIES[0].key);
  const entity = ENTITIES.find((e) => e.key === entityKey)!;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" /> Gestão de dados
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Edite ou remova registros de qualquer tabela do sistema.
          </p>
        </div>
        <Select value={entityKey} onValueChange={setEntityKey}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITIES.map((e) => (
              <SelectItem key={e.key} value={e.key}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <EntityTable entity={entity} key={entity.key} />
      </CardContent>
    </Card>
  );
}

type Row = { id: string } & Record<string, unknown>;

function EntityTable({ entity }: { entity: EntityDef }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editRow, setEditRow] = useState<Row | null>(null);

  const key = ["admin", "entity", entity.key];
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from(entity.table)
        .select(entity.select)
        .order(entity.orderBy, { ascending: entity.ascending ?? false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from(entity.table)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["admin", "counts"] });
      toast.success("Registro excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (payload: { id: string; values: Record<string, unknown> }) => {
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from(entity.table)
        .update(payload.values)
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Registro atualizado");
      setEditRow(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = data ?? [];
    if (!s) return base;
    return base.filter((r) =>
      entity.searchCols.some((c) => String(r[c] ?? "").toLowerCase().includes(s)),
    );
  }, [data, q, entity.searchCols]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <div className="text-xs text-muted-foreground ml-auto">
          {filtered.length} registro{filtered.length === 1 ? "" : "s"}
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {entity.columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.label}
                </TableHead>
              ))}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={entity.columns.length + 1} className="text-center py-10">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={entity.columns.length + 1}
                  className="text-center py-10 text-muted-foreground text-sm"
                >
                  Nenhum registro encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                {entity.columns.map((c) => (
                  <TableCell key={c.key} className="text-sm">
                    {formatCell(r[c.key], c.type)}
                  </TableCell>
                ))}
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setEditRow(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      const label = String(r[entity.labelCol] ?? r.id);
                      if (confirm(`Excluir "${label}"? Esta ação não pode ser desfeita.`)) {
                        del.mutate(r.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editRow} onOpenChange={(v) => !v && setEditRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar registro</DialogTitle>
            <DialogDescription>
              {entity.label} — {editRow ? String(editRow[entity.labelCol] ?? editRow.id) : ""}
            </DialogDescription>
          </DialogHeader>
          {editRow && (
            <RowEditor
              row={editRow}
              columns={entity.columns.filter((c) => c.editable)}
              onCancel={() => setEditRow(null)}
              onSave={(values) => update.mutate({ id: editRow.id, values })}
              saving={update.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowEditor({
  row,
  columns,
  onCancel,
  onSave,
  saving,
}: {
  row: Row;
  columns: Col[];
  onCancel: () => void;
  onSave: (values: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    columns.forEach((c) => {
      const raw = row[c.key];
      if (raw == null) v[c.key] = "";
      else if (c.type === "date" && typeof raw === "string") v[c.key] = raw.slice(0, 10);
      else v[c.key] = String(raw);
    });
    return v;
  });

  const submit = () => {
    const payload: Record<string, unknown> = {};
    columns.forEach((c) => {
      const s = values[c.key];
      if (s === "" || s == null) {
        payload[c.key] = null;
      } else if (c.type === "number") {
        const n = Number(s);
        payload[c.key] = Number.isNaN(n) ? null : n;
      } else {
        payload[c.key] = s;
      }
    });
    onSave(payload);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {columns.map((c) => (
          <div key={c.key} className="space-y-1">
            <Label htmlFor={c.key} className="text-xs">
              {c.label}
            </Label>
            <Input
              id={c.key}
              type={c.type === "number" ? "number" : c.type === "date" ? "date" : "text"}
              value={values[c.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [c.key]: e.target.value }))}
              step={c.type === "number" ? "any" : undefined}
            />
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar alterações
        </Button>
      </DialogFooter>
    </div>
  );
}

function formatCell(v: unknown, type?: Col["type"]) {
  if (v == null || v === "") return <span className="text-muted-foreground">—</span>;
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (type === "number" && typeof v === "number") {
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (type === "date" && typeof v === "string") return v.slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleString("pt-BR");
  }
  return String(v);
}

/* ---------------- Cards ---------------- */

function ModuleCard({
  to,
  icon: Icon,
  label,
  count,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
}) {
  return (
    <Link to={to}>
      <Card className="hover:border-primary transition-colors">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold">{count ?? "—"}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ModuleShortcut({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link to={to}>
      <Card className="hover:border-primary transition-colors">
        <CardContent className="p-3 flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ---------------- Invites Manager ---------------- */

type Invitation = {
  id: string;
  token: string;
  email: string | null;
  role: AppRole;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
};

function generateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function InvitesManager() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("vendedor");
  const [expiresDays, setExpiresDays] = useState<number>(7);

  const { data: invites, isLoading } = useQuery({
    queryKey: ["admin", "invitations"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from("invitations")
        .select("id, token, email, role, expires_at, used_at, used_by, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const token = generateToken();
      const expires_at = new Date(Date.now() + expiresDays * 86400000).toISOString();
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from("invitations")
        .insert({
          token,
          email: email.trim() || null,
          role,
          expires_at,
          created_by: user?.id,
        });
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      qc.invalidateQueries({ queryKey: ["admin", "invitations"] });
      const url = `${window.location.origin}/invite/${token}`;
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Convite criado — link copiado!");
      setEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from("invitations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "invitations"] });
      toast.success("Convite revogado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copiado!"),
      () => toast.error("Falha ao copiar"),
    );
  };

  const inviteStatus = (inv: Invitation) => {
    if (inv.used_at) return { label: "Usado", variant: "secondary" as const };
    if (new Date(inv.expires_at) < new Date())
      return { label: "Expirado", variant: "destructive" as const };
    return { label: "Ativo", variant: "default" as const };
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Gerar convite
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Crie um link de convite. Ao aceitar, o usuário recebe automaticamente o nível de acesso escolhido.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label htmlFor="inv-email">E-mail (opcional)</Label>
              <Input
                id="inv-email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Nível de acesso</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="inv-days">Validade (dias)</Label>
              <Input
                id="inv-days"
                type="number"
                min={1}
                max={90}
                value={expiresDays}
                onChange={(e) => setExpiresDays(Number(e.target.value) || 7)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <LinkIcon className="mr-2 h-4 w-4" />
              Gerar link de convite
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Convites emitidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && (invites ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                    Nenhum convite emitido.
                  </TableCell>
                </TableRow>
              )}
              {(invites ?? []).map((inv) => {
                const status = inviteStatus(inv);
                const active = status.label === "Ativo";
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm">{inv.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ROLES.find((r) => r.key === inv.role)?.label ?? inv.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(inv.expires_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {active && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyLink(inv.token)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Revogar este convite?")) revoke.mutate(inv.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


/* ---------------- Create User Dialog ---------------- */

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const createUser = useServerFn(adminCreateUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [roles, setRoles] = useState<AppRole[]>(["vendedor"]);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setRoles(["vendedor"]);
    setShowPwd(false);
  };

  const toggleRole = (r: AppRole, checked: boolean) => {
    setRoles((prev) => (checked ? Array.from(new Set([...prev, r])) : prev.filter((x) => x !== r)));
  };

  const genPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$%";
    let out = "";
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
    setPassword(out);
    setShowPwd(true);
  };

  const submit = async () => {
    if (!email.trim()) return toast.error("Informe o e-mail");
    if (password.length < 8) return toast.error("Senha deve ter pelo menos 8 caracteres");
    if (roles.length === 0) return toast.error("Selecione ao menos uma função");
    setSubmitting(true);
    try {
      await createUser({ data: { email, password, full_name: fullName, roles } });
      toast.success("Usuário criado com sucesso");
      onCreated();
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar usuário");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Novo usuário
          </DialogTitle>
          <DialogDescription>
            Crie um usuário com e-mail e senha e defina as funções (permissões por módulo).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="João da Silva" />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Senha (mín. 8 caracteres)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="button" variant="outline" onClick={genPassword}>
                Gerar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Funções (permissões por módulo)</Label>
            <div className="space-y-2 rounded-md border p-3">
              {ROLES.map((r) => {
                const checked = roles.includes(r.key);
                return (
                  <label key={r.key} className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleRole(r.key, v === true)}
                    />
                    <div>
                      <div className="text-sm font-medium">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              As permissões por módulo/ação de cada função são configuradas na aba{" "}
              <strong>Permissões</strong>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Criar usuário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Edit User Dialog ---------------- */

function EditUserDialog({
  profile,
  currentRoles,
  isSelf,
  onOpenChange,
  onSaved,
}: {
  profile: Profile | null;
  currentRoles: AppRole[];
  isSelf: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const updateUser = useServerFn(adminUpdateUser);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [roles, setRolesState] = useState<AppRole[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const open = !!profile;

  // Initialize when opening
  useMemo(() => {
    if (profile) {
      setEmail(profile.email ?? "");
      setFullName(profile.full_name ?? "");
      setPassword("");
      setShowPwd(false);
      setRolesState(currentRoles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const toggleRole = (r: AppRole, checked: boolean) => {
    setRolesState((prev) =>
      checked ? Array.from(new Set([...prev, r])) : prev.filter((x) => x !== r),
    );
  };

  const submit = async () => {
    if (!profile) return;
    if (!email.trim()) return toast.error("Informe o e-mail");
    if (password && password.length < 8)
      return toast.error("Senha deve ter pelo menos 8 caracteres");
    if (roles.length === 0) return toast.error("Selecione ao menos uma função");
    if (isSelf && !roles.includes("admin")) {
      if (!confirm("Você está removendo sua própria função de admin. Continuar?")) return;
    }
    setSubmitting(true);
    try {
      await updateUser({
        data: {
          user_id: profile.id,
          email,
          full_name: fullName,
          password: password || null,
          roles,
        },
      });
      toast.success("Usuário atualizado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar usuário");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" /> Editar usuário
          </DialogTitle>
          <DialogDescription>
            Atualize e-mail, nome, senha e funções. A conta não é recriada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nova senha (opcional)</Label>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para manter a atual"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Funções</Label>
            <div className="space-y-2 rounded-md border p-3">
              {ROLES.map((r) => {
                const checked = roles.includes(r.key);
                return (
                  <label key={r.key} className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleRole(r.key, v === true)}
                    />
                    <div>
                      <div className="text-sm font-medium">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Permissões finas por módulo/ação são definidas na aba <strong>Permissões</strong>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
