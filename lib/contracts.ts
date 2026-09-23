/**
 * Shared domain contracts (Halyk Career Quest).
 *
 * Frozen after Batch 0 (see docs/architecture.md §3). Changing a shape here
 * requires a note in docs/architecture.md and a message to every owner - every
 * Batch 1 task codes against these exact schemas/types.
 *
 * One deliberate fix vs. the architecture prose: `Count` there reads
 * `z.number().int().min(5)` with a comment saying "0 is also shown; 1-4 is
 * suppressed". Taken literally that schema rejects 0, which contradicts the
 * comment and would break hr.ts at the type level. Implemented here as
 * `z.number().int().min(0)` so 0 passes through and 1-4 is represented by the
 * `{suppressed:true}` branch instead - the intent in the prose, not the typo.
 */
import { z } from "zod";

export const Grade = z.enum(["Junior", "Middle", "Senior", "Lead"]);
export type Grade = z.infer<typeof Grade>;

export const Locale = z.enum(["kk", "ru", "en"]);
export type Locale = z.infer<typeof Locale>;

export const FactorKind = z.enum([
  "grade",
  "skill_gap",
  "next_level_requirement",
  "participation_history",
  "career_goal",
  "session_availability",
  "pending_gain",
  "effort_fit",
]);
export type FactorKind = z.infer<typeof FactorKind>;

export const Factor = z.object({
  kind: FactorKind,
  code: z.string(),
  weight: z.number(),
  raw: z.number(),
  contribution: z.number(),
  values: z.record(z.string(), z.union([z.string(), z.number()])),
});
export type Factor = z.infer<typeof Factor>;

export const GapRow = z.object({
  skill_id: z.string(),
  name: z.string(),
  assessed: z.number(),
  effective: z.number(),
  required: z.number(),
  gap: z.number(),
  critical: z.boolean(),
  pendingFrom: z.array(z.object({ event_id: z.string(), date: z.string() })),
});
export type GapRow = z.infer<typeof GapRow>;

export const Trajectory = z.object({
  current: z.object({ role: z.string(), grade: Grade }),
  target: z.object({
    role: z.string(),
    grade: Grade,
    source: z.enum(["goal", "next_grade", "hold"]),
  }),
  gaps: z.array(GapRow),
  percentMet: z.number(),
  currentGradeGaps: z.array(GapRow),
});
export type Trajectory = z.infer<typeof Trajectory>;

export const RuleTraceEntry = z.object({
  ruleId: z.string(),
  description: z.string(),
  source: z.string().optional(),
  status: z.enum(["pass", "fail", "undetermined", "not-applicable"]),
  detail: z.string().optional(),
});
export type RuleTraceEntry = z.infer<typeof RuleTraceEntry>;

export const Recommendation = z.object({
  event_id: z.string(),
  title: z.string(),
  type: z.string(),
  format: z.string(),
  duration_hours: z.number(),
  next_session: z.string().nullable(),
  score: z.number(),
  /** Asserted (not just typed) to be >= 3 distinct kinds where consumed. */
  factors: z.array(Factor),
  expected: z.array(
    // `name` is additive/optional (the final review #4): the human-readable
    // skill name, so the AI explanation layer never has to cite a raw SK_*
    // id in prose. Old producers that omit it still validate.
    z.object({ skill_id: z.string(), name: z.string().optional(), from: z.number(), to: z.number(), max_level: z.number() }),
  ),
  rules: z.array(RuleTraceEntry),
  /** Additive, optional, backward compatible: set when this is the single
   * best-scoring eligible/gap-closing candidate returned in place of a
   * LOW_FIT noStep (every eligible candidate scored <= 0). Old consumers
   * that never set it still validate. */
  lowFit: z.boolean().optional(),
});
export type Recommendation = z.infer<typeof Recommendation>;

export const NoStepReason = z.enum([
  "AT_TOP_NO_GAP",
  "NO_GAP_TO_NEXT",
  "PREREQ_BLOCKED",
  "NO_SESSION",
  "CATALOGUE_GAP",
  "ALL_DONE",
  "DATA_INCOMPLETE",
  // Appended, backward compatible: eligible candidates exist (gaps are
  // real and the catalogue has a matching event) but every candidate's
  // score is <= 0 (typically a heavy F5 participation penalty). Distinct
  // from DATA_INCOMPLETE, which means the profile itself is broken.
  "LOW_FIT",
]);
export type NoStepReason = z.infer<typeof NoStepReason>;

export const RecommendationResult = z.object({
  employee_id: z.string(),
  scoringVersion: z.literal("scoring.v1"),
  asOf: z.string(),
  recommendations: z.array(Recommendation).max(3),
  noStep: NoStepReason.nullable(),
  blocked: z.array(
    z.object({ event_id: z.string(), title: z.string(), failedRule: z.string(), detail: z.string() }),
  ),
});
export type RecommendationResult = z.infer<typeof RecommendationResult>;

export const Explanation = z.object({
  event_id: z.string(),
  headline: z.string(),
  why: z.array(z.string()).min(3).max(5),
  expected_progress: z.string(),
  /** "llm" = a live provider call; "mock" = the offline scripted model (still
   *  ran through generateStructured + grounding, just deterministic); "template"
   *  = the deterministic fallback used on any failure. Never label "mock" as "llm". */
  source: z.enum(["llm", "mock", "template"]),
  fallbackReason: z.string().optional(),
});
export type Explanation = z.infer<typeof Explanation>;

/**
 * Development suggestion for an employee the deterministic engine could not
 * match to any catalogue recommendation (operator-approved extension,
 * 2026-09-23; noStep ALL_DONE / PREREQ_BLOCKED / CATALOGUE_GAP only). The
 * model proposes; it never creates a catalogue event, changes a
 * recommendation, or writes state - see lib/ai/suggest.ts.
 */
export const SuggestionType = z.enum([
  "prerequisite_path",
  "mentoring",
  "stretch_assignment",
  "peer_learning",
  "request_training",
  "maintain_and_share",
]);
export type SuggestionType = z.infer<typeof SuggestionType>;

export const Suggestion = z.object({
  type: SuggestionType,
  skill_id: z.string(),
  /** Only meaningful for prerequisite_path: existing blocked event_ids that would unlock once the gap closes. */
  event_ids: z.array(z.string()).optional(),
  /** Always code-generated (type + localized skill/event name) - never taken from model text. */
  title: z.string(),
  rationale: z.string(),
  generatedBy: z.enum(["ai", "template"]).optional(),
});
export type Suggestion = z.infer<typeof Suggestion>;

export const SuggestionResult = z.object({
  employee_id: z.string(),
  noStep: NoStepReason,
  suggestions: z.array(Suggestion).max(3),
  source: z.enum(["llm", "mock", "template"]),
  /** "no_reliable_suggestion": nothing survived validation - zero suggestions, never padded from the template. */
  status: z.enum(["ok", "no_reliable_suggestion"]).optional(),
  fallbackReason: z.string().optional(),
});
export type SuggestionResult = z.infer<typeof SuggestionResult>;

export const ProgressResult = z.object({
  event_id: z.string(),
  changes: z.array(
    z.object({
      skill_id: z.string(),
      before: z.number(),
      after: z.number(),
      gain: z.number(),
      max_level: z.number(),
      capped: z.boolean(),
    }),
  ),
  trajectoryBefore: Trajectory,
  trajectoryAfter: Trajectory,
  recommendations: RecommendationResult,
});
export type ProgressResult = z.infer<typeof ProgressResult>;

/** 0 is shown as-is; 1-4 must be represented as `{suppressed:true}`; n>=5 is shown. */
export const Count = z.union([z.number().int().min(0), z.object({ suppressed: z.literal(true) })]);
export type Count = z.infer<typeof Count>;

export const HrAggregates = z.object({
  n: z.number(),
  laggingSkills: z.array(
    z.object({
      skill_id: z.string(),
      name: z.string(),
      belowOwnGrade: Count,
      belowTarget: Count,
      criticalBelowTarget: Count,
    }),
  ),
  noStep: z.array(
    z.object({
      employee_id: z.string(),
      full_name: z.string(),
      role: z.string(),
      grade: Grade,
      reason: NoStepReason,
    }),
  ),
  participation: z.array(
    z.object({
      event_id: z.string(),
      title: z.string(),
      mandatory: z.boolean(),
      byStatus: z.record(z.string(), Count),
      completionRate: z.number().nullable(),
    }),
  ),
});
export type HrAggregates = z.infer<typeof HrAggregates>;

export const ImportReport = z.object({
  accepted: z.record(z.string(), z.number()),
  updated: z.record(z.string(), z.number()),
  errors: z.array(
    z.object({ file: z.string(), row: z.number(), field: z.string(), message: z.string() }),
  ),
});
export type ImportReport = z.infer<typeof ImportReport>;

export const Session = z.discriminatedUnion("role", [
  z.object({ role: z.literal("employee"), employeeId: z.string() }),
  z.object({ role: z.literal("hr"), id: z.literal("HR01") }),
]);
export type Session = z.infer<typeof Session>;
