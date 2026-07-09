import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

const dateBR = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  convertido: "Convertido",
};

// Brand color (matches app primary)
const BRAND: [number, number, number] = [24, 24, 27];
const ACCENT: [number, number, number] = [37, 99, 235];
const MUTED: [number, number, number] = [113, 113, 122];

type Acessorio = { descricao?: string; codigo?: string; quantidade?: number; preco_unitario?: number };

export async function buildOrcamentoPdf(orcamentoId: string): Promise<{ doc: jsPDF; filename: string }> {
  const [{ data: orc, error: e1 }, { data: itens, error: e2 }] = await Promise.all([
    supabase.from("orcamentos").select("*").eq("id", orcamentoId).maybeSingle(),
    supabase.from("orcamento_itens").select("*").eq("orcamento_id", orcamentoId).order("ordem"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (!orc) throw new Error("Orçamento não encontrado");

  const [cliente, vendedor] = await Promise.all([
    orc.cliente_id
      ? supabase.from("clientes").select("*").eq("id", orc.cliente_id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    orc.vendedor_id
      ? supabase.from("vendedores").select("nome, email, telefone").eq("id", orc.vendedor_id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;

  // ---------- Header band ----------
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 88, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("ORÇAMENTO", marginX, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nº ${String(orc.numero).padStart(4, "0")}`, marginX, 60);
  doc.text(`Emissão: ${dateBR(orc.data_orcamento)}`, marginX, 74);

  // right side
  const validadeDias = orc.validade_dias ?? 15;
  const validade = new Date(orc.data_orcamento);
  validade.setDate(validade.getDate() + validadeDias);
  doc.setFontSize(10);
  const rightX = pageW - marginX;
  doc.text(`Válido até: ${validade.toLocaleDateString("pt-BR")}`, rightX, 60, { align: "right" });
  doc.text(`Status: ${STATUS_LABEL[orc.status] ?? orc.status}`, rightX, 74, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y = 112;

  // ---------- Section helper ----------
  const section = (title: string) => {
    doc.setFillColor(244, 244, 245);
    doc.rect(marginX, y - 12, pageW - marginX * 2, 20, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND);
    doc.text(title.toUpperCase(), marginX + 8, y + 2);
    doc.setTextColor(0, 0, 0);
    y += 18;
  };

  const kv = (rows: Array<[string, string | null | undefined]>) => {
    doc.setFontSize(9.5);
    const colW = (pageW - marginX * 2) / 2;
    let col = 0;
    let localY = y;
    rows.forEach(([k, v]) => {
      const x = marginX + col * colW;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...MUTED);
      doc.text(k, x, localY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      const text = v && String(v).trim() ? String(v) : "—";
      const lines = doc.splitTextToSize(text, colW - 6);
      doc.text(lines, x, localY + 12);
      col = col === 0 ? 1 : 0;
      if (col === 0) localY += 30;
    });
    y = col === 0 ? localY + 6 : localY + 30;
  };

  // ---------- Cliente ----------
  section("Cliente");
  const enderecoCli = [
    [cliente?.endereco, cliente?.numero].filter(Boolean).join(", "),
    cliente?.bairro,
    [cliente?.cidade, cliente?.estado].filter(Boolean).join("/"),
    cliente?.cep,
  ]
    .filter(Boolean)
    .join(" — ");
  kv([
    ["Nome / Razão social", orc.cliente_nome ?? cliente?.nome ?? "—"],
    ["Documento", cliente?.documento ?? "—"],
    ["Telefone", cliente?.telefone ?? cliente?.celular ?? "—"],
    ["E-mail", cliente?.email ?? "—"],
    ["Endereço", enderecoCli || "—"],
    ["Tipo", cliente?.tipo === "PJ" ? "Pessoa Jurídica" : cliente?.tipo === "PF" ? "Pessoa Física" : "—"],
  ]);

  // ---------- Obra ----------
  const enderecoObra = [
    [orc.obra_endereco, orc.obra_numero].filter(Boolean).join(", "),
    orc.obra_bairro,
    [orc.obra_cidade, orc.obra_estado].filter(Boolean).join("/"),
    orc.obra_cep,
  ]
    .filter(Boolean)
    .join(" — ");
  if (enderecoObra || orc.obra_ambiente || orc.obra_pavimento || orc.obra_referencia) {
    section("Local da obra");
    kv([
      ["Endereço", enderecoObra || "—"],
      ["Ambiente", orc.obra_ambiente],
      ["Pavimento", orc.obra_pavimento],
      ["Referência", orc.obra_referencia],
    ]);
  }

  // ---------- Comercial ----------
  section("Condições comerciais");
  kv([
    ["Vendedor", vendedor?.nome ?? "—"],
    ["Forma de pagamento", orc.forma_pagamento],
    ["Prazo de entrega", orc.prazo_entrega_dias ? `${orc.prazo_entrega_dias} dias` : null],
    ["Validade", `${validadeDias} dias`],
  ]);

  // ---------- Itens ----------
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND);
  doc.text("ITENS", marginX, y);
  y += 8;

  const body = (itens ?? []).map((it, idx) => {
    const dim =
      it.largura_mm && it.altura_mm
        ? `${it.largura_mm} × ${it.altura_mm} mm`
        : it.largura_mm
          ? `${it.largura_mm} mm`
          : "—";
    const acLista = Array.isArray(it.acessorios) ? (it.acessorios as Acessorio[]) : [];
    const acessTxt = acLista.length
      ? acLista.map((a) => `${a.descricao ?? a.codigo ?? "item"}${a.quantidade ? ` ×${a.quantidade}` : ""}`).join(", ")
      : "";
    const extras: string[] = [];
    if (it.tipo) extras.push(`Tipo: ${it.tipo}`);
    if (it.cor_perfil) extras.push(`Cor: ${it.cor_perfil}`);
    if (it.acabamento_perfil) extras.push(`Acabamento: ${it.acabamento_perfil}`);
    if (acessTxt) extras.push(`Acessórios: ${acessTxt}`);
    const descricao = extras.length ? `${it.descricao}\n${extras.join(" • ")}` : it.descricao;
    return [
      String(idx + 1),
      descricao,
      dim,
      String(Number(it.quantidade).toFixed(2)).replace(".", ","),
      brl(Number(it.preco_unitario)),
      brl(Number(it.subtotal)),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["#", "Descrição", "Dimensões", "Qtd", "Preço unit.", "Subtotal"]],
    body: body.length ? body : [["—", "Nenhum item cadastrado.", "—", "—", "—", "—"]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6, lineColor: [228, 228, 231], textColor: [24, 24, 27] },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold", halign: "left" },
    columnStyles: {
      0: { cellWidth: 24, halign: "center" },
      2: { cellWidth: 80, halign: "center" },
      3: { cellWidth: 42, halign: "right" },
      4: { cellWidth: 74, halign: "right" },
      5: { cellWidth: 78, halign: "right" },
    },
    margin: { left: marginX, right: marginX },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 18;

  // ---------- Resumo ----------
  if (y > pageH - 200) {
    doc.addPage();
    y = 60;
  }

  const boxW = 260;
  const boxX = pageW - marginX - boxW;
  const subtotal = Number(orc.subtotal);
  const desconto = Number(orc.desconto);
  const impostos = Number(orc.valor_impostos);
  const total = Number(orc.total);

  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.5);
  doc.roundedRect(boxX, y, boxW, 110, 4, 4);

  const line = (label: string, value: string, bold = false, color?: [number, number, number]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(...(color ?? [39, 39, 42]));
    doc.text(label, boxX + 14, y);
    doc.text(value, boxX + boxW - 14, y, { align: "right" });
  };

  y += 22;
  line("Subtotal", brl(subtotal));
  y += 18;
  line("Desconto", `− ${brl(desconto)}`, false, MUTED);
  y += 18;
  line(
    `Impostos${orc.imposto_percentual ? ` (${Number(orc.imposto_percentual)}%)` : ""}`,
    brl(impostos),
    false,
    MUTED,
  );
  y += 8;
  doc.setDrawColor(228, 228, 231);
  doc.line(boxX + 14, y, boxX + boxW - 14, y);
  y += 20;
  line("TOTAL", brl(total), true, ACCENT);
  y += 22;

  // ---------- Observações ----------
  if (orc.observacoes && orc.observacoes.trim()) {
    if (y > pageH - 120) {
      doc.addPage();
      y = 60;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BRAND);
    doc.text("OBSERVAÇÕES", marginX, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(39, 39, 42);
    const lines = doc.splitTextToSize(orc.observacoes, pageW - marginX * 2);
    doc.text(lines, marginX, y);
    y += lines.length * 12 + 8;
  }

  // ---------- Footer ----------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(228, 228, 231);
    doc.line(marginX, pageH - 40, pageW - marginX, pageH - 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Orçamento #${orc.numero} • Emitido em ${dateBR(orc.data_orcamento)}`,
      marginX,
      pageH - 24,
    );
    doc.text(`Página ${i} de ${pageCount}`, pageW - marginX, pageH - 24, { align: "right" });
  }

  const filename = `orcamento-${String(orc.numero).padStart(4, "0")}-${(orc.cliente_nome ?? "cliente")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.pdf`;
  doc.save(filename);
}
