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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vidros")({
  component: VidrosPage,
});

type Vidro = {
  id: string;
  codigo: string;
  descricao: string;
  tipo: string | null;
  espessura_mm: number | null;
  cor: string | null;
  fornecedor: string | null;
  preco_m2: number | null;
  estoque_m2: number | null;
  ativo: boolean;
};

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function VidrosPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vidro | null>(null);
  const [ativo, setAtivo] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["vidros"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vidros").select("*").order("codigo");
      if (error) throw error;
      return data as Vidro[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter((v) => [v.codigo, v.descricao, v.tipo, v.cor, v.fornecedor].some((x) => (x ?? "").toLowerCase().includes(s)));
  }, [data, q]);

  const save = useMutation({
    mutationFn: async (payload: Partial<Vidro> & { id?: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await supabase.from("vidros").update(rest as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vidros").insert(rest as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vidros"] });
      qc.invalidateQueries({ queryKey: ["count", "vidros"] });
      toast.success("Vidro salvo");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vidros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vidros"] });
      qc.invalidateQueries({ queryKey: ["count", "vidros"] });
      toast.success("Vidro removido");
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
      tipo: String(fd.get("tipo") ?? "") || null,
      espessura_mm: num(fd.get("espessura_mm")),
      cor: String(fd.get("cor") ?? "") || null,
      preco_m2: num(fd.get("preco_m2")),
      estoque_m2: num(fd.get("estoque_m2")) ?? 0,
      ativo,
    });
  };

  return (
    <PageShell
      title="Vidros"
      description="Cadastro de vidros por tipo, espessura e cor"
      newLabel="Novo vidro"
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
            <TableHead className="hidden md:table-cell">Tipo</TableHead>
            <TableHead className="hidden md:table-cell">Espessura</TableHead>
            <TableHead className="hidden lg:table-cell">Cor</TableHead>
            <TableHead className="hidden sm:table-cell text-right">R$ / m²</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…</TableCell></TableRow>}
          {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">Nenhum vidro cadastrado.</TableCell></TableRow>}
          {filtered.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="font-mono text-xs">{v.codigo}</TableCell>
              <TableCell className="font-medium">{v.descricao}</TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">{v.tipo ?? "—"}</TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">{v.espessura_mm ? `${v.espessura_mm} mm` : "—"}</TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">{v.cor ?? "—"}</TableCell>
              <TableCell className="hidden sm:table-cell text-right tabular-nums">{v.preco_m2 != null ? `R$ ${Number(v.preco_m2).toFixed(2)}` : "—"}</TableCell>
              <TableCell><Badge variant={v.ativo ? "default" : "secondary"}>{v.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => { setEditing(v); setAtivo(v.ativo); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => confirm(`Excluir "${v.codigo}"?`) && remove.mutate(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar vidro" : "Novo vidro"}</DialogTitle></DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="codigo">Código *</Label><Input id="codigo" name="codigo" required defaultValue={editing?.codigo ?? ""} /></div>
            <div><Label htmlFor="tipo">Tipo</Label><Input id="tipo" name="tipo" defaultValue={editing?.tipo ?? ""} placeholder="Temperado, Laminado…" /></div>
            <div className="sm:col-span-2"><Label htmlFor="descricao">Descrição *</Label><Input id="descricao" name="descricao" required defaultValue={editing?.descricao ?? ""} /></div>
            <div><Label htmlFor="espessura_mm">Espessura (mm)</Label><Input id="espessura_mm" name="espessura_mm" type="number" step="0.1" defaultValue={editing?.espessura_mm ?? ""} /></div>
            <div><Label htmlFor="cor">Cor</Label><Input id="cor" name="cor" defaultValue={editing?.cor ?? ""} placeholder="Incolor, Fumê, Verde…" /></div>
            <div><Label htmlFor="preco_m2">Preço / m² (R$)</Label><Input id="preco_m2" name="preco_m2" type="number" step="0.01" defaultValue={editing?.preco_m2 ?? ""} /></div>
            <div><Label htmlFor="estoque_m2">Estoque (m²)</Label><Input id="estoque_m2" name="estoque_m2" type="number" step="0.01" defaultValue={editing?.estoque_m2 ?? 0} /></div>
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
