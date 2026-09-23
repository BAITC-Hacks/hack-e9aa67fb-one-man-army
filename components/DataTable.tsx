"use client";

/**
 * Reusable search + sort table. Server pages pass plain, JSON-serialisable
 * columns/rows (no functions cross the server -> client boundary); cell
 * rendering is driven entirely by `type`, never by a render callback.
 */
import { useId, useMemo, useState } from "react";
import { Pill, type PillTone } from "./Pill";

export type DataTableColumnType = "text" | "number" | "count" | "pill";

export interface DataTableColumn {
  key: string;
  header: string;
  sortable?: boolean;
  /** Defaults to "text". */
  type?: DataTableColumnType;
  /** Defaults to true for "text"/"pill" columns, false otherwise. */
  searchable?: boolean;
  /** Appended after a formatted "number" value, e.g. "%". */
  suffix?: string;
}

export type DataTableCell =
  | string
  | number
  | null
  | undefined
  | { suppressed: true }
  | { label: string; title?: string; tone: PillTone };

export interface DataTableRow {
  id: string;
  cells: Record<string, DataTableCell>;
}

export interface DataTableProps {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  searchPlaceholder: string;
  noMatchesText: string;
  /** "{n} results" - {n} is replaced with the visible row count. */
  resultCountTemplate: string;
  suppressedLabel: string;
  suppressedTitle: string;
  /** Shown for null/undefined "number" cells. Defaults to "-". */
  emptyCellText?: string;
  minWidthClassName?: string;
}

type SortDir = "asc" | "desc";

function toText(cell: DataTableCell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "object") {
    if ("suppressed" in cell) return "";
    return cell.label;
  }
  return String(cell);
}

function toNumeric(cell: DataTableCell): number {
  if (cell === null || cell === undefined) return -Infinity;
  if (typeof cell === "object") {
    // Suppressed groups (n 1-4) and unknown values sort as lowest, not as 0.
    if ("suppressed" in cell) return -1;
    return -Infinity;
  }
  return typeof cell === "number" ? cell : -Infinity;
}

export function DataTable({
  columns,
  rows,
  searchPlaceholder,
  noMatchesText,
  resultCountTemplate,
  suppressedLabel,
  suppressedTitle,
  emptyCellText = "-",
  minWidthClassName = "min-w-[560px]",
}: DataTableProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);
  const searchId = useId();

  const searchableKeys = useMemo(
    () =>
      columns
        .filter((col) => col.searchable ?? (col.type === "text" || col.type === undefined || col.type === "pill"))
        .map((col) => col.key),
    [columns],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => searchableKeys.some((key) => toText(row.cells[key]).toLowerCase().includes(needle)));
  }, [rows, query, searchableKeys]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    const isNumeric = col?.type === "number" || col?.type === "count";
    const copy = [...filtered];
    copy.sort((a, b) => {
      let result: number;
      if (isNumeric) {
        result = toNumeric(a.cells[sort.key]) - toNumeric(b.cells[sort.key]);
      } else {
        const at = toText(a.cells[sort.key]).toLowerCase();
        const bt = toText(b.cells[sort.key]).toLowerCase();
        result = at < bt ? -1 : at > bt ? 1 : 0;
      }
      return sort.dir === "asc" ? result : -result;
    });
    return copy;
  }, [filtered, sort, columns]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function renderCell(col: DataTableColumn, cell: DataTableCell) {
    const type = col.type ?? "text";
    if (type === "count") {
      if (typeof cell === "object" && cell !== null && "suppressed" in cell) {
        return (
          <span
            title={suppressedTitle}
            className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-neutral-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-neutral-text)]"
          >
            {suppressedLabel}
          </span>
        );
      }
      return <span className="tabular-nums">{typeof cell === "number" ? cell : emptyCellText}</span>;
    }
    if (type === "number") {
      return (
        <span className="tabular-nums">
          {typeof cell === "number" ? `${cell}${col.suffix ?? ""}` : emptyCellText}
        </span>
      );
    }
    if (type === "pill") {
      if (cell && typeof cell === "object" && "label" in cell) {
        return (
          <Pill tone={cell.tone} title={cell.title}>
            {cell.label}
          </Pill>
        );
      }
      return null;
    }
    return <>{toText(cell)}</>;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <label htmlFor={searchId} className="sr-only">
          {searchPlaceholder}
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="min-h-[44px] w-full max-w-xs rounded-md border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        />
        <span className="text-xs text-[var(--color-muted)]">{resultCountTemplate.replace("{n}", String(sorted.length))}</span>
      </div>
      <div aria-live="polite" className="sr-only">
        {resultCountTemplate.replace("{n}", String(sorted.length))}
      </div>
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidthClassName} border-collapse text-sm`}>
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-[var(--color-muted)]">
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                const ariaSort = !col.sortable ? undefined : isSorted ? (sort!.dir === "asc" ? "ascending" : "descending") : "none";
                return (
                  <th key={col.key} scope="col" className="px-3 py-2 font-medium first:pl-0 last:pr-0" aria-sort={ariaSort}>
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 rounded font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                      >
                        {col.header}
                        <span aria-hidden="true" className="text-[10px]">
                          {isSorted ? (sort!.dir === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-6 text-center text-sm text-[var(--color-muted)]">
                  {noMatchesText}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={row.id} className="border-b border-[var(--color-line)] last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 first:pl-0 last:pr-0 text-[var(--color-ink)]">
                      {renderCell(col, row.cells[col.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
