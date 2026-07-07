import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/exportar")({
  component: ExportarPage,
});

type TableName =
  | "clientes"
  | "perfis_aluminio"
  | "vidros"
  | "acessorios"
  | "vendedores"
  | "orcamentos"
  | "orcamento_itens"
  | "pedidos"
  | "pedido_historico"
  | "pedido_anexos"
  | "ordens_producao"
  | "ordem_producao_etapas"
  | "obras"
  | "obra_cronograma"
  | "obra_materiais"
  | "obra_medicoes"
  | "financeiro_lancamentos"
  | "profiles"
  | "user_roles";

type ModuleDef = {
  key: string;
  label: string;
  sheet: string;
  table: TableName;
  description: string;
};

const MODULES: ModuleDef[] = [
  { key: "clientes", label: "Clientes", sheet: "Clientes", table: "clientes", description: "Cadastro completo de clientes" },
  { key: "perfis", label: "Perfis de Alumínio", sheet: "Perfis", table: "perfis_aluminio", description: "Catálogo e estoque de perfis" },
  { key: "vidros", label: "Vidros", sheet: "Vidros", table: "vidros", description: "Catálogo, fornecedores e estoque" },
  { key: "acessorios", label: "Acessórios", sheet: "Acessorios", table: "acessorios", description: "Ferragens e componentes" },
  { key: "vendedores", label: "Vendedores", sheet: "Vendedores", table: "vendedores", description: "Equipe comercial" },
  { key: "orcamentos", label: "Orçamentos", sheet: "Orcamentos", table: "orcamentos", description: "Propostas comerciais" },
  { key: "orcamento_itens", label: "Itens de Orçamento", sheet: "Orcamento_Itens", table: "orcamento_itens", description: "Detalhamento por item" },
  { key: "pedidos", label: "Pedidos (fluxo)", sheet: "Pedidos", table: "pedidos", description: "Pedidos em produção" },
  { key: "pedido_historico", label: "Histórico de Pedidos", sheet: "Pedido_Historico", table: "pedido_historico", description: "Auditoria de etapas" },
  { key: "pedido_anexos", label: "Anexos de Pedidos", sheet: "Pedido_Anexos", table: "pedido_anexos", description: "Metadados dos anexos" },
  { key: "ordens_producao", label: "Ordens de Produção", sheet: "Ordens_Producao", table: "ordens_producao", description: "OPs da fábrica" },
  { key: "ordem_etapas", label: "Etapas de Produção", sheet: "OP_Etapas", table: "ordem_producao_etapas", description: "Rastreio por etapa" },
  { key: "obras", label: "Obras", sheet: "Obras", table: "obras", description: "Projetos e instalações" },
  { key: "obra_cronograma", label: "Cronograma de Obras", sheet: "Obra_Cronograma", table: "obra_cronograma", description: "Planejamento" },
  { key: "obra_materiais", label: "Materiais de Obras", sheet: "Obra_Materiais", table: "obra_materiais", description: "Consumo previsto/real" },
  { key: "obra_medicoes", label: "Medições", sheet: "Obra_Medicoes", table: "obra_medicoes", description: "Medições em campo" },
  { key: "financeiro", label: "Financeiro", sheet: "Financeiro", table: "financeiro_lancamentos", description: "Contas a pagar/receber" },
  { key: "profiles", label: "Usuários", sheet: "Usuarios", table: "profiles", description: "Perfis dos usuários" },
  { key: "user_roles", label: "Papéis / Permissões", sheet: "Papeis", table: "user_roles", description: "Vínculos usuário-papel" },
];

function flatten(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) {
      out[k] = "";
    } else if (typeof v === "object") {
      try {
        out[k] = JSON.stringify(v);
      } catch {
        out[k] = String(v);
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function fetchAll(table: TableName): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  let from = 0;
  const all: Record<string, unknown>[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as Record<string, unknown>[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function ExportarPage() {
  const [selected, setSelected] = useState<Record<string, boolean>>(
    () => Object.fromEntries(MODULES.map((m) => [m.key, true])),
  );
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [done, setDone] = useState<string[]>([]);

  const toggle = (key: string) =>
    setSelected((s) => ({ ...s, [key]: !s[key] }));
  const allOn = MODULES.every((m) => selected[m.key]);
  const toggleAll = () =>
    setSelected(Object.fromEntries(MODULES.map((m) => [m.key, !allOn])));

  const chosen = MODULES.filter((m) => selected[m.key]);

  async function handleExport() {
    if (chosen.length === 0) {
      toast.error("Selecione ao menos um módulo.");
      return;
    }
    setBusy(true);
    setDone([]);
    try {
      const wb = XLSX.utils.book_new();

      // Índice
      const indexRows: (string | number)[][] = [
        ["ERP Esquadrias - Exportação completa"],
        [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
        [],
        ["Módulo", "Aba", "Registros"],
      ];

      const results: { sheet: string; count: number }[] = [];

      for (const mod of chosen) {
        setProgress(`Buscando ${mod.label}...`);
        const rows = await fetchAll(mod.table);
        const flat = rows.map(flatten);
        const ws =
          flat.length > 0
            ? XLSX.utils.json_to_sheet(flat)
            : XLSX.utils.aoa_to_sheet([["(sem registros)"]]);
        XLSX.utils.book_append_sheet(wb, ws, mod.sheet.slice(0, 31));
        results.push({ sheet: mod.sheet, count: flat.length });
        setDone((d) => [...d, mod.key]);
      }

      for (const r of results) {
        indexRows.push([
          MODULES.find((m) => m.sheet === r.sheet)?.label ?? r.sheet,
          r.sheet,
          r.count,
        ]);
      }
      const wsIndex = XLSX.utils.aoa_to_sheet(indexRows);
      XLSX.utils.book_append_sheet(wb, wsIndex, "Índice");
      // Move índice to first position
      wb.SheetNames = ["Índice", ...wb.SheetNames.filter((n) => n !== "Índice")];

      setProgress("Gerando arquivo...");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(wb, `erp-esquadrias-export-${stamp}.xlsx`);

      const total = results.reduce((s, r) => s + r.count, 0);
      toast.success(`Exportação concluída: ${results.length} abas, ${total} registros.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Falha na exportação: ${msg}`);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Exportar dados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere um arquivo XLSX com uma aba para cada módulo do sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleAll} disabled={busy}>
            {allOn ? "Desmarcar todos" : "Selecionar todos"}
          </Button>
          <Button onClick={handleExport} disabled={busy} className="gap-2">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Baixar XLSX ({chosen.length})
              </>
            )}
          </Button>
        </div>
      </div>

      {busy && (
        <Card className="shadow-card border-primary/40">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm">{progress || "Processando..."}</span>
            <Badge variant="secondary" className="ml-auto">
              {done.length}/{chosen.length}
            </Badge>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Módulos disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => {
              const checked = !!selected[m.key];
              const isDone = done.includes(m.key);
              return (
                <label
                  key={m.key}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    checked ? "border-primary/40 bg-primary/5" : "border-border hover:bg-accent/40"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(m.key)}
                    disabled={busy}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{m.label}</span>
                      {isDone && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-chart-2 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                    <p className="text-[10px] text-muted-foreground/70 font-mono mt-1">
                      aba: {m.sheet}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        A exportação respeita as permissões do seu usuário: você só receberá os dados aos quais tem acesso.
        Campos complexos (JSON, arrays) são serializados como texto para compatibilidade com Excel.
      </p>
    </div>
  );
}
