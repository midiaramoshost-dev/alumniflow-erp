import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Search,
  Loader2,
  Ruler,
  Send,
  ShoppingBag,
  Scissors,
  Cog,
  Wrench,
  CheckCircle2,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/controle-fabril")({
  component: ControleFabrilPage,
});

type Obra = {
  id: string;
  numero: number;
  titulo: string;
  cliente_nome: string | null;
  status: string;
  data_medicao: string | null;
  data_envio_tecnico: string | null;
  data_compra_vidros: string | null;
  data_compra_acessorios: string | null;
  data_compra_perfis: string | null;
  data_corte: string | null;
  cortador_nome: string | null;
  data_usinagem: string | null;
  usinador_nome: string | null;
  data_montagem: string | null;
  montador_nome: string | null;
  data_conferencia: string | null;
  conferido_por: string | null;
};

const STAGES: {
  key: keyof Obra;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  nameKey?: keyof Obra;
  nameLabel?: string;
}[] = [
  { key: "data_medicao", label: "Medição", icon: Ruler },
  { key: "data_envio_tecnico", label: "Envio técnico", icon: Send },
  { key: "data_compra_perfis", label: "Compra perfis", icon: ShoppingBag },
  { key: "data_compra_vidros", label: "Compra vidros", icon: ShoppingBag },
  { key: "data_compra_acessorios", label: "Compra acessórios", icon: ShoppingBag },
  { key: "data_corte", label: "Corte", icon: Scissors, nameKey: "cortador_nome", nameLabel: "Cortador" },
  { key: "data_usinagem", label: "Usinagem", icon: Cog, nameKey: "usinador_nome", nameLabel: "Usinador" },
  { key: "data_montagem", label: "Montagem", icon: Wrench, nameKey: "montador_nome", nameLabel: "Montador" },
];

function ControleFabrilPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Obra | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["controle-fabril"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from("obras")
        .select(
          "id, numero, titulo, cliente_nome, status, data_medicao, data_envio_tecnico, data_compra_vidros, data_compra_acessorios, data_compra_perfis, data_corte, cortador_nome, data_usinagem, usinador_nome, data_montagem, montador_nome",
        )
        .order("numero", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Obra[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = data ?? [];
    if (!s) return base;
    return base.filter((o) =>
      [o.titulo, o.cliente_nome, String(o.numero)].some((v) => (v ?? "").toLowerCase().includes(s)),
    );
  }, [data, q]);

  const stats = useMemo(() => {
    const list = data ?? [];
    return {
      total: list.length,
      medindo: list.filter((o) => o.data_medicao && !o.data_envio_tecnico).length,
      comprando: list.filter(
        (o) =>
          o.data_envio_tecnico &&
          !(o.data_compra_vidros && o.data_compra_acessorios && o.data_compra_perfis),
      ).length,
      producao: list.filter(
        (o) => (o.data_corte || o.data_usinagem) && !o.data_montagem,
      ).length,
      concluidas: list.filter((o) => o.data_montagem).length,
    };
  }, [data]);

  const save = useMutation({
    mutationFn: async (payload: Partial<Obra> & { id: string }) => {
      const { id, ...rest } = payload;
      const clean = Object.fromEntries(
        Object.entries(rest).map(([k, v]) => [k, v === "" ? null : v]),
      );
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from("obras")
        .update(clean)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["controle-fabril"] });
      qc.invalidateQueries({ queryKey: ["obras"] });
      toast.success("Controle atualizado");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    const payload: Partial<Obra> & { id: string } = { id: editing.id };
    STAGES.forEach((s) => {
      (payload as Record<string, unknown>)[s.key as string] =
        String(fd.get(s.key as string) ?? "") || null;
      if (s.nameKey) {
        (payload as Record<string, unknown>)[s.nameKey as string] =
          String(fd.get(s.nameKey as string) ?? "").trim() || null;
      }
    });
    save.mutate(payload);
  };

  return (
    <PageShell
      title="Controle Fabril"
      description="Acompanhamento produtivo por obra: medição, compras, corte, usinagem e montagem"
      actions={
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente ou obra…"
            className="pl-8 w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        <Kpi label="Total de obras" value={String(stats.total)} icon={CheckCircle2} />
        <Kpi label="Em medição" value={String(stats.medindo)} icon={Ruler} />
        <Kpi label="Aguardando compras" value={String(stats.comprando)} icon={ShoppingBag} />
        <Kpi label="Em produção" value={String(stats.producao)} icon={Cog} />
        <Kpi label="Montadas" value={String(stats.concluidas)} icon={Wrench} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Obra / Cliente</TableHead>
            {STAGES.map((s) => (
              <TableHead key={String(s.key)} className="text-center text-xs">
                {s.label}
              </TableHead>
            ))}
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={STAGES.length + 2} className="text-center py-10">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Carregando…
              </TableCell>
            </TableRow>
          )}
          {!isLoading && filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={STAGES.length + 2}
                className="text-center py-10 text-muted-foreground text-sm"
              >
                Nenhuma obra encontrada. Aprove um orçamento para gerar automaticamente.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-medium">
                <div className="text-xs text-muted-foreground">OB-{o.numero}</div>
                <div>{o.cliente_nome ?? o.titulo}</div>
              </TableCell>
              {STAGES.map((s) => {
                const dateVal = o[s.key] as string | null;
                const nameVal = s.nameKey ? (o[s.nameKey] as string | null) : null;
                return (
                  <TableCell key={String(s.key)} className="text-center">
                    {dateVal ? (
                      <>
                        <Badge variant="default" className="text-[10px]">
                          {dateVal.slice(0, 10).split("-").reverse().join("/")}
                        </Badge>
                        {nameVal && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{nameVal}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </TableCell>
                );
              })}
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => setEditing(o)}>
                  Registrar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Controle fabril — OB-{editing?.numero} · {editing?.cliente_nome ?? editing?.titulo}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
              {STAGES.map((s) => (
                <div
                  key={String(s.key)}
                  className={s.nameKey ? "grid grid-cols-2 gap-2 sm:col-span-2" : ""}
                >
                  <div>
                    <Label htmlFor={String(s.key)} className="flex items-center gap-1.5">
                      <s.icon className="h-3.5 w-3.5" />
                      {s.label}
                    </Label>
                    <Input
                      id={String(s.key)}
                      name={String(s.key)}
                      type="date"
                      defaultValue={
                        (editing[s.key] as string | null)?.slice(0, 10) ?? ""
                      }
                    />
                  </div>
                  {s.nameKey && (
                    <div>
                      <Label htmlFor={String(s.nameKey)}>{s.nameLabel}</Label>
                      <Input
                        id={String(s.nameKey)}
                        name={String(s.nameKey)}
                        defaultValue={(editing[s.nameKey] as string | null) ?? ""}
                        placeholder="Nome do responsável"
                      />
                    </div>
                  )}
                </div>
              ))}
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
