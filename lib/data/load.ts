/**
 * Dataset loader (docs/architecture.md §1).
 *
 * Resolution order: `DATASET_DIR` env var, then `docs/task/career_quest_dataset/`
 * if present, then the committed `data/seed/` (synthetic, same schema). Then it
 * merges overlays from the file store (`lib/store/jsonl.ts`, under `DATA_DIR`):
 * `imports.json` (upsert employees by id, history by record_id, events/skills
 * replace-by-id) -> `completions.jsonl` (in-app completions appended as history
 * rows) -> `dismissals.jsonl` (a per-employee set). `invalidateDataset()` must be
 * called after any mutation so the next read picks it up.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { z } from "zod";
import { readJson, readJsonl } from "../store/jsonl";
import { parseCsv, emptyToUndefined } from "./csv";
import { DismissalRow, Employee, EventSchema, HistoryRow, RoleProfile, Skill, SkillsFile } from "./schemas";
import type { Event } from "./schemas";
export type { Grade, Employee, Event, HistoryRow, RoleProfile, Skill } from "./schemas";

export interface Dataset {
  asOfDate: string;
  skills: Skill[];
  roleProfiles: RoleProfile[];
  employees: Employee[];
  events: Event[];
  history: HistoryRow[];
  /**
   * employee_id -> dismissed event_ids (the `dismissals.jsonl` overlay).
   * Optional so a hand-built test `Dataset` (as used by other Batch 1 tasks)
   * does not have to supply it; readers should do `ds.dismissals?.[id] ?? []`.
   */
  dismissals?: Record<string, string[]>;
}

function resolveDatasetDir(): string {
  const override = process.env.DATASET_DIR;
  if (override && existsSync(override)) return override;
  const kit = join(process.cwd(), "docs/task/career_quest_dataset");
  if (existsSync(kit)) return kit;
  return join(process.cwd(), "data/seed");
}

async function readJsonFile(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function readTextFile(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

/** Accepts either `{meta, <key>: [...]}` or a bare array. */
function unwrap(raw: unknown, key: string): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && key in raw) {
    const value = (raw as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

/** Validates rows one by one so a single bad row never rejects the file. */
function parseEach<T extends z.ZodType>(schema: T, rows: unknown[]): z.infer<T>[] {
  const out: z.infer<T>[] = [];
  for (const row of rows) {
    const result = schema.safeParse(row);
    if (result.success) out.push(result.data);
  }
  return out;
}

function byId<T extends { employee_id?: string; event_id?: string; skill_id?: string; record_id?: string }>(
  rows: T[],
  idOf: (row: T) => string,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) map.set(idOf(row), row);
  return map;
}

/** The shape `import.ts` (T5) writes to `imports.json`. Optional at this stage. */
interface ImportsOverlay {
  employees?: unknown[];
  history?: unknown[];
  events?: unknown[];
  skills?: unknown[];
}

export async function getDataset(): Promise<Dataset> {
  const dir = resolveDatasetDir();
  const skillsRaw = await readJsonFile(join(dir, "skills.json"));
  const employeesRaw = await readJsonFile(join(dir, "employees.json"));
  const eventsRaw = await readJsonFile(join(dir, "events.json"));
  const historyText = await readTextFile(join(dir, "activity_history.csv"));

  const skillsFile = SkillsFile.safeParse(skillsRaw);
  const asOfDate =
    skillsFile.success && skillsFile.data.meta?.as_of_date
      ? skillsFile.data.meta.as_of_date
      : (process.env.AS_OF_DATE ?? new Date().toISOString().slice(0, 10));

  let skills = parseEach(Skill, unwrap(skillsRaw, "skills"));
  let roleProfiles = parseEach(RoleProfile, unwrap(skillsRaw, "role_profiles"));
  let employees = parseEach(Employee, unwrap(employeesRaw, "employees"));
  let events = parseEach(EventSchema, unwrap(eventsRaw, "events"));
  let history = parseEach(HistoryRow, parseCsv(historyText).map(emptyToUndefined));

  // --- overlay: imports.json (upsert employees by id, history by record_id,
  //     events/skills replace-by-id). Optional: absent until T5 lands. ---
  const importsOverlay = await readJson<ImportsOverlay | null>("imports.json", null);
  if (importsOverlay) {
    if (importsOverlay.employees) {
      const merged = byId(employees, (e) => e.employee_id);
      for (const row of parseEach(Employee, importsOverlay.employees)) merged.set(row.employee_id, row);
      employees = [...merged.values()];
    }
    if (importsOverlay.history) {
      const merged = byId(history, (h) => h.record_id);
      for (const row of parseEach(HistoryRow, importsOverlay.history)) merged.set(row.record_id, row);
      history = [...merged.values()];
    }
    if (importsOverlay.events) {
      const merged = byId(events, (e) => e.event_id);
      for (const row of parseEach(EventSchema, importsOverlay.events)) merged.set(row.event_id, row);
      events = [...merged.values()];
    }
    if (importsOverlay.skills) {
      const merged = byId(skills, (s) => s.skill_id);
      for (const row of parseEach(Skill, importsOverlay.skills)) merged.set(row.skill_id, row);
      skills = [...merged.values()];
    }
  }

  // --- overlay: completions.jsonl (in-app completions, appended as history
  //     rows: status completed, assigned_by self, date as_of_date). ---
  const completions = await readJsonl<unknown>("completions.jsonl");
  if (completions.length > 0) {
    const merged = byId(history, (h) => h.record_id);
    for (const row of parseEach(HistoryRow, completions)) merged.set(row.record_id, row);
    history = [...merged.values()];
  }

  // --- overlay: dismissals.jsonl (a per-employee set). ---
  const dismissalRows = await readJsonl<unknown>("dismissals.jsonl");
  const dismissals: Record<string, string[]> = {};
  for (const raw of dismissalRows) {
    const parsed = DismissalRow.safeParse(raw);
    if (!parsed.success) continue;
    const list = dismissals[parsed.data.employee_id] ?? [];
    if (!list.includes(parsed.data.event_id)) list.push(parsed.data.event_id);
    dismissals[parsed.data.employee_id] = list;
  }

  const dataset: Dataset = { asOfDate, skills, roleProfiles, employees, events, history, dismissals };
  return dataset;
}

/**
 * No-op kept for call-site compatibility (docs/architecture.md still calls
 * this out as "invalidate after any mutation"). `getDataset()` used to
 * memoize in a module-scope variable, but Next.js bundles route handlers and
 * server components into separate chunks in production (`output: standalone`),
 * each getting its own copy of that module-scope variable - so a completion
 * written by the API route never invalidated the copy the page's render read
 * from, and a just-completed skill level appeared to "not update" (observed:
 * effective stuck at the pre-completion value after `router.refresh()`).
 * `getDataset()` now always reads straight from disk, so there is nothing to
 * invalidate; every reader sees the latest overlay on every call.
 */
export function invalidateDataset(): void {
  // intentionally empty
}
