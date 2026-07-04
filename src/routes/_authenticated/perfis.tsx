import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfis")({
  component: PerfisPage,
});

type Perfil = {
  id: string;
  codigo: string;
  descricao: string;
  linha: string | null;
  cor: string | null;
  acabamento: string | null;
  comprimento_barra_mm: number;
  peso_kg_m: number | null;
  preco_kg: number | null;
  preco_metro: number | null;
  estoque_atual: number | null;
  estoque_minimo: number | null;
  ativo: boolean;
};

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function PerfisPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Perfil | null>(null);
  const [ativo, setAtivo] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["perfis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis_aluminio")
        .select("*")
        .order("codigo");
      if (error) throw error;
      return data as Perfil[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter((p) =>
      [p.codigo, p.descricao, p.linha, p.cor].some((v) => (v ?? "").toLowerCase().includes(s)),
    );
  }, [data, q]);

  const save = useMutation({
    mutationFn: async (payload: Partial<Perfil> & { id?: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await supabase
          .from("perfis_aluminio")
          .update(rest as never)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("perfis_aluminio").insert(rest as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perfis"] });
      qc.invalidateQueries({ queryKey: ["count", "perfis_aluminio"] });
      toast.success("Perfil salvo");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("perfis_aluminio").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perfis"] });
      qc.invalidateQueries({ queryKey: ["count", "perfis_aluminio"] });
      toast.success("Perfil removido");
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
      linha: String(fd.get("linha") ?? "") || null,
      cor: String(fd.get("cor") ?? "") || null,
      acabamento: String(fd.get("acabamento") ?? "") || null,
      comprimento_barra_mm: Number(fd.get("comprimento_barra_mm")) || 6000,
      peso_kg_m: num(fd.get("peso_kg_m")),
      preco_kg: num(fd.get("preco_kg")),
      preco_metro: num(fd.get("preco_metro")),
      estoque_atual: num(fd.get("estoque_atual")) ?? 0,
      estoque_minimo: num(fd.get("estoque_minimo")) ?? 0,
      ativo,
    });
  };

  return (
    <PageShell
      title="Perfis de Alumínio"
      description="Cadastro técnico de perfis com preço e estoque"
      newLabel="Novo perfil"
      onNew={() => {
        setEditing(null);
        setAtivo(true);
        setOpen(true);
      }}
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
            <TableHead className="hidden md:table-cell">Linha</TableHead>
            <TableHead className="hidden lg:table-cell">Cor</TableHead>
            <TableHead className="hidden sm:table-cell text-right">R$ / m</TableHead>
            <TableHead className="hidden sm:table-cell text-right">Estoque</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…</TableCell></TableRow>
          )}
          {!isLoading && filtered.length === 0 && (
            <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">Nenhum perfil cadastrado.</TableCell></TableRow>
          )}
          {filtered.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
              <TableCell className="font-medium">{p.descricao}</TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">{p.linha ?? "—"}</TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">{p.cor ?? "—"}</TableCell>
              <TableCell className="hidden sm:table-cell text-right tabular-nums">
                {p.preco_metro != null ? `R$ ${Number(p.preco_metro).toFixed(2)}` : "—"}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-right tabular-nums">
                {p.estoque_atual != null ? Number(p.estoque_atual).toFixed(2) : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={p.ativo ? "default" : "secondary"}>
                  {p.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setAtivo(p.ativo); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => confirm(`Excluir "${p.codigo}"?`) && remove.mutate(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar perfil" : "Novo perfil"}</DialogTitle></DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="codigo">Código *</Label><Input id="codigo" name="codigo" required defaultValue={editing?.codigo ?? ""} /></div>
            <div><Label htmlFor="linha">Linha</Label><Input id="linha" name="linha" defaultValue={editing?.linha ?? ""} placeholder="Ex: Suprema, Alumifit" /></div>
            <div className="sm:col-span-2"><Label htmlFor="descricao">Descrição *</Label><Input id="descricao" name="descricao" required defaultValue={editing?.descricao ?? ""} /></div>
            <div><Label htmlFor="cor">Cor</Label><Input id="cor" name="cor" defaultValue={editing?.cor ?? ""} placeholder="Branco, Preto, Bronze…" /></div>
            <div><Label htmlFor="acabamento">Acabamento</Label><Input id="acabamento" name="acabamento" defaultValue={editing?.acabamento ?? ""} placeholder="Anodizado, Pintado" /></div>
            <div><Label htmlFor="comprimento_barra_mm">Barra (mm)</Label><Input id="comprimento_barra_mm" name="comprimento_barra_mm" type="number" defaultValue={editing?.comprimento_barra_mm ?? 6000} /></div>
            <div><Label htmlFor="peso_kg_m">Peso (kg/m)</Label><Input id="peso_kg_m" name="peso_kg_m" type="number" step="0.001" defaultValue={editing?.peso_kg_m ?? ""} /></div>
            <div><Label htmlFor="preco_kg">Preço / kg (R$)</Label><Input id="preco_kg" name="preco_kg" type="number" step="0.01" defaultValue={editing?.preco_kg ?? ""} /></div>
            <div><Label htmlFor="preco_metro">Preço / m (R$)</Label><Input id="preco_metro" name="preco_metro" type="number" step="0.01" defaultValue={editing?.preco_metro ?? ""} /></div>
            <div><Label htmlFor="estoque_atual">Estoque atual</Label><Input id="estoque_atual" name="estoque_atual" type="number" step="0.01" defaultValue={editing?.estoque_atual ?? 0} /></div>
            <div><Label htmlFor="estoque_minimo">Estoque mínimo</Label><Input id="estoque_minimo" name="estoque_minimo" type="number" step="0.01" defaultValue={editing?.estoque_minimo ?? 0} /></div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
              <Label htmlFor="ativo">Ativo</Label>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
