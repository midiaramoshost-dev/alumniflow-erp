import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Undo2,
  CheckCircle2,
  Circle,
  CircleDot,
  XCircle,
  Paperclip,
  MessageSquare,
  Hand,
  Loader2,
  Download,
  Trash2,
  Upload,
  User as UserIcon,
  Clock,
  Plus,
  Save,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos/$pedidoId")({
  component: PedidoDetalhePage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 space-y-3">
      <p className="text-sm text-destructive">Erro: {error.message}</p>
      <Button size="sm" variant="outline" onClick={reset}>
        Tentar de novo
      </Button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Pedido não encontrado.</div>
  ),
});

type Etapa =
  | "venda"
  | "avaliacao_tecnica"
  | "orcamento"
  | "corte"
  | "usinagem"
  | "montagem"
  | "vidracaria"
  | "acabamento"
  | "entrega"
  | "concluido"
  | "cancelado";

const FLOW: { key: Etapa; label: string; role: string; color: string }[] = [
  { key: "venda", label: "Venda", role: "Vendedor", color: "bg-blue-500" },
  { key: "avaliacao_tecnica", label: "Avaliação técnica", role: "Produção", color: "bg-indigo-500" },
  { key: "orcamento", label: "Orçamento", role: "Vendedor", color: "bg-purple-500" },
  { key: "corte", label: "Corte", role: "Produção", color: "bg-orange-500" },
  { key: "usinagem", label: "Usinagem", role: "Produção", color: "bg-amber-500" },
  { key: "montagem", label: "Montagem", role: "Produção", color: "bg-yellow-500" },
  { key: "vidracaria", label: "Vidraçaria", role: "Produção", color: "bg-cyan-500" },
  { key: "acabamento", label: "Acabamento", role: "Produção", color: "bg-teal-500" },
  { key: "entrega", label: "Entrega", role: "Produção", color: "bg-emerald-500" },
];

const CHECKLIST_PADRAO: Record<Etapa, string[]> = {
  venda: ["Cliente confirmou pedido", "Documentos coletados", "Sinal recebido"],
  avaliacao_tecnica: ["Medição em obra realizada", "Projeto técnico validado", "Materiais definidos"],
  orcamento: ["Orçamento revisado", "Preços conferidos", "Aprovado pelo cliente"],
  corte: ["Perfis separados", "Corte concluído", "Peças identificadas"],
  usinagem: ["Furações realizadas", "Ajustes finais", "Peças conferidas"],
  montagem: ["Estrutura montada", "Ferragens instaladas", "Vedações aplicadas"],
  vidracaria: ["Vidros conferidos", "Instalados na esquadria", "Selagem realizada"],
  acabamento: ["Limpeza final", "Vedações", "Inspeção visual"],
  entrega: ["Transporte agendado", "Cliente notificado", "Entrega/instalação concluída"],
  concluido: [],
  cancelado: [],
};

const etapaLabel = (e: Etapa | null | undefined) =>
  FLOW.find((x) => x.key === e)?.label ??
  (e === "concluido" ? "Concluído" : e === "cancelado" ? "Cancelado" : String(e ?? ""));

type Pedido = {
  id: string;
  numero: number;
  titulo: string;
  descricao: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  etapa: Etapa;
  prioridade: string;
  valor_estimado: number | null;
  responsavel_atual_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  prazo_entrega: string | null;
  forma_entrega: string | null;
  transportadora: string | null;
  endereco_entrega: { endereco?: string } | null;
  observacoes_internas: string | null;
  forma_pagamento: string | null;
  condicoes_pagamento: string | null;
  parcelas: number;
  subtotal: number;
  desconto: number;
  impostos: number;
  valor_total: number;
  sinal_entrada: number;
  saldo: number;
  status_pagamento: string;
  prazos_por_etapa: Record<string, string> | null;
};

type Historico = {
  id: string;
  pedido_id: string;
  acao: string;
  etapa_de: Etapa | null;
  etapa_para: Etapa | null;
  observacao: string | null;
  motivo: string | null;
  de_user_id: string | null;
  para_user_id: string | null;
  created_at: string;
};

type Anexo = {
  id: string;
  pedido_id: string;
  etapa: Etapa;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

type PedidoItem = {
  id: string;
  pedido_id: string;
  ordem: number;
  tipo: string;
  descricao: string;
  perfil_id: string | null;
  vidro_id: string | null;
  acessorio_id: string | null;
  cor: string | null;
  acabamento: string | null;
  largura_mm: number | null;
  altura_mm: number | null;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  observacoes: string | null;
};

type ChecklistItem = {
  id: string;
  pedido_id: string;
  etapa: Etapa;
  ordem: number;
  item: string;
  concluido: boolean;
  concluido_em: string | null;
  concluido_por: string | null;
  observacao: string | null;
};

type FinanceiroLanc = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  status: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: any) => any; storage: any };

const brl = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function diasParaPrazo(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  return Math.round((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function PedidoDetalhePage() {
  const { pedidoId } = Route.useParams();
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [observacao, setObservacao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [comentario, setComentario] = useState("");

  const { data: pedido, isLoading } = useQuery({
    queryKey: ["pedidos", pedidoId],
    queryFn: async () => {
      const { data, error } = await db.from("pedidos").select("*").eq("id", pedidoId).maybeSingle();
      if (error) throw error;
      return data as Pedido | null;
    },
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["pedidos", pedidoId, "historico"],
    queryFn: async () => {
      const { data } = await db.from("pedido_historico").select("*")
        .eq("pedido_id", pedidoId).order("created_at", { ascending: true });
      return (data ?? []) as Historico[];
    },
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ["pedidos", pedidoId, "anexos"],
    queryFn: async () => {
      const { data } = await db.from("pedido_anexos").select("*")
        .eq("pedido_id", pedidoId).order("created_at", { ascending: true });
      return (data ?? []) as Anexo[];
    },
  });

  const { data: itens = [], refetch: refetchItens } = useQuery({
    queryKey: ["pedidos", pedidoId, "itens"],
    queryFn: async () => {
      const { data } = await db.from("pedido_itens").select("*")
        .eq("pedido_id", pedidoId).order("ordem", { ascending: true });
      return (data ?? []) as PedidoItem[];
    },
  });

  const { data: checklist = [], refetch: refetchChecklist } = useQuery({
    queryKey: ["pedidos", pedidoId, "checklist"],
    queryFn: async () => {
      const { data } = await db.from("pedido_checklist").select("*")
        .eq("pedido_id", pedidoId).order("etapa").order("ordem");
      return (data ?? []) as ChecklistItem[];
    },
  });

  const { data: financeiro = [] } = useQuery({
    queryKey: ["pedidos", pedidoId, "financeiro"],
    queryFn: async () => {
      const { data } = await db.from("financeiro_lancamentos").select("*")
        .eq("pedido_id", pedidoId).order("data_vencimento", { ascending: true });
      return (data ?? []) as FinanceiroLanc[];
    },
  });

  const userIds = useMemo(() => {
    const s = new Set<string>();
    historico.forEach((h) => { if (h.de_user_id) s.add(h.de_user_id); if (h.para_user_id) s.add(h.para_user_id); });
    anexos.forEach((a) => { if (a.uploaded_by) s.add(a.uploaded_by); });
    if (pedido?.responsavel_atual_id) s.add(pedido.responsavel_atual_id);
    if (pedido?.created_by) s.add(pedido.created_by);
    return Array.from(s);
  }, [historico, anexos, pedido]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-lookup", userIds.sort().join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await db.from("profiles").select("id, full_name, email").in("id", userIds);
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });
  const nameOf = (id: string | null) => {
    if (!id) return "—";
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || id.slice(0, 8);
  };

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["pedidos"] });
  };

  const call = async (fn: string, args: Record<string, unknown>, ok: string) => {
    const { error } = await db.rpc(fn, args);
    if (error) return toast.error(error.message);
    toast.success(ok);
    invalidar();
    setObservacao(""); setMotivo(""); setComentario("");
  };

  const podeAgir = !!pedido && (
    hasRole("admin") ||
    (pedido.etapa === "venda" && hasRole("vendedor")) ||
    (pedido.etapa === "orcamento" && hasRole("vendedor")) ||
    (["avaliacao_tecnica","corte","usinagem","montagem","vidracaria","acabamento","entrega"].includes(pedido.etapa) && hasRole("producao"))
  );

  const isFinal = pedido && (pedido.etapa === "concluido" || pedido.etapa === "cancelado");
  const currentIdx = pedido ? FLOW.findIndex((s) => s.key === pedido.etapa) : -1;
  const dias = diasParaPrazo(pedido?.prazo_entrega ?? null);
  const atrasado = !!pedido && dias != null && dias < 0 && !isFinal;

  const eventosPorEtapa = useMemo(() => {
    const m = new Map<Etapa, Historico[]>();
    FLOW.forEach((s) => m.set(s.key, []));
    historico.forEach((h) => {
      const key = (h.etapa_de ?? h.etapa_para) as Etapa | null;
      if (key && m.has(key)) m.get(key)!.push(h);
    });
    return m;
  }, [historico]);

  const anexosPorEtapa = useMemo(() => {
    const m = new Map<Etapa, Anexo[]>();
    FLOW.forEach((s) => m.set(s.key, []));
    anexos.forEach((a) => { if (m.has(a.etapa)) m.get(a.etapa)!.push(a); });
    return m;
  }, [anexos]);

  const conclusaoDe = (etapa: Etapa) => historico.find((h) => h.acao === "concluir" && h.etapa_de === etapa) ?? null;

  const uploadAnexo = async (file: File, etapa: Etapa) => {
    if (!pedido || !user) return;
    const path = `${pedido.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await db.storage.from("pedido-anexos").upload(path, file, { upsert: false });
    if (upErr) return toast.error(upErr.message);
    const { error: insErr } = await db.from("pedido_anexos").insert({
      pedido_id: pedido.id, etapa, storage_path: path, filename: file.name,
      mime_type: file.type, size_bytes: file.size, uploaded_by: user.id,
    });
    if (insErr) return toast.error(insErr.message);
    toast.success("Anexo enviado");
    invalidar();
  };

  const baixarAnexo = async (a: Anexo) => {
    const { data, error } = await db.storage.from("pedido-anexos").createSignedUrl(a.storage_path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const excluirAnexo = async (a: Anexo) => {
    await db.storage.from("pedido-anexos").remove([a.storage_path]);
    const { error } = await db.from("pedido_anexos").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Anexo removido");
    invalidar();
  };

  if (isLoading) {
    return (
      <PageShell title="Pedido" description="Carregando…">
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando pedido…
        </div>
      </PageShell>
    );
  }

  if (!pedido) {
    return (
      <PageShell title="Pedido" description="Não encontrado">
        <div className="p-6 text-sm text-muted-foreground">
          Pedido não encontrado.{" "}
          <Link to="/pedidos" className="underline">Voltar para a lista</Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`Pedido #${pedido.numero}`}
      description={pedido.titulo}
      actions={
        <Button size="sm" variant="outline" onClick={() => navigate({ to: "/pedidos" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      }
    >
      <div className="p-4 md:p-6 space-y-6">
        {/* Cabeçalho + KPIs */}
        <Card>
          <CardContent className="p-4 md:p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="text-xs">{etapaLabel(pedido.etapa)}</Badge>
              <Badge variant={pedido.prioridade === "urgente" ? "destructive" : "outline"} className="text-xs capitalize">
                {pedido.prioridade}
              </Badge>
              <Badge
                variant={pedido.status_pagamento === "pago" ? "default" : pedido.status_pagamento === "parcial" ? "secondary" : "outline"}
                className="text-xs capitalize"
              >
                Pagamento: {pedido.status_pagamento}
              </Badge>
              {atrasado && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Atrasado {Math.abs(dias!)}d
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                <Clock className="h-3 w-3" /> Criado em {fmtDate(pedido.created_at)} por {nameOf(pedido.created_by)}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-medium">{pedido.cliente_nome ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Responsável atual</p>
                <p className="font-medium flex items-center gap-1">
                  <UserIcon className="h-3.5 w-3.5" />
                  {pedido.responsavel_atual_id ? nameOf(pedido.responsavel_atual_id) : "Aguardando aceite"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Prazo de entrega</p>
                <p className={`font-medium ${atrasado ? "text-destructive" : ""}`}>
                  {pedido.prazo_entrega
                    ? `${new Date(pedido.prazo_entrega + "T00:00:00").toLocaleDateString("pt-BR")}${dias != null ? ` (${dias >= 0 ? `em ${dias}d` : `há ${Math.abs(dias)}d`})` : ""}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor total</p>
                <p className="font-semibold text-lg">{brl(pedido.valor_total)}</p>
                <p className="text-[11px] text-muted-foreground">
                  Sinal {brl(pedido.sinal_entrada)} · Saldo {brl(pedido.saldo)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isFinal && (
          <Card className={pedido.etapa === "cancelado" ? "border-destructive/50" : "border-emerald-500/50"}>
            <CardContent className="p-4 flex items-center gap-2">
              {pedido.etapa === "cancelado" ? (
                <><XCircle className="h-5 w-5 text-destructive" /><span className="font-medium">Pedido cancelado</span></>
              ) : (
                <><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span className="font-medium">Pedido concluído</span></>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="resumo">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="itens">Itens ({itens.length})</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="entrega">Entrega & pagamento</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="fluxo">Fluxo</TabsTrigger>
          </TabsList>

          {/* Resumo */}
          <TabsContent value="resumo" className="mt-4 space-y-4">
            {pedido.descricao && (
              <Card><CardContent className="p-4 text-sm whitespace-pre-wrap">{pedido.descricao}</CardContent></Card>
            )}
            {pedido.observacoes_internas && (
              <Card className="border-amber-500/40">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Observações internas</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0 text-sm whitespace-pre-wrap">{pedido.observacoes_internas}</CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Itens */}
          <TabsContent value="itens" className="mt-4">
            <ItensEditor
              pedidoId={pedido.id}
              itens={itens}
              readonly={!!isFinal}
              onChange={() => { refetchItens(); invalidar(); }}
            />
          </TabsContent>

          {/* Financeiro */}
          <TabsContent value="financeiro" className="mt-4">
            <FinanceiroEditor
              pedido={pedido}
              lancamentos={financeiro}
              readonly={!!isFinal}
              onChange={invalidar}
            />
          </TabsContent>

          {/* Entrega */}
          <TabsContent value="entrega" className="mt-4">
            <EntregaEditor pedido={pedido} readonly={!!isFinal} onChange={invalidar} />
          </TabsContent>

          {/* Checklist */}
          <TabsContent value="checklist" className="mt-4">
            <ChecklistEditor
              pedidoId={pedido.id}
              checklist={checklist}
              etapaAtual={pedido.etapa}
              readonly={!!isFinal}
              onChange={() => { refetchChecklist(); }}
            />
          </TabsContent>

          {/* Fluxo (timeline existente) */}
          <TabsContent value="fluxo" className="mt-4">
            <div>
              <ol className="relative border-l-2 border-border ml-2 space-y-6">
                {FLOW.map((step, idx) => {
                  const status: "concluida" | "atual" | "pendente" =
                    isFinal
                      ? (currentIdx === -1 || idx <= (currentIdx === -1 ? FLOW.length : currentIdx)) ? "concluida" : "pendente"
                      : idx < currentIdx ? "concluida"
                      : idx === currentIdx ? "atual"
                      : "pendente";
                  const eventos = eventosPorEtapa.get(step.key) ?? [];
                  const anexosStep = anexosPorEtapa.get(step.key) ?? [];
                  const concl = conclusaoDe(step.key);
                  const prazoEtapa = pedido.prazos_por_etapa?.[step.key];
                  const diasEtapa = diasParaPrazo(prazoEtapa ?? null);
                  const etapaAtrasada = status === "atual" && diasEtapa != null && diasEtapa < 0;

                  return (
                    <li key={step.key} className="pl-6 relative">
                      <span className={`absolute -left-[13px] top-0 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${
                        status === "concluida" ? "bg-emerald-500 text-white"
                        : status === "atual" ? `${step.color} text-white`
                        : "bg-muted text-muted-foreground"
                      }`}>
                        {status === "concluida" ? <CheckCircle2 className="h-3.5 w-3.5" />
                          : status === "atual" ? <CircleDot className="h-3.5 w-3.5" />
                          : <Circle className="h-3.5 w-3.5" />}
                      </span>

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <p className="font-medium">{step.label}</p>
                          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{step.role}</span>
                          {status === "atual" && <Badge variant="default" className="text-[10px]">Etapa atual</Badge>}
                          {etapaAtrasada && (
                            <Badge variant="destructive" className="text-[10px]">
                              <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Atrasada
                            </Badge>
                          )}
                          {prazoEtapa && (
                            <span className="text-xs text-muted-foreground">
                              Prazo: {new Date(prazoEtapa + "T00:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          )}
                          {status === "concluida" && concl && (
                            <span className="text-xs text-muted-foreground">
                              Concluída em {fmtDate(concl.created_at)} por {nameOf(concl.de_user_id)}
                            </span>
                          )}
                        </div>

                        {eventos.length > 0 && (
                          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                            {eventos.map((h) => (
                              <div key={h.id} className="text-xs">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge
                                    variant={h.acao === "devolver" ? "destructive" : h.acao === "concluir" ? "default" : "secondary"}
                                    className="text-[10px] capitalize"
                                  >
                                    {h.acao}
                                  </Badge>
                                  <span className="text-muted-foreground">{nameOf(h.de_user_id)}</span>
                                  {h.etapa_de && h.etapa_para && h.etapa_de !== h.etapa_para && (
                                    <span className="text-muted-foreground">
                                      {etapaLabel(h.etapa_de)} → {etapaLabel(h.etapa_para)}
                                    </span>
                                  )}
                                  <span className="text-muted-foreground ml-auto">{fmtDate(h.created_at)}</span>
                                </div>
                                {h.observacao && <p className="mt-1 pl-1">{h.observacao}</p>}
                                {h.motivo && <p className="mt-1 pl-1 text-destructive">Motivo: {h.motivo}</p>}
                              </div>
                            ))}
                          </div>
                        )}

                        {anexosStep.length > 0 && (
                          <div className="space-y-1">
                            {anexosStep.map((a) => (
                              <div key={a.id} className="flex items-center gap-2 text-sm border rounded px-2 py-1">
                                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="flex-1 truncate">{a.filename}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {nameOf(a.uploaded_by)} · {fmtDate(a.created_at)}
                                </span>
                                <Button size="icon" variant="ghost" onClick={() => baixarAnexo(a)}>
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                                {(hasRole("admin") || a.uploaded_by === user?.id) && (
                                  <Button size="icon" variant="ghost" onClick={() => excluirAnexo(a)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {status === "atual" && !isFinal && (
                          <div className="rounded-md border p-3 space-y-3 bg-card">
                            {podeAgir ? (
                              <>
                                <p className="text-xs font-medium">Ações desta etapa</p>
                                {!pedido.responsavel_atual_id && (
                                  <Button
                                    size="sm" variant="secondary"
                                    onClick={() => call("pedido_aceitar", { _pedido_id: pedido.id }, "Etapa aceita")}
                                  >
                                    <Hand className="h-4 w-4 mr-1" /> Aceitar responsabilidade
                                  </Button>
                                )}
                                <Textarea
                                  placeholder="Observação (opcional) ao concluir e avançar"
                                  value={observacao}
                                  onChange={(e) => setObservacao(e.target.value)}
                                  rows={2}
                                />
                                <div className="flex flex-wrap gap-2">
                                  <Button size="sm" onClick={() => call("pedido_avancar", { _pedido_id: pedido.id, _observacao: observacao || null }, "Etapa concluída")}>
                                    <ArrowRight className="h-4 w-4 mr-1" /> Concluir e avançar
                                  </Button>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                  <Label className="text-xs">Comentar sem mudar etapa</Label>
                                  <div className="flex gap-2">
                                    <Input placeholder="Comentário rápido" value={comentario} onChange={(e) => setComentario(e.target.value)} />
                                    <Button size="sm" variant="outline" onClick={() => {
                                      if (!comentario.trim()) return toast.error("Escreva um comentário");
                                      call("pedido_comentar", { _pedido_id: pedido.id, _observacao: comentario }, "Comentário registrado");
                                    }}>
                                      <MessageSquare className="h-4 w-4 mr-1" /> Comentar
                                    </Button>
                                  </div>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                  <Label className="text-xs text-destructive">Devolver ou cancelar (motivo obrigatório)</Label>
                                  <Input placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" disabled={idx === 0}
                                      onClick={() => {
                                        if (!motivo.trim()) return toast.error("Informe o motivo");
                                        call("pedido_devolver", { _pedido_id: pedido.id, _motivo: motivo }, "Pedido devolvido");
                                      }}>
                                      <Undo2 className="h-4 w-4 mr-1" /> Devolver etapa
                                    </Button>
                                    <Button size="sm" variant="destructive"
                                      onClick={() => {
                                        if (!motivo.trim()) return toast.error("Informe o motivo");
                                        call("pedido_cancelar", { _pedido_id: pedido.id, _motivo: motivo }, "Pedido cancelado");
                                      }}>
                                      <XCircle className="h-4 w-4 mr-1" /> Cancelar pedido
                                    </Button>
                                  </div>
                                </div>
                                <Separator />
                                <div>
                                  <Label className="text-xs flex items-center gap-1"><Upload className="h-3 w-3" /> Anexar arquivo a esta etapa</Label>
                                  <Input type="file" onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) uploadAnexo(f, step.key);
                                    e.target.value = "";
                                  }} />
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Você não tem permissão para agir nesta etapa ({step.label}).
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}

/* ============ Itens Editor ============ */

function ItensEditor({
  pedidoId, itens, readonly, onChange,
}: {
  pedidoId: string;
  itens: PedidoItem[];
  readonly: boolean;
  onChange: () => void;
}) {
  const [novo, setNovo] = useState({
    tipo: "produto",
    descricao: "",
    largura_mm: "",
    altura_mm: "",
    quantidade: "1",
    preco_unitario: "0",
    cor: "",
    acabamento: "",
    observacoes: "",
  });

  const total = itens.reduce((s, i) => s + Number(i.subtotal || 0), 0);

  const addItem = async () => {
    if (!novo.descricao.trim()) return toast.error("Informe a descrição");
    const qtd = Number(novo.quantidade || 1);
    const pu = Number(novo.preco_unitario || 0);
    const { error } = await db.from("pedido_itens").insert({
      pedido_id: pedidoId,
      ordem: itens.length + 1,
      tipo: novo.tipo,
      descricao: novo.descricao.trim(),
      largura_mm: novo.largura_mm ? Number(novo.largura_mm) : null,
      altura_mm: novo.altura_mm ? Number(novo.altura_mm) : null,
      quantidade: qtd,
      preco_unitario: pu,
      subtotal: qtd * pu,
      cor: novo.cor.trim() || null,
      acabamento: novo.acabamento.trim() || null,
      observacoes: novo.observacoes.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Item adicionado");
    setNovo({ tipo: "produto", descricao: "", largura_mm: "", altura_mm: "", quantidade: "1", preco_unitario: "0", cor: "", acabamento: "", observacoes: "" });
    onChange();
  };

  const removerItem = async (id: string) => {
    const { error } = await db.from("pedido_itens").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-left p-2">Tipo</th>
                  <th className="text-left p-2">Descrição</th>
                  <th className="text-center p-2">Dimensões</th>
                  <th className="text-right p-2">Qtd</th>
                  <th className="text-right p-2">Preço unit.</th>
                  <th className="text-right p-2">Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum item cadastrado</td></tr>
                )}
                {itens.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="p-2 capitalize">{it.tipo}</td>
                    <td className="p-2">
                      <div className="font-medium">{it.descricao}</div>
                      <div className="text-xs text-muted-foreground">
                        {[it.cor, it.acabamento].filter(Boolean).join(" · ")}
                        {it.observacoes ? ` — ${it.observacoes}` : ""}
                      </div>
                    </td>
                    <td className="p-2 text-center text-xs">
                      {it.largura_mm && it.altura_mm ? `${it.largura_mm} × ${it.altura_mm} mm` : "—"}
                    </td>
                    <td className="p-2 text-right">{Number(it.quantidade)}</td>
                    <td className="p-2 text-right">{brl(it.preco_unitario)}</td>
                    <td className="p-2 text-right font-medium">{brl(it.subtotal)}</td>
                    <td className="p-2">
                      {!readonly && (
                        <Button size="icon" variant="ghost" onClick={() => removerItem(it.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-semibold">
                <tr>
                  <td colSpan={5} className="p-2 text-right">Total dos itens</td>
                  <td className="p-2 text-right">{brl(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {!readonly && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Adicionar item</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={novo.tipo} onValueChange={(v) => setNovo({ ...novo, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="produto">Produto</SelectItem>
                    <SelectItem value="servico">Serviço</SelectItem>
                    <SelectItem value="perfil">Perfil</SelectItem>
                    <SelectItem value="vidro">Vidro</SelectItem>
                    <SelectItem value="acessorio">Acessório</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Label>Descrição *</Label>
                <Input value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <Label>Largura (mm)</Label>
                <Input type="number" value={novo.largura_mm} onChange={(e) => setNovo({ ...novo, largura_mm: e.target.value })} />
              </div>
              <div>
                <Label>Altura (mm)</Label>
                <Input type="number" value={novo.altura_mm} onChange={(e) => setNovo({ ...novo, altura_mm: e.target.value })} />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input type="number" step="0.01" value={novo.quantidade} onChange={(e) => setNovo({ ...novo, quantidade: e.target.value })} />
              </div>
              <div>
                <Label>Preço unit. (R$)</Label>
                <Input type="number" step="0.01" value={novo.preco_unitario} onChange={(e) => setNovo({ ...novo, preco_unitario: e.target.value })} />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Cor</Label>
                <Input value={novo.cor} onChange={(e) => setNovo({ ...novo, cor: e.target.value })} />
              </div>
              <div>
                <Label>Acabamento</Label>
                <Input value={novo.acabamento} onChange={(e) => setNovo({ ...novo, acabamento: e.target.value })} />
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={novo.observacoes} onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ============ Financeiro Editor ============ */

function FinanceiroEditor({
  pedido, lancamentos, readonly, onChange,
}: {
  pedido: Pedido;
  lancamentos: FinanceiroLanc[];
  readonly: boolean;
  onChange: () => void;
}) {
  const [desconto, setDesconto] = useState(String(pedido.desconto ?? 0));
  const [impostos, setImpostos] = useState(String(pedido.impostos ?? 0));
  const [sinal, setSinal] = useState(String(pedido.sinal_entrada ?? 0));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await db.from("pedidos").update({
      desconto: Number(desconto || 0),
      impostos: Number(impostos || 0),
      sinal_entrada: Number(sinal || 0),
    }).eq("id", pedido.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Valores atualizados");
    onChange();
  };

  const total = pedido.valor_total;
  const saldo = pedido.saldo;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Subtotal dos itens</p><p className="text-lg font-semibold">{brl(pedido.subtotal)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Desconto</p><p className="text-lg font-semibold text-destructive">− {brl(pedido.desconto)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Impostos</p><p className="text-lg font-semibold">+ {brl(pedido.impostos)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold text-primary">{brl(total)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Saldo</p><p className="text-lg font-bold">{brl(saldo)}</p><p className="text-[10px] capitalize text-muted-foreground">{pedido.status_pagamento}</p></CardContent></Card>
      </div>

      {!readonly && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Ajustes financeiros</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Desconto (R$)</Label>
                <Input type="number" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
              </div>
              <div>
                <Label>Impostos (R$)</Label>
                <Input type="number" step="0.01" value={impostos} onChange={(e) => setImpostos(e.target.value)} />
              </div>
              <div>
                <Label>Sinal / entrada (R$)</Label>
                <Input type="number" step="0.01" value={sinal} onChange={(e) => setSinal(e.target.value)} />
              </div>
            </div>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Lançamentos financeiros vinculados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lancamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum lançamento vinculado. Um recebimento é gerado automaticamente quando o pedido tem valor.
            </p>
          ) : (
            <div className="space-y-2">
              {lancamentos.map((l) => (
                <div key={l.id} className="flex items-center gap-2 border rounded px-3 py-2 text-sm">
                  <Badge variant={l.tipo === "receita" ? "default" : "secondary"} className="capitalize text-[10px]">{l.tipo}</Badge>
                  <span className="flex-1 truncate">{l.descricao}</span>
                  <Badge
                    variant={l.status === "pago" ? "default" : l.status === "vencido" ? "destructive" : "outline"}
                    className="text-[10px] capitalize"
                  >
                    {l.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Venc: {l.data_vencimento ? new Date(l.data_vencimento).toLocaleDateString("pt-BR") : "—"}
                  </span>
                  <span className="font-medium">{brl(l.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ Entrega Editor ============ */

function EntregaEditor({
  pedido, readonly, onChange,
}: {
  pedido: Pedido;
  readonly: boolean;
  onChange: () => void;
}) {
  const [form, setForm] = useState({
    prazo_entrega: pedido.prazo_entrega ?? "",
    forma_entrega: pedido.forma_entrega ?? "",
    transportadora: pedido.transportadora ?? "",
    endereco_entrega: pedido.endereco_entrega?.endereco ?? "",
    forma_pagamento: pedido.forma_pagamento ?? "",
    condicoes_pagamento: pedido.condicoes_pagamento ?? "",
    parcelas: String(pedido.parcelas ?? 1),
    observacoes_internas: pedido.observacoes_internas ?? "",
    prioridade: pedido.prioridade,
  });
  const [prazosEtapa, setPrazosEtapa] = useState<Record<string, string>>(pedido.prazos_por_etapa ?? {});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await db.from("pedidos").update({
      prazo_entrega: form.prazo_entrega || null,
      forma_entrega: form.forma_entrega || null,
      transportadora: form.transportadora || null,
      endereco_entrega: form.endereco_entrega ? { endereco: form.endereco_entrega } : null,
      forma_pagamento: form.forma_pagamento || null,
      condicoes_pagamento: form.condicoes_pagamento || null,
      parcelas: Math.max(1, Number(form.parcelas || 1)),
      observacoes_internas: form.observacoes_internas || null,
      prioridade: form.prioridade,
      prazos_por_etapa: prazosEtapa,
    }).eq("id", pedido.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Pedido atualizado");
    onChange();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Entrega</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Prazo de entrega</Label>
              <Input type="date" disabled={readonly} value={form.prazo_entrega}
                onChange={(e) => setForm({ ...form, prazo_entrega: e.target.value })} />
            </div>
            <div>
              <Label>Forma de entrega</Label>
              <Select disabled={readonly} value={form.forma_entrega} onValueChange={(v) => setForm({ ...form, forma_entrega: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="retirada">Retirada na fábrica</SelectItem>
                  <SelectItem value="entrega_propria">Entrega própria</SelectItem>
                  <SelectItem value="transportadora">Transportadora</SelectItem>
                  <SelectItem value="instalacao">Entrega + instalação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select disabled={readonly} value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.forma_entrega === "transportadora" && (
            <div>
              <Label>Transportadora</Label>
              <Input disabled={readonly} value={form.transportadora}
                onChange={(e) => setForm({ ...form, transportadora: e.target.value })} />
            </div>
          )}
          <div>
            <Label>Endereço de entrega</Label>
            <Textarea disabled={readonly} rows={2} value={form.endereco_entrega}
              onChange={(e) => setForm({ ...form, endereco_entrega: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Pagamento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Forma de pagamento</Label>
              <Select disabled={readonly} value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_vista">À vista</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Parcelas</Label>
              <Input type="number" min="1" disabled={readonly} value={form.parcelas}
                onChange={(e) => setForm({ ...form, parcelas: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Condições de pagamento</Label>
            <Input disabled={readonly} value={form.condicoes_pagamento}
              placeholder="Ex.: 50% entrada + 50% na entrega"
              onChange={(e) => setForm({ ...form, condicoes_pagamento: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Prazos por etapa</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {FLOW.map((s) => (
              <div key={s.key}>
                <Label className="text-xs">{s.label}</Label>
                <Input
                  type="date"
                  disabled={readonly}
                  value={prazosEtapa[s.key] ?? ""}
                  onChange={(e) => setPrazosEtapa({ ...prazosEtapa, [s.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Observações internas</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} disabled={readonly} value={form.observacoes_internas}
            onChange={(e) => setForm({ ...form, observacoes_internas: e.target.value })} />
        </CardContent>
      </Card>

      {!readonly && (
        <div>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar alterações
          </Button>
        </div>
      )}
    </div>
  );
}

/* ============ Checklist Editor ============ */

function ChecklistEditor({
  pedidoId, checklist, etapaAtual, readonly, onChange,
}: {
  pedidoId: string;
  checklist: ChecklistItem[];
  etapaAtual: Etapa;
  readonly: boolean;
  onChange: () => void;
}) {
  const { user } = useAuth();
  const [novoItem, setNovoItem] = useState<Record<string, string>>({});

  const semear = useMutation({
    mutationFn: async () => {
      const rows: Partial<ChecklistItem>[] = [];
      for (const step of FLOW) {
        const existentes = checklist.filter((c) => c.etapa === step.key);
        if (existentes.length === 0) {
          const padroes = CHECKLIST_PADRAO[step.key] ?? [];
          padroes.forEach((it, i) => {
            rows.push({ pedido_id: pedidoId, etapa: step.key, ordem: i + 1, item: it });
          });
        }
      }
      if (rows.length === 0) return;
      const { error } = await db.from("pedido_checklist").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Checklist padrão criado"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = async (item: ChecklistItem) => {
    const { error } = await db.from("pedido_checklist").update({
      concluido: !item.concluido,
      concluido_em: !item.concluido ? new Date().toISOString() : null,
      concluido_por: !item.concluido ? user?.id : null,
    }).eq("id", item.id);
    if (error) return toast.error(error.message);
    onChange();
  };

  const adicionar = async (etapa: Etapa) => {
    const texto = (novoItem[etapa] ?? "").trim();
    if (!texto) return;
    const ord = (checklist.filter((c) => c.etapa === etapa).length + 1);
    const { error } = await db.from("pedido_checklist").insert({
      pedido_id: pedidoId, etapa, ordem: ord, item: texto,
    });
    if (error) return toast.error(error.message);
    setNovoItem({ ...novoItem, [etapa]: "" });
    onChange();
  };

  const remover = async (id: string) => {
    const { error } = await db.from("pedido_checklist").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };

  return (
    <div className="space-y-3">
      {checklist.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Nenhum item de checklist cadastrado. Você pode criar o checklist padrão para todas as etapas.
            </p>
            {!readonly && (
              <Button size="sm" onClick={() => semear.mutate()} disabled={semear.isPending}>
                {semear.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Criar checklist padrão
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {FLOW.map((step) => {
        const items = checklist.filter((c) => c.etapa === step.key);
        if (items.length === 0 && step.key !== etapaAtual) return null;
        const done = items.filter((i) => i.concluido).length;
        return (
          <Card key={step.key} className={step.key === etapaAtual ? "border-primary/50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{step.label}</span>
                <Badge variant="outline" className="text-[10px]">{done}/{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={it.concluido}
                    disabled={readonly}
                    onCheckedChange={() => toggle(it)}
                  />
                  <div className="flex-1">
                    <p className={it.concluido ? "line-through text-muted-foreground" : ""}>{it.item}</p>
                    {it.concluido && it.concluido_em && (
                      <p className="text-[10px] text-muted-foreground">Concluído em {fmtDate(it.concluido_em)}</p>
                    )}
                  </div>
                  {!readonly && (
                    <Button size="icon" variant="ghost" onClick={() => remover(it.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              {!readonly && (
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Novo item"
                    value={novoItem[step.key] ?? ""}
                    onChange={(e) => setNovoItem({ ...novoItem, [step.key]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") adicionar(step.key); }}
                  />
                  <Button size="sm" variant="outline" onClick={() => adicionar(step.key)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
