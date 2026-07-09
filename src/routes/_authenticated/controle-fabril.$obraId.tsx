import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Ruler,
  Send,
  ShoppingBag,
  Scissors,
  Cog,
  Wrench,
  Sparkles,
  Square,
  ClipboardCheck,
  LogIn,
  LogOut,
  ArrowLeft,
  Pencil,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/controle-fabril/$obraId")({
  component: ControleFabrilDetalhePage,
});

type Obra = {
  id: string;
  numero: number;
  titulo: string;
  cliente_nome: string | null;
  status: string;
  progresso: number;
  valor: number | null;
  data_entrega_prevista: string | null;
  data_entrega_real: string | null;
  observacoes: string | null;
  data_medicao: string | null;
  data_envio_tecnico: string | null;
  data_compra_vidros: string | null;
  data_compra_acessorios: string | null;
  data_compra_perfis: string | null;
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

const PRE_STAGES = [
  { key: "data_medicao", label: "Medição", icon: Ruler },
  { key: "data_envio_tecnico", label: "Envio técnico", icon: Send },
  { key: "data_compra_perfis", label: "Compra perfis", icon: ShoppingBag },
  { key: "data_compra_vidros", label: "Compra vidros", icon: ShoppingBag },
  { key: "data_compra_acessorios", label: "Compra acessórios", icon: ShoppingBag },
] as const;

const SECTOR_STAGES = [
  {
    label: "Corte",
    icon: Scissors,
    entradaKey: "data_corte_entrada",
    saidaKey: "data_corte_saida",
    nameKey: "cortador_nome",
    nameLabel: "Cortador",
  },
  {
    label: "Usinagem",
    icon: Cog,
    entradaKey: "data_usinagem_entrada",
    saidaKey: "data_usinagem_saida",
    nameKey: "usinador_nome",
    nameLabel: "Usinador",
  },
  {
    label: "Montagem",
    icon: Wrench,
    entradaKey: "data_montagem_entrada",
    saidaKey: "data_montagem_saida",
    nameKey: "montador_nome",
    nameLabel: "Montador",
  },
  {
    label: "Vidraçaria",
    icon: Square,
    entradaKey: "data_vidracaria_entrada",
    saidaKey: "data_vidracaria_saida",
    nameKey: "vidraceiro_nome",
    nameLabel: "Vidraceiro",
  },
  {
    label: "Acabamento",
    icon: Sparkles,
    entradaKey: "data_acabamento_entrada",
    saidaKey: "data_acabamento_saida",
    nameKey: "acabador_nome",
    nameLabel: "Acabador",
  },
  {
    label: "Conferência",
    icon: ClipboardCheck,
    entradaKey: "data_conferencia_entrada",
    saidaKey: "data_conferencia_saida",
    nameKey: "conferido_por",
    nameLabel: "Conferido por",
  },
] as const;

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  return v.slice(0, 10).split("-").reverse().join("/");
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ControleFabrilDetalhePage() {
  const { obraId } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["controle-fabril", obraId],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from("obras")
        .select("*")
        .eq("id", obraId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data as Obra;
    },
  });

  if (isLoading) {
    return (
      <PageShell title="Controle Fabril" description="Carregando...">
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando obra…
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell title="Controle Fabril" description="Obra não encontrada">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Obra não encontrada.
            <div className="mt-4">
              <Button asChild variant="outline">
                <Link to="/controle-fabril">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const o = data;
  const setoresConcluidos = SECTOR_STAGES.filter(
    (s) => o[s.saidaKey as keyof Obra],
  ).length;

  return (
    <PageShell
      title={`OB-${o.numero} · ${o.cliente_nome ?? o.titulo}`}
      description={o.titulo}
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/controle-fabril">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
          <Button asChild>
            <Link to="/controle-fabril" search={{ edit: o.id } as never}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className="text-sm capitalize">
              {o.status.replace(/_/g, " ")}
            </Badge>
            <div className="mt-3 text-xs text-muted-foreground">Progresso</div>
            <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${o.progresso ?? 0}%` }}
              />
            </div>
            <div className="mt-1 text-xs font-medium">{o.progresso ?? 0}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Entrega</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">Prevista:</span>{" "}
              <span className="font-medium">{fmtDate(o.data_entrega_prevista)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Realizada:</span>{" "}
              <span className="font-medium">{fmtDate(o.data_entrega_real)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Valor:</span>{" "}
              <span className="font-medium">{fmtMoney(o.valor)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Setores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {setoresConcluidos}
              <span className="text-base text-muted-foreground">
                {" "}
                / {SECTOR_STAGES.length}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              setores concluídos
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Pré-produção</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PRE_STAGES.map((s) => {
              const v = o[s.key as keyof Obra] as string | null;
              const Icon = s.icon;
              return (
                <div
                  key={s.key}
                  className="rounded-md border p-3 flex flex-col gap-1"
                >
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {s.label}
                  </div>
                  {v ? (
                    <Badge variant="default" className="w-fit text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {fmtDate(v)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">
                      Pendente
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Setores produtivos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {SECTOR_STAGES.map((s) => {
              const ent = o[s.entradaKey as keyof Obra] as string | null;
              const sai = o[s.saidaKey as keyof Obra] as string | null;
              const name = o[s.nameKey as keyof Obra] as string | null;
              const Icon = s.icon;
              const inProgress = ent && !sai;
              const done = !!sai;
              return (
                <div
                  key={s.label}
                  className="rounded-md border p-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] items-center"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{s.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {name ?? `${s.nameLabel} não atribuído`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <LogIn className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-muted-foreground text-xs">Entrada:</span>
                    <span className="font-medium">{fmtDate(ent)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <LogOut className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-muted-foreground text-xs">Saída:</span>
                    <span className="font-medium">{fmtDate(sai)}</span>
                  </div>
                  <div className="text-right">
                    {done ? (
                      <Badge variant="default" className="text-[10px]">
                        Concluído
                      </Badge>
                    ) : inProgress ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Em curso
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Pendente
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {o.observacoes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {o.observacoes}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
