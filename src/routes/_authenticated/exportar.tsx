import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import ExcelJS from "exceljs";
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

/* =========================================================================
   Estilo visual (cores da marca)
   ========================================================================= */
const BRAND = "FF1E40AF"; // primary blue-800
const BRAND_SOFT = "FFE0E7FF"; // indigo-100
const SECTION_HEAD = "FF334155"; // slate-700
const HEADER_TEXT = "FFFFFFFF";
const ZEBRA = "FFF8FAFC"; // slate-50

type ColKind = "text" | "int" | "money" | "percent" | "date" | "datetime" | "bool" | "status";

type Col = {
  key: string;
  header: string;
  kind?: ColKind;
  width?: number;
  /** transforma valor bruto do banco para valor exibido */
  map?: (row: Record<string, unknown>, ctx: ExportContext) => unknown;
};

type ExportContext = {
  users: Map<string, string>; // user_id -> nome
  clientes: Map<string, string>;
  vendedores: Map<string, string>;
  perfis: Map<string, string>;
  vidros: Map<string, string>;
};

/* =========================================================================
   Utilidades
   ========================================================================= */
const PEDIDO_ETAPAS: { key: string; label: string }[] = [
  { key: "venda", label: "Venda" },
  { key: "avaliacao_tecnica", label: "Avaliação Técnica" },
  { key: "orcamento", label: "Orçamento" },
  { key: "corte", label: "Corte" },
  { key: "usinagem", label: "Usinagem" },
  { key: "montagem", label: "Montagem" },
  { key: "vidracaria", label: "Vidraçaria" },
  { key: "acabamento", label: "Acabamento" },
  { key: "entrega", label: "Entrega" },
  { key: "concluido", label: "Concluído" },
  { key: "cancelado", label: "Cancelado" },
];
const etapaLabel = (k?: string | null) =>
  PEDIDO_ETAPAS.find((e) => e.key === k)?.label ?? (k ?? "—");

const ACAO_LABEL: Record<string, string> = {
  criar: "Criou",
  aceitar: "Aceitou",
  concluir: "Concluiu / Avançou",
  devolver: "Devolveu",
  comentar: "Comentou",
  cancelar: "Cancelou",
};

const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  pendente: "Pendente",
  pago: "Pago",
  vencido: "Vencido",
  cancelado: "Cancelado",
  aprovado: "Aprovado",
  rascunho: "Rascunho",
  enviado: "Enviado",
  rejeitado: "Rejeitado",
  convertido: "Convertido",
  planejamento: "Planejamento",
  aguardando_material: "Aguardando material",
  em_producao: "Em produção",
  em_medicao: "Em medição",
  em_instalacao: "Em instalação",
  concluida: "Concluída",
  cancelada: "Cancelada",
  aguardando: "Aguardando",
  corte: "Corte",
  usinagem: "Usinagem",
  montagem: "Montagem",
  vidracaria: "Vidraçaria",
  acabamento: "Acabamento",
  finalizado: "Finalizado",
  entregue: "Entregue",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  producao: "Produção",
  financeiro: "Financeiro",
  gerente: "Gerente",
};

const s = (v: unknown) => (v == null || v === "" ? "" : String(v));
const humanStatus = (v: unknown) => {
  const k = s(v).toLowerCase();
  return STATUS_LABEL[k] ?? (k ? k.charAt(0).toUpperCase() + k.slice(1) : "");
};

/* =========================================================================
   Fetch com paginação
   ========================================================================= */
async function fetchAll<T = Record<string, unknown>>(
  table: string,
  order?: { column: string; ascending?: boolean },
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = supabase.from(table as never).select("*").range(from, from + pageSize - 1);
    if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/* =========================================================================
   Definições de tabela por SEÇÃO do menu
   ========================================================================= */
type SubTable = { title: string; table: string; cols: Col[]; orderBy?: string };
type Section = { key: string; label: string; sheet: string; tabColor: string; blocks: SubTable[] };

const SECTIONS: Section[] = [
  {
    key: "cadastros",
    label: "Cadastros",
    sheet: "Cadastros",
    tabColor: "FF3B82F6",
    blocks: [
      {
        title: "Clientes",
        table: "clientes",
        orderBy: "nome",
        cols: [
          { key: "nome", header: "Nome do cliente", width: 32 },
          { key: "tipo", header: "Tipo", width: 12, map: (r) => (s(r.tipo).toLowerCase() === "pj" ? "Pessoa Jurídica" : s(r.tipo).toLowerCase() === "pf" ? "Pessoa Física" : s(r.tipo)) },
          { key: "documento", header: "CPF / CNPJ", width: 20 },
          { key: "email", header: "E-mail", width: 28 },
          { key: "telefone", header: "Telefone", width: 16 },
          { key: "celular", header: "Celular", width: 16 },
          { key: "cidade", header: "Cidade", width: 20 },
          { key: "estado", header: "UF", width: 6 },
          { key: "cep", header: "CEP", width: 12 },
          { key: "endereco", header: "Endereço", width: 34 },
          { key: "vendedor", header: "Vendedor", width: 22, map: (r, c) => c.vendedores.get(s(r.vendedor_id)) ?? "" },
          { key: "valor_total", header: "Valor total", kind: "money", width: 14 },
          { key: "data_venda", header: "Data da venda", kind: "date", width: 14 },
          { key: "created_at", header: "Cadastrado em", kind: "datetime", width: 18 },
        ],
      },
      {
        title: "Vendedores",
        table: "vendedores",
        orderBy: "nome",
        cols: [
          { key: "nome", header: "Vendedor", width: 30 },
          { key: "email", header: "E-mail", width: 28 },
          { key: "telefone", header: "Telefone", width: 16 },
          { key: "documento", header: "CPF / CNPJ", width: 20 },
          { key: "percentual_comissao", header: "Comissão padrão", kind: "percent", width: 16 },
          { key: "percentual_comissao_meta", header: "Comissão c/ meta", kind: "percent", width: 18 },
          { key: "meta_mensal", header: "Meta mensal", kind: "money", width: 14 },
          { key: "ativo", header: "Situação", kind: "bool", width: 12 },
        ],
      },
      {
        title: "Perfis de Alumínio",
        table: "perfis_aluminio",
        orderBy: "codigo",
        cols: [
          { key: "codigo", header: "Código", width: 14 },
          { key: "descricao", header: "Descrição", width: 40 },
          { key: "linha", header: "Linha", width: 18 },
          { key: "cor", header: "Cor", width: 14 },
          { key: "acabamento", header: "Acabamento", width: 16 },
          { key: "comprimento_barra_mm", header: "Barra (mm)", kind: "int", width: 12 },
          { key: "peso_kg_m", header: "Peso (kg/m)", width: 12 },
          { key: "preco_kg", header: "Preço/kg", kind: "money", width: 12 },
          { key: "preco_metro", header: "Preço/m", kind: "money", width: 12 },
          { key: "estoque_atual", header: "Estoque atual", width: 14 },
          { key: "estoque_minimo", header: "Estoque mínimo", width: 16 },
          { key: "ativo", header: "Situação", kind: "bool", width: 12 },
        ],
      },
      {
        title: "Vidros",
        table: "vidros",
        orderBy: "codigo",
        cols: [
          { key: "codigo", header: "Código", width: 14 },
          { key: "descricao", header: "Descrição", width: 40 },
          { key: "tipo", header: "Tipo", width: 16 },
          { key: "espessura_mm", header: "Espessura (mm)", width: 14 },
          { key: "cor", header: "Cor", width: 14 },
          { key: "fornecedor", header: "Fornecedor", width: 24 },
          { key: "preco_m2", header: "Preço/m²", kind: "money", width: 12 },
          { key: "estoque_m2", header: "Estoque (m²)", width: 14 },
          { key: "ativo", header: "Situação", kind: "bool", width: 12 },
        ],
      },
      {
        title: "Acessórios",
        table: "acessorios",
        orderBy: "codigo",
        cols: [
          { key: "codigo", header: "Código", width: 14 },
          { key: "descricao", header: "Descrição", width: 40 },
          { key: "categoria", header: "Categoria", width: 20 },
          { key: "unidade", header: "Unidade", width: 10 },
          { key: "preco_unitario", header: "Preço unitário", kind: "money", width: 14 },
          { key: "estoque_atual", header: "Estoque atual", width: 14 },
          { key: "estoque_minimo", header: "Estoque mínimo", width: 16 },
          { key: "ativo", header: "Situação", kind: "bool", width: 12 },
        ],
      },
    ],
  },
  {
    key: "comercial",
    label: "Comercial",
    sheet: "Comercial",
    tabColor: "FF10B981",
    blocks: [
      {
        title: "Orçamentos",
        table: "orcamentos",
        orderBy: "numero",
        cols: [
          { key: "numero", header: "Nº do orçamento", kind: "int", width: 14 },
          { key: "cliente_nome", header: "Cliente", width: 30 },
          { key: "data_orcamento", header: "Data", kind: "date", width: 12 },
          { key: "validade_dias", header: "Validade (dias)", kind: "int", width: 14 },
          { key: "subtotal", header: "Subtotal", kind: "money", width: 14 },
          { key: "desconto", header: "Desconto", kind: "money", width: 14 },
          { key: "total", header: "Total", kind: "money", width: 14 },
          { key: "status", header: "Situação", kind: "status", width: 14 },
          { key: "observacoes", header: "Observações", width: 40 },
        ],
      },
      {
        title: "Itens de Orçamento",
        table: "orcamento_itens",
        orderBy: "created_at",
        cols: [
          { key: "orcamento_id", header: "Orçamento", width: 18 },
          { key: "descricao", header: "Descrição do item", width: 40 },
          { key: "tipo", header: "Tipo", width: 14 },
          { key: "perfil", header: "Perfil", width: 26, map: (r, c) => c.perfis.get(s(r.perfil_id)) ?? "" },
          { key: "vidro", header: "Vidro", width: 26, map: (r, c) => c.vidros.get(s(r.vidro_id)) ?? "" },
          { key: "largura_mm", header: "Largura (mm)", kind: "int", width: 12 },
          { key: "altura_mm", header: "Altura (mm)", kind: "int", width: 12 },
          { key: "quantidade", header: "Qtd.", width: 8 },
          { key: "preco_unitario", header: "Preço unit.", kind: "money", width: 14 },
          { key: "subtotal", header: "Subtotal", kind: "money", width: 14 },
        ],
      },
    ],
  },
  {
    key: "producao",
    label: "Produção",
    sheet: "Produção",
    tabColor: "FFF59E0B",
    blocks: [
      {
        title: "Ordens de Produção",
        table: "ordens_producao",
        orderBy: "numero",
        cols: [
          { key: "numero", header: "Nº da OP", kind: "int", width: 10 },
          { key: "titulo", header: "Título", width: 32 },
          { key: "cliente_nome", header: "Cliente", width: 28 },
          { key: "orcamento_numero", header: "Orçamento", kind: "int", width: 12 },
          { key: "etapa", header: "Etapa atual", kind: "status", width: 16 },
          { key: "prioridade", header: "Prioridade", width: 12, map: (r) => PRIORIDADE_LABEL[s(r.prioridade)] ?? s(r.prioridade) },
          { key: "progresso", header: "Progresso", kind: "percent", width: 12, map: (r) => (r.progresso == null ? null : Number(r.progresso) / 100) },
          { key: "data_inicio", header: "Início", kind: "date", width: 12 },
          { key: "data_previsao", header: "Previsão", kind: "date", width: 12 },
          { key: "data_entrega", header: "Entrega", kind: "date", width: 12 },
          { key: "responsavel", header: "Responsável", width: 22, map: (r, c) => c.users.get(s(r.responsavel_id)) ?? "" },
        ],
      },
      {
        title: "Etapas de Produção",
        table: "ordem_producao_etapas",
        orderBy: "iniciada_em",
        cols: [
          { key: "ordem_id", header: "OP", width: 12 },
          { key: "etapa", header: "Etapa", kind: "status", width: 16 },
          { key: "iniciada_em", header: "Iniciada em", kind: "datetime", width: 18 },
          { key: "concluida_em", header: "Concluída em", kind: "datetime", width: 18 },
          { key: "responsavel", header: "Responsável", width: 22, map: (r, c) => c.users.get(s(r.responsavel_id)) ?? "" },
          { key: "observacoes", header: "Observações", width: 40 },
        ],
      },
    ],
  },
  {
    key: "obras",
    label: "Obras",
    sheet: "Obras",
    tabColor: "FF8B5CF6",
    blocks: [
      {
        title: "Obras",
        table: "obras",
        orderBy: "numero",
        cols: [
          { key: "numero", header: "Nº da obra", kind: "int", width: 10 },
          { key: "titulo", header: "Título", width: 32 },
          { key: "cliente_nome", header: "Cliente", width: 28 },
          { key: "status", header: "Situação", kind: "status", width: 18 },
          { key: "progresso", header: "Progresso", kind: "percent", width: 12, map: (r) => (r.progresso == null ? null : Number(r.progresso) / 100) },
          { key: "valor", header: "Valor", kind: "money", width: 14 },
          { key: "responsavel_nome", header: "Responsável", width: 22 },
          { key: "cidade", header: "Cidade", width: 18 },
          { key: "estado", header: "UF", width: 6 },
          { key: "logradouro", header: "Endereço", width: 32 },
          { key: "data_inicio_prevista", header: "Início previsto", kind: "date", width: 14 },
          { key: "data_entrega_prevista", header: "Entrega prevista", kind: "date", width: 16 },
          { key: "data_entrega_real", header: "Entrega real", kind: "date", width: 14 },
          { key: "data_medicao", header: "Medição", kind: "date", width: 12 },
          { key: "data_corte", header: "Corte", kind: "date", width: 12 },
          { key: "data_montagem", header: "Montagem", kind: "date", width: 12 },
        ],
      },
      {
        title: "Cronograma",
        table: "obra_cronograma",
        orderBy: "ordem",
        cols: [
          { key: "obra_id", header: "Obra", width: 14 },
          { key: "ordem", header: "Ordem", kind: "int", width: 8 },
          { key: "titulo", header: "Etapa", width: 26 },
          { key: "descricao", header: "Descrição", width: 34 },
          { key: "status", header: "Situação", kind: "status", width: 14 },
          { key: "data_prevista", header: "Prevista", kind: "date", width: 12 },
          { key: "data_conclusao", header: "Concluída", kind: "date", width: 12 },
        ],
      },
      {
        title: "Materiais",
        table: "obra_materiais",
        orderBy: "created_at",
        cols: [
          { key: "obra_id", header: "Obra", width: 14 },
          { key: "descricao", header: "Material", width: 34 },
          { key: "unidade", header: "Unidade", width: 10 },
          { key: "quantidade_prevista", header: "Qtd. prevista", width: 14 },
          { key: "quantidade_utilizada", header: "Qtd. utilizada", width: 14 },
          { key: "observacoes", header: "Observações", width: 40 },
        ],
      },
      {
        title: "Medições",
        table: "obra_medicoes",
        orderBy: "data_medicao",
        cols: [
          { key: "obra_id", header: "Obra", width: 14 },
          { key: "ambiente", header: "Ambiente", width: 22 },
          { key: "largura_mm", header: "Largura (mm)", kind: "int", width: 12 },
          { key: "altura_mm", header: "Altura (mm)", kind: "int", width: 12 },
          { key: "quantidade", header: "Quantidade", width: 12 },
          { key: "data_medicao", header: "Data", kind: "date", width: 12 },
          { key: "responsavel", header: "Responsável", width: 22, map: (r, c) => c.users.get(s(r.responsavel_id)) ?? "" },
          { key: "observacoes", header: "Observações", width: 34 },
        ],
      },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    sheet: "Financeiro",
    tabColor: "FFEF4444",
    blocks: [
      {
        title: "Lançamentos financeiros",
        table: "financeiro_lancamentos",
        orderBy: "data_vencimento",
        cols: [
          { key: "tipo", header: "Tipo", width: 12, map: (r) => (s(r.tipo) === "receita" ? "Receita" : s(r.tipo) === "despesa" ? "Despesa" : s(r.tipo)) },
          { key: "descricao", header: "Descrição", width: 40 },
          { key: "categoria", header: "Categoria", width: 18 },
          { key: "cliente_nome", header: "Cliente / Fornecedor", width: 28 },
          { key: "valor", header: "Valor", kind: "money", width: 14 },
          { key: "data_vencimento", header: "Vencimento", kind: "date", width: 14 },
          { key: "data_pagamento", header: "Pagamento", kind: "date", width: 14 },
          { key: "status", header: "Situação", kind: "status", width: 14 },
          { key: "forma_pagamento", header: "Forma de pagamento", width: 20 },
          { key: "orcamento_numero", header: "Orçamento", kind: "int", width: 12 },
          { key: "obra_numero", header: "Obra", kind: "int", width: 10 },
        ],
      },
    ],
  },
  {
    key: "sistema",
    label: "Sistema",
    sheet: "Sistema",
    tabColor: "FF64748B",
    blocks: [
      {
        title: "Usuários",
        table: "profiles",
        orderBy: "full_name",
        cols: [
          { key: "full_name", header: "Nome", width: 28 },
          { key: "email", header: "E-mail", width: 32 },
          { key: "phone", header: "Telefone", width: 16 },
          { key: "company", header: "Empresa", width: 22 },
          { key: "papel", header: "Papel(is)", width: 30, map: () => "" },
          { key: "created_at", header: "Cadastrado em", kind: "datetime", width: 18 },
        ],
      },
    ],
  },
];

/* =========================================================================
   Aplicação de estilos ExcelJS
   ========================================================================= */
function applyHeaderStyle(row: ExcelJS.Row, cols: Col[]) {
  row.height = 22;
  row.eachCell({ includeEmpty: false }, (cell, i) => {
    if (i > cols.length) return;
    cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF1E3A8A" } },
      bottom: { style: "thin", color: { argb: "FF1E3A8A" } },
      left: { style: "thin", color: { argb: "FF1E3A8A" } },
      right: { style: "thin", color: { argb: "FF1E3A8A" } },
    };
  });
}

function applySectionTitle(cell: ExcelJS.Cell, span: number) {
  cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 13 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION_HEAD } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  const ws = cell.worksheet;
  const r = Number(cell.row);
  const c = Number(cell.col);
  ws.mergeCells(r, c, r, c + span - 1);
  ws.getRow(r).height = 26;
}

function cellFormatFor(kind?: ColKind): Partial<ExcelJS.Style> {
  switch (kind) {
    case "money":
      return { numFmt: '"R$" #,##0.00;[Red]"R$" -#,##0.00;"—"', alignment: { horizontal: "right" } };
    case "percent":
      return { numFmt: "0.0%;-0.0%;-", alignment: { horizontal: "right" } };
    case "int":
      return { numFmt: "#,##0;-#,##0;-", alignment: { horizontal: "right" } };
    case "date":
      return { numFmt: "dd/mm/yyyy", alignment: { horizontal: "center" } };
    case "datetime":
      return { numFmt: "dd/mm/yyyy hh:mm", alignment: { horizontal: "center" } };
    case "bool":
      return { alignment: { horizontal: "center" } };
    default:
      return { alignment: { vertical: "top", wrapText: true } };
  }
}

function toCellValue(kind: ColKind | undefined, raw: unknown): unknown {
  if (raw == null || raw === "") return null;
  switch (kind) {
    case "money":
    case "percent":
    case "int": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case "date":
    case "datetime": {
      const d = new Date(String(raw));
      return isNaN(d.getTime()) ? null : d;
    }
    case "bool":
      return raw ? "Ativo" : "Inativo";
    case "status":
      return humanStatus(raw);
    default:
      return typeof raw === "object" ? JSON.stringify(raw) : raw;
  }
}

/* =========================================================================
   Renderização de um bloco de tabela em uma sheet
   ========================================================================= */
function renderBlock(
  ws: ExcelJS.Worksheet,
  block: SubTable,
  rows: Record<string, unknown>[],
  ctx: ExportContext,
  startRow: number,
): number {
  const { cols } = block;

  // Título do bloco
  const titleCell = ws.getCell(startRow, 1);
  titleCell.value = `${block.title}  (${rows.length})`;
  applySectionTitle(titleCell, cols.length);

  // Cabeçalho
  const headerRow = ws.getRow(startRow + 1);
  cols.forEach((c, i) => {
    headerRow.getCell(i + 1).value = c.header;
    const col = ws.getColumn(i + 1);
    if (c.width && (col.width ?? 0) < c.width) col.width = c.width;
  });
  applyHeaderStyle(headerRow, cols);

  // Dados
  rows.forEach((r, idx) => {
    const excelRow = ws.getRow(startRow + 2 + idx);
    cols.forEach((c, i) => {
      const raw = c.map ? c.map(r, ctx) : r[c.key];
      const cell = excelRow.getCell(i + 1);
      cell.value = toCellValue(c.kind, raw) as ExcelJS.CellValue;
      const st = cellFormatFor(c.kind);
      if (st.numFmt) cell.numFmt = st.numFmt;
      if (st.alignment) cell.alignment = st.alignment;
      cell.font = { size: 10, color: { argb: "FF0F172A" } };
      if (idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      }
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
      };
    });
    excelRow.height = 18;
  });

  // Congelar cabeçalho no primeiro bloco da sheet
  if (startRow === 1) {
    ws.views = [{ state: "frozen", ySplit: startRow + 1 }];
  }

  return startRow + 2 + rows.length + 2; // deixa 2 linhas em branco
}

/* =========================================================================
   Sheet especial: Pedidos com timeline
   ========================================================================= */
type PedidoRow = {
  id: string;
  numero: number;
  titulo: string;
  cliente_nome: string | null;
  etapa: string;
  prioridade: string;
  valor_estimado: number | null;
  responsavel_atual_id: string | null;
  created_at: string;
};

type HistoricoRow = {
  pedido_id: string;
  acao: string;
  etapa_de: string | null;
  etapa_para: string | null;
  observacao: string | null;
  motivo: string | null;
  de_user_id: string | null;
  created_at: string;
};

type AnexoRow = { pedido_id: string; etapa: string; filename: string };

function renderPedidosTimeline(
  ws: ExcelJS.Worksheet,
  pedidos: PedidoRow[],
  historicos: HistoricoRow[],
  anexos: AnexoRow[],
  ctx: ExportContext,
) {
  const etapasFluxo = PEDIDO_ETAPAS.filter((e) => e.key !== "cancelado");

  // colunas fixas
  const base: Col[] = [
    { key: "numero", header: "Nº", kind: "int", width: 8 },
    { key: "titulo", header: "Título", width: 32 },
    { key: "cliente_nome", header: "Cliente", width: 26 },
    { key: "etapa", header: "Etapa atual", kind: "status", width: 18 },
    { key: "prioridade", header: "Prioridade", width: 12, map: (r) => PRIORIDADE_LABEL[s(r.prioridade)] ?? s(r.prioridade) },
    { key: "valor_estimado", header: "Valor estimado", kind: "money", width: 16 },
    { key: "responsavel", header: "Responsável atual", width: 22, map: (r) => ctx.users.get(s(r.responsavel_atual_id)) ?? "" },
    { key: "created_at", header: "Aberto em", kind: "datetime", width: 18 },
  ];

  // colunas de timeline: uma "data concluída" por etapa
  const timelineCols: Col[] = etapasFluxo.map((e) => ({
    key: `etapa_${e.key}`,
    header: e.label,
    kind: "datetime",
    width: 16,
  }));

  const extraCols: Col[] = [
    { key: "historico", header: "Histórico (passo a passo)", width: 70 },
    { key: "anexos", header: "Anexos", width: 40 },
  ];

  const cols = [...base, ...timelineCols, ...extraCols];

  // título
  const titleCell = ws.getCell(1, 1);
  titleCell.value = "Pedidos — Fluxo passo a passo";
  applySectionTitle(titleCell, cols.length);

  // header
  const headerRow = ws.getRow(2);
  cols.forEach((c, i) => {
    headerRow.getCell(i + 1).value = c.header;
    const col = ws.getColumn(i + 1);
    if (c.width && (col.width ?? 0) < c.width) col.width = c.width;
  });
  applyHeaderStyle(headerRow, cols);

  // agrupa histórico e anexos por pedido
  const histByPedido = new Map<string, HistoricoRow[]>();
  for (const h of historicos) {
    const arr = histByPedido.get(h.pedido_id) ?? [];
    arr.push(h);
    histByPedido.set(h.pedido_id, arr);
  }
  const anexosByPedido = new Map<string, AnexoRow[]>();
  for (const a of anexos) {
    const arr = anexosByPedido.get(a.pedido_id) ?? [];
    arr.push(a);
    anexosByPedido.set(a.pedido_id, arr);
  }

  pedidos.forEach((p, idx) => {
    const rowIdx = 3 + idx;
    const excelRow = ws.getRow(rowIdx);
    const hs = (histByPedido.get(p.id) ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));

    // datas de conclusão por etapa (última ação "concluir" que levou PARA aquela etapa marca a conclusão da anterior;
    // usamos: para cada etapa X, a data da entrada em X = ação "concluir" com etapa_para = X)
    const dataEtapa: Record<string, Date | null> = {};
    for (const h of hs) {
      if (h.acao === "concluir" && h.etapa_para) {
        dataEtapa[h.etapa_para] = new Date(h.created_at);
      }
      if (h.acao === "criar" && h.etapa_para) {
        dataEtapa[h.etapa_para] = new Date(h.created_at);
      }
    }

    // preencher colunas base
    base.forEach((c, i) => {
      const raw = c.map ? c.map(p as unknown as Record<string, unknown>, ctx) : (p as unknown as Record<string, unknown>)[c.key];
      const cell = excelRow.getCell(i + 1);
      cell.value = toCellValue(c.kind, raw) as ExcelJS.CellValue;
      const st = cellFormatFor(c.kind);
      if (st.numFmt) cell.numFmt = st.numFmt;
      if (st.alignment) cell.alignment = st.alignment;
      cell.font = { size: 10 };
    });

    // colunas de timeline
    etapasFluxo.forEach((e, i) => {
      const cell = excelRow.getCell(base.length + i + 1);
      const d = dataEtapa[e.key];
      if (d) {
        cell.value = d;
        cell.numFmt = "dd/mm/yyyy hh:mm";
        cell.alignment = { horizontal: "center" };
        // colorir se é a etapa atual
        if (p.etapa === e.key) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_SOFT } };
          cell.font = { bold: true, size: 10, color: { argb: BRAND } };
        } else {
          cell.font = { size: 10, color: { argb: "FF16A34A" } };
        }
      } else {
        // etapa atual sem data ainda
        if (p.etapa === e.key) {
          cell.value = "▸ atual";
          cell.alignment = { horizontal: "center" };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_SOFT } };
          cell.font = { bold: true, size: 10, color: { argb: BRAND } };
        } else {
          cell.value = "—";
          cell.alignment = { horizontal: "center" };
          cell.font = { size: 10, color: { argb: "FF94A3B8" } };
        }
      }
    });

    // histórico
    const histText = hs
      .map((h) => {
        const when = new Date(h.created_at).toLocaleString("pt-BR");
        const quem = ctx.users.get(s(h.de_user_id)) ?? "—";
        const acao = ACAO_LABEL[h.acao] ?? h.acao;
        const de = etapaLabel(h.etapa_de);
        const para = etapaLabel(h.etapa_para);
        const nota = h.observacao ? ` — “${h.observacao}”` : "";
        const mot = h.motivo ? ` — motivo: ${h.motivo}` : "";
        return `${when} · ${quem}: ${acao} (${de} → ${para})${nota}${mot}`;
      })
      .join("\n");
    const histCell = excelRow.getCell(base.length + timelineCols.length + 1);
    histCell.value = histText;
    histCell.alignment = { vertical: "top", wrapText: true };
    histCell.font = { size: 9, color: { arb: "FF334155" } as never };

    // anexos
    const ax = anexosByPedido.get(p.id) ?? [];
    const anexoText = ax
      .map((a) => `• [${etapaLabel(a.etapa)}] ${a.filename}`)
      .join("\n");
    const anexoCell = excelRow.getCell(base.length + timelineCols.length + 2);
    anexoCell.value = anexoText || (ax.length === 0 ? "" : "");
    anexoCell.alignment = { vertical: "top", wrapText: true };
    anexoCell.font = { size: 9 };

    // zebra
    if (idx % 2 === 1) {
      for (let i = 1; i <= cols.length; i++) {
        const c = excelRow.getCell(i);
        if (!c.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      }
    }

    // altura da linha proporcional ao histórico
    const lines = Math.max(1, hs.length, ax.length);
    excelRow.height = Math.min(180, 22 + (lines - 1) * 12);
  });

  ws.views = [{ state: "frozen", ySplit: 2, xSplit: 2 }];
}

/* =========================================================================
   Sheet: Índice
   ========================================================================= */
function renderIndice(
  ws: ExcelJS.Worksheet,
  counts: { section: string; block: string; count: number }[],
) {
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 32;
  ws.getColumn(3).width = 14;

  ws.mergeCells("A1:C1");
  const t = ws.getCell("A1");
  t.value = "ERP Esquadrias — Exportação completa";
  t.font = { bold: true, size: 18, color: { argb: HEADER_TEXT } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 40;

  ws.mergeCells("A2:C2");
  const sub = ws.getCell("A2");
  sub.value = `Gerado em ${new Date().toLocaleString("pt-BR")}`;
  sub.font = { italic: true, color: { argb: "FF475569" } };
  sub.alignment = { horizontal: "left", indent: 1 };

  const header = ws.getRow(4);
  header.getCell(1).value = "Seção";
  header.getCell(2).value = "Conteúdo";
  header.getCell(3).value = "Registros";
  applyHeaderStyle(header, [{ key: "a", header: "" }, { key: "b", header: "" }, { key: "c", header: "" }]);

  counts.forEach((c, i) => {
    const r = ws.getRow(5 + i);
    r.getCell(1).value = c.section;
    r.getCell(2).value = c.block;
    r.getCell(3).value = c.count;
    r.getCell(3).numFmt = "#,##0";
    r.getCell(3).alignment = { horizontal: "right" };
    if (i % 2 === 1) {
      for (let k = 1; k <= 3; k++) r.getCell(k).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    }
    r.eachCell((cell) => {
      cell.font = { ...(cell.font ?? {}), size: 10 };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
    });
  });

  ws.views = [{ state: "frozen", ySplit: 4 }];
}

/* =========================================================================
   Componente
   ========================================================================= */
function ExportarPage() {
  const [selected, setSelected] = useState<Record<string, boolean>>(() => ({
    pedidos: true,
    ...Object.fromEntries(SECTIONS.map((s) => [s.key, true])),
  }));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [done, setDone] = useState<string[]>([]);

  const groups: { key: string; label: string; description: string }[] = [
    { key: "pedidos", label: "Pedidos — passo a passo", description: "Fluxo Venda → Entrega com timeline, histórico e anexos por linha" },
    ...SECTIONS.map((s) => ({
      key: s.key,
      label: s.label,
      description: s.blocks.map((b) => b.title).join(" · "),
    })),
  ];

  const toggle = (k: string) => setSelected((s) => ({ ...s, [k]: !s[k] }));
  const allOn = groups.every((g) => selected[g.key]);
  const toggleAll = () => setSelected(Object.fromEntries(groups.map((g) => [g.key, !allOn])));
  const chosen = groups.filter((g) => selected[g.key]);

  async function handleExport() {
    if (chosen.length === 0) return toast.error("Selecione ao menos uma seção.");

    setBusy(true);
    setDone([]);
    try {
      setProgress("Carregando dados de apoio (usuários, clientes, catálogos)...");

      const [profilesRes, vendedoresRes, clientesRes, perfisRes, vidrosRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("vendedores").select("id, nome"),
        supabase.from("clientes").select("id, nome"),
        supabase.from("perfis_aluminio").select("id, codigo, descricao"),
        supabase.from("vidros").select("id, codigo, descricao"),
      ]);

      const ctx: ExportContext = {
        users: new Map(
          (profilesRes.data ?? []).map((p) => [
            p.id as string,
            (p.full_name as string) || (p.email as string) || "—",
          ]),
        ),
        vendedores: new Map((vendedoresRes.data ?? []).map((v) => [v.id as string, v.nome as string])),
        clientes: new Map((clientesRes.data ?? []).map((c) => [c.id as string, c.nome as string])),
        perfis: new Map(
          (perfisRes.data ?? []).map((p) => [p.id as string, `${p.codigo} — ${p.descricao}`]),
        ),
        vidros: new Map(
          (vidrosRes.data ?? []).map((v) => [v.id as string, `${v.codigo} — ${v.descricao}`]),
        ),
      };

      const wb = new ExcelJS.Workbook();
      wb.creator = "ERP Esquadrias";
      wb.created = new Date();

      const indice: { section: string; block: string; count: number }[] = [];

      // Índice primeiro (será preenchido no fim, mas cria a aba já)
      const wsIndex = wb.addWorksheet("Índice", { properties: { tabColor: { argb: BRAND } } });

      // 1) Pedidos com timeline
      if (selected["pedidos"]) {
        setProgress("Carregando pedidos, histórico e anexos...");
        const [pedidos, historicos, anexos, rolesData] = await Promise.all([
          fetchAll<PedidoRow>("pedidos", { column: "numero", ascending: true }),
          fetchAll<HistoricoRow>("pedido_historico", { column: "created_at", ascending: true }),
          fetchAll<AnexoRow>("pedido_anexos"),
          fetchAll<{ user_id: string; role: string }>("user_roles"),
        ]);
        // enriquece users com papel para uso no bloco Sistema depois
        const rolesByUser = new Map<string, string[]>();
        for (const r of rolesData) {
          const arr = rolesByUser.get(r.user_id) ?? [];
          arr.push(ROLE_LABEL[r.role] ?? r.role);
          rolesByUser.set(r.user_id, arr);
        }
        (ctx as ExportContext & { rolesByUser?: Map<string, string[]> }).rolesByUser = rolesByUser;

        const ws = wb.addWorksheet("Pedidos", { properties: { tabColor: { argb: BRAND } } });
        renderPedidosTimeline(ws, pedidos, historicos, anexos, ctx);
        indice.push({ section: "Pedidos", block: "Fluxo passo a passo", count: pedidos.length });
        setDone((d) => [...d, "pedidos"]);
      }

      // 2) Seções
      for (const sec of SECTIONS) {
        if (!selected[sec.key]) continue;
        setProgress(`Carregando ${sec.label}...`);

        const ws = wb.addWorksheet(sec.sheet, { properties: { tabColor: { argb: sec.tabColor } } });
        let cursor = 1;

        for (const block of sec.blocks) {
          const rows = await fetchAll<Record<string, unknown>>(
            block.table,
            block.orderBy ? { column: block.orderBy, ascending: true } : undefined,
          );

          // Enriquecimento: Sistema → papéis do usuário
          if (sec.key === "sistema" && block.table === "profiles") {
            const rolesByUser = (ctx as ExportContext & { rolesByUser?: Map<string, string[]> }).rolesByUser;
            if (rolesByUser) {
              const papelCol = block.cols.find((c) => c.key === "papel");
              if (papelCol) {
                papelCol.map = (r) => (rolesByUser.get(s(r.id)) ?? []).join(", ");
              }
            } else {
              // busca sob demanda se pedidos não foi selecionado
              const { data } = await supabase.from("user_roles").select("user_id, role");
              const map = new Map<string, string[]>();
              for (const r of (data ?? []) as { user_id: string; role: string }[]) {
                const arr = map.get(r.user_id) ?? [];
                arr.push(ROLE_LABEL[r.role] ?? r.role);
                map.set(r.user_id, arr);
              }
              const papelCol = block.cols.find((c) => c.key === "papel");
              if (papelCol) papelCol.map = (r) => (map.get(s(r.id)) ?? []).join(", ");
            }
          }

          cursor = renderBlock(ws, block, rows, ctx, cursor);
          indice.push({ section: sec.label, block: block.title, count: rows.length });
        }

        setDone((d) => [...d, sec.key]);
      }

      renderIndice(wsIndex, indice);

      setProgress("Gerando arquivo XLSX...");
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `erp-esquadrias-${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const total = indice.reduce((n, x) => n + x.count, 0);
      toast.success(`Exportação concluída — ${indice.length} tabelas, ${total} registros.`);
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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Exportar dados</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gera um XLSX “como o app”: colunas em português, formatação de moeda e datas, uma aba por seção do menu, e a aba
            <strong> Pedidos</strong> com o passo a passo completo.
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
            <FileSpreadsheet className="h-4 w-4" /> Seções a exportar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => {
              const checked = !!selected[g.key];
              const isDone = done.includes(g.key);
              return (
                <label
                  key={g.key}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    checked ? "border-primary/40 bg-primary/5" : "border-border hover:bg-accent/40"
                  }`}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(g.key)} disabled={busy} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{g.label}</span>
                      {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-chart-2 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Todos os valores respeitam as permissões do seu usuário. Colunas monetárias saem em R$, datas em dd/mm/aaaa, e a aba
        Pedidos mostra a etapa atual destacada, com histórico e anexos consolidados por linha.
      </p>
    </div>
  );
}
