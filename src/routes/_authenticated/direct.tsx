import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/direct")({
  component: DirectPage,
});

type Step = 0 | 1 | 2 | 3 | 4;

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

const steps = [
  { key: 0, label: "Cliente", icon: User },
  { key: 1, label: "Medição", icon: Ruler },
  { key: 2, label: "Serviço", icon: ClipboardList },
  { key: 3, label: "Materiais", icon: Package },
  { key: 4, label: "Revisão", icon: CheckCircle2 },
] as const;

function DirectPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);

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
  const valorComissao =
    ((vendedorSel?.percentual_comissao ?? 0) * total) / 100;

  const setItem = (idx: number, patch: Partial<ItemForm>) =>
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const canNext = (): boolean => {
    if (step === 0) {
      if (clienteMode === "existente") return !!clienteId;
      return novoCliente.nome.trim().length > 1;
    }
    if (step === 1) return !!vendedorId && !!dataMedicao && medidorNome.trim().length > 1;
    if (step === 2) return servicoDescricao.trim().length > 2;
    if (step === 3) return itens.length > 0 && itens.every((it) => it.descricao.trim() && Number(it.preco_unitario) > 0);
    return true;
  };

  const salvar = useMutation({
    mutationFn: async () => {
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
        subtotal: (Number(it.quantidade) || 0) * (Number(it.preco_unitario) || 0),
        perfil_id: it.perfil_id,
        vidro_id: it.vidro_id,
      }));
      const { error: eItens } = await supabase.from("orcamento_itens").insert(rows);
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

  return (
    <PageShell
      title="Direct"
      description="Fluxo guiado: cliente → medição → serviço → materiais → orçamento"
    >
      {/* Stepper */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {steps.map((s, i) => {
          const active = step === s.key;
          const done = step > s.key;
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (done ? setStep(s.key) : null)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow"
                    : done
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{i + 1}. {s.label}</span>
              </button>
              {i < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => {
              const S = steps[step];
              const I = S.icon;
              return (
                <>
                  <I className="h-5 w-5" />
                  {S.label}
                </>
              );
            })()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
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
                        setNovoCliente((s) => ({ ...s, documento: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={novoCliente.telefone}
                      onChange={(e) =>
                        setNovoCliente((s) => ({ ...s, telefone: e.target.value }))
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
                        setNovoCliente((s) => ({ ...s, endereco: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input
                      value={novoCliente.cidade}
                      onChange={(e) =>
                        setNovoCliente((s) => ({ ...s, cidade: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Input
                      value={novoCliente.estado}
                      onChange={(e) =>
                        setNovoCliente((s) => ({ ...s, estado: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
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

          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Descrição do serviço *</Label>
                <Textarea
                  rows={4}
                  value={servicoDescricao}
                  onChange={(e) => setServicoDescricao(e.target.value)}
                  placeholder="Ex.: Fornecimento e instalação de esquadrias de alumínio linha suprema, com vidros temperados 8mm..."
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

          {step === 3 && (
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
                        (Number(it.quantidade) || 0) * (Number(it.preco_unitario) || 0);
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input
                              value={it.tipo}
                              onChange={(e) => setItem(idx, { tipo: e.target.value })}
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
                                  prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
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

          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SummaryBlock title="Cliente" icon={User}>
                  <div>
                    <span className="text-muted-foreground">Nome:</span>{" "}
                    <span className="font-medium">
                      {clienteMode === "novo" ? novoCliente.nome : clienteSel?.nome}
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
                    <span className="font-medium">{vendedorSel?.nome ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Medidor:</span>{" "}
                    {medidorNome || "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data:</span> {dataMedicao}
                  </div>
                </SummaryBlock>

                <SummaryBlock title="Serviço" icon={ClipboardList}>
                  <div className="whitespace-pre-wrap">{servicoDescricao || "—"}</div>
                  {obraEndereco && (
                    <div className="text-muted-foreground">
                      {obraEndereco}
                      {obraCidade ? ` — ${obraCidade}` : ""}
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    Prazo: {prazoEntrega} dias {formaPagamento ? `• ${formaPagamento}` : ""}
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
                    <span>Comissão ({vendedorSel?.percentual_comissao ?? 0}%)</span>
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
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => (s > 0 ? ((s - 1) as Step) : s))}
          disabled={step === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        {step < 4 ? (
          <Button
            onClick={() => canNext() && setStep((s) => ((s + 1) as Step))}
            disabled={!canNext()}
          >
            Avançar <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending}
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
