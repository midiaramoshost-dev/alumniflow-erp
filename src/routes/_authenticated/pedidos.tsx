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
  const [prazoEntrega, setPrazoEntrega] = useState("");
  const [formaEntrega, setFormaEntrega] = useState("");
  const [transportadora, setTransportadora] = useState("");
  const [enderecoEntrega, setEnderecoEntrega] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [condicoesPagamento, setCondicoesPagamento] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [sinalEntrada, setSinalEntrada] = useState("");
  const [observacoesInternas, setObservacoesInternas] = useState("");

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
      const total = valor ? Number(valor) : 0;
      const payload = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        cliente_id: clienteId || null,
        cliente_nome: clienteNome.trim() || null,
        valor_estimado: total || null,
        subtotal: total,
        valor_total: total,
        sinal_entrada: sinalEntrada ? Number(sinalEntrada) : 0,
        prioridade,
        prazo_entrega: prazoEntrega || null,
        forma_entrega: formaEntrega.trim() || null,
        transportadora: transportadora.trim() || null,
        endereco_entrega: enderecoEntrega.trim()
          ? { endereco: enderecoEntrega.trim() }
          : null,
        forma_pagamento: formaPagamento.trim() || null,
        condicoes_pagamento: condicoesPagamento.trim() || null,
        parcelas: parcelas ? Math.max(1, Number(parcelas)) : 1,
        observacoes_internas: observacoesInternas.trim() || null,
        created_by: user?.id,
      };
      const { error } = await db.from("pedidos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success("Pedido criado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Novo pedido</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Título *</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Valor inicial (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div>
            <Label>Sinal / entrada (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={sinalEntrada}
              onChange={(e) => setSinalEntrada(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Prazo de entrega</Label>
            <Input
              type="date"
              value={prazoEntrega}
              onChange={(e) => setPrazoEntrega(e.target.value)}
            />
          </div>
          <div>
            <Label>Forma de entrega</Label>
            <Select value={formaEntrega} onValueChange={setFormaEntrega}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retirada">Retirada na fábrica</SelectItem>
                <SelectItem value="entrega_propria">Entrega própria</SelectItem>
                <SelectItem value="transportadora">Transportadora</SelectItem>
                <SelectItem value="instalacao">Entrega + instalação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {formaEntrega === "transportadora" && (
          <div>
            <Label>Transportadora</Label>
            <Input
              value={transportadora}
              onChange={(e) => setTransportadora(e.target.value)}
            />
          </div>
        )}

        <div>
          <Label>Endereço de entrega</Label>
          <Textarea
            value={enderecoEntrega}
            onChange={(e) => setEnderecoEntrega(e.target.value)}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
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
            <Input
              type="number"
              min="1"
              value={parcelas}
              onChange={(e) => setParcelas(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label>Condições de pagamento</Label>
          <Input
            placeholder="Ex.: 50% entrada + 50% na entrega"
            value={condicoesPagamento}
            onChange={(e) => setCondicoesPagamento(e.target.value)}
          />
        </div>

        <div>
          <Label>Descrição</Label>
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
          />
        </div>

        <div>
          <Label>Observações internas</Label>
          <Textarea
            placeholder="Só visível à equipe"
            value={observacoesInternas}
            onChange={(e) => setObservacoesInternas(e.target.value)}
            rows={2}
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
