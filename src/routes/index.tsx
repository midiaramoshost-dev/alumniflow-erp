import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ShieldCheck,
  Factory,
  BarChart3,
  Layers,
  Users,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-primary shadow-elegant">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">CRM CRISTIANO</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-[0.06]" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              ERP especializado em esquadrias de alumínio
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
              Do orçamento à obra entregue,{" "}
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                em uma única plataforma.
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Controle vendas, produção, PCP, estoque de perfis e vidros, obras e financeiro.
              Feito para fábricas de esquadrias de alumínio que querem crescer com eficiência.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="shadow-elegant">
                <Link to="/auth">
                  Começar agora <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Já tenho conta</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Users, title: "Clientes & Vendas", desc: "CRM, orçamentos e pedidos integrados." },
            { icon: Layers, title: "Cadastros técnicos", desc: "Perfis, vidros e acessórios com estoque." },
            { icon: Factory, title: "Produção & PCP", desc: "Ordens, corte otimizado e montagem." },
            { icon: Building2, title: "Obras & Instalação", desc: "Acompanhe até a entrega final." },
            { icon: BarChart3, title: "Dashboard em tempo real", desc: "KPIs de vendas, produção e financeiro." },
            { icon: ShieldCheck, title: "Permissões seguras", desc: "Papéis: Admin, Vendedor, PCP, Financeiro." },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-border bg-card p-6 shadow-card transition-all hover:shadow-elegant hover:-translate-y-0.5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} CRM CRISTIANO · ERP para esquadrias de alumínio
      </footer>
    </div>
  );
}
