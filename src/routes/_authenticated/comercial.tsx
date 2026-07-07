import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Search, Loader2, Users, Percent, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/comercial")({
  component: ComercialPage,
});

type Vendedor = {
  id: string;
  user_id: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  percentual_comissao: number;
  percentual_comissao_meta: number | null;
  meta_mensal: number | null;
  tipo_comissao: "venda" | "recebimento";
  observacoes: string | null;
  ativo: boolean;
};

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function brl(v: number | null | undefined) {
  return v != null ? `R$ ${Number(v).toFixed(2)}` : "—";
}

function ComercialPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendedor | null>(null);
  const [ativo, setAtivo] = useState(true);
  const [tipo, setTipo] = useState<"venda" | "recebimento">("venda");

  const { data, isLoading } = useQuery({
    queryKey: ["vendedores"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("vendedores" as never) as never)
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Vendedor[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = data ?? [];
    if (!s) return base;
    return base.filter((v) =>
      [v.nome, v.email, v.telefone, v.documento].some((x) => (x ?? "").toLowerCase().includes(s)),
    );
  }, [data, q]);

  const kpis = useMemo(() => {
    const list = data ?? [];
    const ativos = list.filter((v) => v.ativo);
    const totalMeta = ativos.reduce((s, v) => s + Number(v.meta_mensal ?? 0), 0);
    const mediaCom = ativos.length
      ? ativos.reduce((s, v) => s + Number(v.percentual_comissao ?? 0), 0) / ativos.length
      : 0;
    return {
      total: list.length,
      ativos: ativos.length,
      totalMeta,
      mediaCom,
    };
  }, [data]);

  const save = useMutation({
    mutationFn: async (payload: Partial<Vendedor> & { id?: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await (supabase.from("vendedores" as never) as never)
          .update(rest)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("vendedores" as never) as never).insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendedores"] });
      toast.success("Vendedor salvo");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("vendedores" as never) as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendedores"] });
      toast.success("Vendedor removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") ?? "").trim();
    if (!nome) return toast.error("Nome é obrigatório");
    save.mutate({
      id: editing?.id,
      nome,
      email: String(fd.get("email") ?? "").trim() || null,
      telefone: String(fd.get("telefone") ?? "").trim() || null,
      documento: String(fd.get("documento") ?? "").trim() || null,
      percentual_comissao: num(fd.get("percentual_comissao")) ?? 0,
      percentual_comissao_meta: num(fd.get("percentual_comissao_meta")),
      meta_mensal: num(fd.get("meta_mensal")),
      tipo_comissao: tipo,
      observacoes: String(fd.get("observacoes") ?? "").trim() || null,
      ativo,
    });
  };

  const openNew = () => {
    setEditing(null);
    setAtivo(true);
    setTipo("venda");
    setOpen(true);
  };
  const openEdit = (v: Vendedor) => {
    setEditing(v);
    setAtivo(v.ativo);
    setTipo(v.tipo_comissao);
    setOpen(true);
  };

  return (
    <PageShell
      title="Comercial"
      description="Vendedores, comissões e metas da equipe"
      newLabel={isAdmin ? "Novo vendedor" : undefined}
      onNew={isAdmin ? openNew : undefined}
      actions={
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vendedor…"
            className="pl-8 w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Kpi icon={Users} label="Vendedores ativos" value={`${kpis.ativos} / ${kpis.total}`} />
        <Kpi icon={Percent} label="Comissão média" value={`${kpis.mediaCom.toFixed(2)}%`} />
        <Kpi icon={Target} label="Meta mensal total" value={brl(kpis.totalMeta)} />
        <Kpi icon={TrendingUp} label="Tipo padrão" value="Venda" />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="hidden md:table-cell">Contato</TableHead>
            <TableHead className="hidden lg:table-cell">Documento</TableHead>
            <TableHead className="text-right">Comissão</TableHead>
            <TableHead className="hidden sm:table-cell text-right">Meta / mês</TableHead>
            <TableHead className="hidden md:table-cell">Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-10">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Carregando…
              </TableCell>
            </TableRow>
          )}
          {!isLoading && filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                Nenhum vendedor cadastrado.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="font-medium">{v.nome}</TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                <div>{v.email ?? "—"}</div>
                <div>{v.telefone ?? ""}</div>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground font-mono text-xs">
                {v.documento ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums font-semibold">
                {Number(v.percentual_comissao).toFixed(2)}%
                {v.percentual_comissao_meta != null && (
                  <div className="text-[10px] text-muted-foreground font-normal">
                    meta: {Number(v.percentual_comissao_meta).toFixed(2)}%
                  </div>
                )}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-right tabular-nums">
                {brl(v.meta_mensal)}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Badge variant="outline" className="capitalize">
                  {v.tipo_comissao === "venda" ? "Sobre venda" : "Sobre recebimento"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={v.ativo ? "default" : "secondary"}>
                  {v.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {isAdmin ? (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => confirm(`Excluir "${v.nome}"?`) && remove.mutate(v.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar vendedor" : "Novo vendedor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" name="nome" required defaultValue={editing?.nome ?? ""} />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" name="telefone" defaultValue={editing?.telefone ?? ""} />
            </div>
            <div>
              <Label htmlFor="documento">CPF / CNPJ</Label>
              <Input id="documento" name="documento" defaultValue={editing?.documento ?? ""} />
            </div>
            <div>
              <Label htmlFor="tipo_comissao">Tipo de comissão</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "venda" | "recebimento")}>
                <SelectTrigger id="tipo_comissao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="venda">Sobre venda (orçamento aprovado)</SelectItem>
                  <SelectItem value="recebimento">Sobre recebimento (pago)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="percentual_comissao">Comissão padrão (%)</Label>
              <Input
                id="percentual_comissao"
                name="percentual_comissao"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editing?.percentual_comissao ?? 0}
              />
            </div>
            <div>
              <Label htmlFor="percentual_comissao_meta">Comissão ao bater meta (%)</Label>
              <Input
                id="percentual_comissao_meta"
                name="percentual_comissao_meta"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editing?.percentual_comissao_meta ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="meta_mensal">Meta mensal (R$)</Label>
              <Input
                id="meta_mensal"
                name="meta_mensal"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editing?.meta_mensal ?? ""}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                name="observacoes"
                rows={3}
                defaultValue={editing?.observacoes ?? ""}
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
              <Label htmlFor="ativo">Ativo</Label>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
