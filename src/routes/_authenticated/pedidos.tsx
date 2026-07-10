import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  ArrowRight,
  Undo2,
  CheckCircle2,
  XCircle,
  Paperclip,
  MessageSquare,
  Hand,
  Loader2,
  Download,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos")({
  component: PedidosPage,
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

const ETAPAS: { key: Etapa; label: string; color: string }[] = [
  { key: "venda", label: "Venda", color: "bg-blue-500" },
  { key: "avaliacao_tecnica", label: "Avaliação técnica", color: "bg-indigo-500" },
  { key: "orcamento", label: "Orçamento", color: "bg-purple-500" },
  { key: "corte", label: "Corte", color: "bg-orange-500" },
  { key: "usinagem", label: "Usinagem", color: "bg-amber-500" },
  { key: "montagem", label: "Montagem", color: "bg-yellow-500" },
  { key: "vidracaria", label: "Vidraçaria", color: "bg-cyan-500" },
  { key: "acabamento", label: "Acabamento", color: "bg-teal-500" },
  { key: "entrega", label: "Entrega", color: "bg-emerald-500" },
  { key: "concluido", label: "Concluído", color: "bg-green-600" },
  { key: "cancelado", label: "Cancelado", color: "bg-destructive" },
];

const etapaLabel = (e: Etapa | null | undefined) =>
  ETAPAS.find((x) => x.key === e)?.label ?? String(e ?? "");

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
  valor_total: number | null;
  saldo: number | null;
  sinal_entrada: number | null;
  status_pagamento: string | null;
  prazo_entrega: string | null;
  forma_entrega: string | null;
  responsavel_atual_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const brl = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

function diasParaPrazo(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  return Math.round((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: any) => any; storage: any };

function PedidosPage() {
  const { hasRole } = useAuth();
  const [openNew, setOpenNew] = useState(false);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos"],
    queryFn: async () => {
      const { data, error } = await db
        .from("pedidos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pedido[];
    },
  });

  const grupos = useMemo(() => {
    const map = new Map<Etapa, Pedido[]>();
    ETAPAS.forEach((e) => map.set(e.key, []));
    pedidos.forEach((p) => map.get(p.etapa)?.push(p));
    return map;
  }, [pedidos]);

  return (
    <PageShell
      title="Pedidos"
      description="Fluxo passo-a-passo do pedido, da venda à entrega"
      actions={
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!hasRole("vendedor") && !hasRole("admin")}>
              <Plus className="h-4 w-4 mr-1" /> Novo pedido
            </Button>
          </DialogTrigger>
          <NovoPedidoDialog onClose={() => setOpenNew(false)} />
        </Dialog>
      }
    >
      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando pedidos…
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {ETAPAS.map((etapa) => {
              const items = grupos.get(etapa.key) ?? [];
              return (
                <div
                  key={etapa.key}
                  className="w-72 shrink-0 rounded-lg border bg-card/50"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${etapa.color}`} />
                      <span className="text-sm font-medium">{etapa.label}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {items.length}
                    </Badge>
                  </div>
                  <div className="p-2 space-y-2 min-h-24 max-h-[70vh] overflow-y-auto">
                    {items.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Sem pedidos
                      </p>
                    )}
                    {items.map((p) => {
                      const dias = diasParaPrazo(p.prazo_entrega);
                      const atrasado =
                        dias != null && dias < 0 && !["concluido", "cancelado"].includes(p.etapa);
                      const alerta =
                        dias != null && dias >= 0 && dias <= 3 && !["concluido", "cancelado"].includes(p.etapa);
                      return (
                        <Link
                          key={p.id}
                          to="/pedidos/$pedidoId"
                          params={{ pedidoId: p.id }}
                          className="block"
                        >
                          <Card
                            className={`cursor-pointer hover:shadow-md transition ${
                              atrasado ? "border-destructive/60" : alerta ? "border-amber-500/60" : ""
                            }`}
                          >
                            <CardContent className="p-3 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">#{p.numero}</span>
                                <Badge
                                  variant={p.prioridade === "urgente" ? "destructive" : "outline"}
                                  className="text-[9px] capitalize"
                                >
                                  {p.prioridade}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium line-clamp-2">{p.titulo}</p>
                              {p.cliente_nome && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {p.cliente_nome}
                                </p>
                              )}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                {(p.valor_total ?? p.valor_estimado) != null && (
                                  <p className="text-xs font-semibold">
                                    {brl(p.valor_total ?? p.valor_estimado)}
                                  </p>
                                )}
                                {p.status_pagamento && p.status_pagamento !== "pendente" && (
                                  <Badge
                                    variant={p.status_pagamento === "pago" ? "default" : "secondary"}
                                    className="text-[9px] capitalize"
                                  >
                                    {p.status_pagamento}
                                  </Badge>
                                )}
                              </div>
                              {p.prazo_entrega && (
                                <p
                                  className={`text-[10px] flex items-center gap-1 ${
                                    atrasado
                                      ? "text-destructive font-medium"
                                      : alerta
                                        ? "text-amber-600"
                                        : "text-muted-foreground"
                                  }`}
                                >
                                  {atrasado
                                    ? `Atrasado ${Math.abs(dias!)}d`
                                    : dias === 0
                                      ? "Entrega hoje"
                                      : `Prazo em ${dias}d`}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </PageShell>
  );
}

/* ---------------- Novo pedido ---------------- */

function NovoPedidoDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNome, setClienteNome] = useState("");
  const [valor, setValor] = useState("");
  const [prioridade, setPrioridade] = useState("media");

  const { data: clientes = [] } = useQuery({
    queryKey: ["pedidos", "clientes-lookup"],
    queryFn: async () => {
      const { data } = await db.from("clientes").select("id, nome").order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Informe um título");
      const payload = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        cliente_id: clienteId || null,
        cliente_nome: clienteNome.trim() || null,
        valor_estimado: valor ? Number(valor) : null,
        prioridade,
        created_by: user?.id,
      };
      const { error } = await db.from("pedidos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success("Pedido criado");
      onClose();
      setTitulo("");
      setDescricao("");
      setClienteId("");
      setClienteNome("");
      setValor("");
      setPrioridade("media");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Novo pedido</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Título</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div>
          <Label>Cliente</Label>
          <Select
            value={clienteId}
            onValueChange={(v) => {
              setClienteId(v);
              const c = clientes.find((x) => x.id === v);
              if (c) setClienteNome(c.nome);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Valor estimado (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select value={prioridade} onValueChange={setPrioridade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Criar pedido
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ---------------- Detalhes ---------------- */

type Historico = {
  id: string;
  pedido_id: string;
  acao: string;
  etapa_de: Etapa | null;
  etapa_para: Etapa | null;
  observacao: string | null;
  motivo: string | null;
  de_user_id: string | null;
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

function PedidoDetailDialog({
  pedidoId,
  onClose,
}: {
  pedidoId: string | null;
  onClose: () => void;
}) {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const [observacao, setObservacao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [comentario, setComentario] = useState("");

  const { data: pedido } = useQuery({
    queryKey: ["pedidos", pedidoId],
    enabled: !!pedidoId,
    queryFn: async () => {
      const { data, error } = await db
        .from("pedidos")
        .select("*")
        .eq("id", pedidoId)
        .maybeSingle();
      if (error) throw error;
      return data as Pedido | null;
    },
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["pedidos", pedidoId, "historico"],
    enabled: !!pedidoId,
    queryFn: async () => {
      const { data } = await db
        .from("pedido_historico")
        .select("*")
        .eq("pedido_id", pedidoId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Historico[];
    },
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ["pedidos", pedidoId, "anexos"],
    enabled: !!pedidoId,
    queryFn: async () => {
      const { data } = await db
        .from("pedido_anexos")
        .select("*")
        .eq("pedido_id", pedidoId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Anexo[];
    },
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["pedidos"] });
    qc.invalidateQueries({ queryKey: ["pedidos", pedidoId] });
    qc.invalidateQueries({ queryKey: ["pedidos", pedidoId, "historico"] });
    qc.invalidateQueries({ queryKey: ["pedidos", pedidoId, "anexos"] });
  };

  const call = async (fn: string, args: Record<string, unknown>, ok: string) => {
    const { error } = await db.rpc(fn, args);
    if (error) return toast.error(error.message);
    toast.success(ok);
    invalidar();
    setObservacao("");
    setMotivo("");
    setComentario("");
  };

  const podeAgir =
    !!pedido &&
    (hasRole("admin") ||
      (pedido.etapa === "venda" && hasRole("vendedor")) ||
      (pedido.etapa === "orcamento" && hasRole("vendedor")) ||
      ([
        "avaliacao_tecnica",
        "corte",
        "usinagem",
        "montagem",
        "vidracaria",
        "acabamento",
        "entrega",
      ].includes(pedido.etapa) &&
        hasRole("producao")));

  const isFinal = pedido && ["concluido", "cancelado"].includes(pedido.etapa);

  const uploadAnexo = async (file: File) => {
    if (!pedido || !user) return;
    const path = `${pedido.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await db.storage
      .from("pedido-anexos")
      .upload(path, file, { upsert: false });
    if (upErr) return toast.error(upErr.message);
    const { error: insErr } = await db.from("pedido_anexos").insert({
      pedido_id: pedido.id,
      etapa: pedido.etapa,
      storage_path: path,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user.id,
    });
    if (insErr) return toast.error(insErr.message);
    toast.success("Anexo enviado");
    invalidar();
  };

  const baixarAnexo = async (a: Anexo) => {
    const { data, error } = await db.storage
      .from("pedido-anexos")
      .createSignedUrl(a.storage_path, 60);
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

  return (
    <Dialog open={!!pedidoId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {pedido && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>Pedido #{pedido.numero}</span>
                <Badge>{etapaLabel(pedido.etapa)}</Badge>
                <Badge variant="outline">{pedido.prioridade}</Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-1">
              <p className="font-medium">{pedido.titulo}</p>
              {pedido.cliente_nome && (
                <p className="text-sm text-muted-foreground">
                  Cliente: {pedido.cliente_nome}
                </p>
              )}
              {pedido.descricao && (
                <p className="text-sm whitespace-pre-wrap">{pedido.descricao}</p>
              )}
            </div>

            {!isFinal && podeAgir && (
              <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                <p className="text-sm font-medium">Ações desta etapa</p>
                <Textarea
                  placeholder="Observação (opcional) ao avançar / comentar"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      call("pedido_aceitar", { _pedido_id: pedido.id }, "Etapa aceita")
                    }
                  >
                    <Hand className="h-4 w-4 mr-1" /> Aceitar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      call(
                        "pedido_avancar",
                        { _pedido_id: pedido.id, _observacao: observacao || null },
                        "Etapa concluída",
                      )
                    }
                  >
                    <ArrowRight className="h-4 w-4 mr-1" /> Concluir e avançar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!comentario.trim())
                        return toast.error("Escreva um comentário");
                      call(
                        "pedido_comentar",
                        { _pedido_id: pedido.id, _observacao: comentario },
                        "Comentário registrado",
                      );
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" /> Comentar
                  </Button>
                </div>
                <Input
                  placeholder="Comentário rápido"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
                <div className="pt-2 border-t space-y-2">
                  <Input
                    placeholder="Motivo obrigatório para devolver / cancelar"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!motivo.trim()) return toast.error("Informe o motivo");
                        call(
                          "pedido_devolver",
                          { _pedido_id: pedido.id, _motivo: motivo },
                          "Pedido devolvido",
                        );
                      }}
                    >
                      <Undo2 className="h-4 w-4 mr-1" /> Devolver etapa
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (!motivo.trim()) return toast.error("Informe o motivo");
                        call(
                          "pedido_cancelar",
                          { _pedido_id: pedido.id, _motivo: motivo },
                          "Pedido cancelado",
                        );
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Cancelar pedido
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!podeAgir && !isFinal && (
              <p className="text-xs text-muted-foreground">
                Você não tem permissão para agir na etapa atual ({etapaLabel(pedido.etapa)}).
              </p>
            )}

            <Tabs defaultValue="historico">
              <TabsList>
                <TabsTrigger value="historico">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Histórico ({historico.length})
                </TabsTrigger>
                <TabsTrigger value="anexos">
                  <Paperclip className="h-3.5 w-3.5 mr-1" /> Anexos ({anexos.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="historico" className="space-y-2 mt-2">
                {historico.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sem registros
                  </p>
                )}
                {historico.map((h) => (
                  <div key={h.id} className="text-xs border-l-2 border-primary/40 pl-3 py-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">
                        {h.acao}
                      </Badge>
                      {h.etapa_de && h.etapa_para && h.etapa_de !== h.etapa_para && (
                        <span className="text-muted-foreground">
                          {etapaLabel(h.etapa_de)} → {etapaLabel(h.etapa_para)}
                        </span>
                      )}
                      <span className="text-muted-foreground ml-auto">
                        {new Date(h.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {h.observacao && <p className="mt-1">{h.observacao}</p>}
                    {h.motivo && (
                      <p className="mt-1 text-destructive">Motivo: {h.motivo}</p>
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="anexos" className="space-y-2 mt-2">
                {podeAgir && !isFinal && (
                  <div>
                    <Label className="text-xs">Enviar arquivo</Label>
                    <Input
                      type="file"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadAnexo(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
                {anexos.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum anexo
                  </p>
                )}
                {anexos.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 text-sm border rounded px-2 py-1"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{a.filename}</span>
                    <Badge variant="outline" className="text-[9px]">
                      {etapaLabel(a.etapa)}
                    </Badge>
                    <Button size="icon" variant="ghost" onClick={() => baixarAnexo(a)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {(hasRole("admin") || a.uploaded_by === user?.id) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => excluirAnexo(a)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
