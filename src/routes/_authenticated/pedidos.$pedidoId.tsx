import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos/$pedidoId")({
  component: PedidoDetalhePage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6 space-y-3">
      <p className="text-sm text-destructive">Erro: {error.message}</p>
      <Button size="sm" variant="outline" onClick={reset}>Tentar de novo</Button>
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: any) => any; storage: any };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
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
    qc.invalidateQueries({ queryKey: ["pedidos", pedidoId] });
    qc.invalidateQueries({ queryKey: ["pedidos", pedidoId, "historico"] });
    qc.invalidateQueries({ queryKey: ["pedidos", pedidoId, "anexos"] });
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

  // Group events per etapa (use etapa_de as the stage where the action happened; comentar/aceitar use etapa_de === etapa_para)
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

  const conclusaoDe = (etapa: Etapa) => {
    const ev = historico.find((h) => h.acao === "concluir" && h.etapa_de === etapa);
    return ev ?? null;
  };

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
        {/* Cabeçalho */}
        <Card>
          <CardContent className="p-4 md:p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="text-xs">{etapaLabel(pedido.etapa)}</Badge>
              <Badge variant="outline" className="text-xs">Prioridade: {pedido.prioridade}</Badge>
              {pedido.valor_estimado != null && (
                <Badge variant="secondary" className="text-xs">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(pedido.valor_estimado))}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                <Clock className="h-3 w-3" /> Criado em {fmtDate(pedido.created_at)} por {nameOf(pedido.created_by)}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-3 text-sm">
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
                <p className="text-xs text-muted-foreground">Última atualização</p>
                <p className="font-medium">{fmtDate(pedido.updated_at)}</p>
              </div>
            </div>
            {pedido.descricao && (
              <>
                <Separator />
                <p className="text-sm whitespace-pre-wrap">{pedido.descricao}</p>
              </>
            )}
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

        {/* Timeline */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Passo a passo</h3>
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
                      {status === "concluida" && concl && (
                        <span className="text-xs text-muted-foreground">
                          Concluída em {fmtDate(concl.created_at)} por {nameOf(concl.de_user_id)}
                        </span>
                      )}
                    </div>

                    {/* Eventos */}
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

                    {/* Anexos por etapa */}
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

                    {/* Ações em contexto (etapa atual) */}
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
                              <Button
                                size="sm"
                                onClick={() => call("pedido_avancar",
                                  { _pedido_id: pedido.id, _observacao: observacao || null },
                                  "Etapa concluída")}
                              >
                                <ArrowRight className="h-4 w-4 mr-1" /> Concluir e avançar
                              </Button>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                              <Label className="text-xs">Comentar sem mudar etapa</Label>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Comentário rápido"
                                  value={comentario}
                                  onChange={(e) => setComentario(e.target.value)}
                                />
                                <Button
                                  size="sm" variant="outline"
                                  onClick={() => {
                                    if (!comentario.trim()) return toast.error("Escreva um comentário");
                                    call("pedido_comentar",
                                      { _pedido_id: pedido.id, _observacao: comentario },
                                      "Comentário registrado");
                                  }}
                                >
                                  <MessageSquare className="h-4 w-4 mr-1" /> Comentar
                                </Button>
                              </div>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                              <Label className="text-xs text-destructive">Devolver ou cancelar (motivo obrigatório)</Label>
                              <Input
                                placeholder="Motivo"
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm" variant="outline"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    if (!motivo.trim()) return toast.error("Informe o motivo");
                                    call("pedido_devolver",
                                      { _pedido_id: pedido.id, _motivo: motivo },
                                      "Pedido devolvido");
                                  }}
                                >
                                  <Undo2 className="h-4 w-4 mr-1" /> Devolver etapa
                                </Button>
                                <Button
                                  size="sm" variant="destructive"
                                  onClick={() => {
                                    if (!motivo.trim()) return toast.error("Informe o motivo");
                                    call("pedido_cancelar",
                                      { _pedido_id: pedido.id, _motivo: motivo },
                                      "Pedido cancelado");
                                  }}
                                >
                                  <XCircle className="h-4 w-4 mr-1" /> Cancelar pedido
                                </Button>
                              </div>
                            </div>

                            <Separator />

                            <div>
                              <Label className="text-xs flex items-center gap-1"><Upload className="h-3 w-3" /> Anexar arquivo a esta etapa</Label>
                              <Input
                                type="file"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadAnexo(f, step.key);
                                  e.target.value = "";
                                }}
                              />
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
      </div>
    </PageShell>
  );
}
