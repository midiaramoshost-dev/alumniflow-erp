import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Search, Loader2, Plus, X, Wifi } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendas")({
  validateSearch: (s: Record<string, unknown>) => ({
    open: typeof s.open === "string" ? s.open : undefined,
  }),
  component: VendasPage,
});

type Status = "rascunho" | "enviado" | "aprovado" | "rejeitado" | "convertido";

type Orcamento = {
  id: string;
  numero: number;
  cliente_id: string | null;
  cliente_nome: string | null;
  status: Status;
  data_orcamento: string;
  validade_dias: number;
  subtotal: number;
  desconto: number;
  total: number;
  observacoes: string | null;
  created_at: string;
};

type Item = {
  id: string;
  orcamento_id: string;
  ordem: number;
  descricao: string;
  tipo: string | null;
  largura_mm: number | null;
  altura_mm: number | null;
  quantidade: number;
  perfil_id: string | null;
  vidro_id: string | null;
  preco_unitario: number;
  subtotal: number;
};

const STATUS_META: Record<Status, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  enviado: { label: "Enviado", className: "bg-chart-3/15 text-chart-3" },
  aprovado: { label: "Aprovado", className: "bg-chart-2/15 text-chart-2" },
  rejeitado: { label: "Rejeitado", className: "bg-destructive/15 text-destructive" },
  convertido: { label: "Convertido", className: "bg-primary/15 text-primary" },
};

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);

function VendasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "todos">("todos");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("vendas-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orcamentos" },
        () => qc.invalidateQueries({ queryKey: ["orcamentos"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orcamento_itens" },
        () => {
          qc.invalidateQueries({ queryKey: ["orcamentos"] });
          qc.invalidateQueries({ queryKey: ["orcamento-itens"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["orcamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos" as never)
        .select("*")
        .order("numero", { ascending: false });
      if (error) throw error;
      return data as unknown as Orcamento[];
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((o) => {
      if (statusFilter !== "todos" && o.status !== statusFilter) return false;
      if (!q) return true;
      return [String(o.numero), o.cliente_nome, o.observacoes].some((v) =>
        (v ?? "").toString().toLowerCase().includes(q),
      );
    });
  }, [data, query, statusFilter]);

  const kpis = useMemo(() => {
    const all = data ?? [];
    return {
      total: all.length,
      aprovados: all.filter((o) => o.status === "aprovado" || o.status === "convertido").length,
      pipeline: all
        .filter((o) => o.status === "rascunho" || o.status === "enviado")
        .reduce((s, o) => s + Number(o.total), 0),
      fechados: all
        .filter((o) => o.status === "aprovado" || o.status === "convertido")
        .reduce((s, o) => s + Number(o.total), 0),
    };
  }, [data]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orcamentos" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orcamentos"] });
      toast.success("Orçamento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell
      title="Vendas / Orçamentos"
      description="Crie orçamentos de esquadrias, acompanhe status e converta em pedidos"
      onNew={() => {
        setEditingId(null);
        setOpen(true);
      }}
      newLabel="Novo orçamento"
      actions={
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-chart-2">
            <Wifi className="h-3.5 w-3.5" />
            Ao vivo
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status | "todos")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(STATUS_META).map(([k, m]) => (
                <SelectItem key={k} value={k}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar…"
              className="pl-8 w-48"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard label="Orçamentos" value={String(kpis.total)} />
        <KpiCard label="Aprovados" value={String(kpis.aprovados)} accent="text-chart-2" />
        <KpiCard label="Em pipeline" value={brl(kpis.pipeline)} accent="text-chart-3" />
        <KpiCard label="Fechados" value={brl(kpis.fechados)} accent="text-primary" />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Nº</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="hidden md:table-cell">Data</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right w-32">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Carregando…
              </TableCell>
            </TableRow>
          )}
          {!isLoading && filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                Nenhum orçamento encontrado.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((o) => {
            const meta = STATUS_META[o.status];
            return (
              <TableRow key={o.id}>
                <TableCell className="font-mono font-semibold">#{o.numero}</TableCell>
                <TableCell className="font-medium">{o.cliente_nome ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {new Date(o.data_orcamento).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  <Badge className={meta.className} variant="secondary">
                    {meta.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">{brl(Number(o.total))}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingId(o.id);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Excluir orçamento #${o.numero}?`)) remove.mutate(o.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <OrcamentoDialog
        key={editingId ?? "new"}
        open={open}
        onOpenChange={setOpen}
        orcamentoId={editingId}
        userId={user?.id ?? null}
      />
    </PageShell>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? ""}`}>{value}</p>
    </div>
  );
}

function OrcamentoDialog({
  open,
  onOpenChange,
  orcamentoId,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orcamentoId: string | null;
  userId: string | null;
}) {
  const qc = useQueryClient();
  const [clienteId, setClienteId] = useState<string>("");
  const [status, setStatus] = useState<Status>("rascunho");
  const [validadeDias, setValidadeDias] = useState("15");
  const [desconto, setDesconto] = useState("0");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<Partial<Item>[]>([]);

  const { data: clientes } = useQuery({
    queryKey: ["clientes-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
    enabled: open,
  });

  const { data: existing, isFetching: loadingOrc } = useQuery({
    queryKey: ["orcamento", orcamentoId],
    queryFn: async () => {
      if (!orcamentoId) return null;
      const [{ data: o, error: e1 }, { data: it, error: e2 }] = await Promise.all([
        supabase.from("orcamentos" as never).select("*").eq("id", orcamentoId).maybeSingle(),
        supabase
          .from("orcamento_itens" as never)
          .select("*")
          .eq("orcamento_id", orcamentoId)
          .order("ordem"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return {
        orcamento: o as unknown as Orcamento | null,
        itens: (it ?? []) as unknown as Item[],
      };
    },
    enabled: open && !!orcamentoId,
  });

  useEffect(() => {
    if (!open) return;
    if (existing?.orcamento) {
      setClienteId(existing.orcamento.cliente_id ?? "");
      setStatus(existing.orcamento.status);
      setValidadeDias(String(existing.orcamento.validade_dias));
      setDesconto(String(existing.orcamento.desconto));
      setObservacoes(existing.orcamento.observacoes ?? "");
      setItens(existing.itens);
    } else if (!orcamentoId) {
      setClienteId("");
      setStatus("rascunho");
      setValidadeDias("15");
      setDesconto("0");
      setObservacoes("");
      setItens([
        { descricao: "", quantidade: 1, largura_mm: null, altura_mm: null, preco_unitario: 0, subtotal: 0 },
      ]);
    }
  }, [existing, open, orcamentoId]);

  const subtotal = itens.reduce((s, i) => s + Number(i.subtotal ?? 0), 0);
  const total = Math.max(subtotal - Number(desconto || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      const cliente = clientes?.find((c) => c.id === clienteId);
      const payload = {
        cliente_id: clienteId || null,
        cliente_nome: cliente?.nome ?? null,
        status,
        validade_dias: Number(validadeDias) || 15,
        desconto: Number(desconto) || 0,
        observacoes: observacoes || null,
      };

      let id = orcamentoId;
      if (id) {
        const { error } = await supabase
          .from("orcamentos" as never)
          .update(payload as never)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("orcamentos" as never)
          .insert({ ...payload, created_by: userId } as never)
          .select("id")
          .single();
        if (error) throw error;
        id = (data as { id: string }).id;
      }

      // Replace itens: delete all then insert current
      const { error: delErr } = await supabase
        .from("orcamento_itens" as never)
        .delete()
        .eq("orcamento_id", id);
      if (delErr) throw delErr;

      const valid = itens.filter((i) => (i.descricao ?? "").trim().length > 0);
      if (valid.length > 0) {
        const rows = valid.map((i, idx) => ({
          orcamento_id: id,
          ordem: idx + 1,
          descricao: i.descricao,
          tipo: i.tipo ?? null,
          largura_mm: i.largura_mm ?? null,
          altura_mm: i.altura_mm ?? null,
          quantidade: Number(i.quantidade ?? 1),
          preco_unitario: Number(i.preco_unitario ?? 0),
          subtotal: Number(i.subtotal ?? 0),
          perfil_id: i.perfil_id ?? null,
          vidro_id: i.vidro_id ?? null,
        }));
        const { error: insErr } = await supabase
          .from("orcamento_itens" as never)
          .insert(rows as never);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orcamentos"] });
      toast.success(orcamentoId ? "Orçamento atualizado" : "Orçamento criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItens((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };
      const qtd = Number(merged.quantidade ?? 0);
      const preco = Number(merged.preco_unitario ?? 0);
      merged.subtotal = qtd * preco;
      next[idx] = merged;
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{orcamentoId ? "Editar orçamento" : "Novo orçamento"}</DialogTitle>
          <DialogDescription>
            Dados gerais, itens de esquadria e resumo financeiro
          </DialogDescription>
        </DialogHeader>

        {loadingOrc ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            Carregando…
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Label>Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientes ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Validade (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={validadeDias}
                  onChange={(e) => setValidadeDias(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base">Itens</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setItens((p) => [
                      ...p,
                      {
                        descricao: "",
                        quantidade: 1,
                        largura_mm: null,
                        altura_mm: null,
                        preco_unitario: 0,
                        subtotal: 0,
                      },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar item
                </Button>
              </div>
              <div className="space-y-2">
                {itens.length === 0 && (
                  <p className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                    Nenhum item. Clique em "Adicionar item".
                  </p>
                )}
                {itens.map((it, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-end rounded-md border p-3 bg-muted/20"
                  >
                    <div className="col-span-12 md:col-span-4">
                      <Label className="text-xs">Descrição</Label>
                      <Input
                        value={it.descricao ?? ""}
                        onChange={(e) => updateItem(idx, { descricao: e.target.value })}
                        placeholder="Ex: Janela de correr 2 folhas"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-1">
                      <Label className="text-xs">Larg. (mm)</Label>
                      <Input
                        type="number"
                        value={it.largura_mm ?? ""}
                        onChange={(e) =>
                          updateItem(idx, {
                            largura_mm: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-4 md:col-span-1">
                      <Label className="text-xs">Alt. (mm)</Label>
                      <Input
                        type="number"
                        value={it.altura_mm ?? ""}
                        onChange={(e) =>
                          updateItem(idx, {
                            altura_mm: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-4 md:col-span-1">
                      <Label className="text-xs">Qtd.</Label>
                      <Input
                        type="number"
                        min={1}
                        value={it.quantidade ?? 1}
                        onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Label className="text-xs">Preço unit. (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={it.preco_unitario ?? 0}
                        onChange={(e) =>
                          updateItem(idx, { preco_unitario: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="col-span-5 md:col-span-2 text-right">
                      <Label className="text-xs">Subtotal</Label>
                      <p className="font-semibold text-sm h-9 flex items-center justify-end">
                        {brl(Number(it.subtotal ?? 0))}
                      </p>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setItens((p) => p.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  rows={3}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{brl(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Desconto (R$)</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="w-32 h-8"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                  />
                </div>
                <div className="border-t pt-2 mt-1 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold text-primary">{brl(total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {orcamentoId ? "Salvar alterações" : "Criar orçamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
