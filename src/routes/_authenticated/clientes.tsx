import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
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
import { Separator } from "@/components/ui/separator";
import { Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});

const FORMAS_PAGAMENTO = [
  "À vista",
  "Boleto",
  "Cartão de crédito",
  "PIX",
  "Financiamento",
  "Parcelado",
  "Transferência",
] as const;

const schema = z.object({
  tipo: z.enum(["PF", "PJ"]),
  nome: z.string().trim().min(2, "Nome obrigatório").max(120),
  documento: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(255).optional().or(z.literal("")),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
  celular: z.string().trim().max(30).optional().or(z.literal("")),
  cidade: z.string().trim().max(80).optional().or(z.literal("")),
  estado: z.string().trim().max(4).optional().or(z.literal("")),
  observacoes: z.string().trim().max(500).optional().or(z.literal("")),
  numero_proposta: z.string().trim().max(30).optional().or(z.literal("")),
  data_venda: z.string().trim().max(30).optional().or(z.literal("")),
  valor_total: z.string().trim().max(30).optional().or(z.literal("")),
  forma_pagamento: z.string().trim().max(40).optional().or(z.literal("")),
  vendedor_id: z.string().trim().max(40).optional().or(z.literal("")),
  comissao_percentual: z.string().trim().max(10).optional().or(z.literal("")),
});

type Cliente = {
  id: string;
  tipo: string;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  cidade: string | null;
  estado: string | null;
  observacoes: string | null;
  created_at: string;
  numero_proposta: string | null;
  data_venda: string | null;
  valor_total: number | null;
  forma_pagamento: string | null;
  vendedor_id: string | null;
  comissao_percentual: number | null;
};

type Vendedor = {
  id: string;
  nome: string;
  percentual_comissao: number;
  ativo: boolean;
};

function brl(v: number | null | undefined) {
  return v != null ? `R$ ${Number(v).toFixed(2)}` : "—";
}

function ClientesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [vendedorId, setVendedorId] = useState<string>("none");
  const [comissao, setComissao] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState<string>("none");

  const { data, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Cliente[];
    },
  });

  const { data: vendedores } = useQuery({
    queryKey: ["vendedores", "ativos"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from("vendedores")
        .select("id, nome, percentual_comissao, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Vendedor[];
    },
  });

  const vendedorMap = useMemo(() => {
    const m = new Map<string, Vendedor>();
    (vendedores ?? []).forEach((v) => m.set(v.id, v));
    return m;
  }, [vendedores]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((c) =>
      [c.nome, c.email, c.documento, c.cidade, c.numero_proposta].some((v) =>
        (v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [data, query]);

  const upsert = useMutation({
    mutationFn: async (payload: z.infer<typeof schema> & { id?: string }) => {
      const { id, valor_total, comissao_percentual, data_venda, ...rest } = payload;
      const clean: Record<string, unknown> = Object.fromEntries(
        Object.entries(rest).map(([k, v]) => [k, v === "" ? null : v]),
      );
      clean.valor_total = valor_total ? Number(String(valor_total).replace(",", ".")) : null;
      clean.comissao_percentual = comissao_percentual
        ? Number(String(comissao_percentual).replace(",", "."))
        : null;
      clean.data_venda = data_venda || null;

      if (id) {
        const { error } = await (supabase as unknown as { from: (t: string) => any })
          .from("clientes")
          .update(clean)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as unknown as { from: (t: string) => any })
          .from("clientes")
          .insert({ ...clean, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["count", "clientes"] });
      toast.success(editing ? "Cliente atualizado" : "Cliente criado");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["count", "clientes"] });
      toast.success("Cliente removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setVendedorId("none");
    setComissao("");
    setFormaPagamento("none");
    setOpen(true);
  };

  const openEdit = (c: Cliente) => {
    setEditing(c);
    setVendedorId(c.vendedor_id ?? "none");
    setComissao(c.comissao_percentual != null ? String(c.comissao_percentual) : "");
    setFormaPagamento(c.forma_pagamento ?? "none");
    setOpen(true);
  };

  const onVendedorChange = (id: string) => {
    setVendedorId(id);
    if (id !== "none") {
      const v = vendedorMap.get(id);
      if (v && !comissao) setComissao(String(v.percentual_comissao ?? ""));
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const obj = Object.fromEntries(fd.entries());
    // inject controlled selects
    obj.vendedor_id = vendedorId === "none" ? "" : vendedorId;
    obj.forma_pagamento = formaPagamento === "none" ? "" : formaPagamento;
    obj.comissao_percentual = comissao;
    const parsed = schema.safeParse(obj);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    upsert.mutate({ ...parsed.data, id: editing?.id });
  };

  const suggestedProposta = useMemo(() => {
    if (editing?.numero_proposta) return editing.numero_proposta;
    const year = new Date().getFullYear();
    const seq = String((data?.length ?? 0) + 1001).padStart(4, "0");
    return `${year}-${seq}`;
  }, [editing, data]);

  return (
    <PageShell
      title="Clientes"
      description="Cadastro com dados comerciais da proposta"
      onNew={openNew}
      newLabel="Novo cliente"
      actions={
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar…"
            className="pl-8 w-56"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="hidden md:table-cell">Proposta</TableHead>
            <TableHead className="hidden lg:table-cell">Vendedor</TableHead>
            <TableHead className="hidden sm:table-cell text-right">Valor</TableHead>
            <TableHead className="hidden md:table-cell">Pagamento</TableHead>
            <TableHead className="hidden lg:table-cell">Data venda</TableHead>
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
                Nenhum cliente encontrado.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((c) => {
            const v = c.vendedor_id ? vendedorMap.get(c.vendedor_id) : null;
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.nome}
                  <div className="text-xs text-muted-foreground">
                    <Badge variant="secondary" className="mr-1">
                      {c.tipo}
                    </Badge>
                    {c.documento ?? ""}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell font-mono text-xs">
                  {c.numero_proposta ?? "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {v?.nome ?? "—"}
                  {c.comissao_percentual != null && (
                    <div className="text-[10px]">com {Number(c.comissao_percentual).toFixed(2)}%</div>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-right tabular-nums">
                  {brl(c.valor_total)}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                  {c.forma_pagamento ?? "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                  {c.data_venda ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Excluir "${c.nome}"?`)) remove.mutate(c.id);
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            <DialogDescription>Dados do cliente e da proposta comercial</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Tipo</Label>
              <Select name="tipo" defaultValue={editing?.tipo ?? "PF"}>
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
              <Label htmlFor="documento">CPF / CNPJ</Label>
              <Input id="documento" name="documento" defaultValue={editing?.documento ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="nome">Nome / Razão social *</Label>
              <Input id="nome" name="nome" required defaultValue={editing?.nome ?? ""} />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" name="telefone" defaultValue={editing?.telefone ?? ""} />
            </div>
            <div>
              <Label htmlFor="celular">Celular</Label>
              <Input id="celular" name="celular" defaultValue={editing?.celular ?? ""} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" name="cidade" defaultValue={editing?.cidade ?? ""} />
              </div>
              <div>
                <Label htmlFor="estado">UF</Label>
                <Input
                  id="estado"
                  name="estado"
                  maxLength={2}
                  defaultValue={editing?.estado ?? ""}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <Separator className="my-1" />
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Proposta comercial
              </div>
            </div>

            <div>
              <Label htmlFor="numero_proposta">Nº da proposta</Label>
              <Input
                id="numero_proposta"
                name="numero_proposta"
                defaultValue={editing?.numero_proposta ?? suggestedProposta}
              />
            </div>
            <div>
              <Label htmlFor="data_venda">Data da venda</Label>
              <Input
                id="data_venda"
                name="data_venda"
                type="date"
                defaultValue={
                  editing?.data_venda ?? new Date().toISOString().slice(0, 10)
                }
              />
            </div>
            <div>
              <Label htmlFor="valor_total">Valor total da obra (R$)</Label>
              <Input
                id="valor_total"
                name="valor_total"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editing?.valor_total ?? ""}
              />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Não informar —</SelectItem>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vendedor</Label>
              <Select value={vendedorId} onValueChange={onVendedorChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem vendedor —</SelectItem>
                  {(vendedores ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome} ({Number(v.percentual_comissao).toFixed(2)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="comissao_percentual">Comissão do vendedor (%)</Label>
              <Input
                id="comissao_percentual"
                type="number"
                step="0.01"
                min="0"
                value={comissao}
                onChange={(e) => setComissao(e.target.value)}
                placeholder="Ex.: 5,00"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                name="observacoes"
                rows={2}
                defaultValue={editing?.observacoes ?? ""}
              />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
