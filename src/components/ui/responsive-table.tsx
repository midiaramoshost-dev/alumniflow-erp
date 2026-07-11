import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * ResponsiveTable
 * - Mobile (< md): renders as a card list; the "primary" columns show inline,
 *   remaining columns collapse into an expandable panel — no horizontal scroll.
 * - Desktop (>= md): renders a native table; users can toggle columns via
 *   a "Columns" menu.
 * - Built-in pagination.
 */

export type ResponsiveColumn<T> = {
  /** Unique id, also used as the visibility key. */
  id: string;
  /** Header label. */
  header: React.ReactNode;
  /** Cell renderer. */
  cell: (row: T, index: number) => React.ReactNode;
  /**
   * Priority: shown on mobile inline. Others collapse behind a chevron.
   * Order controls what appears first on mobile.
   */
  priority?: "primary" | "secondary" | "hidden";
  /** Hide on desktop by default (still toggleable via menu). */
  defaultHidden?: boolean;
  className?: string;
  headerClassName?: string;
};

export interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  data: T[];
  /** Unique row key extractor. Required for stable rendering. */
  getRowId: (row: T, index: number) => string;
  /** Optional row click / navigate. */
  onRowClick?: (row: T) => void;
  /** Empty state slot. */
  empty?: React.ReactNode;
  /** Enable pagination (client-side). Default: true. */
  pagination?: boolean;
  /** Default page size. */
  defaultPageSize?: number;
  /** Page size options. */
  pageSizeOptions?: number[];
  /** Optional caption above the table (e.g. filters, search). */
  toolbar?: React.ReactNode;
  className?: string;
}

export function ResponsiveTable<T>({
  columns,
  data,
  getRowId,
  onRowClick,
  empty,
  pagination = true,
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  toolbar,
  className,
}: ResponsiveTableProps<T>) {
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(defaultPageSize);
  const [visibility, setVisibility] = React.useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        columns.map((c) => [c.id, !c.defaultHidden && c.priority !== "hidden"]),
      ),
  );

  const visibleColumns = React.useMemo(
    () => columns.filter((c) => visibility[c.id] !== false),
    [columns, visibility],
  );

  const total = data.length;
  const pageCount = pagination ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const currentPage = Math.min(pageIndex, pageCount - 1);

  React.useEffect(() => {
    if (pageIndex > pageCount - 1) setPageIndex(0);
  }, [pageCount, pageIndex]);

  const pageRows = React.useMemo(() => {
    if (!pagination) return data;
    const start = currentPage * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, pagination, currentPage, pageSize]);

  const primaryCols = visibleColumns.filter((c) => c.priority !== "secondary");
  const secondaryCols = visibleColumns.filter((c) => c.priority === "secondary");

  return (
    <div className={cn("space-y-3", className)}>
      {(toolbar || columns.length > 3) && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0 flex-1">{toolbar}</div>
          <div className="shrink-0">
            <ColumnsMenu
              columns={columns}
              visibility={visibility}
              onChange={setVisibility}
            />
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((c) => (
                <TableHead key={c.id} className={cn(c.headerClassName)}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length}
                  className="text-center text-muted-foreground py-10"
                >
                  {empty ?? "Nenhum registro encontrado."}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, i) => (
                <TableRow
                  key={getRowId(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {visibleColumns.map((c) => (
                    <TableCell key={c.id} className={cn(c.className)}>
                      {c.cell(row, currentPage * pageSize + i)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {pageRows.length === 0 ? (
          <div className="rounded-lg border bg-card py-10 text-center text-muted-foreground text-sm">
            {empty ?? "Nenhum registro encontrado."}
          </div>
        ) : (
          pageRows.map((row, i) => (
            <MobileRow
              key={getRowId(row, i)}
              row={row}
              index={currentPage * pageSize + i}
              primary={primaryCols}
              secondary={secondaryCols}
              onClick={onRowClick}
            />
          ))
        )}
      </div>

      {pagination && (
        <Pagination
          total={total}
          pageIndex={currentPage}
          pageSize={pageSize}
          pageCount={pageCount}
          pageSizeOptions={pageSizeOptions}
          onPageChange={setPageIndex}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPageIndex(0);
          }}
        />
      )}
    </div>
  );
}

function MobileRow<T>({
  row,
  index,
  primary,
  secondary,
  onClick,
}: {
  row: T;
  index: number;
  primary: ResponsiveColumn<T>[];
  secondary: ResponsiveColumn<T>[];
  onClick?: (row: T) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [first, ...rest] = primary;
  return (
    <div className="rounded-lg border bg-card shadow-card">
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 p-3",
          onClick && "cursor-pointer",
        )}
        onClick={onClick ? () => onClick(row) : undefined}
      >
        <div className="min-w-0 space-y-1.5">
          {first && (
            <div className="min-w-0 text-sm font-semibold text-foreground break-words">
              {first.cell(row, index)}
            </div>
          )}
          {rest.map((c) => (
            <div key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-xs">
              <span className="text-muted-foreground shrink-0">{c.header}</span>
              <span className="min-w-0 text-foreground break-words text-right">
                {c.cell(row, index)}
              </span>
            </div>
          ))}
        </div>
        {secondary.length > 0 && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={open ? "Recolher detalhes" : "Expandir detalhes"}
                onClick={(e) => e.stopPropagation()}
                className="h-10 w-10 shrink-0"
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    open && "rotate-180",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </div>
      {secondary.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleContent>
            <div className="border-t px-3 py-3 space-y-2 bg-muted/30">
              {secondary.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-xs"
                >
                  <span className="text-muted-foreground shrink-0">{c.header}</span>
                  <span className="min-w-0 text-foreground break-words text-right">
                    {c.cell(row, index)}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function ColumnsMenu<T>({
  columns,
  visibility,
  onChange,
}: {
  columns: ResponsiveColumn<T>[];
  visibility: Record<string, boolean>;
  onChange: (v: Record<string, boolean>) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 md:h-9 gap-2"
          aria-label="Alternar colunas visíveis"
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Colunas</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.id}
            checked={visibility[c.id] !== false}
            onCheckedChange={(v) => onChange({ ...visibility, [c.id]: !!v })}
            onSelect={(e) => e.preventDefault()}
          >
            {typeof c.header === "string" ? c.header : c.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Pagination({
  total,
  pageIndex,
  pageSize,
  pageCount,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: {
  total: number;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  pageSizeOptions: number[];
  onPageChange: (i: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);
  return (
    <div className="grid grid-cols-1 gap-3 sm:flex sm:items-center sm:justify-between text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-muted-foreground shrink-0">Linhas</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className="h-10 md:h-9 w-[84px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground truncate">
          {from}-{to} de {total}
        </span>
      </div>
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 md:h-9 md:w-9"
          onClick={() => onPageChange(0)}
          disabled={pageIndex === 0}
          aria-label="Primeira página"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 md:h-9 md:w-9"
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={pageIndex === 0}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-muted-foreground num-tabular whitespace-nowrap">
          {pageIndex + 1} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 md:h-9 md:w-9"
          onClick={() => onPageChange(pageIndex + 1)}
          disabled={pageIndex >= pageCount - 1}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 md:h-9 md:w-9"
          onClick={() => onPageChange(pageCount - 1)}
          disabled={pageIndex >= pageCount - 1}
          aria-label="Última página"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
