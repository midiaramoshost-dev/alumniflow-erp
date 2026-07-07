import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type AppRole = "admin" | "vendedor" | "producao" | "financeiro_obra";

const ROLES: { key: AppRole; label: string; description: string }[] = [
  { key: "admin", label: "Administrador", description: "Acesso total ao sistema" },
  { key: "vendedor", label: "Vendedor", description: "Clientes, orçamentos e comercial" },
  { key: "producao", label: "Produção", description: "Ordens, controle fabril e obras" },
  { key: "financeiro_obra", label: "Financeiro/Obra", description: "Financeiro e acompanhamento de obras" },
];

type Profile = { id: string; full_name: string | null; email: string | null };
type UserRoleRow = { user_id: string; role: AppRole };

function AdminPage() {
  const { user, hasRole, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [unlocked, setUnlocked] = useState(false);
  const [pwd, setPwd] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Profile | null>(null);

  const isAdmin = hasRole("admin");

  // Simple in-session lock: admin must re-confirm identity to enter panel
  const requireUnlock = () => {
    if (unlocked) return true;
    return false;
  };

  const verify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user?.email) return toast.error("Sessão inválida");
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: pwd,
    });
    if (error) return toast.error("Senha incorreta");
    setUnlocked(true);
    setPwd("");
    toast.success("Painel desbloqueado");
  };

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin", "profiles"],
    enabled: isAdmin && unlocked,
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
    enabled: isAdmin && unlocked,
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

  const setRoles = useMutation({
    mutationFn: async (payload: { userId: string; roles: AppRole[] }) => {
      const { userId, roles } = payload;
      // Delete all current, then insert desired
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (delErr) throw delErr;
      if (roles.length > 0) {
        const rows = roles.map((r) => ({ user_id: userId, role: r }));
        const { error } = await supabase.from("user_roles").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "user_roles"] });
      toast.success("Permissões atualizadas");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Overview counts
  const { data: counts } = useQuery({
    queryKey: ["admin", "counts"],
    enabled: isAdmin && unlocked,
    queryFn: async () => {
      const tables = [
        "clientes",
        "orcamentos",
        "ordens_producao",
        "obras",
        "financeiro_lancamentos",
        "vendedores",
      ] as const;
      const entries = await Promise.all(
        tables.map(async (t) => {
          const { count } = await (supabase as unknown as { from: (t: string) => any })
            .from(t)
            .select("*", { count: "exact", head: true });
          return [t, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<(typeof tables)[number], number>;
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

  if (!requireUnlock()) {
    return (
      <PageShell title="Admin Master" description="Confirme sua senha para acessar">
        <div className="max-w-md mx-auto py-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Desbloquear painel administrativo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={verify} className="space-y-4">
                <div>
                  <Label htmlFor="email">Usuário</Label>
                  <Input id="email" value={user?.email ?? ""} disabled />
                </div>
                <div>
                  <Label htmlFor="pwd">Senha</Label>
                  <Input
                    id="pwd"
                    type="password"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Entrar no painel
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Admin Master"
      description="Gestão completa do sistema e permissões de usuários"
      actions={
        <Badge variant="default" className="gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Desbloqueado
        </Badge>
      }
    >
      {/* Overview */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <ModuleShortcut to="/perfis" icon={Layers} label="Perfis de alumínio" />
        <ModuleShortcut to="/vidros" icon={Square} label="Vidros" />
        <ModuleShortcut to="/acessorios" icon={Package} label="Acessórios" />
        <ModuleShortcut to="/controle-fabril" icon={Cog} label="Controle Fabril" />
      </div>

      {/* Users & Roles */}
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
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome ou e-mail…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
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
                        Editar funções
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Funções de {editing?.full_name ?? editing?.email}</DialogTitle>
            <DialogDescription>
              Marque as funções que este usuário deve ter. Múltiplas funções são permitidas.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <RoleEditor
              initial={rolesByUser.get(editing.id) ?? []}
              onCancel={() => setEditing(null)}
              onSave={(roles) => setRoles.mutate({ userId: editing.id, roles })}
              saving={setRoles.isPending}
              isSelf={editing.id === user?.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function RoleEditor({
  initial,
  onCancel,
  onSave,
  saving,
  isSelf,
}: {
  initial: AppRole[];
  onCancel: () => void;
  onSave: (roles: AppRole[]) => void;
  saving: boolean;
  isSelf: boolean;
}) {
  const [selected, setSelected] = useState<Set<AppRole>>(new Set(initial));
  const toggle = (r: AppRole) => {
    const next = new Set(selected);
    if (next.has(r)) next.delete(r);
    else next.add(r);
    setSelected(next);
  };

  const submit = () => {
    const roles = Array.from(selected);
    if (isSelf && !roles.includes("admin")) {
      if (!confirm("Você está removendo sua própria função de admin. Continuar?")) return;
    }
    onSave(roles);
  };

  return (
    <div className="space-y-3">
      {ROLES.map((r) => {
        const checked = selected.has(r.key);
        return (
          <label
            key={r.key}
            className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/40"
          >
            <Checkbox checked={checked} onCheckedChange={() => toggle(r.key)} />
            <div>
              <div className="font-medium text-sm">{r.label}</div>
              <div className="text-xs text-muted-foreground">{r.description}</div>
            </div>
          </label>
        );
      })}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </div>
  );
}

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
