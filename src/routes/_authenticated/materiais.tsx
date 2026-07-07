import { useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertTriangle,
  Layers,
  Square,
  Wifi,
  TrendingDown,
  PackageCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/materiais")({
  component: MateriaisPage,
});

type Perfil = {
  id: string;
  codigo: string;
  descricao: string;
  estoque_atual: number | null;
  estoque_minimo: number | null;
  comprimento_barra_mm: number;
};
type Vidro = {
  id: string;
  codigo: string;
  descricao: string;
  estoque_m2: number | null;
  espessura_mm: number | null;
};
type Item = {
  perfil_id: string | null;
  vidro_id: string | null;
  altura_mm: number | null;
  largura_mm: number | null;
  quantidade: number;
  orcamento_id: string;
};
type Orc = { id: string; numero: number; status: string };
type ObraMat = {
  obra_id: string;
  descricao: string;
  unidade: string | null;
  quantidade_prevista: number;
  quantidade_utilizada: number;
};

const COMMITTED = new Set(["aprovado", "convertido"]);
const PIPELINE = new Set(["enviado"]);

type Forecast = {
  id: string;
  codigo: string;
  descricao: string;
  estoque: number;
  minimo: number;
  committed: number;
  pipeline: number;
  unidade: string;
};

function computeForecast(
  itens: Item[],
  orcs: Map<string, Orc>,
  kind: "perfil" | "vidro",
  catalog: Map<string, Perfil | Vidro>,
): Forecast[] {
  const byId = new Map<string, { committed: number; pipeline: number }>();
  for (const it of itens) {
    const refId = kind === "perfil" ? it.perfil_id : it.vidro_id;
    if (!refId) continue;
    const orc = orcs.get(it.orcamento_id);
    if (!orc) continue;
    const isCommitted = COMMITTED.has(orc.status);
    const isPipeline = PIPELINE.has(orc.status);
    if (!isCommitted && !isPipeline) continue;

    let amount = 0;
    const h = Number(it.altura_mm ?? 0);
    const w = Number(it.largura_mm ?? 0);
    const q = Number(it.quantidade ?? 0);
    if (kind === "perfil") {
      // perimeter in meters
      amount = ((h * 2 + w * 2) / 1000) * q;
    } else {
      // area in m²
      amount = ((h * w) / 1_000_000) * q;
    }
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const cur = byId.get(refId) ?? { committed: 0, pipeline: 0 };
    if (isCommitted) cur.committed += amount;
    else cur.pipeline += amount;
    byId.set(refId, cur);
  }

  const out: Forecast[] = [];
  for (const [id, sums] of byId) {
    const c = catalog.get(id);
    if (!c) continue;
    out.push({
      id,
      codigo: c.codigo,
      descricao: c.descricao,
      estoque:
        kind === "perfil"
          ? Number((c as Perfil).estoque_atual ?? 0)
          : Number((c as Vidro).estoque_m2 ?? 0),
      minimo:
        kind === "perfil"
          ? Number((c as Perfil).estoque_minimo ?? 0)
          : 0,
      committed: sums.committed,
      pipeline: sums.pipeline,
      unidade: kind === "perfil" ? "m" : "m²",
    });
  }
  return out.sort((a, b) => b.committed + b.pipeline - (a.committed + a.pipeline));
}

const fmt = (n: number, u: string) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n)} ${u}`;

function severity(f: Forecast): "ok" | "atencao" | "critico" {
  const restante = f.estoque - f.committed;
  if (restante < 0) return "critico";
  if (restante < f.minimo || restante - f.pipeline < 0) return "atencao";
  return "ok";
}

function ForecastTable({ rows, icon: Icon }: { rows: Forecast[]; icon: typeof Layers }) {
  if (rows.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground text-center">
        Nenhum consumo previsto. Aprove ou envie orçamentos para começar a previsão.
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material</TableHead>
          <TableHead className="text-right">Estoque</TableHead>
          <TableHead className="text-right">Comprometido</TableHead>
          <TableHead className="text-right">Pipeline</TableHead>
          <TableHead className="text-right">Saldo previsto</TableHead>
          <TableHead>Cobertura</TableHead>
          <TableHead className="text-right">Alerta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((f) => {
          const restante = f.estoque - f.committed;
          const restanteFull = f.estoque - f.committed - f.pipeline;
          const consumoTotal = f.committed + f.pipeline;
          const cobertura = consumoTotal > 0 ? Math.min(100, (f.estoque / consumoTotal) * 100) : 100;
          const s = severity(f);
          return (
            <TableRow key={f.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-muted-foreground">{f.codigo}</div>
                    <div className="truncate font-medium">{f.descricao}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {fmt(f.estoque, f.unidade)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-chart-3">
                {fmt(f.committed, f.unidade)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {fmt(f.pipeline, f.unidade)}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums font-semibold ${
                  restante < 0 ? "text-destructive" : restanteFull < 0 ? "text-chart-3" : ""
                }`}
              >
                {fmt(restante, f.unidade)}
              </TableCell>
              <TableCell className="w-40">
                <Progress
                  value={cobertura}
                  className={`h-1.5 ${
                    s === "critico"
                      ? "[&>*]:bg-destructive"
                      : s === "atencao"
                      ? "[&>*]:bg-chart-3"
                      : "[&>*]:bg-chart-2"
                  }`}
                />
                <span className="text-[10px] text-muted-foreground mt-1 inline-block">
                  {Math.round(cobertura)}% coberto
                </span>
              </TableCell>
              <TableCell className="text-right">
                {s === "critico" ? (
                  <Badge className="bg-destructive/15 text-destructive border-0 gap-1">
                    <AlertTriangle className="h-3 w-3" /> Crítico
                  </Badge>
                ) : s === "atencao" ? (
                  <Badge className="bg-chart-3/15 text-chart-3 border-0 gap-1">
                    <TrendingDown className="h-3 w-3" /> Atenção
                  </Badge>
                ) : (
                  <Badge className="bg-chart-2/15 text-chart-2 border-0 gap-1">
                    <PackageCheck className="h-3 w-3" /> OK
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function MateriaisPage() {
  const qc = useQueryClient();

  const perfis = useQuery({
    queryKey: ["mat", "perfis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis_aluminio")
        .select("id, codigo, descricao, estoque_atual, estoque_minimo, comprimento_barra_mm");
      if (error) throw error;
      return data as Perfil[];
    },
  });
  const vidros = useQuery({
    queryKey: ["mat", "vidros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vidros")
        .select("id, codigo, descricao, estoque_m2, espessura_mm");
      if (error) throw error;
      return data as Vidro[];
    },
  });
  const orcs = useQuery({
    queryKey: ["mat", "orcamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, numero, status")
        .in("status", ["enviado", "aprovado", "convertido"]);
      if (error) throw error;
      return data as Orc[];
    },
  });
  const itens = useQuery({
    queryKey: ["mat", "itens"],
    enabled: !!orcs.data,
    queryFn: async () => {
      const ids = (orcs.data ?? []).map((o) => o.id);
      if (ids.length === 0) return [] as Item[];
      const { data, error } = await supabase
        .from("orcamento_itens")
        .select("perfil_id, vidro_id, altura_mm, largura_mm, quantidade, orcamento_id")
        .in("orcamento_id", ids);
      if (error) throw error;
      return data as Item[];
    },
  });
  const obraMat = useQuery({
    queryKey: ["mat", "obra_materiais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_materiais")
        .select("obra_id, descricao, unidade, quantidade_prevista, quantidade_utilizada");
      if (error) throw error;
      return data as ObraMat[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("materiais-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orcamentos" }, () =>
        qc.invalidateQueries({ queryKey: ["mat"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "orcamento_itens" }, () =>
        qc.invalidateQueries({ queryKey: ["mat", "itens"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "perfis_aluminio" }, () =>
        qc.invalidateQueries({ queryKey: ["mat", "perfis"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "vidros" }, () =>
        qc.invalidateQueries({ queryKey: ["mat", "vidros"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "obra_materiais" }, () =>
        qc.invalidateQueries({ queryKey: ["mat", "obra_materiais"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const perfilForecast = useMemo(() => {
    if (!itens.data || !orcs.data || !perfis.data) return [];
    const orcMap = new Map(orcs.data.map((o) => [o.id, o]));
    const cat = new Map<string, Perfil>(perfis.data.map((p) => [p.id, p]));
    return computeForecast(itens.data, orcMap, "perfil", cat);
  }, [itens.data, orcs.data, perfis.data]);

  const vidroForecast = useMemo(() => {
    if (!itens.data || !orcs.data || !vidros.data) return [];
    const orcMap = new Map(orcs.data.map((o) => [o.id, o]));
    const cat = new Map<string, Vidro>(vidros.data.map((v) => [v.id, v]));
    return computeForecast(itens.data, orcMap, "vidro", cat);
  }, [itens.data, orcs.data, vidros.data]);

  const criticos = [...perfilForecast, ...vidroForecast].filter(
    (f) => severity(f) === "critico",
  );
  const atencao = [...perfilForecast, ...vidroForecast].filter(
    (f) => severity(f) === "atencao",
  );

  // Obra materials pending
  const obraPendentes = useMemo(() => {
    return (obraMat.data ?? [])
      .map((m) => ({
        ...m,
        pendente: Number(m.quantidade_prevista) - Number(m.quantidade_utilizada),
      }))
      .filter((m) => m.pendente > 0)
      .sort((a, b) => b.pendente - a.pendente)
      .slice(0, 20);
  }, [obraMat.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Previsão de Materiais
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consumo previsto a partir de orçamentos e obras · alertas automáticos de estoque
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5 bg-chart-2/15 text-chart-2 border-0">
          <Wifi className="h-3 w-3" /> Ao vivo
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 text-destructive grid place-items-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Alertas críticos</p>
              <p className="text-2xl font-bold">{criticos.length}</p>
              <p className="text-xs text-muted-foreground">Estoque insuficiente</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-chart-3/10 text-chart-3 grid place-items-center">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Atenção</p>
              <p className="text-2xl font-bold">{atencao.length}</p>
              <p className="text-xs text-muted-foreground">Abaixo do mínimo previsto</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-chart-2/10 text-chart-2 grid place-items-center">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Itens monitorados</p>
              <p className="text-2xl font-bold">
                {perfilForecast.length + vidroForecast.length}
              </p>
              <p className="text-xs text-muted-foreground">Perfis + vidros com consumo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {criticos.length > 0 && (
        <Card className="shadow-card border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Ação necessária
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1.5 text-sm">
              {criticos.slice(0, 5).map((f) => (
                <li key={f.id} className="flex items-center justify-between">
                  <span className="truncate">
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {f.codigo}
                    </span>
                    {f.descricao}
                  </span>
                  <span className="tabular-nums text-destructive font-semibold shrink-0">
                    faltam {fmt(f.committed - f.estoque, f.unidade)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="perfis" className="w-full">
        <TabsList>
          <TabsTrigger value="perfis" className="gap-2">
            <Layers className="h-4 w-4" /> Perfis ({perfilForecast.length})
          </TabsTrigger>
          <TabsTrigger value="vidros" className="gap-2">
            <Square className="h-4 w-4" /> Vidros ({vidroForecast.length})
          </TabsTrigger>
          <TabsTrigger value="obras" className="gap-2">
            <PackageCheck className="h-4 w-4" /> Obras ({obraPendentes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfis">
          <Card className="shadow-card">
            <CardContent className="p-0">
              <ForecastTable rows={perfilForecast} icon={Layers} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vidros">
          <Card className="shadow-card">
            <CardContent className="p-0">
              <ForecastTable rows={vidroForecast} icon={Square} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="obras">
          <Card className="shadow-card">
            <CardContent className="p-0">
              {obraPendentes.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  Sem materiais pendentes em obras. Cadastre materiais previstos em{" "}
                  <Link to="/obras" className="text-primary hover:underline">
                    Obras
                  </Link>
                  .
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Previsto</TableHead>
                      <TableHead className="text-right">Utilizado</TableHead>
                      <TableHead className="text-right">Pendente</TableHead>
                      <TableHead>Consumo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {obraPendentes.map((m) => {
                      const prev = Number(m.quantidade_prevista);
                      const usado = Number(m.quantidade_utilizada);
                      const pct = prev > 0 ? Math.min(100, (usado / prev) * 100) : 0;
                      const u = m.unidade ?? "un";
                      return (
                        <TableRow key={`${m.obra_id}-${m.descricao}`}>
                          <TableCell className="font-medium">{m.descricao}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(prev, u)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(usado, u)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-chart-3">
                            {fmt(m.pendente, u)}
                          </TableCell>
                          <TableCell className="w-40">
                            <Progress value={pct} className="h-1.5" />
                            <span className="text-[10px] text-muted-foreground mt-1 inline-block">
                              {Math.round(pct)}% consumido
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Cálculo: perfis = perímetro (altura+largura)×2 dos itens em metros; vidros = área
        altura×largura em m². "Comprometido" = orçamentos aprovados/convertidos · "Pipeline" =
        enviados aguardando aprovação.
      </p>
    </div>
  );
}
