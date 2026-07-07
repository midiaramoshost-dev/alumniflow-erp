import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/acessorios")({
  component: AcessoriosPage,
});

type Item = {
  id: string;
  codigo: string;
  descricao: string;
  categoria: string | null;
  unidade: string;
  preco_unitario: number | null;
  estoque_atual: number | null;
  estoque_minimo: number | null;
  ativo: boolean;
};

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function AcessoriosPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [ativo, setAtivo] = useState(true);
  const [categoria, setCategoria] = useState<string>("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");

  const CATEGORIAS = [
    "Puxadores",
    "Roldanas",
    "Borrachas",
    "Parafusos",
    "Ferragens",
  ] as const;

  const { data, isLoading } = useQuery({
    queryKey: ["acessorios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("acessorios").select("*").order("codigo");
      if (error) throw error;
      return data as Item[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter((v) => [v.codigo, v.descricao, v.categoria].some((x) => (x ?? "").toLowerCase().includes(s)));
  }, [data, q]);

  const save = useMutation({
    mutationFn: async (payload: Partial<Item> & { id?: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await supabase.from("acessorios").update(rest as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("acessorios").insert(rest as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acessorios"] });
      qc.invalidateQueries({ queryKey: ["count", "acessorios"] });
      toast.success("Acessório salvo");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("acessorios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acessorios"] });
      qc.invalidateQueries({ queryKey: ["count", "acessorios"] });
      toast.success("Acessório removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const codigo = String(fd.get("codigo") ?? "").trim();
    const descricao = String(fd.get("descricao") ?? "").trim();
    if (!codigo || !descricao) return toast.error("Código e descrição são obrigatórios");
    save.mutate({
      id: editing?.id,
      codigo,
      descricao,
      categoria: String(fd.get("categoria") ?? "") || null,
      unidade: String(fd.get("unidade") ?? "UN") || "UN",
      preco_unitario: num(fd.get("preco_unitario")),
      estoque_atual: num(fd.get("estoque_atual")) ?? 0,
      estoque_minimo: num(fd.get("estoque_minimo")) ?? 0,
      ativo,
    });
  };

  return (
    <PageShell
      title="Acessórios"
      description="Puxadores, roldanas, borrachas, parafusos, ferragens"
      newLabel="Novo acessório"
      onNew={() => { setEditing(null); setAtivo(true); setOpen(true); }}
      actions={
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar…" className="pl-8 w-56" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="hidden md:table-cell">Categoria</TableHead>
            <TableHead className="hidden md:table-cell">Un</TableHead>
            <TableHead className="hidden sm:table-cell text-right">Preço</TableHead>
            <TableHead className="hidden sm:table-cell text-right">Estoque</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…</TableCell></TableRow>}
          {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">Nenhum acessório cadastrado.</TableCell></TableRow>}
          {filtered.map((v) => {
            const low =
              v.estoque_atual != null &&
              v.estoque_minimo != null &&
              Number(v.estoque_atual) < Number(v.estoque_minimo);
            return (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-xs">{v.codigo}</TableCell>
                <TableCell className="font-medium">{v.descricao}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{v.categoria ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{v.unidade}</TableCell>
                <TableCell className="hidden sm:table-cell text-right tabular-nums">{v.preco_unitario != null ? `R$ ${Number(v.preco_unitario).toFixed(2)}` : "—"}</TableCell>
                <TableCell className="hidden sm:table-cell text-right tabular-nums">
                  <span className={low ? "text-destructive font-semibold" : ""}>
                    {v.estoque_atual != null ? Number(v.estoque_atual).toFixed(2) : "—"}
                  </span>
                </TableCell>
                <TableCell><Badge variant={v.ativo ? "default" : "secondary"}>{v.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(v); setAtivo(v.ativo); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => confirm(`Excluir "${v.codigo}"?`) && remove.mutate(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar acessório" : "Novo acessório"}</DialogTitle></DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="codigo">Código *</Label><Input id="codigo" name="codigo" required defaultValue={editing?.codigo ?? ""} /></div>
            <div><Label htmlFor="categoria">Categoria</Label><Input id="categoria" name="categoria" defaultValue={editing?.categoria ?? ""} placeholder="Ferragem, Vedação…" /></div>
            <div className="sm:col-span-2"><Label htmlFor="descricao">Descrição *</Label><Input id="descricao" name="descricao" required defaultValue={editing?.descricao ?? ""} /></div>
            <div><Label htmlFor="unidade">Unidade</Label><Input id="unidade" name="unidade" defaultValue={editing?.unidade ?? "UN"} placeholder="UN, MT, KG…" /></div>
            <div><Label htmlFor="preco_unitario">Preço unitário (R$)</Label><Input id="preco_unitario" name="preco_unitario" type="number" step="0.01" defaultValue={editing?.preco_unitario ?? ""} /></div>
            <div><Label htmlFor="estoque_atual">Estoque atual</Label><Input id="estoque_atual" name="estoque_atual" type="number" step="0.01" defaultValue={editing?.estoque_atual ?? 0} /></div>
            <div><Label htmlFor="estoque_minimo">Estoque mínimo</Label><Input id="estoque_minimo" name="estoque_minimo" type="number" step="0.01" defaultValue={editing?.estoque_minimo ?? 0} /></div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
              <Label htmlFor="ativo">Ativo</Label>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
