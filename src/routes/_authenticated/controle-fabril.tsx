import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  LogIn,
  LogOut,
  Sparkles,
  Square,
  Plus,
  ListTree,
  ExternalLink,
  AlertCircle,
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
  // entrada/saída por setor
  data_corte_entrada: string | null;
  data_corte_saida: string | null;
  cortador_nome: string | null;
  data_usinagem_entrada: string | null;
  data_usinagem_saida: string | null;
  usinador_nome: string | null;
  data_montagem_entrada: string | null;
  data_montagem_saida: string | null;
  montador_nome: string | null;
  data_vidracaria_entrada: string | null;
  data_vidracaria_saida: string | null;
  vidraceiro_nome: string | null;
  data_acabamento_entrada: string | null;
  data_acabamento_saida: string | null;
  acabador_nome: string | null;
  data_conferencia_entrada: string | null;
  data_conferencia_saida: string | null;
  conferido_por: string | null;
};

type PreStage = {
  kind: "pre";
  key: keyof Obra;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type SectorStage = {
  kind: "sector";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  entradaKey: keyof Obra;
  saidaKey: keyof Obra;
  nameKey: keyof Obra;
  nameLabel: string;
};

type Stage = PreStage | SectorStage;

const PRE_STAGES: PreStage[] = [
  { kind: "pre", key: "data_medicao", label: "Medição", icon: Ruler },
  { kind: "pre", key: "data_envio_tecnico", label: "Envio técnico", icon: Send },
  { kind: "pre", key: "data_compra_perfis", label: "Compra perfis", icon: ShoppingBag },
  { kind: "pre", key: "data_compra_vidros", label: "Compra vidros", icon: ShoppingBag },
  { kind: "pre", key: "data_compra_acessorios", label: "Compra acessórios", icon: ShoppingBag },
];

const SECTOR_STAGES: SectorStage[] = [
  {
    kind: "sector",
    label: "Corte",
    icon: Scissors,
    entradaKey: "data_corte_entrada",
    saidaKey: "data_corte_saida",
    nameKey: "cortador_nome",
    nameLabel: "Cortador",
  },
  {
    kind: "sector",
    label: "Usinagem",
    icon: Cog,
    entradaKey: "data_usinagem_entrada",
    saidaKey: "data_usinagem_saida",
    nameKey: "usinador_nome",
    nameLabel: "Usinador",
  },
  {
    kind: "sector",
    label: "Montagem",
    icon: Wrench,
    entradaKey: "data_montagem_entrada",
    saidaKey: "data_montagem_saida",
    nameKey: "montador_nome",
    nameLabel: "Montador",
  },
  {
    kind: "sector",
    label: "Vidraçaria",
    icon: Square,
    entradaKey: "data_vidracaria_entrada",
    saidaKey: "data_vidracaria_saida",
    nameKey: "vidraceiro_nome",
    nameLabel: "Vidraceiro",
  },
  {
    kind: "sector",
    label: "Acabamento",
    icon: Sparkles,
    entradaKey: "data_acabamento_entrada",
    saidaKey: "data_acabamento_saida",
    nameKey: "acabador_nome",
    nameLabel: "Acabador",
  },
  {
    kind: "sector",
    label: "Conferência",
    icon: ClipboardCheck,
    entradaKey: "data_conferencia_entrada",
    saidaKey: "data_conferencia_saida",
    nameKey: "conferido_por",
    nameLabel: "Conferido por",
  },
];

const STAGES: Stage[] = [...PRE_STAGES, ...SECTOR_STAGES];

const SELECT_COLUMNS =
  "id, numero, titulo, cliente_nome, status, data_medicao, data_envio_tecnico, data_compra_vidros, data_compra_acessorios, data_compra_perfis, data_corte_entrada, data_corte_saida, cortador_nome, data_usinagem_entrada, data_usinagem_saida, usinador_nome, data_montagem_entrada, data_montagem_saida, montador_nome, data_vidracaria_entrada, data_vidracaria_saida, vidraceiro_nome, data_acabamento_entrada, data_acabamento_saida, acabador_nome, data_conferencia_entrada, data_conferencia_saida, conferido_por";

function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  return v.slice(0, 10).split("-").reverse().join("/");
}

function toDateInput(v: string | null | undefined): string {
  return v ? v.slice(0, 10) : "";
}

/**
 * Valida coerência de datas entre pré-produção e setores.
 * Retorna array de erros por rótulo/campo; vazio = ok.
 */
function validateStages(
  values: Record<string, string | null | undefined>,
): string[] {
  const errors: string[] = [];
  for (const s of SECTOR_STAGES) {
    const ent = (values[s.entradaKey as string] ?? "") as string;
    const sai = (values[s.saidaKey as string] ?? "") as string;
    const nome = ((values[s.nameKey as string] ?? "") as string).trim();
    if (sai && !ent) {
      errors.push(`${s.label}: não é possível registrar saída sem entrada.`);
    }
    if (ent && sai && sai < ent) {
      errors.push(`${s.label}: saída não pode ser anterior à entrada.`);
    }
    if ((ent || sai) && !nome) {
      errors.push(`${s.label}: informe o ${s.nameLabel.toLowerCase()}.`);
    }
  }
  return errors;
}

function stageState(
  values: Record<string, string | null | undefined>,
  s: SectorStage,
): "empty" | "in_progress" | "incomplete" | "done" {
  const ent = (values[s.entradaKey as string] ?? "") as string;
  const sai = (values[s.saidaKey as string] ?? "") as string;
  const nome = ((values[s.nameKey as string] ?? "") as string).trim();
  if (!ent && !sai && !nome) return "empty";
  if (sai && !ent) return "incomplete";
  if (ent && sai && sai < ent) return "incomplete";
  if ((ent || sai) && !nome) return "incomplete";
  if (ent && !sai) return "in_progress";
  if (ent && sai) return "done";
  return "incomplete";
}

function ControleFabrilPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Obra | null>(null);
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [createStageState, setCreateStageState] = useState<
    Record<string, string | null>
  >({});
  const [editStageState, setEditStageState] = useState<
    Record<string, string | null>
  >({});

  // Realtime: atualiza a lista quando obras são criadas/alteradas.
  useEffect(() => {
    const channel = supabase
      .channel("controle-fabril-obras")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "obras" },
        () => {
          qc.invalidateQueries({ queryKey: ["controle-fabril"] });
          qc.invalidateQueries({ queryKey: ["obras"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Reset live-validation state when dialogs open/close.
  useEffect(() => {
    if (creating) {
      setCreateStageState({});
      setFormErrors([]);
    }
  }, [creating]);
  useEffect(() => {
    if (editing) {
      const initial: Record<string, string | null> = {};
      STAGES.forEach((s) => {
        if (s.kind === "pre") {
          initial[s.key as string] = toDateInput(editing[s.key] as string | null);
        } else {
          initial[s.entradaKey as string] = toDateInput(
            editing[s.entradaKey] as string | null,
          );
          initial[s.saidaKey as string] = toDateInput(
            editing[s.saidaKey] as string | null,
          );
          initial[s.nameKey as string] =
            (editing[s.nameKey] as string | null) ?? "";
        }
      });
      setEditStageState(initial);
      setFormErrors([]);
    }
  }, [editing]);

  const { data, isLoading } = useQuery({
    queryKey: ["controle-fabril"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from("obras")
        .select(SELECT_COLUMNS)
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
      [o.titulo, o.cliente_nome, String(o.numero)].some((v) =>
        (v ?? "").toLowerCase().includes(s),
      ),
    );
  }, [data, q]);

  const stats = useMemo(() => {
    const list = data ?? [];
    const wip = (o: Obra) =>
      SECTOR_STAGES.some((s) => o[s.entradaKey] && !o[s.saidaKey]);
    return {
      total: list.length,
      medindo: list.filter((o) => o.data_medicao && !o.data_envio_tecnico).length,
      comprando: list.filter(
        (o) =>
          o.data_envio_tecnico &&
          !(o.data_compra_vidros && o.data_compra_acessorios && o.data_compra_perfis),
      ).length,
      producao: list.filter(wip).length,
      concluidas: list.filter((o) => o.data_conferencia_saida).length,
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

  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from("obras")
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["controle-fabril"] });
      qc.invalidateQueries({ queryKey: ["obras"] });
      toast.success("Nova obra criada no controle fabril");
      setCreating(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const collectStageValues = (
    fd: FormData,
  ): Record<string, string | null> => {
    const values: Record<string, string | null> = {};
    STAGES.forEach((s) => {
      if (s.kind === "pre") {
        values[s.key as string] = String(fd.get(s.key as string) ?? "") || null;
      } else {
        values[s.entradaKey as string] =
          String(fd.get(s.entradaKey as string) ?? "") || null;
        values[s.saidaKey as string] =
          String(fd.get(s.saidaKey as string) ?? "") || null;
        values[s.nameKey as string] =
          String(fd.get(s.nameKey as string) ?? "").trim() || null;
      }
    });
    return values;
  };

  const onCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const titulo = String(fd.get("titulo") ?? "").trim();
    if (!titulo) {
      setFormErrors(["Informe o título da obra."]);
      toast.error("Informe o título da obra");
      return;
    }
    const stageValues = collectStageValues(fd);
    const errors = validateStages(stageValues);
    if (errors.length) {
      setFormErrors(errors);
      toast.error(errors[0]);
      return;
    }
    setFormErrors([]);
    const payload: Record<string, unknown> = {
      titulo,
      cliente_nome: String(fd.get("cliente_nome") ?? "").trim() || null,
      data_entrega_prevista: String(fd.get("data_entrega_prevista") ?? "") || null,
      observacoes: String(fd.get("observacoes") ?? "").trim() || null,
      status: "planejamento",
      ...stageValues,
    };
    create.mutate(payload);
  };

  const quickStamp = (o: Obra, key: keyof Obra) => {
    save.mutate({ id: o.id, [key]: new Date().toISOString() } as Partial<Obra> & {
      id: string;
    });
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    const stageValues = collectStageValues(fd);
    const errors = validateStages(stageValues);
    if (errors.length) {
      setFormErrors(errors);
      toast.error(errors[0]);
      return;
    }
    setFormErrors([]);
    save.mutate({ id: editing.id, ...stageValues } as Partial<Obra> & {
      id: string;
    });
  };


  return (
    <PageShell
      title="Controle Fabril"
      description="Entrada e saída por setor: medição, compras, corte, usinagem, montagem, vidraçaria, acabamento e conferência"
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente ou obra…"
              className="pl-8 w-64"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => setMenuOpen(true)}>
            <ListTree className="h-4 w-4 mr-2" />
            Abrir controle
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Controle
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        <Kpi label="Total de obras" value={String(stats.total)} icon={CheckCircle2} />
        <Kpi label="Em medição" value={String(stats.medindo)} icon={Ruler} />
        <Kpi label="Aguardando compras" value={String(stats.comprando)} icon={ShoppingBag} />
        <Kpi label="Em produção" value={String(stats.producao)} icon={Cog} />
        <Kpi label="Conferidas" value={String(stats.concluidas)} icon={ClipboardCheck} />
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Obra / Cliente</TableHead>
              {PRE_STAGES.map((s) => (
                <TableHead key={String(s.key)} className="text-center text-xs">
                  {s.label}
                </TableHead>
              ))}
              {SECTOR_STAGES.map((s) => (
                <TableHead key={s.label} className="text-center text-xs min-w-[140px]">
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
                {PRE_STAGES.map((s) => {
                  const v = o[s.key] as string | null;
                  return (
                    <TableCell key={String(s.key)} className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <StatusDot state={v ? "done" : "empty"} />
                        {v ? (
                          <Badge variant="default" className="text-[10px]">
                            {fmtDate(v)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
                {SECTOR_STAGES.map((s) => {
                  const ent = o[s.entradaKey] as string | null;
                  const sai = o[s.saidaKey] as string | null;
                  const name = o[s.nameKey] as string | null;
                  const inProgress = ent && !sai;
                  const cellState: "empty" | "in_progress" | "done" = sai
                    ? "done"
                    : ent
                      ? "in_progress"
                      : "empty";
                  return (
                    <TableCell key={s.label} className="text-center align-top">
                      <div className="flex flex-col gap-1 items-center">
                        <StatusDot state={cellState} />
                        <div className="flex flex-col items-center gap-0.5 text-[10px]">
                          <div className="flex items-center gap-1">
                            <LogIn className="h-2.5 w-2.5 text-blue-600" />
                            {ent ? (
                              <span className="font-medium">{fmtDate(ent)}</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => quickStamp(o, s.entradaKey)}
                                className="text-muted-foreground hover:text-primary underline decoration-dotted"
                              >
                                marcar
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <LogOut className="h-2.5 w-2.5 text-green-600" />
                            {sai ? (
                              <span className="font-medium">{fmtDate(sai)}</span>
                            ) : ent ? (
                              <button
                                type="button"
                                onClick={() => quickStamp(o, s.saidaKey)}
                                className="text-muted-foreground hover:text-primary underline decoration-dotted"
                              >
                                marcar
                              </button>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </div>
                        </div>
                        {inProgress && (
                          <Badge variant="secondary" className="text-[9px] py-0 px-1">
                            em curso
                          </Badge>
                        )}
                        {name && (
                          <div className="text-[9px] text-muted-foreground truncate max-w-[120px]">
                            {name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" asChild>
                      <Link
                        to="/controle-fabril/$obraId"
                        params={{ obraId: o.id }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(o)}>
                      Editar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo controle fabril</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={onCreate}
            onChange={(e) =>
              setCreateStageState(collectStageValues(new FormData(e.currentTarget)))
            }
            className="space-y-6"
          >
            {formErrors.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <AlertCircle className="h-4 w-4" />
                  Corrija antes de salvar
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-xs">
                  {formErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <section>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Dados da obra
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="titulo">Título da obra *</Label>
                  <Input id="titulo" name="titulo" placeholder="Ex.: Fachada Edifício X" required />
                </div>
                <div>
                  <Label htmlFor="cliente_nome">Cliente</Label>
                  <Input id="cliente_nome" name="cliente_nome" placeholder="Nome do cliente" />
                </div>
                <div>
                  <Label htmlFor="data_entrega_prevista">Entrega prevista</Label>
                  <Input id="data_entrega_prevista" name="data_entrega_prevista" type="date" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Input id="observacoes" name="observacoes" placeholder="Notas iniciais" />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Pré-produção
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PRE_STAGES.map((s) => (
                  <div key={String(s.key)}>
                    <Label htmlFor={`new-${String(s.key)}`} className="flex items-center gap-1.5 text-xs">
                      <s.icon className="h-3.5 w-3.5" />
                      {s.label}
                    </Label>
                    <Input id={`new-${String(s.key)}`} name={String(s.key)} type="date" />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Setores produtivos
              </h3>
              <div className="grid gap-4">
                {SECTOR_STAGES.map((s) => {
                  const state = stageState(createStageState, s);
                  return (
                    <div
                      key={s.label}
                      className={`rounded-md border p-3 grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr_auto] ${
                        state === "incomplete" ? "border-destructive/50 bg-destructive/5" : ""
                      }`}
                    >
                      <div>
                        <Label
                          htmlFor={`new-${String(s.entradaKey)}`}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <s.icon className="h-3.5 w-3.5" />
                          {s.label} — Entrada
                        </Label>
                        <Input
                          id={`new-${String(s.entradaKey)}`}
                          name={String(s.entradaKey)}
                          type="date"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor={`new-${String(s.saidaKey)}`}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          {s.label} — Saída
                        </Label>
                        <Input
                          id={`new-${String(s.saidaKey)}`}
                          name={String(s.saidaKey)}
                          type="date"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`new-${String(s.nameKey)}`} className="text-xs">
                          {s.nameLabel}
                        </Label>
                        <Input
                          id={`new-${String(s.nameKey)}`}
                          name={String(s.nameKey)}
                          placeholder="Nome do responsável"
                        />
                      </div>
                      <div className="flex items-end justify-end pb-1">
                        <StageBadge state={state} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>


            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>

        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Controle fabril — OB-{editing?.numero} · {editing?.cliente_nome ?? editing?.titulo}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={onSubmit}
              onChange={(e) =>
                setEditStageState(collectStageValues(new FormData(e.currentTarget)))
              }
              className="space-y-6"
            >
              {formErrors.length > 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <AlertCircle className="h-4 w-4" />
                    Corrija antes de salvar
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-xs">
                    {formErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
              <section>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                  Pré-produção
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {PRE_STAGES.map((s) => (
                    <div key={String(s.key)}>
                      <Label htmlFor={String(s.key)} className="flex items-center gap-1.5 text-xs">
                        <s.icon className="h-3.5 w-3.5" />
                        {s.label}
                      </Label>
                      <Input
                        id={String(s.key)}
                        name={String(s.key)}
                        type="date"
                        defaultValue={toDateInput(editing[s.key] as string | null)}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                  Setores produtivos
                </h3>
                <div className="grid gap-4">
                  {SECTOR_STAGES.map((s) => {
                    const state = stageState(editStageState, s);
                    return (
                      <div
                        key={s.label}
                        className={`rounded-md border p-3 grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr_auto] ${
                          state === "incomplete" ? "border-destructive/50 bg-destructive/5" : ""
                        }`}
                      >
                        <div>
                          <Label
                            htmlFor={String(s.entradaKey)}
                            className="flex items-center gap-1.5 text-xs"
                          >
                            <s.icon className="h-3.5 w-3.5" />
                            {s.label} — Entrada
                          </Label>
                          <Input
                            id={String(s.entradaKey)}
                            name={String(s.entradaKey)}
                            type="date"
                            defaultValue={toDateInput(editing[s.entradaKey] as string | null)}
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor={String(s.saidaKey)}
                            className="flex items-center gap-1.5 text-xs"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            {s.label} — Saída
                          </Label>
                          <Input
                            id={String(s.saidaKey)}
                            name={String(s.saidaKey)}
                            type="date"
                            defaultValue={toDateInput(editing[s.saidaKey] as string | null)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={String(s.nameKey)} className="text-xs">
                            {s.nameLabel}
                          </Label>
                          <Input
                            id={String(s.nameKey)}
                            name={String(s.nameKey)}
                            defaultValue={(editing[s.nameKey] as string | null) ?? ""}
                            placeholder="Nome do responsável"
                          />
                        </div>
                        <div className="flex items-end justify-end pb-1">
                          <StageBadge state={state} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>


              <DialogFooter>
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
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>Controles cadastrados</SheetTitle>
            <SheetDescription>
              Selecione uma obra para abrir os detalhes de entrada/saída.
            </SheetDescription>
          </SheetHeader>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, cliente ou obra…"
              className="pl-8"
              value={menuQuery}
              onChange={(e) => setMenuQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto mt-4 -mx-6 px-6 space-y-1">
            {(() => {
              const s = menuQuery.trim().toLowerCase();
              const list = (data ?? []).filter((o) =>
                !s
                  ? true
                  : [o.titulo, o.cliente_nome, String(o.numero)].some((v) =>
                      (v ?? "").toLowerCase().includes(s),
                    ),
              );
              if (list.length === 0) {
                return (
                  <div className="text-center text-xs text-muted-foreground py-8">
                    Nenhum controle encontrado.
                  </div>
                );
              }
              return list.map((o) => {
                const done = !!o.data_conferencia_saida;
                const wip = SECTOR_STAGES.some(
                  (st) => o[st.entradaKey] && !o[st.saidaKey],
                );
                return (
                  <Link
                    key={o.id}
                    to="/controle-fabril/$obraId"
                    params={{ obraId: o.id }}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] text-muted-foreground">
                        OB-{o.numero}
                      </div>
                      <div className="text-sm font-medium truncate">
                        {o.cliente_nome ?? o.titulo}
                      </div>
                      {o.cliente_nome && (
                        <div className="text-xs text-muted-foreground truncate">
                          {o.titulo}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {done ? (
                        <Badge variant="default" className="text-[10px]">
                          Concluído
                        </Badge>
                      ) : wip ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Em curso
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          {o.status}
                        </Badge>
                      )}
                    </div>
                  </Link>
                );
              });
            })()}
          </div>
        </SheetContent>
      </Sheet>
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

const STATUS_LABEL: Record<
  "empty" | "in_progress" | "incomplete" | "done",
  string
> = {
  empty: "Pendente — etapa ainda não iniciada",
  in_progress: "Em curso — entrada registrada, aguardando saída",
  incomplete: "Incompleto — dados faltando ou inconsistentes",
  done: "Concluído — etapa finalizada",
};

export function StatusDot({
  state,
  className = "",
  onClick,
  title,
}: {
  state: "empty" | "in_progress" | "incomplete" | "done";
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  const base = "inline-block h-2 w-2 rounded-full shrink-0";
  const tip = title ?? STATUS_LABEL[state];
  const clickableCls = onClick ? "cursor-pointer hover:scale-125 transition-transform" : "";
  const content =
    state === "done" ? (
      <span
        aria-label={tip}
        title={tip}
        onClick={onClick}
        className={`${base} bg-green-500 shadow-[0_0_0_2px_rgba(34,197,94,0.2)] ${clickableCls} ${className}`}
      />
    ) : state === "in_progress" ? (
      <span
        aria-label={tip}
        title={tip}
        onClick={onClick}
        className={`relative ${base} ${clickableCls} ${className}`}
      >
        <span className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-75" />
        <span className="relative block h-2 w-2 rounded-full bg-amber-500" />
      </span>
    ) : (
      <span
        aria-label={tip}
        title={tip}
        onClick={onClick}
        className={`relative ${base} ${clickableCls} ${className}`}
      >
        <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
        <span className="relative block h-2 w-2 rounded-full bg-red-500" />
      </span>
    );
  return content;
}

export function StageLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground mb-4">
      <span className="font-medium text-foreground">Legenda:</span>
      <span className="flex items-center gap-1.5">
        <StatusDot state="empty" />
        Pendente
      </span>
      <span className="flex items-center gap-1.5">
        <StatusDot state="in_progress" />
        Em curso (entrada registrada)
      </span>
      <span className="flex items-center gap-1.5">
        <StatusDot state="incomplete" />
        Incompleto (saída sem entrada, datas inválidas, responsável faltando)
      </span>
      <span className="flex items-center gap-1.5">
        <StatusDot state="done" />
        Concluído
      </span>
      <span className="ml-auto italic">
        Clique na bolinha para marcar a etapa como concluída e avançar
      </span>
    </div>
  );
}

function StageBadge({
  state,
}: {
  state: "empty" | "in_progress" | "incomplete" | "done";
}) {
  if (state === "done") {
    return (
      <Badge variant="default" className="text-[10px] gap-1">
        <StatusDot state="done" />
        <CheckCircle2 className="h-3 w-3" />
        Concluído
      </Badge>
    );
  }
  if (state === "in_progress") {
    return (
      <Badge variant="secondary" className="text-[10px] gap-1">
        <StatusDot state="in_progress" />
        Em curso
      </Badge>
    );
  }
  if (state === "incomplete") {
    return (
      <Badge variant="destructive" className="text-[10px] gap-1">
        <StatusDot state="incomplete" className="bg-white" />
        <AlertCircle className="h-3 w-3" />
        Incompleto
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1">
      <StatusDot state="empty" />
      Pendente
    </Badge>
  );
}
