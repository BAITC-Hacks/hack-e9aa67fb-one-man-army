/**
 * Zod schemas for the 4 dataset files (docs/architecture.md §2). Accepts
 * `{meta, <key>: [...]}` or a bare array at the file level; each row is
 * validated one by one downstream so a single bad row never rejects a file.
 */
import { z } from "zod";

export const Grade = z.enum(["Junior", "Middle", "Senior", "Lead"]);
export type Grade = z.infer<typeof Grade>;

export const SkillLevels = z.record(z.string(), z.number());
export type SkillLevels = z.infer<typeof SkillLevels>;

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

/** `{meta, employees: [...]}` or a bare array. Rows are validated individually. */
export const EmployeesFile = z.union([
  z.object({ meta: z.object({ as_of_date: z.string() }).passthrough().optional(), employees: z.array(z.unknown()) }),
  z.array(z.unknown()),
]);

export const EventsFile = z.union([
  z.object({ meta: z.object({ as_of_date: z.string() }).passthrough().optional(), events: z.array(z.unknown()) }),
  z.array(z.unknown()),
]);

export const SkillsFile = z.object({
  meta: z.object({ as_of_date: z.string() }).passthrough().optional(),
  proficiency_scale: z.record(z.string(), z.string()).optional(),
  skills: z.array(z.unknown()).optional(),
  role_profiles: z.array(z.unknown()).optional(),
});

/** Dismissal overlay row (`dismissals.jsonl`): a per-employee set of dismissed events. */
export const DismissalRow = z.object({ employee_id: z.string(), event_id: z.string() });
export type DismissalRow = z.infer<typeof DismissalRow>;
