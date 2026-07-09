import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ShieldCheck,
  Eye,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";
import { toast } from "sonner";

type AppRole = "admin" | "vendedor" | "producao" | "financeiro_obra";

const ROLES: { key: AppRole; label: string; tone: string }[] = [
  { key: "admin", label: "Administrador", tone: "bg-primary/10 text-primary" },
  { key: "vendedor", label: "Vendedor", tone: "bg-blue-500/10 text-blue-600" },
  { key: "producao", label: "Produção", tone: "bg-amber-500/10 text-amber-600" },
  { key: "financeiro_obra", label: "Financeiro/Obra", tone: "bg-emerald-500/10 text-emerald-600" },
];

const MODULES: { key: string; label: string; group: string }[] = [
  { key: "comercial", label: "Comercial", group: "Vendas" },
  { key: "clientes", label: "Clientes", group: "Vendas" },
  { key: "vendas", label: "Orçamentos/Vendas", group: "Vendas" },
  { key: "pedidos", label: "Pedidos", group: "Vendas" },
  { key: "producao", label: "Produção", group: "Fábrica" },
  { key: "controle_fabril", label: "Controle Fabril", group: "Fábrica" },
  { key: "obras", label: "Obras", group: "Fábrica" },
  { key: "materiais", label: "Materiais", group: "Estoque" },
  { key: "vidros", label: "Vidros", group: "Estoque" },
  { key: "acessorios", label: "Acessórios", group: "Estoque" },
  { key: "perfis", label: "Perfis", group: "Estoque" },
  { key: "financeiro", label: "Financeiro", group: "Financeiro" },
  { key: "exportar", label: "Exportar", group: "Sistema" },
  { key: "admin", label: "Admin Master", group: "Sistema" },
];

const ACTIONS: { key: string; label: string; Icon: typeof Eye }[] = [
  { key: "view", label: "Visualizar", Icon: Eye },
  { key: "create", label: "Criar", Icon: Plus },
  { key: "edit", label: "Editar", Icon: Pencil },
  { key: "delete", label: "Excluir", Icon: Trash2 },
];

type Row = { id: string; role: AppRole; module: string; action: string; allowed: boolean };

export function PermissionsMatrix() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<AppRole>("vendedor");
  const [dirty, setDirty] = useState<Record<string, boolean>>({}); // key `${role}|${module}|${action}` -> allowed

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["role_permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("id, role, module, action, allowed");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const map = useMemo(() => {
    const m = new Map<string, Row>();
    rows.forEach((r) => m.set(`${r.role}|${r.module}|${r.action}`, r));
    return m;
  }, [rows]);

  const getValue = (role: AppRole, mod: string, action: string) => {
    const k = `${role}|${mod}|${action}`;
    if (k in dirty) return dirty[k];
    return map.get(k)?.allowed ?? false;
  };

  const toggle = (role: AppRole, mod: string, action: string) => {
    if (role === "admin") return; // admin always full
    const k = `${role}|${mod}|${action}`;
    const current = getValue(role, mod, action);
    setDirty((d) => ({ ...d, [k]: !current }));
  };

  const toggleModule = (role: AppRole, mod: string, allowed: boolean) => {
    if (role === "admin") return;
    const next: Record<string, boolean> = { ...dirty };
    ACTIONS.forEach((a) => {
      next[`${role}|${mod}|${a.key}`] = allowed;
    });
    setDirty(next);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(dirty).map(([k, allowed]) => {
        const [role, module, action] = k.split("|");
        return { role: role as AppRole, module, action, allowed };
      });
      // upsert one by one relying on unique(role,module,action)
      for (const u of updates) {
        const existing = map.get(`${u.role}|${u.module}|${u.action}`);
        if (existing) {
          const { error } = await supabase
            .from("role_permissions")
            .update({ allowed: u.allowed })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("role_permissions").insert(u);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Permissões atualizadas");
      setDirty({});
      qc.invalidateQueries({ queryKey: ["role_permissions"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const dirtyCount = Object.keys(dirty).length;

  const grouped = useMemo(() => {
    const g = new Map<string, typeof MODULES>();
    MODULES.forEach((m) => {
      const arr = g.get(m.group) ?? [];
      arr.push(m);
      g.set(m.group, arr);
    });
    return Array.from(g.entries());
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando permissões…
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Matriz de permissões
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Ajuste, por papel, quais ações são permitidas em cada módulo. Administradores
              sempre têm acesso total.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dirtyCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                {dirtyCount} alteração{dirtyCount > 1 ? "s" : ""} pendente{dirtyCount > 1 ? "s" : ""}
              </Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDirty({})}
              disabled={dirtyCount === 0 || saveMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Descartar
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={dirtyCount === 0 || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as AppRole)}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              {ROLES.map((r) => (
                <TabsTrigger key={r.key} value={r.key} className="gap-2">
                  <span className={`h-2 w-2 rounded-full ${r.tone}`} />
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {ROLES.map((role) => {
              const isAdmin = role.key === "admin";
              return (
                <TabsContent key={role.key} value={role.key} className="mt-4">
                  {isAdmin && (
                    <div className="rounded-md border bg-primary/5 text-primary px-3 py-2 text-xs mb-3">
                      O papel <b>Administrador</b> possui acesso irrestrito e não pode ser
                      restringido nesta matriz.
                    </div>
                  )}
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[220px]">Módulo</TableHead>
                          {ACTIONS.map((a) => (
                            <TableHead key={a.key} className="text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 justify-center">
                                    <a.Icon className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">{a.label}</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{a.label}</TooltipContent>
                              </Tooltip>
                            </TableHead>
                          ))}
                          <TableHead className="text-right w-[110px]">Módulo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grouped.map(([group, mods]) => (
                          <Fragment key={`g-${group}`}>
                            <TableRow key={`g-${group}`} className="bg-muted/40 hover:bg-muted/40">
                              <TableCell
                                colSpan={ACTIONS.length + 2}
                                className="text-[11px] uppercase tracking-wide text-muted-foreground py-1.5"
                              >
                                {group}
                              </TableCell>
                            </TableRow>
                            {mods.map((m) => {
                              const allChecked = ACTIONS.every((a) =>
                                getValue(role.key, m.key, a.key)
                              );
                              const anyChecked = ACTIONS.some((a) =>
                                getValue(role.key, m.key, a.key)
                              );
                              return (
                                <TableRow key={`${role.key}-${m.key}`}>
                                  <TableCell className="font-medium">{m.label}</TableCell>
                                  {ACTIONS.map((a) => {
                                    const val = getValue(role.key, m.key, a.key);
                                    const k = `${role.key}|${m.key}|${a.key}`;
                                    const isDirty = k in dirty;
                                    return (
                                      <TableCell key={a.key} className="text-center">
                                        <div className="inline-flex items-center justify-center">
                                          <Checkbox
                                            checked={isAdmin ? true : val}
                                            disabled={isAdmin}
                                            onCheckedChange={() =>
                                              toggle(role.key, m.key, a.key)
                                            }
                                            className={
                                              isDirty ? "ring-2 ring-primary/60" : ""
                                            }
                                          />
                                        </div>
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell className="text-right">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      disabled={isAdmin}
                                      onClick={() =>
                                        toggleModule(role.key, m.key, !allChecked)
                                      }
                                    >
                                      {allChecked
                                        ? "Nenhum"
                                        : anyChecked
                                          ? "Todos"
                                          : "Todos"}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
