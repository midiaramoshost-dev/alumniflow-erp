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
import { Progress } from "@/components/ui/progress";
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
import {
  Pencil,
  Trash2,
  Search,
  Loader2,
  Wifi,
  Factory,
  Flame,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/producao")({
  validateSearch: (s: Record<string, unknown>) => ({
    open: typeof s.open === "string" ? s.open : undefined,
  }),
  component: ProducaoPage,
});

type Etapa =
  | "aguardando"
  | "corte"
  | "montagem"
  | "vidracaria"
  | "acabamento"
  | "finalizado"
  | "entregue"
  | "cancelada";

type Prioridade = "baixa" | "media" | "alta" | "urgente";

type OP = {
  id: string;
  numero: number;
  orcamento_id: string | null;
  orcamento_numero: number | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  titulo: string;
  descricao: string | null;
  etapa: Etapa;
  prioridade: Prioridade;
  progresso: number;
  data_inicio: string | null;
  data_previsao: string | null;
  data_entrega: string | null;
  observacoes: string | null;
  created_at: string;
};

const ETAPA_META: Record<Etapa, { label: string; className: string; progress: number }> = {
  aguardando: { label: "Aguardando", className: "bg-muted text-muted-foreground", progress: 0 },
  corte: { label: "Corte", className: "bg-chart-3/15 text-chart-3", progress: 20 },
  montagem: { label: "Montagem", className: "bg-chart-4/15 text-chart-4", progress: 45 },
  vidracaria: { label: "Vidraçaria", className: "bg-chart-5/15 text-chart-5", progress: 65 },
  acabamento: { label: "Acabamento", className: "bg-primary/15 text-primary", progress: 85 },
  finalizado: { label: "Finalizado", className: "bg-chart-2/15 text-chart-2", progress: 100 },
  entregue: { label: "Entregue", className: "bg-chart-2/25 text-chart-2", progress: 100 },
  cancelada: { label: "Cancelada", className: "bg-destructive/15 text-destructive", progress: 0 },
};

const PRIORIDADE_META: Record<Prioridade, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "bg-muted text-muted-foreground" },
  media: { label: "Média", className: "bg-chart-3/15 text-chart-3" },
  alta: { label: "Alta", className: "bg-chart-4/15 text-chart-4" },
  urgente: { label: "Urgente", className: "bg-destructive/15 text-destructive" },
};

const ETAPAS_ORDER: Etapa[] = [
  "aguardando",
  "corte",
  "montagem",
  "vidracaria",
  "acabamento",
  "finalizado",
  "entregue",
];

function nextEtapa(e: Etapa): Etapa | null {
  const idx = ETAPAS_ORDER.indexOf(e);
  if (idx < 0 || idx >= ETAPAS_ORDER.length - 1) return null;
  return ETAPAS_ORDER[idx + 1];
}

function ProducaoPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [etapaFilter, setEtapaFilter] = useState<Etapa | "todos" | "ativos">("ativos");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("producao-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordens_producao" },
        () => qc.invalidateQueries({ queryKey: ["ordens-producao"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordem_producao_etapas" },
        () => qc.invalidateQueries({ queryKey: ["op-etapas"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["ordens-producao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_producao" as never)
        .select("*")
        .order("numero", { ascending: false });
      if (error) throw error;
      return data as unknown as OP[];
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((o) => {
      if (etapaFilter === "ativos" && (o.etapa === "entregue" || o.etapa === "cancelada"))
        return false;
      if (etapaFilter !== "todos" && etapaFilter !== "ativos" && o.etapa !== etapaFilter)
        return false;
      if (!q) return true;
      return [String(o.numero), o.titulo, o.cliente_nome, o.observacoes].some((v) =>
        (v ?? "").toString().toLowerCase().includes(q),
      );
    });
  }, [data, query, etapaFilter]);

  const kpis = useMemo(() => {
    const all = data ?? [];
    return {
      total: all.length,
      emProducao: all.filter(
        (o) =>
          o.etapa !== "aguardando" &&
          o.etapa !== "entregue" &&
          o.etapa !== "cancelada" &&
          o.etapa !== "finalizado",
      ).length,
      aguardando: all.filter((o) => o.etapa === "aguardando").length,
      finalizadas: all.filter((o) => o.etapa === "finalizado" || o.etapa === "entregue").length,
    };
  }, [data]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ordens_producao" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-producao"] });
      toast.success("Ordem removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const avancarEtapa = useMutation({
    mutationFn: async (op: OP) => {
      const prox = nextEtapa(op.etapa);
      if (!prox) return;
      const patch: Record<string, unknown> = {
        etapa: prox,
        progresso: ETAPA_META[prox].progress,
      };
      if (!op.data_inicio && prox !== "aguardando") {
        patch.data_inicio = new Date().toISOString().slice(0, 10);
      }
      const { error } = await supabase
        .from("ordens_producao" as never)
        .update(patch as never)
        .eq("id", op.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-producao"] });
      toast.success("Etapa avançada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell
      title="Produção / PCP"
      description="Ordens de produção, etapas de fabricação e status em tempo real"
      onNew={() => {
        setEditingId(null);
        setOpen(true);
      }}
      newLabel="Nova ordem"
      actions={
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-chart-2">
            <Wifi className="h-3.5 w-3.5" />
            Ao vivo
          </div>
          <Select
            value={etapaFilter}
            onValueChange={(v) => setEtapaFilter(v as Etapa | "todos" | "ativos")}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Ativas</SelectItem>
              <SelectItem value="todos">Todas</SelectItem>
              {Object.entries(ETAPA_META).map(([k, m]) => (
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
        <KpiCard label="Total de OPs" value={String(kpis.total)} icon={Factory} />
        <KpiCard
          label="Em produção"
          value={String(kpis.emProducao)}
          icon={Factory}
          accent="text-chart-3"
        />
        <KpiCard
          label="Aguardando"
          value={String(kpis.aguardando)}
          icon={Flame}
          accent="text-chart-4"
        />
        <KpiCard
          label="Finalizadas"
          value={String(kpis.finalizadas)}
          icon={Factory}
          accent="text-chart-2"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Nº</TableHead>
            <TableHead>Ordem</TableHead>
            <TableHead className="hidden lg:table-cell">Cliente</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead className="hidden md:table-cell w-40">Progresso</TableHead>
            <TableHead className="hidden sm:table-cell">Prior.</TableHead>
            <TableHead className="text-right w-40">Ações</TableHead>
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
                Nenhuma ordem de produção encontrada.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((o) => {
            const meta = ETAPA_META[o.etapa];
            const prior = PRIORIDADE_META[o.prioridade];
            const prox = nextEtapa(o.etapa);
            return (
              <TableRow key={o.id}>
                <TableCell className="font-mono font-semibold">#{o.numero}</TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{o.titulo}</p>
                    {o.orcamento_numero && (
                      <p className="text-xs text-muted-foreground">
                        Orçamento #{o.orcamento_numero}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {o.cliente_nome ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge className={meta.className} variant="secondary">
                    {meta.label}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <Progress value={o.progresso} className="h-2" />
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {o.progresso}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge className={prior.className} variant="secondary">
                    {prior.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {prox && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title={`Avançar para ${ETAPA_META[prox].label}`}
                      onClick={() => avancarEtapa.mutate(o)}
                    >
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </Button>
                  )}
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
                      if (confirm(`Excluir OP #${o.numero}?`)) remove.mutate(o.id);
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

      <OPDialog
        key={editingId ?? "new"}
        open={open}
        onOpenChange={setOpen}
        opId={editingId}
        userId={user?.id ?? null}
      />
    </PageShell>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${accent ?? ""}`}>{value}</p>
      </div>
      <Icon className={`h-6 w-6 ${accent ?? "text-muted-foreground"} opacity-60`} />
    </div>
  );
}

function OPDialog({
  open,
  onOpenChange,
  opId,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  opId: string | null;
  userId: string | null;
}) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [orcamentoId, setOrcamentoId] = useState<string>("nenhum");
  const [clienteId, setClienteId] = useState<string>("nenhum");
  const [etapa, setEtapa] = useState<Etapa>("aguardando");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [progresso, setProgresso] = useState("0");
  const [dataPrevisao, setDataPrevisao] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const { data: orcamentos } = useQuery({
    queryKey: ["orcamentos-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos" as never)
        .select("id, numero, cliente_id, cliente_nome, status")
        .in("status", ["aprovado", "convertido", "enviado"])
        .order("numero", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as {
        id: string;
        numero: number;
        cliente_id: string | null;
        cliente_nome: string | null;
        status: string;
      }[];
    },
    enabled: open,
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
    enabled: open,
  });

  const { data: existing, isFetching } = useQuery({
    queryKey: ["ordem-producao", opId],
    queryFn: async () => {
      if (!opId) return null;
      const { data, error } = await supabase
        .from("ordens_producao" as never)
        .select("*")
        .eq("id", opId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as OP | null;
    },
    enabled: open && !!opId,
  });

  const { data: historico } = useQuery({
    queryKey: ["op-etapas", opId],
    queryFn: async () => {
      if (!opId) return [];
      const { data, error } = await supabase
        .from("ordem_producao_etapas" as never)
        .select("*")
        .eq("ordem_id", opId)
        .order("iniciada_em", { ascending: false });
      if (error) throw error;
      return data as unknown as {
        id: string;
        etapa: string;
        iniciada_em: string;
        concluida_em: string | null;
        observacoes: string | null;
      }[];
    },
    enabled: open && !!opId,
  });

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setTitulo(existing.titulo);
      setDescricao(existing.descricao ?? "");
      setOrcamentoId(existing.orcamento_id ?? "nenhum");
      setClienteId(existing.cliente_id ?? "nenhum");
      setEtapa(existing.etapa);
      setPrioridade(existing.prioridade);
      setProgresso(String(existing.progresso));
      setDataPrevisao(existing.data_previsao ?? "");
      setObservacoes(existing.observacoes ?? "");
    } else if (!opId) {
      setTitulo("");
      setDescricao("");
      setOrcamentoId("nenhum");
      setClienteId("nenhum");
      setEtapa("aguardando");
      setPrioridade("media");
      setProgresso("0");
      setDataPrevisao("");
      setObservacoes("");
    }
  }, [existing, open, opId]);

  // Auto-fill cliente when orçamento is chosen
  useEffect(() => {
    if (orcamentoId === "nenhum") return;
    const o = orcamentos?.find((x) => x.id === orcamentoId);
    if (o?.cliente_id) setClienteId(o.cliente_id);
    if (o && !titulo) setTitulo(`Produção — Orçamento #${o.numero}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentoId, orcamentos]);

  const save = useMutation({
    mutationFn: async () => {
      const orc = orcamentos?.find((o) => o.id === orcamentoId);
      const cli = clientes?.find((c) => c.id === clienteId);
      const payload: Record<string, unknown> = {
        titulo,
        descricao: descricao || null,
        orcamento_id: orcamentoId === "nenhum" ? null : orcamentoId,
        orcamento_numero: orc?.numero ?? null,
        cliente_id: clienteId === "nenhum" ? null : clienteId,
        cliente_nome: cli?.nome ?? orc?.cliente_nome ?? null,
        etapa,
        prioridade,
        progresso: Number(progresso) || 0,
        data_previsao: dataPrevisao || null,
        observacoes: observacoes || null,
      };
      if (opId) {
        const { error } = await supabase
          .from("ordens_producao" as never)
          .update(payload as never)
          .eq("id", opId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ordens_producao" as never)
          .insert({ ...payload, created_by: userId } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-producao"] });
      toast.success(opId ? "Ordem atualizada" : "Ordem criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{opId ? "Editar ordem de produção" : "Nova ordem de produção"}</DialogTitle>
          <DialogDescription>
            Vincule ao orçamento aprovado e controle as etapas de fabricação
          </DialogDescription>
        </DialogHeader>

        {isFetching ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            Carregando…
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Orçamento vinculado</Label>
                <Select value={orcamentoId} onValueChange={setOrcamentoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um orçamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">— Sem vínculo —</SelectItem>
                    {(orcamentos ?? []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        #{o.numero} — {o.cliente_nome ?? "Sem cliente"} ({o.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">— Nenhum —</SelectItem>
                    {(clientes ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Esquadrias apto 302 — Obra Central"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  rows={2}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>
              <div>
                <Label>Etapa</Label>
                <Select value={etapa} onValueChange={(v) => {
                  const nova = v as Etapa;
                  setEtapa(nova);
                  setProgresso(String(ETAPA_META[nova].progress));
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ETAPA_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={prioridade} onValueChange={(v) => setPrioridade(v as Prioridade)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADE_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="progresso">Progresso (%)</Label>
                <Input
                  id="progresso"
                  type="number"
                  min={0}
                  max={100}
                  value={progresso}
                  onChange={(e) => setProgresso(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="data_previsao">Previsão de entrega</Label>
                <Input
                  id="data_previsao"
                  type="date"
                  value={dataPrevisao}
                  onChange={(e) => setDataPrevisao(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
            </div>

            {opId && historico && historico.length > 0 && (
              <div>
                <Label className="text-sm">Histórico de etapas</Label>
                <div className="mt-2 rounded-md border divide-y max-h-48 overflow-y-auto">
                  {historico.map((h) => (
                    <div key={h.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={ETAPA_META[h.etapa as Etapa]?.className ?? ""}
                        >
                          {ETAPA_META[h.etapa as Etapa]?.label ?? h.etapa}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {new Date(h.iniciada_em).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {h.concluida_em
                          ? `→ ${new Date(h.concluida_em).toLocaleString("pt-BR")}`
                          : "em andamento"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !titulo.trim()}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {opId ? "Salvar alterações" : "Criar ordem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
