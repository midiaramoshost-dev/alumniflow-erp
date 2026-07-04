import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Layers,
  Square,
  Package,
  TrendingUp,
  ShoppingCart,
  Factory,
  Building,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

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
    <Card className="shadow-card overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
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

function Dashboard() {
  const { user } = useAuth();
  const clientes = useCount("clientes");
  const perfis = useCount("perfis_aluminio");
  const vidros = useCount("vidros");
  const acessorios = useCount("acessorios");
  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Olá{name ? `, ${name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral do seu ERP de esquadrias em tempo real.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Clientes cadastrados"
          value={clientes.data ?? "—"}
          icon={Users}
          hint="Total na base"
        />
        <StatCard
          title="Perfis de alumínio"
          value={perfis.data ?? "—"}
          icon={Layers}
          hint="Itens ativos"
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
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Operação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: ShoppingCart, label: "Vendas", value: "Em breve" },
                { icon: Factory, label: "Produção", value: "Em breve" },
                { icon: Building, label: "Obras", value: "Em breve" },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-dashed border-border p-4 text-center"
                >
                  <m.icon className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Bem-vindo ao AluManager</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              A fundação do seu ERP está pronta com autenticação, permissões e módulo de
              cadastros.
            </p>
            <p>
              Comece cadastrando <strong className="text-foreground">Clientes</strong>,{" "}
              <strong className="text-foreground">Perfis</strong>,{" "}
              <strong className="text-foreground">Vidros</strong> e{" "}
              <strong className="text-foreground">Acessórios</strong> pela barra lateral.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
