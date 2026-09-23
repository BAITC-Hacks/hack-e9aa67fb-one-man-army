/**
 * UI string dictionary. `en` is the source of truth and is complete; `ru`
 * and `kk` are cloned from `en` as placeholders (allowed by the T4
 * acceptance criterion in docs/plan.md). T9 replaces the `ru`/`kk` clones
 * with real translations - the key set must stay identical, which is
 * guaranteed here because both are spread copies of `en`.
 */
import type { Locale } from "../i18n/i18n";

const en: Record<string, string> = {
  "app.title": "Halyk Career Quest",
  "app.tagline": "See your growth path and the training that moves it forward.",

  "common.retry": "Try again",
  "common.back": "Back",
  "common.loading": "Loading…",
  "common.language": "Language",
  "common.logout": "Log out",
  "common.hr": "HR",
  "common.you": "You",
  "common.viewingAsHr": "Viewing as HR",

  "error.unavailable.title": "Not available right now",
  "error.unavailable.body":
    "The engine that computes this page is still starting up. Nothing was lost - try again in a moment.",
  "error.forbidden.title": "This profile isn't yours",
  "error.forbidden.body": "You can only open your own profile. Log in as HR to view other employees.",
  "error.notFound.title": "We couldn't find that",
  "error.notFound.body": "Check the id and try again, or go back.",

  "login.title": "Sign in",
  "login.subtitle": "Pick a demo identity. No password or personal account is needed to try this product.",
  "login.employeeLabel": "I am an employee",
  "login.employeeSelectLabel": "Choose your employee id",
  "login.employeeSelectHint": "This is a demo picker; in production this step is your existing company login.",
  "login.employeeButton": "Continue as employee",
  "login.hrLabel": "I am from HR",
  "login.hrButton": "Continue as HR",
  "login.loading": "Loading demo identities…",
  "login.empty.title": "No demo employees found",
  "login.empty.body": "The seed dataset did not load. Check the server logs and reload this page.",
  "login.error.title": "Couldn't sign in",
  "login.error.body": "Something went wrong starting the session. Try again.",

  "employee.trajectory.title": "Career trajectory",
  "employee.trajectory.current": "Current",
  "employee.trajectory.target": "Target",
  "employee.trajectory.target.goal": "your stated career goal",
  "employee.trajectory.target.next_grade": "the next grade",
  "employee.trajectory.target.hold": "holding at Lead",
  "employee.trajectory.percentMet": "Requirements met",

  "gaps.title": "Skill gaps toward the target",
  "gaps.currentGradeTitle": "Gaps at your current grade",
  "gaps.skill": "Skill",
  "gaps.assessed": "Assessed",
  "gaps.effective": "Effective",
  "gaps.required": "Required",
  "gaps.gap": "Gap",
  "gaps.critical": "Critical",
  "gaps.criticalYes": "Critical for target",
  "gaps.pendingFrom": "Pending gain from",
  "gaps.empty": "No gaps recorded - every required skill is already at or above target.",

  "recs.title": "Recommended next steps",
  "recs.subtitle": "Up to three, ranked by how much they close a real, critical gap - not by popularity.",
  "recs.empty.title": "No step to recommend right now",
  "recs.empty.body": "This isn't an error. See the reason below for why the engine found nothing to add.",
  "recs.noStep.AT_TOP_NO_GAP": "You're already at the top grade with no open gap.",
  "recs.noStep.NO_GAP_TO_NEXT": "Nothing in the catalogue closes a gap toward your next step.",
  "recs.noStep.PREREQ_BLOCKED": "Available events are blocked on a prerequisite you don't yet have.",
  "recs.noStep.NO_SESSION": "A relevant event exists but has no upcoming session.",
  "recs.noStep.CATALOGUE_GAP": "No event in the catalogue develops the skill you need.",
  "recs.noStep.ALL_DONE": "You've completed everything currently relevant.",
  "recs.noStep.DATA_INCOMPLETE": "Your profile is missing data the engine needs to recommend a step.",
  "recs.score": "Score",
  "recs.scoringVersion": "Scoring",
  "recs.duration": "Duration",
  "recs.durationHours": "{h} h",
  "recs.format": "Format",
  "recs.nextSession": "Next session",
  "recs.noSession": "No upcoming session",
  "recs.whyThisStep": "Why this step",
  "recs.hideWhy": "Hide the breakdown",
  "recs.factorsTitle": "Score breakdown",
  "recs.factor.kind": "Factor",
  "recs.factor.weight": "Weight",
  "recs.factor.raw": "Raw",
  "recs.factor.contribution": "Contribution",
  "recs.rulesTitle": "Eligibility trace",
  "recs.expectedTitle": "Expected skill change",
  "recs.expectedRow": "{skill}: {from} → {to} (cap {max})",
  "recs.completeButton": "Mark complete",
  "recs.completing": "Recording…",
  "recs.completeSuccess": "Marked complete. Your trajectory has been updated below.",
  "recs.completeError": "Couldn't record this completion. Try again.",
  "recs.dismissButton": "Not useful for me",
  "recs.dismissing": "Removing…",
  "recs.dismissSuccess": "Removed from your recommendations.",
  "recs.dismissError": "Couldn't remove this. Try again.",
  "recs.availableLaterTitle": "Not eligible right now",
  "recs.availableLaterEmpty": "Nothing is currently blocked.",

  "factor.kind.grade": "Your grade",
  "factor.kind.skill_gap": "Skill gap",
  "factor.kind.next_level_requirement": "Next-level requirement",
  "factor.kind.participation_history": "Participation history",
  "factor.kind.career_goal": "Career goal",
  "factor.kind.session_availability": "Session availability",
  "factor.kind.pending_gain": "Pending gain",
  "factor.kind.effort_fit": "Effort fit",

  "rule.status.pass": "Passed",
  "rule.status.fail": "Failed",
  "rule.status.undetermined": "Undetermined",
  "rule.status.not-applicable": "Not applicable",

  "progress.title": "What just changed",
  "progress.before": "Before",
  "progress.after": "After",
  "progress.gain": "Gain",
  "progress.capped": "Capped at the event's max level",

  "employee.loading": "Loading your profile…",

  "hr.title": "HR overview",
  "hr.subtitle": "Aggregate signal only - never a per-employee ranking.",
  "hr.sampleSize": "Employees covered: {n}",
  "hr.importLink": "Upload activity data",
  "hr.loading": "Loading HR aggregates…",
  "hr.suppressed": "Hidden (fewer than 5 employees)",

  "hr.lagging.title": "Lagging skills",
  "hr.lagging.subtitle": "Skills where employees fall short of their own grade or their target grade.",
  "hr.lagging.skill": "Skill",
  "hr.lagging.belowOwnGrade": "Below own grade",
  "hr.lagging.belowTarget": "Below target",
  "hr.lagging.criticalBelowTarget": "Critical & below target",
  "hr.lagging.empty": "No lagging skills to show for this group.",

  "hr.noStep.title": "Employees with no recommended step",
  "hr.noStep.subtitle": "Listed by employee id, not ranked.",
  "hr.noStep.employee": "Employee",
  "hr.noStep.role": "Role",
  "hr.noStep.grade": "Grade",
  "hr.noStep.reason": "Reason",
  "hr.noStep.empty": "Every employee currently has at least one recommended step.",

  "hr.participation.title": "Participation by activity",
  "hr.participation.subtitle": "Status counts and completion rate per event.",
  "hr.participation.event": "Event",
  "hr.participation.mandatory": "Mandatory",
  "hr.participation.mandatoryYes": "Mandatory",
  "hr.participation.mandatoryNo": "Optional",
  "hr.participation.completionRate": "Completion rate",
  "hr.participation.noRate": "Not enough data",
  "hr.participation.empty": "No activity recorded yet.",

  "lang.kk": "Қазақша",
  "lang.ru": "Русский",
  "lang.en": "English",
};

export const dict: Record<Locale, Record<string, string>> = {
  en,
  ru: { ...en },
  kk: { ...en },
};

/** Looks up `key` in `locale`, falling back to the raw key. */
export function t(locale: Locale, key: string): string {
  return dict[locale][key] ?? key;
}

/** `t` with `{placeholder}` substitution, e.g. format("recs.durationHours", { h: 3 }). */
export function tf(locale: Locale, key: string, vars: Record<string, string | number>): string {
  const template = dict[locale][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
