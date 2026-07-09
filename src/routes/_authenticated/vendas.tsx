import { useMemo, useState, useEffect, type ReactNode } from "react";
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
import { Pencil, Trash2, Search, Loader2, Plus, X, Wifi, FileDown } from "lucide-react";
import { buildOrcamentoPdf, generateOrcamentoPdf } from "@/lib/orcamento-pdf";
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
  // enriquecidos
  vendedor_id: string | null;
  percentual_comissao: number;
  valor_comissao: number;
  margem_percentual: number;
  imposto_percentual: number;
  valor_impostos: number;
  forma_pagamento: string | null;
  prazo_entrega_dias: number | null;
  obra_endereco: string | null;
  obra_numero: string | null;
  obra_bairro: string | null;
  obra_cidade: string | null;
  obra_estado: string | null;
  obra_cep: string | null;
  obra_ambiente: string | null;
  obra_pavimento: string | null;
  obra_referencia: string | null;
};

type ItemAcessorio = {
  acessorio_id: string;
  codigo?: string;
  descricao?: string;
  quantidade: number;
  preco_unitario: number;
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
  cor_perfil: string | null;
  acabamento_perfil: string | null;
  valor_perfil: number;
  valor_vidro: number;
  valor_acessorios: number;
  acessorios: ItemAcessorio[];
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
  const search = Route.useSearch();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "todos">("todos");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (search.open) {
      setEditingId(search.open);
      setOpen(true);
    }
  }, [search.open]);

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
                    title="Prévia do PDF"
                    onClick={() => setPreviewId(o.id)}
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
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

/* =========================================================================
   Diálogo — Novo cliente rápido
   ========================================================================= */
function NovoClienteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (cliente: { id: string; nome: string }) => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"pf" | "pj">("pf");
  const [documento, setDocumento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!nome.trim()) return toast.error("Informe o nome");
    setSaving(true);
    const { data, error } = await supabase
      .from("clientes")
      .insert({ nome, tipo, documento: documento || null, telefone: telefone || null, email: email || null })
      .select("id, nome")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cliente criado");
    onCreated(data as { id: string; nome: string });
    setNome(""); setDocumento(""); setTelefone(""); setEmail("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
          <DialogDescription>Cadastro rápido para usar neste orçamento</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "pf" | "pj")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pf">Pessoa Física</SelectItem>
                  <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tipo === "pj" ? "CNPJ" : "CPF"}</Label>
              <Input value={documento} onChange={(e) => setDocumento(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================================
   Diálogo principal — Novo/Editar orçamento (enriquecido)
   ========================================================================= */
type ClienteLookup = {
  id: string; nome: string;
  telefone: string | null; celular: string | null; email: string | null;
  documento: string | null; endereco: string | null; numero: string | null;
  bairro: string | null; cidade: string | null; estado: string | null; cep: string | null;
  vendedor_id: string | null;
};

type VendedorLookup = {
  id: string; nome: string; percentual_comissao: number | null; percentual_comissao_meta: number | null;
};

type VidroLookup = { id: string; codigo: string; descricao: string; cor: string | null; preco_m2: number | null };

type AcessorioLookup = { id: string; codigo: string; descricao: string; unidade: string | null; preco_unitario: number | null };

type PerfilLookup = {
  id: string; codigo: string; descricao: string; cor: string | null; acabamento: string | null;
  peso_kg_m: number | null; preco_kg: number | null; preco_metro: number | null;
};

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

  // Dados do orçamento
  const [clienteId, setClienteId] = useState<string>("");
  const [status, setStatus] = useState<Status>("rascunho");
  const [validadeDias, setValidadeDias] = useState("15");
  const [desconto, setDesconto] = useState("0");
  const [observacoes, setObservacoes] = useState("");

  // Comercial
  const [vendedorId, setVendedorId] = useState<string>("");
  const [percentualComissao, setPercentualComissao] = useState("0");
  const [margemPct, setMargemPct] = useState("30");
  const [impostoPct, setImpostoPct] = useState("0");
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [prazoEntregaDias, setPrazoEntregaDias] = useState("");

  // Obra
  const [obraEndereco, setObraEndereco] = useState("");
  const [obraNumero, setObraNumero] = useState("");
  const [obraBairro, setObraBairro] = useState("");
  const [obraCidade, setObraCidade] = useState("");
  const [obraEstado, setObraEstado] = useState("");
  const [obraCep, setObraCep] = useState("");
  const [obraAmbiente, setObraAmbiente] = useState("");
  const [obraPavimento, setObraPavimento] = useState("");
  const [obraReferencia, setObraReferencia] = useState("");

  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [itens, setItens] = useState<Partial<Item>[]>([]);

  const { data: clientes } = useQuery({
    queryKey: ["clientes-lookup-enriched"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone, celular, email, documento, endereco, numero, bairro, cidade, estado, cep, vendedor_id")
        .order("nome");
      if (error) throw error;
      return data as ClienteLookup[];
    },
    enabled: open,
  });

  const { data: vendedores } = useQuery({
    queryKey: ["vendedores-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome, percentual_comissao, percentual_comissao_meta")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as VendedorLookup[];
    },
    enabled: open,
  });

  const { data: perfis } = useQuery({
    queryKey: ["perfis-lookup-enriched"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis_aluminio")
        .select("id, codigo, descricao, cor, acabamento, peso_kg_m, preco_kg, preco_metro")
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return data as PerfilLookup[];
    },
    enabled: open,
  });

  const { data: vidros } = useQuery({
    queryKey: ["vidros-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vidros")
        .select("id, codigo, descricao, cor, preco_m2")
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return data as VidroLookup[];
    },
    enabled: open,
  });

  const { data: acessorios } = useQuery({
    queryKey: ["acessorios-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acessorios")
        .select("id, codigo, descricao, unidade, preco_unitario")
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return data as AcessorioLookup[];
    },
    enabled: open,
  });

  const clienteSel = useMemo(
    () => clientes?.find((c) => c.id === clienteId) ?? null,
    [clientes, clienteId],
  );

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
      const o = existing.orcamento;
      setClienteId(o.cliente_id ?? "");
      setStatus(o.status);
      setValidadeDias(String(o.validade_dias));
      setDesconto(String(o.desconto));
      setObservacoes(o.observacoes ?? "");
      setVendedorId(o.vendedor_id ?? "");
      setPercentualComissao(String(o.percentual_comissao ?? 0));
      setMargemPct(String(o.margem_percentual ?? 30));
      setImpostoPct(String(o.imposto_percentual ?? 0));
      setFormaPagamento(o.forma_pagamento ?? "");
      setPrazoEntregaDias(o.prazo_entrega_dias != null ? String(o.prazo_entrega_dias) : "");
      setObraEndereco(o.obra_endereco ?? "");
      setObraNumero(o.obra_numero ?? "");
      setObraBairro(o.obra_bairro ?? "");
      setObraCidade(o.obra_cidade ?? "");
      setObraEstado(o.obra_estado ?? "");
      setObraCep(o.obra_cep ?? "");
      setObraAmbiente(o.obra_ambiente ?? "");
      setObraPavimento(o.obra_pavimento ?? "");
      setObraReferencia(o.obra_referencia ?? "");
      setItens(existing.itens);
    } else if (!orcamentoId) {
      setClienteId("");
      setStatus("rascunho");
      setValidadeDias("15");
      setDesconto("0");
      setObservacoes("");
      setVendedorId(""); setPercentualComissao("0"); setMargemPct("30"); setImpostoPct("0");
      setFormaPagamento(""); setPrazoEntregaDias("");
      setObraEndereco(""); setObraNumero(""); setObraBairro(""); setObraCidade("");
      setObraEstado(""); setObraCep(""); setObraAmbiente(""); setObraPavimento(""); setObraReferencia("");
      setItens([blankItem()]);
    }
  }, [existing, open, orcamentoId]);

  // Auto-preencher vendedor e endereço da obra quando cliente é escolhido (só em criação)
  useEffect(() => {
    if (!open || orcamentoId) return;
    if (!clienteSel) return;
    if (!vendedorId && clienteSel.vendedor_id) setVendedorId(clienteSel.vendedor_id);
    if (!obraEndereco && clienteSel.endereco) setObraEndereco(clienteSel.endereco);
    if (!obraNumero && clienteSel.numero) setObraNumero(clienteSel.numero);
    if (!obraBairro && clienteSel.bairro) setObraBairro(clienteSel.bairro);
    if (!obraCidade && clienteSel.cidade) setObraCidade(clienteSel.cidade);
    if (!obraEstado && clienteSel.estado) setObraEstado(clienteSel.estado);
    if (!obraCep && clienteSel.cep) setObraCep(clienteSel.cep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSel]);

  // Aplicar comissão do vendedor automaticamente
  useEffect(() => {
    if (!open || !vendedorId) return;
    const v = vendedores?.find((x) => x.id === vendedorId);
    if (v && (percentualComissao === "0" || percentualComissao === "")) {
      setPercentualComissao(String(v.percentual_comissao ?? 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedorId, vendedores]);

  // ---- Totais e cálculos ----
  const subtotal = itens.reduce((s, i) => s + Number(i.subtotal ?? 0), 0);
  const descontoNum = Number(desconto) || 0;
  const base = Math.max(subtotal - descontoNum, 0);
  const impostoNum = base * ((Number(impostoPct) || 0) / 100);
  const total = base + impostoNum;
  const comissaoNum = total * ((Number(percentualComissao) || 0) / 100);
  const custoEstimado = total / (1 + (Number(margemPct) || 0) / 100);
  const margemValor = total - custoEstimado;

  const save = useMutation({
    mutationFn: async () => {
      const cliente = clientes?.find((c) => c.id === clienteId);
      const payload = {
        cliente_id: clienteId || null,
        cliente_nome: cliente?.nome ?? null,
        status,
        validade_dias: Number(validadeDias) || 15,
        desconto: descontoNum,
        observacoes: observacoes || null,
        vendedor_id: vendedorId || null,
        percentual_comissao: Number(percentualComissao) || 0,
        valor_comissao: Number(comissaoNum.toFixed(2)),
        margem_percentual: Number(margemPct) || 0,
        imposto_percentual: Number(impostoPct) || 0,
        valor_impostos: Number(impostoNum.toFixed(2)),
        forma_pagamento: formaPagamento || null,
        prazo_entrega_dias: prazoEntregaDias ? Number(prazoEntregaDias) : null,
        obra_endereco: obraEndereco || null,
        obra_numero: obraNumero || null,
        obra_bairro: obraBairro || null,
        obra_cidade: obraCidade || null,
        obra_estado: obraEstado || null,
        obra_cep: obraCep || null,
        obra_ambiente: obraAmbiente || null,
        obra_pavimento: obraPavimento || null,
        obra_referencia: obraReferencia || null,
      };

      let id = orcamentoId;
      if (id) {
        const { error } = await supabase.from("orcamentos" as never).update(payload as never).eq("id", id);
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

      const { error: delErr } = await supabase.from("orcamento_itens" as never).delete().eq("orcamento_id", id);
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
          cor_perfil: i.cor_perfil ?? null,
          acabamento_perfil: i.acabamento_perfil ?? null,
          valor_perfil: Number(i.valor_perfil ?? 0),
          valor_vidro: Number(i.valor_vidro ?? 0),
          valor_acessorios: Number(i.valor_acessorios ?? 0),
          acessorios: i.acessorios ?? [],
        }));
        const { error: insErr } = await supabase.from("orcamento_itens" as never).insert(rows as never);
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
      const merged = { ...next[idx], ...patch } as Partial<Item>;

      // Preencher cor/acabamento a partir do perfil
      if ("perfil_id" in patch && merged.perfil_id) {
        const p = perfis?.find((x) => x.id === merged.perfil_id);
        if (p) {
          if (!merged.cor_perfil && p.cor) merged.cor_perfil = p.cor;
          if (!merged.acabamento_perfil && p.acabamento) merged.acabamento_perfil = p.acabamento;
        }
      }

      // Auto valor_perfil pelo perímetro
      const auto = ("perfil_id" in patch || "largura_mm" in patch || "altura_mm" in patch) &&
        !("valor_perfil" in patch);
      if (auto && merged.perfil_id) {
        const p = perfis?.find((x) => x.id === merged.perfil_id);
        const h = Number(merged.altura_mm ?? 0);
        const w = Number(merged.largura_mm ?? 0);
        if (p && h > 0 && w > 0) {
          const perimetroM = ((h + w) * 2) / 1000;
          const precoMetro = Number(p.preco_metro ?? 0);
          const precoKg = Number(p.preco_kg ?? 0);
          const pesoKgM = Number(p.peso_kg_m ?? 0);
          const porMetro = perimetroM * precoMetro;
          const porPeso = perimetroM * pesoKgM * precoKg;
          const calc = porMetro > 0 ? porMetro : porPeso;
          if (calc > 0) merged.valor_perfil = Number(calc.toFixed(2));
        }
      }

      // Auto valor_vidro por área × preço/m²
      const autoVidro = ("vidro_id" in patch || "largura_mm" in patch || "altura_mm" in patch) &&
        !("valor_vidro" in patch);
      if (autoVidro && merged.vidro_id) {
        const v = vidros?.find((x) => x.id === merged.vidro_id);
        const h = Number(merged.altura_mm ?? 0);
        const w = Number(merged.largura_mm ?? 0);
        if (v && h > 0 && w > 0 && v.preco_m2) {
          const areaM2 = (h * w) / 1_000_000;
          merged.valor_vidro = Number((areaM2 * Number(v.preco_m2)).toFixed(2));
        }
      }

      // valor_acessorios = soma
      const somaAcess = (merged.acessorios ?? []).reduce(
        (s, a) => s + Number(a.quantidade || 0) * Number(a.preco_unitario || 0),
        0,
      );
      merged.valor_acessorios = Number(somaAcess.toFixed(2));

      // preço unitário = perfil + vidro + acessórios (por unidade)
      const pu = Number(merged.valor_perfil ?? 0) + Number(merged.valor_vidro ?? 0) + Number(merged.valor_acessorios ?? 0);
      merged.preco_unitario = Number(pu.toFixed(2));

      const qtd = Number(merged.quantidade ?? 1);
      merged.subtotal = Number((qtd * merged.preco_unitario).toFixed(2));

      next[idx] = merged;
      return next;
    });
  };

  const addAcessorio = (idx: number, acessorioId: string) => {
    const a = acessorios?.find((x) => x.id === acessorioId);
    if (!a) return;
    setItens((prev) => {
      const next = [...prev];
      const cur = next[idx];
      const list = [...(cur.acessorios ?? [])];
      // não duplicar
      if (list.find((x) => x.acessorio_id === acessorioId)) return next;
      list.push({
        acessorio_id: a.id, codigo: a.codigo, descricao: a.descricao,
        quantidade: 1, preco_unitario: Number(a.preco_unitario ?? 0),
      });
      next[idx] = { ...cur, acessorios: list };
      return next;
    });
    // Recalcular
    setTimeout(() => updateItem(idx, {}), 0);
  };

  const removeAcessorio = (idx: number, acessorioId: string) => {
    setItens((prev) => {
      const next = [...prev];
      const cur = next[idx];
      next[idx] = { ...cur, acessorios: (cur.acessorios ?? []).filter((a) => a.acessorio_id !== acessorioId) };
      return next;
    });
    setTimeout(() => updateItem(idx, {}), 0);
  };

  const updateAcessorio = (idx: number, acessorioId: string, patch: Partial<ItemAcessorio>) => {
    setItens((prev) => {
      const next = [...prev];
      const cur = next[idx];
      const list = (cur.acessorios ?? []).map((a) =>
        a.acessorio_id === acessorioId ? { ...a, ...patch } : a,
      );
      next[idx] = { ...cur, acessorios: list };
      return next;
    });
    setTimeout(() => updateItem(idx, {}), 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{orcamentoId ? "Editar orçamento" : "Novo orçamento"}</DialogTitle>
          <DialogDescription>Dados do cliente, obra, itens e informações comerciais</DialogDescription>
        </DialogHeader>

        {loadingOrc ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            Carregando…
          </div>
        ) : (
          <div className="space-y-6">
            {/* ============ CLIENTE ============ */}
            <section className="space-y-3">
              <SectionTitle>Cliente</SectionTitle>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-3">
                  <Label>Cliente</Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                    <SelectContent>
                      {(clientes ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" className="w-full" onClick={() => setNovoClienteOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Novo cliente
                  </Button>
                </div>
              </div>
              {clienteSel && (
                <div className="rounded-md border bg-muted/30 p-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3 text-xs">
                  <InfoItem label="Documento" value={clienteSel.documento} />
                  <InfoItem label="Telefone" value={clienteSel.telefone ?? clienteSel.celular} />
                  <InfoItem label="E-mail" value={clienteSel.email} />
                  <InfoItem label="Endereço" value={[clienteSel.endereco, clienteSel.numero].filter(Boolean).join(", ")} />
                  <InfoItem label="Cidade/UF" value={[clienteSel.cidade, clienteSel.estado].filter(Boolean).join(" - ")} />
                  <InfoItem label="CEP" value={clienteSel.cep} />
                </div>
              )}
            </section>

            {/* ============ OBRA ============ */}
            <section className="space-y-3">
              <SectionTitle>Local de instalação (obra)</SectionTitle>
              <div className="grid gap-3 md:grid-cols-6">
                <div className="md:col-span-3">
                  <Label>Endereço</Label>
                  <Input value={obraEndereco} onChange={(e) => setObraEndereco(e.target.value)} />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={obraNumero} onChange={(e) => setObraNumero(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Bairro</Label>
                  <Input value={obraBairro} onChange={(e) => setObraBairro(e.target.value)} />
                </div>
                <div className="md:col-span-3">
                  <Label>Cidade</Label>
                  <Input value={obraCidade} onChange={(e) => setObraCidade(e.target.value)} />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input maxLength={2} value={obraEstado} onChange={(e) => setObraEstado(e.target.value.toUpperCase())} />
                </div>
                <div className="md:col-span-2">
                  <Label>CEP</Label>
                  <Input value={obraCep} onChange={(e) => setObraCep(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Ambiente</Label>
                  <Input value={obraAmbiente} onChange={(e) => setObraAmbiente(e.target.value)} placeholder="Ex: Cozinha, Sala" />
                </div>
                <div className="md:col-span-2">
                  <Label>Pavimento</Label>
                  <Input value={obraPavimento} onChange={(e) => setObraPavimento(e.target.value)} placeholder="Ex: Térreo, 3º andar" />
                </div>
                <div className="md:col-span-2">
                  <Label>Ponto de referência</Label>
                  <Input value={obraReferencia} onChange={(e) => setObraReferencia(e.target.value)} />
                </div>
              </div>
            </section>

            {/* ============ ITENS ============ */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionTitle>Itens da esquadria</SectionTitle>
                <Button type="button" size="sm" variant="outline" onClick={() => setItens((p) => [...p, blankItem()])}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar item
                </Button>
              </div>
              <div className="space-y-3">
                {itens.length === 0 && (
                  <p className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                    Nenhum item. Clique em "Adicionar item".
                  </p>
                )}
                {itens.map((it, idx) => (
                  <div key={idx} className="rounded-md border p-3 bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Item {idx + 1}</span>
                      <Button
                        type="button" variant="ghost" size="icon"
                        onClick={() => setItens((p) => p.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 md:col-span-6">
                        <Label className="text-xs">Descrição</Label>
                        <Input
                          value={it.descricao ?? ""}
                          onChange={(e) => updateItem(idx, { descricao: e.target.value })}
                          placeholder="Ex: Janela de correr 2 folhas"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <Label className="text-xs">Larg. (mm)</Label>
                        <Input type="number" value={it.largura_mm ?? ""}
                          onChange={(e) => updateItem(idx, { largura_mm: e.target.value ? Number(e.target.value) : null })} />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <Label className="text-xs">Alt. (mm)</Label>
                        <Input type="number" value={it.altura_mm ?? ""}
                          onChange={(e) => updateItem(idx, { altura_mm: e.target.value ? Number(e.target.value) : null })} />
                      </div>
                      <div className="col-span-12 md:col-span-2">
                        <Label className="text-xs">Qtd.</Label>
                        <Input type="number" min={1} value={it.quantidade ?? 1}
                          onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) })} />
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 md:col-span-6">
                        <Label className="text-xs">Perfil</Label>
                        <Select value={it.perfil_id ?? "none"}
                          onValueChange={(v) => updateItem(idx, { perfil_id: v === "none" ? null : v })}>
                          <SelectTrigger><SelectValue placeholder="Sem perfil" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem perfil</SelectItem>
                            {(perfis ?? []).map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.descricao}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-6 md:col-span-3">
                        <Label className="text-xs">Cor do perfil</Label>
                        <Input value={it.cor_perfil ?? ""} onChange={(e) => updateItem(idx, { cor_perfil: e.target.value })} placeholder="Ex: Preto" />
                      </div>
                      <div className="col-span-6 md:col-span-3">
                        <Label className="text-xs">Acabamento</Label>
                        <Input value={it.acabamento_perfil ?? ""} onChange={(e) => updateItem(idx, { acabamento_perfil: e.target.value })} placeholder="Ex: Anodizado" />
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 md:col-span-6">
                        <Label className="text-xs">Vidro</Label>
                        <Select value={it.vidro_id ?? "none"}
                          onValueChange={(v) => updateItem(idx, { vidro_id: v === "none" ? null : v })}>
                          <SelectTrigger><SelectValue placeholder="Sem vidro" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem vidro</SelectItem>
                            {(vidros ?? []).map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.codigo} — {v.descricao}{v.cor ? ` (${v.cor})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <Label className="text-xs">Perfil (R$)</Label>
                        <Input type="number" step="0.01" value={it.valor_perfil ?? 0}
                          onChange={(e) => updateItem(idx, { valor_perfil: Number(e.target.value) })} />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <Label className="text-xs">Vidro (R$)</Label>
                        <Input type="number" step="0.01" value={it.valor_vidro ?? 0}
                          onChange={(e) => updateItem(idx, { valor_vidro: Number(e.target.value) })} />
                      </div>
                      <div className="col-span-12 md:col-span-2 text-right">
                        <Label className="text-xs">Subtotal</Label>
                        <p className="font-semibold text-sm h-9 flex items-center justify-end">
                          {brl(Number(it.subtotal ?? 0))}
                        </p>
                      </div>
                    </div>

                    {/* Acessórios */}
                    <div className="rounded-md border bg-background p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Acessórios do item</Label>
                        <div className="w-64">
                          <Select value="" onValueChange={(v) => v && addAcessorio(idx, v)}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="+ adicionar acessório" /></SelectTrigger>
                            <SelectContent>
                              {(acessorios ?? []).map((a) => (
                                <SelectItem key={a.id} value={a.id}>{a.codigo} — {a.descricao}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {(it.acessorios ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum acessório adicionado.</p>
                      ) : (
                        <div className="space-y-1">
                          {(it.acessorios ?? []).map((a) => (
                            <div key={a.acessorio_id} className="grid grid-cols-12 gap-2 items-center text-sm">
                              <div className="col-span-6 truncate">
                                <span className="font-mono text-xs text-muted-foreground">{a.codigo}</span>{" "}
                                {a.descricao}
                              </div>
                              <div className="col-span-2">
                                <Input type="number" min={1} className="h-8" value={a.quantidade}
                                  onChange={(e) => updateAcessorio(idx, a.acessorio_id, { quantidade: Number(e.target.value) })} />
                              </div>
                              <div className="col-span-3">
                                <Input type="number" step="0.01" className="h-8" value={a.preco_unitario}
                                  onChange={(e) => updateAcessorio(idx, a.acessorio_id, { preco_unitario: Number(e.target.value) })} />
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <Button type="button" size="icon" variant="ghost"
                                  onClick={() => removeAcessorio(idx, a.acessorio_id)}>
                                  <X className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-end text-xs text-muted-foreground pt-1">
                            Acessórios: <span className="font-semibold ml-2">{brl(Number(it.valor_acessorios ?? 0))}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ============ COMERCIAL ============ */}
            <section className="space-y-3">
              <SectionTitle>Informações comerciais</SectionTitle>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Label>Vendedor</Label>
                  <Select value={vendedorId || "none"} onValueChange={(v) => setVendedorId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Sem vendedor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem vendedor</SelectItem>
                      {(vendedores ?? []).map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.nome} ({Number(v.percentual_comissao ?? 0).toFixed(1)}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Comissão (%)</Label>
                  <Input type="number" step="0.1" value={percentualComissao} onChange={(e) => setPercentualComissao(e.target.value)} />
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

                <div>
                  <Label>Margem (%)</Label>
                  <Input type="number" step="0.1" value={margemPct} onChange={(e) => setMargemPct(e.target.value)} />
                </div>
                <div>
                  <Label>Impostos (%)</Label>
                  <Input type="number" step="0.1" value={impostoPct} onChange={(e) => setImpostoPct(e.target.value)} />
                </div>
                <div>
                  <Label>Validade (dias)</Label>
                  <Input type="number" min={1} value={validadeDias} onChange={(e) => setValidadeDias(e.target.value)} />
                </div>
                <div>
                  <Label>Prazo de entrega (dias)</Label>
                  <Input type="number" min={0} value={prazoEntregaDias} onChange={(e) => setPrazoEntregaDias(e.target.value)} />
                </div>

                <div className="md:col-span-4">
                  <Label>Forma de pagamento</Label>
                  <Select value={formaPagamento || "none"} onValueChange={(v) => setFormaPagamento(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não definida</SelectItem>
                      <SelectItem value="a_vista">À vista</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="30_60_90">30/60/90 dias</SelectItem>
                      <SelectItem value="entrada_parcelas">Entrada + parcelas</SelectItem>
                      <SelectItem value="financiamento">Financiamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* ============ RESUMO ============ */}
            <section className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea id="observacoes" rows={4} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-1.5">
                <ResumoLinha label="Subtotal" value={brl(subtotal)} />
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Desconto (R$)</span>
                  <Input type="number" step="0.01" className="w-32 h-8" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
                </div>
                <ResumoLinha label="Base" value={brl(base)} muted />
                <ResumoLinha label={`Impostos (${Number(impostoPct) || 0}%)`} value={brl(impostoNum)} muted />
                <div className="border-t pt-2 mt-1 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold text-primary">{brl(total)}</span>
                </div>
                <div className="border-t pt-2 mt-1 space-y-1">
                  <ResumoLinha
                    label={`Comissão (${Number(percentualComissao) || 0}%)`}
                    value={brl(comissaoNum)}
                    accent="text-chart-3"
                  />
                  <ResumoLinha
                    label={`Margem estimada (${Number(margemPct) || 0}%)`}
                    value={brl(margemValor)}
                    accent="text-chart-2"
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {orcamentoId ? "Salvar alterações" : "Criar orçamento"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <NovoClienteDialog
        open={novoClienteOpen}
        onOpenChange={setNovoClienteOpen}
        onCreated={(c) => {
          qc.invalidateQueries({ queryKey: ["clientes-lookup-enriched"] });
          setClienteId(c.id);
        }}
      />
    </Dialog>
  );
}

/* =========================================================================
   Helpers de UI
   ========================================================================= */
function blankItem(): Partial<Item> {
  return {
    descricao: "", quantidade: 1, largura_mm: null, altura_mm: null,
    perfil_id: null, vidro_id: null, cor_perfil: null, acabamento_perfil: null,
    valor_perfil: 0, valor_vidro: 0, valor_acessorios: 0,
    acessorios: [], preco_unitario: 0, subtotal: 0,
  };
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">
      {children}
    </h3>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value || "—"}</p>
    </div>
  );
}

function ResumoLinha({
  label, value, muted, accent,
}: { label: string; value: string; muted?: boolean; accent?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={`font-medium ${accent ?? ""}`}>{value}</span>
    </div>
  );
}
