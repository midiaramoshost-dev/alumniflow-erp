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
import { Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});

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
};

function ClientesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Cliente[];
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((c) =>
      [c.nome, c.email, c.documento, c.cidade].some((v) =>
        (v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [data, query]);

  const upsert = useMutation({
    mutationFn: async (payload: z.infer<typeof schema> & { id?: string }) => {
      const clean = Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [k, v === "" ? null : v]),
      );
      if (payload.id) {
        const { error } = await supabase.from("clientes").update(clean).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
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

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const obj = Object.fromEntries(fd.entries());
    const parsed = schema.safeParse(obj);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    upsert.mutate({ ...parsed.data, id: editing?.id });
  };

  return (
    <PageShell
      title="Clientes"
      description="Gerencie a base de clientes PF e PJ"
      onNew={() => {
        setEditing(null);
        setOpen(true);
      }}
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
            <TableHead className="hidden md:table-cell">Tipo</TableHead>
            <TableHead className="hidden md:table-cell">Documento</TableHead>
            <TableHead className="hidden lg:table-cell">E-mail</TableHead>
            <TableHead className="hidden sm:table-cell">Cidade/UF</TableHead>
            <TableHead className="text-right">Ações</TableHead>
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
                Nenhum cliente encontrado.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.nome}</TableCell>
              <TableCell className="hidden md:table-cell">
                <Badge variant="secondary">{c.tipo}</Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {c.documento ?? "—"}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">
                {c.email ?? "—"}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground">
                {[c.cidade, c.estado].filter(Boolean).join(" / ") || "—"}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditing(c);
                    setOpen(true);
                  }}
                >
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
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            <DialogDescription>Informações de contato e endereço</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Tipo</Label>
              <Select name="tipo" defaultValue={editing?.tipo ?? "PF"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Input id="estado" name="estado" maxLength={2} defaultValue={editing?.estado ?? ""} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea id="observacoes" name="observacoes" rows={2} defaultValue={editing?.observacoes ?? ""} />
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
