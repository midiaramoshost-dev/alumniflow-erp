import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Layers,
  Square,
  Package,
  TrendingUp,
  ShoppingCart,
  Factory,
  Building,
  Wifi,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);

function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  accent,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card className="group relative overflow-hidden border-border/70 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-brand opacity-70" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {title}
            </p>
            <p className="mt-2.5 font-display text-3xl font-bold tracking-tight text-foreground truncate">
              {value}
            </p>
            {hint && (
              <p className="mt-1.5 text-xs text-muted-foreground/90">{hint}</p>
            )}
          </div>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-border/60 transition-transform group-hover:scale-105 ${
              accent ?? "bg-primary/10 text-primary"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function useCount(table: "clientes" | "perfis_aluminio" | "vidros" | "acessorios") {
  return useQuery({
    queryKey: ["count", table],
    queryFn: async () => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

type OrcRow = { id: string; numero: number; cliente_nome: string | null; status: string; total: number; data_orcamento: string };

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const clientes = useCount("clientes");
  const perfis = useCount("perfis_aluminio");
  const vidros = useCount("vidros");
  const acessorios = useCount("acessorios");

  const orcamentos = useQuery({
    queryKey: ["orcamentos", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos" as never)
        .select("id, numero, cliente_nome, status, total, data_orcamento")
        .order("numero", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as OrcRow[];
    },
  });

  // Realtime: refetch on any change across core tables
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orcamentos" }, () => {
        qc.invalidateQueries({ queryKey: ["orcamentos", "dashboard"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, () => {
        qc.invalidateQueries({ queryKey: ["count", "clientes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "perfis_aluminio" }, () => {
        qc.invalidateQueries({ queryKey: ["count", "perfis_aluminio"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vidros" }, () => {
        qc.invalidateQueries({ queryKey: ["count", "vidros"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "acessorios" }, () => {
        qc.invalidateQueries({ queryKey: ["count", "acessorios"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
  const orcs = orcamentos.data ?? [];
  const pipelineValor = orcs
    .filter((o) => o.status === "rascunho" || o.status === "enviado")
    .reduce((s, o) => s + Number(o.total), 0);
  const fechadosValor = orcs
    .filter((o) => o.status === "aprovado" || o.status === "convertido")
    .reduce((s, o) => s + Number(o.total), 0);
  const orcamentosAtivos = orcs.filter((o) => o.status !== "rejeitado").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Olá{name ? `, ${name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral do seu ERP de esquadrias em tempo real.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5 bg-chart-2/15 text-chart-2 border-0">
          <Wifi className="h-3 w-3" />
          Atualizando ao vivo
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Orçamentos ativos"
          value={orcamentosAtivos}
          icon={ShoppingCart}
          hint="Últimos 50 registros"
        />
        <StatCard
          title="Pipeline"
          value={brl(pipelineValor)}
          icon={TrendingUp}
          hint="Rascunho + enviados"
          accent="bg-chart-3/10 text-chart-3"
        />
        <StatCard
          title="Fechados"
          value={brl(fechadosValor)}
          icon={Building}
          hint="Aprovados + convertidos"
          accent="bg-chart-2/10 text-chart-2"
        />
        <StatCard
          title="Clientes"
          value={clientes.data ?? "—"}
          icon={Users}
          hint="Total na base"
          accent="bg-primary/10 text-primary"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Perfis de alumínio"
          value={perfis.data ?? "—"}
          icon={Layers}
          hint="Itens cadastrados"
          accent="bg-chart-2/10 text-chart-2"
        />
        <StatCard
          title="Vidros"
          value={vidros.data ?? "—"}
          icon={Square}
          hint="Tipos cadastrados"
          accent="bg-chart-3/10 text-chart-3"
        />
        <StatCard
          title="Acessórios"
          value={acessorios.data ?? "—"}
          icon={Package}
          hint="SKUs no estoque"
          accent="bg-chart-4/10 text-chart-4"
        />
        <StatCard
          title="Módulos"
          value="4 ativos"
          icon={Factory}
          hint="Cadastros + Vendas"
          accent="bg-muted text-foreground"
        />
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Últimos orçamentos
          </CardTitle>
          <Link
            to="/vendas"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            Ver todos <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {orcamentos.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
          ) : orcs.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              Nenhum orçamento ainda. <Link to="/vendas" className="text-primary hover:underline">Crie o primeiro</Link>.
            </div>
          ) : (
            <div className="divide-y">
              {orcs.slice(0, 6).map((o) => (
                <div key={o.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-muted-foreground">#{o.numero}</span>
                    <span className="truncate font-medium">{o.cliente_nome ?? "Sem cliente"}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <Badge variant="secondary" className="capitalize">{o.status}</Badge>
                    <span className="font-semibold w-28 text-right">{brl(Number(o.total))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
