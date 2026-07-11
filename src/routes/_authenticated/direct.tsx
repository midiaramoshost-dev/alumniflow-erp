import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { AppRole } from "@/lib/roles";
import { roleLabel } from "@/lib/roles";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  Ruler,
  Package,
  ClipboardList,
  CheckCircle2,
  Plus,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Lock,
  ShieldCheck,
  Scissors,
  Cog,
  Hammer,
  ClipboardCheck,
  Truck,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const ETAPAS = [
  "cliente",
  "medicao",
  "servico",
  "materiais",
  "revisao",
  "corte",
  "usinagem",
  "montagem",
  "conferencia",
  "carregamento",
] as const;
type Etapa = (typeof ETAPAS)[number];

const searchSchema = z.object({
  etapa: z.enum(ETAPAS).optional(),
});

export const Route = createFileRoute("/_authenticated/direct")({
  validateSearch: (s) => searchSchema.parse(s),
  component: DirectPage,
});

// Papéis autorizados por etapa. Admin sempre passa.
const STEP_ROLES: Record<Etapa, AppRole[]> = {
  cliente: ["admin", "vendedor"],
  medicao: ["admin", "vendedor", "medidor"],
  servico: ["admin", "vendedor", "tecnico"],
  materiais: ["admin", "vendedor", "tecnico", "producao"],
  revisao: ["admin", "vendedor"],
  corte: ["admin", "producao", "cortador"],
  usinagem: ["admin", "producao", "usinador"],
  montagem: ["admin", "producao", "montador"],
  conferencia: ["admin", "producao", "conferente"],
  carregamento: ["admin", "producao", "instalador"],
};

const STEP_META: Record<Etapa, { label: string; icon: typeof User; desc: string }> = {
  cliente: { label: "Cliente", icon: User, desc: "Identifique o cliente do orçamento" },
  medicao: { label: "Medição", icon: Ruler, desc: "Vendedor, medidor e data" },
  servico: { label: "Serviço", icon: ClipboardList, desc: "Descrição, obra e prazos" },
  materiais: { label: "Materiais", icon: Package, desc: "Itens, preços e totais" },
  revisao: { label: "Orçamento", icon: CheckCircle2, desc: "Revisão e salvamento" },
  corte: { label: "Corte", icon: Scissors, desc: "Setor de corte de perfis" },
  usinagem: { label: "Usinagem", icon: Cog, desc: "Setor de usinagem" },
  montagem: { label: "Montagem", icon: Hammer, desc: "Setor de montagem" },
  conferencia: { label: "Conferência", icon: ClipboardCheck, desc: "Conferência final" },
  carregamento: { label: "Carregamento", icon: Truck, desc: "Expedição e entrega" },
};


type ItemForm = {
  tipo: string;
  descricao: string;
  largura_mm: string;
  altura_mm: string;
  quantidade: string;
  preco_unitario: string;
  perfil_id: string | null;
  vidro_id: string | null;
};

const emptyItem = (): ItemForm => ({
  tipo: "",
  descricao: "",
  largura_mm: "",
  altura_mm: "",
  quantidade: "1",
  preco_unitario: "0",
  perfil_id: null,
  vidro_id: null,
});

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(n) ? n : 0,
  );

function canDoStep(etapa: Etapa, roles: AppRole[]): boolean {
  if (roles.includes("admin")) return true;
  return STEP_ROLES[etapa].some((r) => roles.includes(r));
}

function DirectPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate({ from: "/direct" });
  const search = Route.useSearch();
  const etapa: Etapa = search.etapa ?? "cliente";
  const stepIndex = ETAPAS.indexOf(etapa);

  const goTo = (e: Etapa) => navigate({ search: { etapa: e } });

  // ---- Cliente
  const [clienteMode, setClienteMode] = useState<"existente" | "novo">("existente");
  const [clienteId, setClienteId] = useState<string>("");
  const [novoCliente, setNovoCliente] = useState({
    nome: "",
    tipo: "PF",
    documento: "",
    telefone: "",
    email: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
  });

  // ---- Vendedor + Medição
  const [vendedorId, setVendedorId] = useState<string>("");
  const [dataMedicao, setDataMedicao] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [medidorNome, setMedidorNome] = useState("");

  // ---- Serviço
  const [servicoDescricao, setServicoDescricao] = useState("");
  const [obraEndereco, setObraEndereco] = useState("");
  const [obraCidade, setObraCidade] = useState("");
  const [obraAmbiente, setObraAmbiente] = useState("");
  const [prazoEntrega, setPrazoEntrega] = useState("30");
  const [formaPagamento, setFormaPagamento] = useState("");

  // ---- Itens
  const [itens, setItens] = useState<ItemForm[]>([emptyItem()]);
  const [desconto, setDesconto] = useState("0");
  const [imposto, setImposto] = useState("0");
  const [observacoes, setObservacoes] = useState("");

  const clientes = useQuery({
    queryKey: ["direct-clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, documento, telefone")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const vendedores = useQuery({
    queryKey: ["direct-vendedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome, percentual_comissao, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const perfis = useQuery({
    queryKey: ["direct-perfis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis_aluminio")
        .select("id, codigo, descricao, preco_metro")
        .order("descricao");
      if (error) throw error;
      return data ?? [];
    },
  });

  const vidros = useQuery({
    queryKey: ["direct-vidros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vidros")
        .select("id, tipo, espessura_mm, preco_m2")
        .order("tipo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const vendedorSel = vendedores.data?.find((v) => v.id === vendedorId);
  const clienteSel = clientes.data?.find((c) => c.id === clienteId);

  const subtotal = useMemo(
    () =>
      itens.reduce(
        (s, it) =>
          s + (Number(it.quantidade) || 0) * (Number(it.preco_unitario) || 0),
        0,
      ),
    [itens],
  );
  const descontoNum = Number(desconto) || 0;
  const impostoNum = Number(imposto) || 0;
  const valorImpostos = ((subtotal - descontoNum) * impostoNum) / 100;
  const total = subtotal - descontoNum + valorImpostos;
  const valorComissao = ((vendedorSel?.percentual_comissao ?? 0) * total) / 100;

  const setItem = (idx: number, patch: Partial<ItemForm>) =>
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const allowed = canDoStep(etapa, roles);

  const canNext = (): boolean => {
    if (!allowed) return false;
    if (etapa === "cliente") {
      if (clienteMode === "existente") return !!clienteId;
      return novoCliente.nome.trim().length > 1;
    }
    if (etapa === "medicao")
      return !!vendedorId && !!dataMedicao && medidorNome.trim().length > 1;
    if (etapa === "servico") return servicoDescricao.trim().length > 2;
    if (etapa === "materiais")
      return (
        itens.length > 0 &&
        itens.every(
          (it) => it.descricao.trim() && Number(it.preco_unitario) > 0,
        )
      );
    return true;
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!canDoStep("revisao", roles))
        throw new Error("Seu perfil não pode finalizar o orçamento.");
      let cId = clienteId;
      let cNome = clienteSel?.nome ?? "";
      if (clienteMode === "novo") {
        const { data, error } = await supabase
          .from("clientes")
          .insert({ ...novoCliente, created_by: user?.id ?? null })
          .select("id, nome")
          .single();
        if (error) throw error;
        cId = data.id;
        cNome = data.nome;
      }

      const { data: orc, error: eOrc } = await supabase
        .from("orcamentos")
        .insert({
          cliente_id: cId,
          cliente_nome: cNome,
          vendedor_id: vendedorId,
          medidor_nome: medidorNome,
          data_medicao: dataMedicao,
          servico_descricao: servicoDescricao,
          obra_endereco: obraEndereco || null,
          obra_cidade: obraCidade || null,
          obra_ambiente: obraAmbiente || null,
          prazo_entrega_dias: Number(prazoEntrega) || null,
          forma_pagamento: formaPagamento || null,
          percentual_comissao: vendedorSel?.percentual_comissao ?? 0,
          valor_comissao: valorComissao,
          imposto_percentual: impostoNum,
          valor_impostos: valorImpostos,
          subtotal,
          desconto: descontoNum,
          total,
          observacoes: observacoes || null,
          status: "rascunho",
          data_orcamento: new Date().toISOString().slice(0, 10),
          created_by: user?.id ?? null,
        })
        .select("id, numero")
        .single();
      if (eOrc) throw eOrc;

      const rows = itens.map((it, i) => ({
        orcamento_id: orc.id,
        ordem: i + 1,
        tipo: it.tipo || null,
        descricao: it.descricao,
        largura_mm: it.largura_mm ? Number(it.largura_mm) : null,
        altura_mm: it.altura_mm ? Number(it.altura_mm) : null,
        quantidade: Number(it.quantidade) || 1,
        preco_unitario: Number(it.preco_unitario) || 0,
        subtotal:
          (Number(it.quantidade) || 0) * (Number(it.preco_unitario) || 0),
        perfil_id: it.perfil_id,
        vidro_id: it.vidro_id,
      }));
      const { error: eItens } = await supabase
        .from("orcamento_itens")
        .insert(rows);
      if (eItens) throw eItens;
      return orc;
    },
    onSuccess: (orc) => {
      toast.success(`Orçamento #${orc.numero} criado`);
      qc.invalidateQueries({ queryKey: ["orcamentos"] });
      navigate({ to: "/vendas" });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const prevEtapa: Etapa | null = stepIndex > 0 ? ETAPAS[stepIndex - 1] : null;
  const nextEtapa: Etapa | null =
    stepIndex < ETAPAS.length - 1 ? ETAPAS[stepIndex + 1] : null;

  return (
    <PageShell
      title="Direct"
      description="Fluxo guiado: cliente → medição → serviço → materiais → revisão. Cada etapa exige o papel correspondente."
    >
      {/* Stepper com links diretos por etapa + gate por papel */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {ETAPAS.map((e, i) => {
          const meta = STEP_META[e];
          const active = etapa === e;
          const done = stepIndex > i;
          const permitted = canDoStep(e, roles);
          const Icon = meta.icon;
          return (
            <div key={e} className="flex items-center gap-2">
              <Link
                to="/direct"
                search={{ etapa: e }}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow"
                    : done
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                } ${!permitted ? "opacity-60" : "hover:brightness-110"}`}
                title={
                  permitted
                    ? `Ir para ${meta.label}`
                    : `Restrito a: ${STEP_ROLES[e].map(roleLabel).join(", ")}`
                }
              >
                {permitted ? (
                  <Icon className="h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                <span className="font-medium">
                  {i + 1}. {meta.label}
                </span>
              </Link>
              {i < ETAPAS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              {(() => {
                const I = STEP_META[etapa].icon;
                return <I className="h-5 w-5" />;
              })()}
              {STEP_META[etapa].label}
              <span className="text-sm font-normal text-muted-foreground">
                — {STEP_META[etapa].desc}
              </span>
            </span>
            <span className="flex flex-wrap gap-1">
              {STEP_ROLES[etapa].map((r) => (
                <Badge
                  key={r}
                  variant={roles.includes(r) || roles.includes("admin") ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {roleLabel(r)}
                </Badge>
              ))}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!allowed ? (
            <StepRestricted etapa={etapa} userRoles={roles} />
          ) : (
            <>
              {etapa === "cliente" && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      variant={clienteMode === "existente" ? "default" : "outline"}
                      onClick={() => setClienteMode("existente")}
                      size="sm"
                    >
                      Cliente existente
                    </Button>
                    <Button
                      variant={clienteMode === "novo" ? "default" : "outline"}
                      onClick={() => setClienteMode("novo")}
                      size="sm"
                    >
                      Novo cliente
                    </Button>
                  </div>

                  {clienteMode === "existente" ? (
                    <div>
                      <Label>Selecione o cliente</Label>
                      <Select value={clienteId} onValueChange={setClienteId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha um cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clientes.data?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome} {c.documento ? `— ${c.documento}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <Label>Nome / Razão social *</Label>
                        <Input
                          value={novoCliente.nome}
                          onChange={(e) =>
                            setNovoCliente((s) => ({ ...s, nome: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Tipo</Label>
                        <Select
                          value={novoCliente.tipo}
                          onValueChange={(v) =>
                            setNovoCliente((s) => ({ ...s, tipo: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PF">Pessoa Física</SelectItem>
                            <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Documento</Label>
                        <Input
                          value={novoCliente.documento}
                          onChange={(e) =>
                            setNovoCliente((s) => ({
                              ...s,
                              documento: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Telefone</Label>
                        <Input
                          value={novoCliente.telefone}
                          onChange={(e) =>
                            setNovoCliente((s) => ({
                              ...s,
                              telefone: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>E-mail</Label>
                        <Input
                          value={novoCliente.email}
                          onChange={(e) =>
                            setNovoCliente((s) => ({ ...s, email: e.target.value }))
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Endereço</Label>
                        <Input
                          value={novoCliente.endereco}
                          onChange={(e) =>
                            setNovoCliente((s) => ({
                              ...s,
                              endereco: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Cidade</Label>
                        <Input
                          value={novoCliente.cidade}
                          onChange={(e) =>
                            setNovoCliente((s) => ({
                              ...s,
                              cidade: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>UF</Label>
                        <Input
                          value={novoCliente.estado}
                          onChange={(e) =>
                            setNovoCliente((s) => ({
                              ...s,
                              estado: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {etapa === "medicao" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Vendedor responsável *</Label>
                    <Select value={vendedorId} onValueChange={setVendedorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o vendedor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {vendedores.data?.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.nome} — {Number(v.percentual_comissao).toFixed(1)}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data da medição *</Label>
                    <Input
                      type="date"
                      value={dataMedicao}
                      onChange={(e) => setDataMedicao(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Quem fez a medição *</Label>
                    <Input
                      value={medidorNome}
                      onChange={(e) => setMedidorNome(e.target.value)}
                      placeholder="Nome do responsável pela medição"
                    />
                  </div>
                </div>
              )}

              {etapa === "servico" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Descrição do serviço *</Label>
                    <Textarea
                      rows={4}
                      value={servicoDescricao}
                      onChange={(e) => setServicoDescricao(e.target.value)}
                      placeholder="Ex.: Fornecimento e instalação de esquadrias..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Endereço da obra</Label>
                    <Input
                      value={obraEndereco}
                      onChange={(e) => setObraEndereco(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Cidade da obra</Label>
                    <Input
                      value={obraCidade}
                      onChange={(e) => setObraCidade(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Ambiente</Label>
                    <Input
                      value={obraAmbiente}
                      onChange={(e) => setObraAmbiente(e.target.value)}
                      placeholder="Sala, cozinha, fachada..."
                    />
                  </div>
                  <div>
                    <Label>Prazo de entrega (dias)</Label>
                    <Input
                      type="number"
                      value={prazoEntrega}
                      onChange={(e) => setPrazoEntrega(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Forma de pagamento</Label>
                    <Input
                      value={formaPagamento}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                      placeholder="Ex.: 50% entrada + 50% na entrega"
                    />
                  </div>
                </div>
              )}

              {etapa === "materiais" && (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-40">Tipo</TableHead>
                          <TableHead>Descrição *</TableHead>
                          <TableHead className="w-40">Perfil</TableHead>
                          <TableHead className="w-40">Vidro</TableHead>
                          <TableHead className="w-24">L (mm)</TableHead>
                          <TableHead className="w-24">A (mm)</TableHead>
                          <TableHead className="w-20">Qtd</TableHead>
                          <TableHead className="w-32">Preço unit. *</TableHead>
                          <TableHead className="w-28 text-right">Subtotal</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itens.map((it, idx) => {
                          const sub =
                            (Number(it.quantidade) || 0) *
                            (Number(it.preco_unitario) || 0);
                          return (
                            <TableRow key={idx}>
                              <TableCell>
                                <Input
                                  value={it.tipo}
                                  onChange={(e) =>
                                    setItem(idx, { tipo: e.target.value })
                                  }
                                  placeholder="Janela, porta..."
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={it.descricao}
                                  onChange={(e) =>
                                    setItem(idx, { descricao: e.target.value })
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={it.perfil_id ?? ""}
                                  onValueChange={(v) =>
                                    setItem(idx, { perfil_id: v || null })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {perfis.data?.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.codigo} {p.descricao}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={it.vidro_id ?? ""}
                                  onValueChange={(v) =>
                                    setItem(idx, { vidro_id: v || null })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {vidros.data?.map((v) => (
                                      <SelectItem key={v.id} value={v.id}>
                                        {v.tipo} {v.espessura_mm}mm
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={it.largura_mm}
                                  onChange={(e) =>
                                    setItem(idx, { largura_mm: e.target.value })
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={it.altura_mm}
                                  onChange={(e) =>
                                    setItem(idx, { altura_mm: e.target.value })
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={it.quantidade}
                                  onChange={(e) =>
                                    setItem(idx, { quantidade: e.target.value })
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={it.preco_unitario}
                                  onChange={(e) =>
                                    setItem(idx, { preco_unitario: e.target.value })
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {brl(sub)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setItens((prev) =>
                                      prev.length > 1
                                        ? prev.filter((_, i) => i !== idx)
                                        : prev,
                                    )
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setItens((prev) => [...prev, emptyItem()])}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Adicionar item
                  </Button>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div>
                      <Label>Desconto (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={desconto}
                        onChange={(e) => setDesconto(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Impostos (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={imposto}
                        onChange={(e) => setImposto(e.target.value)}
                      />
                    </div>
                    <div className="rounded-md border p-3 bg-muted/40">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>{brl(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Desconto</span>
                        <span>− {brl(descontoNum)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Impostos</span>
                        <span>{brl(valorImpostos)}</span>
                      </div>
                      <div className="flex justify-between font-semibold pt-1 border-t mt-1">
                        <span>Total</span>
                        <span>{brl(total)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      rows={2}
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {etapa === "revisao" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SummaryBlock title="Cliente" icon={User}>
                      <div>
                        <span className="text-muted-foreground">Nome:</span>{" "}
                        <span className="font-medium">
                          {clienteMode === "novo"
                            ? novoCliente.nome
                            : clienteSel?.nome}
                        </span>
                      </div>
                      {clienteMode === "novo" && (
                        <>
                          <div>
                            <span className="text-muted-foreground">Documento:</span>{" "}
                            {novoCliente.documento || "—"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Telefone:</span>{" "}
                            {novoCliente.telefone || "—"}
                          </div>
                        </>
                      )}
                    </SummaryBlock>

                    <SummaryBlock title="Medição" icon={Ruler}>
                      <div>
                        <span className="text-muted-foreground">Vendedor:</span>{" "}
                        <span className="font-medium">
                          {vendedorSel?.nome ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Medidor:</span>{" "}
                        {medidorNome || "—"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Data:</span>{" "}
                        {dataMedicao}
                      </div>
                    </SummaryBlock>

                    <SummaryBlock title="Serviço" icon={ClipboardList}>
                      <div className="whitespace-pre-wrap">
                        {servicoDescricao || "—"}
                      </div>
                      {obraEndereco && (
                        <div className="text-muted-foreground">
                          {obraEndereco}
                          {obraCidade ? ` — ${obraCidade}` : ""}
                        </div>
                      )}
                      <div className="text-muted-foreground">
                        Prazo: {prazoEntrega} dias{" "}
                        {formaPagamento ? `• ${formaPagamento}` : ""}
                      </div>
                    </SummaryBlock>

                    <SummaryBlock title="Financeiro" icon={CheckCircle2}>
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{brl(subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Impostos</span>
                        <span>{brl(valorImpostos)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Desconto</span>
                        <span>− {brl(descontoNum)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>Total</span>
                        <span>{brl(total)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          Comissão ({vendedorSel?.percentual_comissao ?? 0}%)
                        </span>
                        <span>{brl(valorComissao)}</span>
                      </div>
                    </SummaryBlock>
                  </div>

                  <div>
                    <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Package className="h-4 w-4" /> Materiais ({itens.length})
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-24">Qtd</TableHead>
                          <TableHead className="w-32 text-right">Preço</TableHead>
                          <TableHead className="w-32 text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itens.map((it, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <div className="font-medium">{it.descricao}</div>
                              {it.tipo && (
                                <Badge variant="secondary" className="mt-1">
                                  {it.tipo}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{it.quantidade}</TableCell>
                            <TableCell className="text-right">
                              {brl(Number(it.preco_unitario))}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {brl(
                                (Number(it.quantidade) || 0) *
                                  (Number(it.preco_unitario) || 0),
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {(etapa === "corte" ||
                etapa === "usinagem" ||
                etapa === "montagem" ||
                etapa === "conferencia" ||
                etapa === "carregamento") && (
                <ProductionStageCard etapa={etapa} />
              )}

            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-between">
        <Button
          variant="outline"
          onClick={() => prevEtapa && goTo(prevEtapa)}
          disabled={!prevEtapa}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        {etapa !== "revisao" ? (
          <Button
            onClick={() => nextEtapa && canNext() && goTo(nextEtapa)}
            disabled={!canNext() || !nextEtapa}
          >
            Avançar <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || !allowed}
          >
            {salvar.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            Salvar orçamento
          </Button>
        )}
      </div>
    </PageShell>
  );
}

function StepRestricted({
  etapa,
  userRoles,
}: {
  etapa: Etapa;
  userRoles: AppRole[];
}) {
  const required = STEP_ROLES[etapa];
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed p-8 text-center">
      <div className="rounded-full bg-amber-500/10 p-3">
        <Lock className="h-8 w-8 text-amber-600" />
      </div>
      <div>
        <p className="font-semibold">Etapa restrita</p>
        <p className="text-sm text-muted-foreground">
          Seu perfil não pode preencher a etapa <b>{STEP_META[etapa].label}</b>.
          Passe o pedido para o responsável ou peça acesso ao administrador.
        </p>
      </div>
      <div className="w-full max-w-md space-y-3 text-left text-sm">
        <div>
          <p className="text-xs uppercase text-muted-foreground">
            Papéis autorizados
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {required.map((r) => (
              <Badge key={r} variant="default">
                <ShieldCheck className="h-3 w-3 mr-1" />
                {roleLabel(r)}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Seus papéis</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {userRoles.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Nenhum perfil atribuído
              </span>
            ) : (
              userRoles.map((r) => (
                <Badge key={r} variant="secondary">
                  {roleLabel(r)}
                </Badge>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-3 bg-muted/30 space-y-1 text-sm">
      <div className="flex items-center gap-2 font-semibold mb-1">
        <Icon className="h-4 w-4" /> {title}
      </div>
      {children}
    </div>
  );
}
