/**
 * Eligibility rules property tests (docs/requirements.md R-03, I-01..I-05).
 * Exercises `eligibilityRules` (lib/rules/eligibility.ts) directly against
 * the real 200-employee / 40-event dataset, plus `recommend()` for the
 * audience (role/grade) contract.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getDataset, type Dataset } from "@/lib/data/load";
import { effectiveSkills } from "@/lib/domain/effective";
import { eligibilityRules, type EligFacts } from "@/lib/rules/eligibility";
import { evaluateRules } from "@/lib/rules/engine";
import { recommend } from "@/lib/domain/recommend";

describe("eligibility rules (I-01..I-05) over the full dataset", () => {
  let ds: Dataset;

  beforeAll(async () => {
    ds = await getDataset();
  });

  it("never grants a mandatory event (I-03, N-03)", () => {
    const mandatoryEvents = ds.events.filter((e) => e.mandatory);
    expect(mandatoryEvents.length).toBeGreaterThan(0);
    const emp = ds.employees[0]!;
    const effective = effectiveSkills(emp, ds.history, ds.events).effective;
    for (const event of mandatoryEvents) {
      const facts: EligFacts = { employee: emp, event, ds, effective, history: ds.history, dismissedEventIds: [] };
      const decision = evaluateRules(eligibilityRules, facts);
      expect(decision.granted).toBe(false);
      expect(decision.blockedBy?.ruleId).toBe("not-mandatory");
    }
  });

  it("never grants an event already completed by that employee, except EV_036 (I-04)", () => {
    let checked = 0;
    for (const emp of ds.employees.slice(0, 60)) {
      const effective = effectiveSkills(emp, ds.history, ds.events).effective;
      const completedIds = new Set(
        ds.history
          .filter((r) => r.employee_id === emp.employee_id && r.status === "completed")
          .map((r) => r.event_id),
      );
      for (const eventId of completedIds) {
        if (eventId === "EV_036") continue;
        const event = ds.events.find((e) => e.event_id === eventId);
        if (!event) continue;
        checked++;
        const facts: EligFacts = { employee: emp, event, ds, effective, history: ds.history, dismissedEventIds: [] };
        const decision = evaluateRules(eligibilityRules, facts);
        expect(decision.granted).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("never grants an event with an unmet prerequisite (I-02)", () => {
    let checked = 0;
    for (const emp of ds.employees) {
      const effective = effectiveSkills(emp, ds.history, ds.events).effective;
      for (const event of ds.events) {
        const entries = Object.entries(event.prerequisites);
        if (entries.length === 0) continue;
        const unmet = entries.some(([skillId, min]) => (effective[skillId] ?? 0) < min);
        if (!unmet) continue;
        checked++;
        const facts: EligFacts = { employee: emp, event, ds, effective, history: ds.history, dismissedEventIds: [] };
        const decision = evaluateRules(eligibilityRules, facts);
        // blockedBy is the *first* failing rule in fixed order (not-mandatory,
        // audience-role, audience-grade, prereqs-met, ...), so a candidate that
        // also fails an earlier rule legitimately reports that one instead.
        // The acceptance criterion (I-02) is only that it is never granted.
        expect(decision.granted).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("recommend() never returns an event outside the employee's current role/grade audience (I-01)", () => {
    for (const emp of ds.employees) {
      const result = recommend(emp.employee_id, ds);
      for (const rec of result.recommendations) {
        const event = ds.events.find((e) => e.event_id === rec.event_id);
        expect(event).toBeDefined();
        expect(event?.target_roles).toContain(emp.role);
        expect(event?.target_grades).toContain(emp.grade);
        expect(event?.mandatory).not.toBe(true);
      }
    }
  });

  it("recommend() never re-recommends an event the employee already completed, across all 200 employees (I-04)", () => {
    for (const emp of ds.employees) {
      const completed = new Set(
        ds.history
          .filter((r) => r.employee_id === emp.employee_id && r.status === "completed" && r.event_id !== "EV_036")
          .map((r) => r.event_id),
      );
      if (completed.size === 0) continue;
      const result = recommend(emp.employee_id, ds);
      for (const rec of result.recommendations) {
        expect(completed.has(rec.event_id)).toBe(false);
      }
    }
  });
});
