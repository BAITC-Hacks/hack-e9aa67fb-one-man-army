/**
 * Minimal real dataset loader (Batch 0).
 *
 * T1 hardens this (extracts `lib/data/schemas.ts` + `lib/data/csv.ts`, adds the
 * `imports.json` / `completions.jsonl` / `dismissals.jsonl` overlay merge from
 * docs/architecture.md §1). For now this file only needs to load and cache a
 * real dataset so other Batch 1 tasks can develop against real shapes instead
 * of guessing.
 *
 * Resolution order (docs/architecture.md §1, §8): `DATASET_DIR` env var, then
 * `docs/task/career_quest_dataset/` if present, then the committed
 * `data/seed/` (synthetic, same schema).
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

export const Grade = z.enum(["Junior", "Middle", "Senior", "Lead"]);
export type Grade = z.infer<typeof Grade>;

const SkillLevels = z.record(z.string(), z.number());

export const Skill = z.object({
  skill_id: z.string(),
  name: z.string(),
  type: z.enum(["hard", "soft"]),
  category: z.string(),
  description: z.string(),
});
export type Skill = z.infer<typeof Skill>;

export const RoleProfile = z.object({
  role: z.string(),
  grade: Grade,
  required_skills: SkillLevels,
  critical_skills: z.array(z.string()),
});
export type RoleProfile = z.infer<typeof RoleProfile>;

export const Employee = z.object({
  employee_id: z.string(),
  full_name: z.string(),
  department: z.string(),
  role: z.string(),
  grade: Grade,
  manager_id: z.string().nullable(),
  hire_date: z.string(),
  tenure_months: z.number(),
  work_format: z.enum(["office", "hybrid", "remote"]),
  preferred_language: z.enum(["kk", "ru", "en"]),
  career_goal: z.object({ target_role: z.string(), target_grade: Grade }).nullable(),
  skills: SkillLevels,
  last_review_date: z.string(),
});
export type Employee = z.infer<typeof Employee>;

export const EventSchema = z.object({
  event_id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.string(),
  format: z.enum(["online", "offline", "self_paced"]),
  duration_hours: z.number(),
  mandatory: z.boolean(),
  target_roles: z.array(z.string()),
  target_grades: z.array(Grade),
  develops_skills: z.array(
    z.object({ skill_id: z.string(), gain: z.number().int().min(0), max_level: z.number().int().min(0).max(5) }),
  ),
  prerequisites: SkillLevels,
  upcoming_sessions: z.array(z.string()),
});
export type Event = z.infer<typeof EventSchema>;

export const HistoryRow = z.object({
  record_id: z.string(),
  employee_id: z.string(),
  event_id: z.string(),
  date: z.string(),
  due_date: z.string().optional(),
  status: z.enum(["completed", "in_progress", "dropped", "no_show", "declined", "overdue"]),
  completion_pct: z.coerce.number().min(0).max(100),
  score: z.coerce.number().optional(),
  feedback_rating: z.coerce.number().int().min(1).max(5).optional(),
  assigned_by: z.enum(["self", "manager", "hr"]),
});
export type HistoryRow = z.infer<typeof HistoryRow>;

export interface Dataset {
  asOfDate: string;
  skills: Skill[];
  roleProfiles: RoleProfile[];
  employees: Employee[];
  events: Event[];
  history: HistoryRow[];
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

/** A ~40-line RFC-4180-ish CSV parser: header row, quoted fields, no dependency. */
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

/** Accepts either `{meta, <key>: [...]}` or a bare array. */
function unwrap(raw: unknown, key: string): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && key in raw) {
    const value = (raw as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

/**
 * CSV cells are always strings, even when empty. An empty cell must become
 * `undefined` before validation, or `z.coerce.number()` on an optional column
 * turns "" into 0 - which then fails a `min(1)` and rejects the whole row.
 */
function emptyToUndefined(row: Record<string, string>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(row)) out[key] = value === "" ? undefined : value;
  return out;
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

let cached: Dataset | null = null;

export async function getDataset(): Promise<Dataset> {
  if (cached) return cached;

  const dir = resolveDatasetDir();
  const skillsRaw = await readJsonFile(join(dir, "skills.json"));
  const employeesRaw = await readJsonFile(join(dir, "employees.json"));
  const eventsRaw = await readJsonFile(join(dir, "events.json"));
  const historyText = await readTextFile(join(dir, "activity_history.csv"));

  const asOfDate =
    skillsRaw &&
    typeof skillsRaw === "object" &&
    "meta" in skillsRaw &&
    skillsRaw.meta &&
    typeof skillsRaw.meta === "object" &&
    "as_of_date" in skillsRaw.meta &&
    typeof (skillsRaw.meta as Record<string, unknown>).as_of_date === "string"
      ? ((skillsRaw.meta as Record<string, unknown>).as_of_date as string)
      : (process.env.AS_OF_DATE ?? new Date().toISOString().slice(0, 10));

  const dataset: Dataset = {
    asOfDate,
    skills: parseEach(Skill, unwrap(skillsRaw, "skills")),
    roleProfiles: parseEach(RoleProfile, unwrap(skillsRaw, "role_profiles")),
    employees: parseEach(Employee, unwrap(employeesRaw, "employees")),
    events: parseEach(EventSchema, unwrap(eventsRaw, "events")),
    history: parseEach(HistoryRow, parseCsv(historyText).map(emptyToUndefined)),
  };

  cached = dataset;
  return dataset;
}

/** Clears the in-memory cache. Call after any mutation (import, completion, dismissal). */
export function invalidateDataset(): void {
  cached = null;
}
