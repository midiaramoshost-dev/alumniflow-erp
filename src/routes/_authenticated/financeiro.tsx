import { useEffect, useMemo, useState } from "react";
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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Pencil, Trash2, Search, Loader2, Wifi,
  TrendingUp, TrendingDown, Wallet, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroPage,
});

type Tipo = "receita" | "despesa";
type Status = "pendente" | "pago" | "atrasado" | "cancelado";

type Lancamento = {
  id: string;
  tipo: Tipo;
  descricao: string;
  categoria: string | null;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: Status;
  forma_pagamento: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  orcamento_id: string | null;
  orcamento_numero: number | null;
  obra_id: string | null;
  obra_numero: number | null;
  observacoes: string | null;
  created_at: string;
};

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);

const fmtDate = (s: string | null) =>
  s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—";

const STATUS_META: Record<Status, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-chart-3/15 text-chart-3" },
  pago: { label: "Pago", className: "bg-chart-2/15 text-chart-2" },
  atrasado: { label: "Atrasado", className: "bg-destructive/15 text-destructive" },
  cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
};

const CATEGORIAS_RECEITA = ["Vendas", "Serviços", "Instalação", "Outros"];
const CATEGORIAS_DESPESA = [
  "Matéria-prima", "Fornecedores", "Salários", "Aluguel", "Energia",
  "Impostos", "Frete", "Marketing", "Manutenção", "Outros",
];
const FORMAS = ["Dinheiro", "PIX", "Boleto", "Cartão de crédito", "Cartão de débito", "Transferência", "Cheque"];

function FinanceiroPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<"todos" | Tipo>("todos");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "todos">("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lancamento | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_lancamentos" as never)
        .select("*")
        .order("data_vencimento", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Lancamento[];
    },
  });

  // Auto-marcar atrasados no client (evita depender de cron)
  const rows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (data ?? []).map((r) =>
      r.status === "pendente" && r.data_vencimento < today
        ? { ...r, status: "atrasado" as Status }
        : r,
    );
  }, [data]);

  const filtered = useMemo(() => {
    let base = rows;
    if (tab !== "todos") base = base.filter((r) => r.tipo === tab);
    if (statusFilter !== "todos") base = base.filter((r) => r.status === statusFilter);
    const s = q.trim().toLowerCase();
    if (s) {
      base = base.filter((r) =>
        [r.descricao, r.categoria, r.cliente_nome].some((x) =>
          (x ?? "").toLowerCase().includes(s),
        ),
      );
    }
    return base;
  }, [rows, tab, statusFilter, q]);

  // KPIs (mês corrente)
  const kpis = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const doMes = rows.filter((r) => r.data_vencimento.startsWith(ym));
    const receber = rows
      .filter((r) => r.tipo === "receita" && r.status !== "pago" && r.status !== "cancelado")
      .reduce((s, r) => s + Number(r.valor), 0);
    const pagar = rows
      .filter((r) => r.tipo === "despesa" && r.status !== "pago" && r.status !== "cancelado")
      .reduce((s, r) => s + Number(r.valor), 0);
    const recebidoMes = doMes
      .filter((r) => r.tipo === "receita" && r.status === "pago")
      .reduce((s, r) => s + Number(r.valor), 0);
    const pagoMes = doMes
      .filter((r) => r.tipo === "despesa" && r.status === "pago")
      .reduce((s, r) => s + Number(r.valor), 0);
    const saldoMes = recebidoMes - pagoMes;
    const atrasados = rows.filter((r) => r.status === "atrasado").length;
    return { receber, pagar, saldoMes, recebidoMes, pagoMes, atrasados };
  }, [rows]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("fin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "financeiro_lancamentos" }, () =>
        qc.invalidateQueries({ queryKey: ["financeiro"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro_lancamentos" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Lançamento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quickPay = useMutation({
    mutationFn: async (r: Lancamento) => {
      const novoStatus: Status = r.status === "pago" ? "pendente" : "pago";
      const { error } = await supabase
        .from("financeiro_lancamentos" as never)
        .update({ status: novoStatus } as never)
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageShell
        title="Financeiro"
        description="Contas a receber, contas a pagar e fluxo de caixa em tempo real"
        newLabel="Novo lançamento"
        onNew={() => {
          setEditing(null);
          setOpen(true);
        }}
        actions={
          <Badge variant="secondary" className="gap-1.5 bg-chart-2/15 text-chart-2 border-0">
            <Wifi className="h-3 w-3" /> Ao vivo
          </Badge>
        }
      >
        <div className="p-4 md:p-6 space-y-5">
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="A receber"
              value={brl(kpis.receber)}
              icon={<TrendingUp className="h-4 w-4" />}
              iconClass="bg-chart-2/10 text-chart-2"
            />
            <KpiCard
              label="A pagar"
              value={brl(kpis.pagar)}
              icon={<TrendingDown className="h-4 w-4" />}
              iconClass="bg-destructive/10 text-destructive"
            />
            <KpiCard
              label="Saldo do mês"
              value={brl(kpis.saldoMes)}
              icon={<Wallet className="h-4 w-4" />}
              iconClass="bg-primary/10 text-primary"
              accent={kpis.saldoMes >= 0 ? "text-chart-2" : "text-destructive"}
            />
            <KpiCard
              label="Atrasados"
              value={String(kpis.atrasados)}
              icon={<AlertTriangle className="h-4 w-4" />}
              iconClass="bg-chart-3/10 text-chart-3"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="receita">A receber</TabsTrigger>
                <TabsTrigger value="despesa">A pagar</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {Object.entries(STATUS_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar…"
                  className="pl-8 w-56"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden lg:table-cell">Vínculo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Carregando…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                      Nenhum lançamento encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-6 w-1 rounded-full ${
                            r.tipo === "receita" ? "bg-chart-2" : "bg-destructive"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{r.descricao}</p>
                          {r.cliente_nome && (
                            <p className="text-xs text-muted-foreground truncate">{r.cliente_nome}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {r.categoria ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {r.orcamento_numero ? `Orç #${r.orcamento_numero}` : ""}
                      {r.obra_numero ? ` / Obra #${r.obra_numero}` : ""}
                      {!r.orcamento_numero && !r.obra_numero && "—"}
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(r.data_vencimento)}</TableCell>
                    <TableCell>
                      <Badge className={`capitalize border-0 ${STATUS_META[r.status].className}`}>
                        {STATUS_META[r.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${
                        r.tipo === "receita" ? "text-chart-2" : "text-destructive"
                      }`}
                    >
                      {r.tipo === "despesa" ? "-" : ""}
                      {brl(Number(r.valor))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={r.status === "pago" ? "Reabrir" : "Marcar como pago"}
                        onClick={() => quickPay.mutate(r)}
                        disabled={quickPay.isPending}
                      >
                        <CheckCircle2
                          className={`h-4 w-4 ${r.status === "pago" ? "text-chart-2" : ""}`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          confirm(`Excluir "${r.descricao}"?`) && remove.mutate(r.id)
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </PageShell>

      <LancamentoDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        userId={user?.id ?? null}
      />
    </div>
  );
}

function KpiCard({
  label, value, icon, iconClass, accent,
}: {
  label: string; value: string; icon: React.ReactNode; iconClass: string; accent?: string;
}) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-10 w-10 rounded-lg grid place-items-center ${iconClass}`}>{icon}</div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${accent ?? ""}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LancamentoDialog({
  open, onOpenChange, editing, userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Lancamento | null;
  userId: string | null;
}) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<Tipo>("receita");
  const [status, setStatus] = useState<Status>("pendente");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<string>("");
  const [valor, setValor] = useState("0");
  const [vencimento, setVencimento] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [forma, setForma] = useState<string>("");
  const [clienteId, setClienteId] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");

  const { data: clientes } = useQuery({
    queryKey: ["clientes-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTipo(editing.tipo);
      setStatus(editing.status);
      setDescricao(editing.descricao);
      setCategoria(editing.categoria ?? "");
      setValor(String(editing.valor));
      setVencimento(editing.data_vencimento);
      setForma(editing.forma_pagamento ?? "");
      setClienteId(editing.cliente_id ?? "");
      setObservacoes(editing.observacoes ?? "");
    } else {
      setTipo("receita");
      setStatus("pendente");
      setDescricao("");
      setCategoria("");
      setValor("0");
      setVencimento(new Date().toISOString().slice(0, 10));
      setForma("");
      setClienteId("");
      setObservacoes("");
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!descricao.trim()) throw new Error("Descrição é obrigatória");
      const cli = clientes?.find((c) => c.id === clienteId);
      const payload = {
        tipo,
        descricao: descricao.trim(),
        categoria: categoria || null,
        valor: Number(String(valor).replace(",", ".")) || 0,
        data_vencimento: vencimento,
        status,
        forma_pagamento: forma || null,
        cliente_id: clienteId || null,
        cliente_nome: cli?.nome ?? null,
        observacoes: observacoes || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("financeiro_lancamentos" as never)
          .update(payload as never)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("financeiro_lancamentos" as never)
          .insert({ ...payload, created_by: userId } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success(editing ? "Lançamento atualizado" : "Lançamento criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const categorias = tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>
            Registre uma receita ou despesa com vencimento e vínculo opcional a clientes ou obras.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receita">Receita (a receber)</SelectItem>
                <SelectItem value="despesa">Despesa (a pagar)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_META).map(([k, m]) => (
                  <SelectItem key={k} value={k}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label>Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Sinal Obra Silva — Cliente ABC"
            />
          </div>

          <div>
            <Label>Categoria</Label>
            <Select value={categoria || "none"} onValueChange={(v) => setCategoria(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem categoria —</SelectItem>
                {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={forma || "none"} onValueChange={(v) => setForma(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Não definida —</SelectItem>
                {FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Valor (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div>
            <Label>Vencimento *</Label>
            <Input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Cliente</Label>
            <Select value={clienteId || "none"} onValueChange={(v) => setClienteId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {(clientes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Salvar alterações" : "Criar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
