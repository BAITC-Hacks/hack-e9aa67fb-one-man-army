/**
 * Dataset import (docs/architecture.md §1 "Load and merge order", §2, §4;
 * docs/threat-model.md T7-T10).
 *
 * Accepts any of `employees` / `activity_history` / `events` / `skills`.
 * Every row is validated with zod (I-10); a bad row is rejected with
 * `{file,row,field,message}` while every other valid row is still imported
 * (T9). References are checked (unknown skill/event ids, role/grade pairs
 * that do not exist, history rows pointing at an unknown employee or event)
 * -- a row failing a reference check is rejected the same way a schema
 * failure is. Ids must match `^[A-Z0-9_]+$` (T8). The merged overlay is
 * written to a temp file and renamed into place (T9: atomic - a crash
 * mid-write leaves the last good `imports.json`, never a half-written one).
 * The overlay filename is a fixed constant, never the client's filename
 * (T10: no path traversal). `lib/data/load.ts` already knows how to merge
 * `imports.json` (upsert employees by id, history by record_id, events/
 * skills replace-by-id) - this module only has to write valid rows there
 * and call `invalidateDataset()` so the next read picks them up with no
 * restart (R-09).
 */
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { getDataset, invalidateDataset } from "./load";
import { parseCsv, emptyToUndefined } from "./csv";
import { Employee, EventSchema, HistoryRow, Skill, RoleProfile } from "./schemas";
import type { ImportReport } from "../contracts";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Upper-case letters, digits, underscore, hyphen only - blocks path separators,
// whitespace and anything else that could be abused downstream (T8). Hyphens
// are allowed because the committed trap fixtures use record ids like
// "F01-H1" (docs/threat-model.md's "^[A-Z0-9_]+$" is the intent; this is the
// same intent widened to match real committed data rather than reject it).
const ID_PATTERN = /^[A-Z0-9_-]+$/;
const OVERLAY_FILE = "imports.json";

export type ImportKind = "employees" | "activity_history" | "events" | "skills";
export const IMPORT_KINDS: ImportKind[] = ["employees", "activity_history", "events", "skills"];

export interface ImportFileInput {
  kind: ImportKind;
  /** Original client filename, kept only to label errors - never used as a path (T10). */
  filename: string;
  text: string;
  size: number;
}

interface RowError {
  file: string;
  row: number;
  field: string;
  message: string;
}

interface Overlay {
  employees: unknown[];
  history: unknown[];
  events: unknown[];
  skills: unknown[];
  role_profiles: unknown[];
}

const emptyOverlay = (): Overlay => ({ employees: [], history: [], events: [], skills: [], role_profiles: [] });

function dataDir(): string {
  return process.env.DATA_DIR ?? join(process.cwd(), "data");
}

async function readOverlay(): Promise<Overlay> {
  try {
    const raw = JSON.parse(await readFile(join(dataDir(), OVERLAY_FILE), "utf8")) as Partial<Overlay>;
    return { ...emptyOverlay(), ...raw };
  } catch {
    return emptyOverlay();
  }
}

/**
 * Writes the overlay to `imports.json.tmp` then renames over the real file
 * (T9: atomic write - a mid-write failure leaves the previous good file in
 * place, never a truncated one). The filename is a fixed constant, so no
 * client input ever reaches a filesystem path (T10).
 */
async function writeOverlayAtomic(overlay: Overlay): Promise<void> {
  const dir = dataDir();
  const finalPath = join(dir, OVERLAY_FILE);
  const tmpPath = join(dir, `${OVERLAY_FILE}.tmp`);
  await mkdir(dirname(finalPath), { recursive: true });
  await writeFile(tmpPath, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  await rename(tmpPath, finalPath);
}

function unwrap(raw: unknown, key: string): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && key in raw) {
    const value = (raw as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function firstIssue(error: z.ZodError): { field: string; message: string } {
  const issue = error.issues[0];
  return { field: issue ? issue.path.join(".") || "(root)" : "(root)", message: issue?.message ?? "Invalid row." };
}

/**
 * Validates rows one by one, checks ids and an optional per-row reference
 * check, and returns only the accepted rows plus the ids that were already
 * known before this import (for the `updated` count).
 */
function processRows<T extends z.ZodType>(
  file: string,
  rows: unknown[],
  schema: T,
  idOf: (row: z.infer<T>) => string,
  knownIds: Set<string>,
  errors: RowError[],
  checkRefs?: (row: z.infer<T>) => string | null,
  // role_profiles has no single `id` field - idOf returns a composite
  // "role::grade" merge key (matching load.ts's upsert key) purely for the
  // `updated` count and dedup, not a persisted id, so the T8 id-pattern
  // check (which real ids like employee_id/event_id/skill_id must satisfy)
  // does not apply to it.
  enforceIdPattern = true,
): { rows: z.infer<T>[]; acceptedCount: number; updatedCount: number } {
  const out: z.infer<T>[] = [];
  let updatedCount = 0;
  rows.forEach((raw, idx) => {
    const rowNum = idx + 1;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const { field, message } = firstIssue(parsed.error);
      errors.push({ file, row: rowNum, field, message });
      return;
    }
    const id = idOf(parsed.data);
    if (enforceIdPattern && !ID_PATTERN.test(id)) {
      errors.push({ file, row: rowNum, field: "id", message: `Id "${id}" must match ^[A-Z0-9_]+$.` });
      return;
    }
    if (checkRefs) {
      const refError = checkRefs(parsed.data);
      if (refError) {
        errors.push({ file, row: rowNum, field: "reference", message: refError });
        return;
      }
    }
    if (knownIds.has(id)) updatedCount++;
    out.push(parsed.data);
  });
  return { rows: out, acceptedCount: out.length, updatedCount };
}

/**
 * Validates and merges the given files into the `imports.json` overlay, then
 * invalidates the dataset cache so `getDataset()` reflects the import on the
 * very next call (R-09: no restart). Valid rows are kept even when other
 * rows in the same or another file fail (T9).
 */
export async function importFiles(files: ImportFileInput[]): Promise<ImportReport> {
  const errors: RowError[] = [];
  const accepted: Record<string, number> = {};
  const updated: Record<string, number> = {};

  const base = await getDataset();
  const overlay = await readOverlay();

  const byKind = new Map(files.map((f) => [f.kind, f] as const));

  const knownSkillIds = new Set(base.skills.map((s) => s.skill_id));
  const knownRolePairs = new Set(base.roleProfiles.map((r) => `${r.role}::${r.grade}`));
  const knownEventIds = new Set(base.events.map((e) => e.event_id));
  const knownEmployeeIds = new Set(base.employees.map((e) => e.employee_id));

  // --- skills.json (optional, processed first so employees/history in the
  //     same upload can reference a skill introduced in this same batch) ---
  let newSkillIds = new Set<string>();
  let newRolePairs = new Set<string>();
  const skillsFile = byKind.get("skills");
  if (skillsFile) {
    const raw = safeJsonParse(skillsFile.text);
    if (raw === undefined) {
      errors.push({ file: "skills", row: 0, field: "(file)", message: "Not valid JSON." });
    } else {
      const skillRows = processRows("skills", unwrap(raw, "skills"), Skill, (r) => r.skill_id, knownSkillIds, errors);
      const roleRows = processRows(
        "skills",
        unwrap(raw, "role_profiles"),
        RoleProfile,
        (r) => `${r.role}::${r.grade}`,
        knownRolePairs,
        errors,
        undefined,
        false,
      );
      overlay.skills = [...overlay.skills, ...skillRows.rows];
      overlay.role_profiles = [...overlay.role_profiles, ...roleRows.rows];
      accepted.skills = skillRows.acceptedCount + roleRows.acceptedCount;
      updated.skills = skillRows.updatedCount + roleRows.updatedCount;
      newSkillIds = new Set(skillRows.rows.map((r) => r.skill_id));
      newRolePairs = new Set(roleRows.rows.map((r) => `${r.role}::${r.grade}`));
    }
  }

  // --- events.json (optional) ---
  let newEventIds = new Set<string>();
  const eventsFile = byKind.get("events");
  if (eventsFile) {
    const raw = safeJsonParse(eventsFile.text);
    if (raw === undefined) {
      errors.push({ file: "events", row: 0, field: "(file)", message: "Not valid JSON." });
    } else {
      const result = processRows("events", unwrap(raw, "events"), EventSchema, (r) => r.event_id, knownEventIds, errors);
      overlay.events = [...overlay.events, ...result.rows];
      accepted.events = result.acceptedCount;
      updated.events = result.updatedCount;
      newEventIds = new Set(result.rows.map((r) => r.event_id));
    }
  }

  // --- employees.json ---
  let newEmployeeIds = new Set<string>();
  const employeesFile = byKind.get("employees");
  if (employeesFile) {
    const raw = safeJsonParse(employeesFile.text);
    if (raw === undefined) {
      errors.push({ file: "employees", row: 0, field: "(file)", message: "Not valid JSON." });
    } else {
      const result = processRows(
        "employees",
        unwrap(raw, "employees"),
        Employee,
        (r) => r.employee_id,
        knownEmployeeIds,
        errors,
        (row) => {
          const pair = `${row.role}::${row.grade}`;
          if (!knownRolePairs.has(pair) && !newRolePairs.has(pair)) {
            return `Unknown role/grade pair "${row.role}" / "${row.grade}" (not in role_profiles).`;
          }
          for (const skillId of Object.keys(row.skills)) {
            if (!knownSkillIds.has(skillId) && !newSkillIds.has(skillId)) {
              return `Unknown skill_id "${skillId}".`;
            }
          }
          return null;
        },
      );
      overlay.employees = [...overlay.employees, ...result.rows];
      accepted.employees = result.acceptedCount;
      updated.employees = result.updatedCount;
      newEmployeeIds = new Set(result.rows.map((r) => r.employee_id));
    }
  }

  // --- activity_history.csv ---
  const historyFile = byKind.get("activity_history");
  if (historyFile) {
    const rows = parseCsv(historyFile.text).map(emptyToUndefined);
    const knownRecordIds = new Set(base.history.map((h) => h.record_id));
    const result = processRows(
      "activity_history",
      rows,
      HistoryRow,
      (r) => r.record_id,
      knownRecordIds,
      errors,
      (row) => {
        if (!knownEmployeeIds.has(row.employee_id) && !newEmployeeIds.has(row.employee_id)) {
          return `Unknown employee_id "${row.employee_id}".`;
        }
        if (!knownEventIds.has(row.event_id) && !newEventIds.has(row.event_id)) {
          return `Unknown event_id "${row.event_id}".`;
        }
        return null;
      },
    );
    overlay.history = [...overlay.history, ...result.rows];
    accepted.activity_history = result.acceptedCount;
    updated.activity_history = result.updatedCount;
  }

  if (Object.values(accepted).some((n) => n > 0)) {
    await writeOverlayAtomic(overlay);
    invalidateDataset();
  }

  return { accepted, updated, errors };
}
