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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Pencil,
  Trash2,
  Search,
  Loader2,
  Wifi,
  Plus,
  X,
  Building,
  MapPin,
  Ruler,
  Calendar,
  Package,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/obras")({
  validateSearch: (s: Record<string, unknown>) => ({
    open: typeof s.open === "string" ? s.open : undefined,
  }),
  component: ObrasPage,
});

type Status =
  | "planejamento"
  | "aguardando_material"
  | "em_medicao"
  | "em_instalacao"
  | "concluida"
  | "cancelada";

type CronogramaStatus = "pendente" | "em_andamento" | "concluida" | "atrasada";

type Obra = {
  id: string;
  numero: number;
  titulo: string;
  descricao: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  orcamento_id: string | null;
  orcamento_numero: number | null;
  ordem_producao_id: string | null;
  ordem_producao_numero: number | null;
  status: Status;
  responsavel_nome: string | null;
  logradouro: string | null;
  numero_endereco: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  data_inicio_prevista: string | null;
  data_entrega_prevista: string | null;
  data_entrega_real: string | null;
  valor: number;
  progresso: number;
  observacoes: string | null;
  created_at: string;
};

type Medicao = {
  id: string;
  obra_id: string;
  ambiente: string;
  largura_mm: number | null;
  altura_mm: number | null;
  quantidade: number;
  observacoes: string | null;
  data_medicao: string;
};

type Cronograma = {
  id: string;
  obra_id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  data_prevista: string | null;
  data_conclusao: string | null;
  status: CronogramaStatus;
};

type Material = {
  id: string;
  obra_id: string;
  descricao: string;
  unidade: string;
  quantidade_prevista: number;
  quantidade_utilizada: number;
  observacoes: string | null;
};

const STATUS_META: Record<Status, { label: string; className: string }> = {
  planejamento: { label: "Planejamento", className: "bg-muted text-muted-foreground" },
  aguardando_material: { label: "Aguardando material", className: "bg-chart-4/15 text-chart-4" },
  em_medicao: { label: "Em medição", className: "bg-chart-3/15 text-chart-3" },
  em_instalacao: { label: "Em instalação", className: "bg-primary/15 text-primary" },
  concluida: { label: "Concluída", className: "bg-chart-2/15 text-chart-2" },
  cancelada: { label: "Cancelada", className: "bg-destructive/15 text-destructive" },
};

const CRON_STATUS_META: Record<CronogramaStatus, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em andamento", className: "bg-primary/15 text-primary" },
  concluida: { label: "Concluída", className: "bg-chart-2/15 text-chart-2" },
  atrasada: { label: "Atrasada", className: "bg-destructive/15 text-destructive" },
};

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

function ObrasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "todos">("todos");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("obras-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "obras" },
        () => qc.invalidateQueries({ queryKey: ["obras"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "obra_medicoes" },
        () => qc.invalidateQueries({ queryKey: ["obra-detalhe"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "obra_cronograma" },
        () => qc.invalidateQueries({ queryKey: ["obra-detalhe"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "obra_materiais" },
        () => qc.invalidateQueries({ queryKey: ["obra-detalhe"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["obras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras" as never)
        .select("*")
        .order("numero", { ascending: false });
      if (error) throw error;
      return data as unknown as Obra[];
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((o) => {
      if (statusFilter !== "todos" && o.status !== statusFilter) return false;
      if (!q) return true;
      return [String(o.numero), o.titulo, o.cliente_nome, o.cidade].some((v) =>
        (v ?? "").toString().toLowerCase().includes(q),
      );
    });
  }, [data, query, statusFilter]);

  const kpis = useMemo(() => {
    const all = data ?? [];
    return {
      total: all.length,
      andamento: all.filter((o) =>
        ["em_medicao", "em_instalacao", "aguardando_material"].includes(o.status),
      ).length,
      concluidas: all.filter((o) => o.status === "concluida").length,
      valorTotal: all.reduce((s, o) => s + Number(o.valor ?? 0), 0),
    };
  }, [data]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obras" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obras"] });
      toast.success("Obra removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell
      title="Obras / Instalação"
      description="Cronograma, medições e entrega das obras com esquadrias"
      onNew={() => {
        setEditingId(null);
        setOpen(true);
      }}
      newLabel="Nova obra"
      actions={
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-chart-2">
            <Wifi className="h-3.5 w-3.5" />
            Ao vivo
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as Status | "todos")}
          >
            <SelectTrigger className="w-44">
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
        <KpiCard label="Total de obras" value={String(kpis.total)} icon={Building} />
        <KpiCard
          label="Em andamento"
          value={String(kpis.andamento)}
          accent="text-primary"
          icon={Ruler}
        />
        <KpiCard
          label="Concluídas"
          value={String(kpis.concluidas)}
          accent="text-chart-2"
          icon={Calendar}
        />
        <KpiCard
          label="Valor total"
          value={brl(kpis.valorTotal)}
          accent="text-chart-3"
          icon={Package}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Nº</TableHead>
            <TableHead>Obra / Cliente</TableHead>
            <TableHead className="hidden lg:table-cell">Local</TableHead>
            <TableHead className="hidden md:table-cell">Entrega</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-40">Progresso</TableHead>
            <TableHead className="text-right w-32">Ações</TableHead>
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
              <TableCell
                colSpan={7}
                className="text-center py-10 text-muted-foreground text-sm"
              >
                Nenhuma obra encontrada.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((o) => {
            const meta = STATUS_META[o.status];
            return (
              <TableRow key={o.id}>
                <TableCell className="font-mono font-semibold">#{o.numero}</TableCell>
                <TableCell>
                  <div className="font-medium">{o.titulo}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.cliente_nome ?? "Sem cliente"}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[o.cidade, o.estado].filter(Boolean).join(" / ") || "—"}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                  {fmtDate(o.data_entrega_prevista)}
                </TableCell>
                <TableCell>
                  <Badge className={meta.className} variant="secondary">
                    {meta.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={o.progresso} className="h-2" />
                    <span className="text-xs font-medium w-8 text-right">
                      {o.progresso}%
                    </span>
                  </div>
                </TableCell>
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
                      if (confirm(`Excluir obra #${o.numero}?`)) remove.mutate(o.id);
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

      <ObraDialog
        key={editingId ?? "new"}
        open={open}
        onOpenChange={setOpen}
        obraId={editingId}
        userId={user?.id ?? null}
      />
    </PageShell>
  );
}

function KpiCard({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  accent?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${accent ?? "text-muted-foreground"}`} />
      </div>
      <p className={`mt-1 text-2xl font-bold ${accent ?? ""}`}>{value}</p>
    </div>
  );
}

function ObraDialog({
  open,
  onOpenChange,
  obraId,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string | null;
  userId: string | null;
}) {
  const qc = useQueryClient();

  // General
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [orcamentoId, setOrcamentoId] = useState<string>("");
  const [ordemProducaoId, setOrdemProducaoId] = useState<string>("");
  const [status, setStatus] = useState<Status>("planejamento");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [valor, setValor] = useState("0");
  const [progresso, setProgresso] = useState("0");
  const [dataInicio, setDataInicio] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [dataEntregaReal, setDataEntregaReal] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Endereço
  const [logradouro, setLogradouro] = useState("");
  const [numeroEnd, setNumeroEnd] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");

  // Coleções
  const [medicoes, setMedicoes] = useState<Partial<Medicao>[]>([]);
  const [cronograma, setCronograma] = useState<Partial<Cronograma>[]>([]);
  const [materiais, setMateriais] = useState<Partial<Material>[]>([]);

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

  const { data: orcamentos } = useQuery({
    queryKey: ["orcamentos-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos" as never)
        .select("id, numero, cliente_nome, status")
        .order("numero", { ascending: false });
      if (error) throw error;
      return data as unknown as {
        id: string;
        numero: number;
        cliente_nome: string | null;
        status: string;
      }[];
    },
    enabled: open,
  });

  const { data: ops } = useQuery({
    queryKey: ["ops-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_producao" as never)
        .select("id, numero, titulo")
        .order("numero", { ascending: false });
      if (error) throw error;
      return data as unknown as { id: string; numero: number; titulo: string }[];
    },
    enabled: open,
  });

  const { data: existing, isFetching: loadingObra } = useQuery({
    queryKey: ["obra-detalhe", obraId],
    queryFn: async () => {
      if (!obraId) return null;
      const [obraRes, medRes, cronRes, matRes] = await Promise.all([
        supabase.from("obras" as never).select("*").eq("id", obraId).maybeSingle(),
        supabase
          .from("obra_medicoes" as never)
          .select("*")
          .eq("obra_id", obraId)
          .order("created_at"),
        supabase
          .from("obra_cronograma" as never)
          .select("*")
          .eq("obra_id", obraId)
          .order("ordem"),
        supabase
          .from("obra_materiais" as never)
          .select("*")
          .eq("obra_id", obraId)
          .order("created_at"),
      ]);
      if (obraRes.error) throw obraRes.error;
      if (medRes.error) throw medRes.error;
      if (cronRes.error) throw cronRes.error;
      if (matRes.error) throw matRes.error;
      return {
        obra: obraRes.data as unknown as Obra | null,
        medicoes: (medRes.data ?? []) as unknown as Medicao[],
        cronograma: (cronRes.data ?? []) as unknown as Cronograma[],
        materiais: (matRes.data ?? []) as unknown as Material[],
      };
    },
    enabled: open && !!obraId,
  });

  useEffect(() => {
    if (!open) return;
    if (existing?.obra) {
      const o = existing.obra;
      setTitulo(o.titulo);
      setDescricao(o.descricao ?? "");
      setClienteId(o.cliente_id ?? "");
      setOrcamentoId(o.orcamento_id ?? "");
      setOrdemProducaoId(o.ordem_producao_id ?? "");
      setStatus(o.status);
      setResponsavelNome(o.responsavel_nome ?? "");
      setValor(String(o.valor ?? 0));
      setProgresso(String(o.progresso ?? 0));
      setDataInicio(o.data_inicio_prevista ?? "");
      setDataEntrega(o.data_entrega_prevista ?? "");
      setDataEntregaReal(o.data_entrega_real ?? "");
      setObservacoes(o.observacoes ?? "");
      setLogradouro(o.logradouro ?? "");
      setNumeroEnd(o.numero_endereco ?? "");
      setComplemento(o.complemento ?? "");
      setBairro(o.bairro ?? "");
      setCidade(o.cidade ?? "");
      setEstado(o.estado ?? "");
      setCep(o.cep ?? "");
      setMedicoes(existing.medicoes);
      setCronograma(existing.cronograma);
      setMateriais(existing.materiais);
    } else if (!obraId) {
      setTitulo("");
      setDescricao("");
      setClienteId("");
      setOrcamentoId("");
      setOrdemProducaoId("");
      setStatus("planejamento");
      setResponsavelNome("");
      setValor("0");
      setProgresso("0");
      setDataInicio("");
      setDataEntrega("");
      setDataEntregaReal("");
      setObservacoes("");
      setLogradouro("");
      setNumeroEnd("");
      setComplemento("");
      setBairro("");
      setCidade("");
      setEstado("");
      setCep("");
      setMedicoes([]);
      setCronograma([]);
      setMateriais([]);
    }
  }, [existing, open, obraId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Informe o título da obra");

      const cliente = clientes?.find((c) => c.id === clienteId);
      const orc = orcamentos?.find((o) => o.id === orcamentoId);
      const op = ops?.find((o) => o.id === ordemProducaoId);

      const payload = {
        titulo: titulo.trim(),
        descricao: descricao || null,
        cliente_id: clienteId || null,
        cliente_nome: cliente?.nome ?? null,
        orcamento_id: orcamentoId || null,
        orcamento_numero: orc?.numero ?? null,
        ordem_producao_id: ordemProducaoId || null,
        ordem_producao_numero: op?.numero ?? null,
        status,
        responsavel_nome: responsavelNome || null,
        valor: Number(valor) || 0,
        progresso: Math.max(0, Math.min(100, Number(progresso) || 0)),
        data_inicio_prevista: dataInicio || null,
        data_entrega_prevista: dataEntrega || null,
        data_entrega_real: dataEntregaReal || null,
        observacoes: observacoes || null,
        logradouro: logradouro || null,
        numero_endereco: numeroEnd || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade: cidade || null,
        estado: estado || null,
        cep: cep || null,
      };

      let id = obraId;
      if (id) {
        const { error } = await supabase
          .from("obras" as never)
          .update(payload as never)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("obras" as never)
          .insert({ ...payload, created_by: userId } as never)
          .select("id")
          .single();
        if (error) throw error;
        id = (data as { id: string }).id;
      }

      // Replace child collections
      const replaceCollection = async <T extends { obra_id?: string }>(
        table: string,
        rows: T[],
      ) => {
        const { error: delErr } = await supabase
          .from(table as never)
          .delete()
          .eq("obra_id", id);
        if (delErr) throw delErr;
        if (rows.length === 0) return;
        const { error: insErr } = await supabase
          .from(table as never)
          .insert(rows as never);
        if (insErr) throw insErr;
      };

      await replaceCollection(
        "obra_medicoes",
        medicoes
          .filter((m) => (m.ambiente ?? "").trim().length > 0)
          .map((m) => ({
            obra_id: id!,
            ambiente: m.ambiente,
            largura_mm: m.largura_mm ?? null,
            altura_mm: m.altura_mm ?? null,
            quantidade: Number(m.quantidade ?? 1),
            observacoes: m.observacoes ?? null,
            data_medicao: m.data_medicao ?? new Date().toISOString().slice(0, 10),
          })),
      );

      await replaceCollection(
        "obra_cronograma",
        cronograma
          .filter((c) => (c.titulo ?? "").trim().length > 0)
          .map((c, idx) => ({
            obra_id: id!,
            ordem: idx + 1,
            titulo: c.titulo,
            descricao: c.descricao ?? null,
            data_prevista: c.data_prevista ?? null,
            data_conclusao: c.data_conclusao ?? null,
            status: c.status ?? "pendente",
          })),
      );

      await replaceCollection(
        "obra_materiais",
        materiais
          .filter((m) => (m.descricao ?? "").trim().length > 0)
          .map((m) => ({
            obra_id: id!,
            descricao: m.descricao,
            unidade: m.unidade ?? "un",
            quantidade_prevista: Number(m.quantidade_prevista ?? 0),
            quantidade_utilizada: Number(m.quantidade_utilizada ?? 0),
            observacoes: m.observacoes ?? null,
          })),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obras"] });
      qc.invalidateQueries({ queryKey: ["obra-detalhe"] });
      toast.success(obraId ? "Obra atualizada" : "Obra criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{obraId ? "Editar obra" : "Nova obra"}</DialogTitle>
          <DialogDescription>
            Dados gerais, cronograma, medições em obra e materiais utilizados
          </DialogDescription>
        </DialogHeader>

        {loadingObra ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            Carregando…
          </div>
        ) : (
          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
              <TabsTrigger value="medicoes">Medições</TabsTrigger>
              <TabsTrigger value="materiais">Materiais</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Título da obra *</Label>
                  <Input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex: Residencial Vista Alegre - Bloco A"
                  />
                </div>
                <div>
                  <Label>Cliente</Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
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
                  <Label>Orçamento vinculado</Label>
                  <Select value={orcamentoId} onValueChange={setOrcamentoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      {(orcamentos ?? []).map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          #{o.numero} — {o.cliente_nome ?? "—"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ordem de produção</Label>
                  <Select value={ordemProducaoId} onValueChange={setOrdemProducaoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      {(ops ?? []).map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          #{o.numero} — {o.titulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Responsável</Label>
                  <Input
                    value={responsavelNome}
                    onChange={(e) => setResponsavelNome(e.target.value)}
                    placeholder="Nome do responsável"
                  />
                </div>
                <div>
                  <Label>Valor da obra (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Progresso (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={progresso}
                    onChange={(e) => setProgresso(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Início previsto</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Entrega prevista</Label>
                  <Input
                    type="date"
                    value={dataEntrega}
                    onChange={(e) => setDataEntrega(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Entrega real</Label>
                  <Input
                    type="date"
                    value={dataEntregaReal}
                    onChange={(e) => setDataEntregaReal(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-md border p-4 bg-muted/20 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4" /> Endereço da obra
                </div>
                <div className="grid gap-3 md:grid-cols-6">
                  <div className="md:col-span-3">
                    <Label className="text-xs">Logradouro</Label>
                    <Input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Número</Label>
                    <Input value={numeroEnd} onChange={(e) => setNumeroEnd(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Complemento</Label>
                    <Input
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Bairro</Label>
                    <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Cidade</Label>
                    <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">UF</Label>
                    <Input
                      value={estado}
                      maxLength={2}
                      onChange={(e) => setEstado(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">CEP</Label>
                    <Input value={cep} onChange={(e) => setCep(e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  rows={3}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="cronograma" className="space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Etapas do cronograma da obra
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCronograma((p) => [
                      ...p,
                      { titulo: "", status: "pendente", data_prevista: null },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Nova etapa
                </Button>
              </div>
              {cronograma.length === 0 && (
                <p className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                  Nenhuma etapa cadastrada.
                </p>
              )}
              {cronograma.map((c, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-end rounded-md border p-3 bg-muted/20"
                >
                  <div className="col-span-12 md:col-span-4">
                    <Label className="text-xs">Título</Label>
                    <Input
                      value={c.titulo ?? ""}
                      onChange={(e) =>
                        setCronograma((p) => {
                          const n = [...p];
                          n[idx] = { ...n[idx], titulo: e.target.value };
                          return n;
                        })
                      }
                      placeholder="Ex: Medição em obra"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <Label className="text-xs">Data prevista</Label>
                    <Input
                      type="date"
                      value={c.data_prevista ?? ""}
                      onChange={(e) =>
                        setCronograma((p) => {
                          const n = [...p];
                          n[idx] = { ...n[idx], data_prevista: e.target.value || null };
                          return n;
                        })
                      }
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <Label className="text-xs">Conclusão</Label>
                    <Input
                      type="date"
                      value={c.data_conclusao ?? ""}
                      onChange={(e) =>
                        setCronograma((p) => {
                          const n = [...p];
                          n[idx] = { ...n[idx], data_conclusao: e.target.value || null };
                          return n;
                        })
                      }
                    />
                  </div>
                  <div className="col-span-10 md:col-span-3">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={c.status ?? "pendente"}
                      onValueChange={(v) =>
                        setCronograma((p) => {
                          const n = [...p];
                          n[idx] = { ...n[idx], status: v as CronogramaStatus };
                          return n;
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CRON_STATUS_META).map(([k, m]) => (
                          <SelectItem key={k} value={k}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 md:col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setCronograma((p) => p.filter((_, i) => i !== idx))
                      }
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="medicoes" className="space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Medições realizadas em campo
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setMedicoes((p) => [
                      ...p,
                      {
                        ambiente: "",
                        quantidade: 1,
                        largura_mm: null,
                        altura_mm: null,
                        data_medicao: new Date().toISOString().slice(0, 10),
                      },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Nova medição
                </Button>
              </div>
              {medicoes.length === 0 && (
                <p className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                  Nenhuma medição registrada.
                </p>
              )}
              {medicoes.map((m, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-end rounded-md border p-3 bg-muted/20"
                >
                  <div className="col-span-12 md:col-span-4">
                    <Label className="text-xs">Ambiente</Label>
                    <Input
                      value={m.ambiente ?? ""}
                      onChange={(e) =>
                        setMedicoes((p) => {
                          const n = [...p];
                          n[idx] = { ...n[idx], ambiente: e.target.value };
                          return n;
                        })
                      }
                      placeholder="Ex: Sala - janela frontal"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-xs">Larg. (mm)</Label>
                    <Input
                      type="number"
                      value={m.largura_mm ?? ""}
                      onChange={(e) =>
                        setMedicoes((p) => {
                          const n = [...p];
                          n[idx] = {
                            ...n[idx],
                            largura_mm: e.target.value ? Number(e.target.value) : null,
                          };
                          return n;
                        })
                      }
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-xs">Alt. (mm)</Label>
                    <Input
                      type="number"
                      value={m.altura_mm ?? ""}
                      onChange={(e) =>
                        setMedicoes((p) => {
                          const n = [...p];
                          n[idx] = {
                            ...n[idx],
                            altura_mm: e.target.value ? Number(e.target.value) : null,
                          };
                          return n;
                        })
                      }
                    />
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <Label className="text-xs">Qtd.</Label>
                    <Input
                      type="number"
                      min={1}
                      value={m.quantidade ?? 1}
                      onChange={(e) =>
                        setMedicoes((p) => {
                          const n = [...p];
                          n[idx] = { ...n[idx], quantidade: Number(e.target.value) };
                          return n;
                        })
                      }
                    />
                  </div>
                  <div className="col-span-10 md:col-span-2">
                    <Label className="text-xs">Data</Label>
                    <Input
                      type="date"
                      value={m.data_medicao ?? ""}
                      onChange={(e) =>
                        setMedicoes((p) => {
                          const n = [...p];
                          n[idx] = { ...n[idx], data_medicao: e.target.value };
                          return n;
                        })
                      }
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMedicoes((p) => p.filter((_, i) => i !== idx))}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="col-span-12">
                    <Label className="text-xs">Observações</Label>
                    <Input
                      value={m.observacoes ?? ""}
                      onChange={(e) =>
                        setMedicoes((p) => {
                          const n = [...p];
                          n[idx] = { ...n[idx], observacoes: e.target.value };
                          return n;
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="materiais" className="space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Controle de materiais previstos vs utilizados
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setMateriais((p) => [
                      ...p,
                      {
                        descricao: "",
                        unidade: "un",
                        quantidade_prevista: 0,
                        quantidade_utilizada: 0,
                      },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Novo material
                </Button>
              </div>
              {materiais.length === 0 && (
                <p className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                  Nenhum material cadastrado.
                </p>
              )}
              {materiais.map((m, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-end rounded-md border p-3 bg-muted/20"
                >
                  <div className="col-span-12 md:col-span-5">
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      value={m.descricao ?? ""}
                      onChange={(e) =>
                        setMateriais((p) => {
                          const n = [...p];
                          n[idx] = { ...n[idx], descricao: e.target.value };
                          return n;
                        })
                      }
                      placeholder="Ex: Perfil linha 25"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-xs">Unidade</Label>
                    <Input
                      value={m.unidade ?? "un"}
                      onChange={(e) =>
                        setMateriais((p) => {
                          const n = [...p];
                          n[idx] = { ...n[idx], unidade: e.target.value };
                          return n;
                        })
                      }
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-xs">Prevista</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={m.quantidade_prevista ?? 0}
                      onChange={(e) =>
                        setMateriais((p) => {
                          const n = [...p];
                          n[idx] = {
                            ...n[idx],
                            quantidade_prevista: Number(e.target.value),
                          };
                          return n;
                        })
                      }
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-xs">Utilizada</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={m.quantidade_utilizada ?? 0}
                      onChange={(e) =>
                        setMateriais((p) => {
                          const n = [...p];
                          n[idx] = {
                            ...n[idx],
                            quantidade_utilizada: Number(e.target.value),
                          };
                          return n;
                        })
                      }
                    />
                  </div>
                  <div className="col-span-12 md:col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMateriais((p) => p.filter((_, i) => i !== idx))}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {obraId ? "Salvar alterações" : "Criar obra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
