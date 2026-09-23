/**
 * Minimal RFC-4180-ish CSV parser (header row, quoted fields). No dependency,
 * per the complexity budget (docs/architecture.md §10).
 */

/** Parses CSV text into an array of header-keyed string records. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const header = rows[0];
  if (!header) return [];
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, idx) => {
      record[key] = cells[idx] ?? "";
    });
    return record;
  });
}

/**
 * CSV cells are always strings, even when empty. An empty cell must become
 * `undefined` before validation, or `z.coerce.number()` on an optional column
 * turns "" into 0 - which then fails a `min(1)` and rejects the whole row.
 * (Kept from the Batch 0 loader - do not drop this when parsing history rows.)
 */
export function emptyToUndefined(row: Record<string, string>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(row)) out[key] = value === "" ? undefined : value;
  return out;
}
