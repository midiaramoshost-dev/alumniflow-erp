import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShoppingCart, Factory, Building, Wifi, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pipeline")({
  component: PipelinePage,
});

type Row = {
  orc_id: string;
  orc_numero: number;
  cliente_nome: string | null;
  orc_status: string;
  orc_total: number;
  op_id: string | null;
  op_numero: number | null;
  op_etapa: string | null;
  op_progresso: number | null;
  obra_id: string | null;
  obra_numero: number | null;
  obra_status: string | null;
  obra_progresso: number | null;
};

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);

const statusColor = (s: string | null | undefined) => {
  if (!s) return "bg-muted text-muted-foreground";
  if (["aprovado", "convertido", "entregue", "concluida", "finalizado"].includes(s))
    return "bg-chart-2/15 text-chart-2 border-0";
  if (["rejeitado", "cancelada"].includes(s)) return "bg-destructive/15 text-destructive border-0";
  if (["rascunho", "aguardando", "planejamento"].includes(s))
    return "bg-muted text-muted-foreground border-0";
  return "bg-chart-3/15 text-chart-3 border-0";
};

function PipelinePage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline"],
    queryFn: async (): Promise<Row[]> => {
      const { data: orcs, error } = await supabase
        .from("orcamentos")
        .select("id, numero, cliente_nome, status, total")
        .order("numero", { ascending: false })
        .limit(100);
      if (error) throw error;

      const ids = (orcs ?? []).map((o) => o.id);
      const [{ data: ops }, { data: obras }] = await Promise.all([
        supabase
          .from("ordens_producao")
          .select("id, numero, etapa, progresso, orcamento_id")
          .in("orcamento_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        supabase
          .from("obras")
          .select("id, numero, status, progresso, orcamento_id")
          .in("orcamento_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      ]);

      const opByOrc = new Map((ops ?? []).map((o) => [o.orcamento_id, o]));
      const obraByOrc = new Map((obras ?? []).map((o) => [o.orcamento_id, o]));

      return (orcs ?? []).map((o) => {
        const op = opByOrc.get(o.id);
        const obra = obraByOrc.get(o.id);
        return {
          orc_id: o.id,
          orc_numero: o.numero,
          cliente_nome: o.cliente_nome,
          orc_status: o.status,
          orc_total: Number(o.total),
          op_id: op?.id ?? null,
          op_numero: op?.numero ?? null,
          op_etapa: op?.etapa ?? null,
          op_progresso: op?.progresso ?? null,
          obra_id: obra?.id ?? null,
          obra_numero: obra?.numero ?? null,
          obra_status: obra?.status ?? null,
          obra_progresso: obra?.progresso ?? null,
        };
      });
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("pipeline-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orcamentos" }, () =>
        qc.invalidateQueries({ queryKey: ["pipeline"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "ordens_producao" }, () =>
        qc.invalidateQueries({ queryKey: ["pipeline"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "obras" }, () =>
        qc.invalidateQueries({ queryKey: ["pipeline"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const rows = data ?? [];
  const totalAprovados = rows.filter((r) =>
    ["aprovado", "convertido"].includes(r.orc_status),
  ).length;
  const emProducao = rows.filter(
    (r) => r.op_etapa && !["finalizado", "entregue", "cancelada"].includes(r.op_etapa),
  ).length;
  const obrasAtivas = rows.filter(
    (r) => r.obra_status && !["concluida", "cancelada"].includes(r.obra_status),
  ).length;

  return (
    <PageShell
      title="Pipeline de Entrega"
      description="Visão unificada de Vendas → Produção → Obras em tempo real"
      actions={
        <Badge variant="secondary" className="gap-1.5 bg-chart-2/15 text-chart-2 border-0">
          <Wifi className="h-3 w-3" /> Ao vivo
        </Badge>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Orçamentos aprovados</p>
              <p className="text-2xl font-bold">{totalAprovados}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-chart-3/10 text-chart-3 grid place-items-center">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Em produção</p>
              <p className="text-2xl font-bold">{emProducao}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-chart-2/10 text-chart-2 grid place-items-center">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Obras ativas</p>
              <p className="text-2xl font-bold">{obrasAtivas}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Fluxo por orçamento</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              Nenhum orçamento ainda. Aprove um orçamento em{" "}
              <Link to="/vendas" className="text-primary hover:underline">
                Vendas
              </Link>{" "}
              para iniciar o pipeline.
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div
                  key={r.orc_id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 md:gap-2 items-center px-4 md:px-6 py-4 hover:bg-muted/30 transition-colors"
                >
                  {/* Orçamento */}
                  <Link to="/vendas" className="min-w-0 group">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ShoppingCart className="h-3 w-3" /> Orçamento
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-sm font-semibold">#{r.orc_numero}</span>
                      <span className="truncate font-medium group-hover:text-primary">
                        {r.cliente_nome ?? "Sem cliente"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`capitalize ${statusColor(r.orc_status)}`}>
                        {r.orc_status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {brl(r.orc_total)}
                      </span>
                    </div>
                  </Link>

                  <ArrowRight className="hidden md:block h-4 w-4 text-muted-foreground/50" />

                  {/* Produção */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Factory className="h-3 w-3" /> Produção
                    </div>
                    {r.op_id ? (
                      <Link to="/producao" className="block group">
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-sm font-semibold">
                            OP #{r.op_numero}
                          </span>
                          <Badge className={`capitalize ${statusColor(r.op_etapa)}`}>
                            {r.op_etapa}
                          </Badge>
                        </div>
                        <Progress value={r.op_progresso ?? 0} className="h-1.5 mt-2" />
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">— aguardando aprovação</p>
                    )}
                  </div>

                  <ArrowRight className="hidden md:block h-4 w-4 text-muted-foreground/50" />

                  {/* Obra */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building className="h-3 w-3" /> Obra
                    </div>
                    {r.obra_id ? (
                      <Link to="/obras" className="block group">
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-sm font-semibold">
                            #{r.obra_numero}
                          </span>
                          <Badge className={`capitalize ${statusColor(r.obra_status)}`}>
                            {r.obra_status?.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <Progress value={r.obra_progresso ?? 0} className="h-1.5 mt-2" />
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">— aguardando aprovação</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
