/**
 * Grounding tests for T3 (ADR-0007, docs/threat-model.md T13).
 *
 * Runs under MODEL_REF=mock:demo (forced in vitest.config.ts), so this proves
 * the offline demo path end to end with no credentials.
 */
import { describe, it, expect } from "vitest";
import { explain } from "@/lib/ai/explain";
import { groundingCheck } from "@/lib/ai/grounding";
import { createMockModel } from "@/lib/ai/mock-provider";
import type { Recommendation } from "@/lib/contracts";

// Shaped to match real `lib/rules/scoring.ts` output (F1 critical skill_gap,
// F3 next_level_requirement, F5 participation_history, F_grade grade), so
// these tests exercise the same factor codes/values the engine produces.
const rec: Recommendation = {
  event_id: "EV_006",
  title: "System Design Workshop",
  type: "workshop",
  format: "offline",
  duration_hours: 8,
  next_session: "2026-10-01",
  score: 12.5,
  factors: [
    {
      kind: "skill_gap",
      code: "F1",
      weight: 3,
      raw: 2,
      contribution: 6,
      values: { closure: 2 },
    },
    {
      kind: "next_level_requirement",
      code: "F3",
      weight: 1,
      raw: 2,
      contribution: 2,
      values: { target: "Senior", largestGap: 2 },
    },
    {
      kind: "grade",
      code: "F_grade",
      weight: 1,
      raw: 1,
      contribution: 1,
      values: { grade: "Middle", targetGrade: "Senior" },
    },
    {
      kind: "participation_history",
      code: "F5",
      weight: -1.5,
      raw: 1,
      contribution: -1.5,
      values: { negativeRecords: 1, positiveOnTime: 2 },
    },
  ],
  expected: [{ skill_id: "SK_SYSTEM_DESIGN", from: 2, to: 3, max_level: 5 }],
  rules: [],
};

describe("explain (mock:demo)", () => {
  it("a mock explanation passes the grounding check and is honestly labelled 'mock', not 'llm'", async () => {
    const result = await explain(rec, "en");
    expect(result.source).toBe("mock");
    const text = [result.headline, ...result.why, result.expected_progress].join("\n");
    expect(groundingCheck(text, { factors: rec.factors, expected: rec.expected })).toEqual({ grounded: true });
  });

  it("the rendered rationale reads as prose, not a key=value dump, and cites >=3 of grade/skill_gap/participation_history/next_level_requirement", async () => {
    const result = await explain(rec, "en");
    const text = result.why.join(" ");
    expect(text).not.toMatch(/\w+=\w+/); // no "closure=2" style debug dump
    expect(text).not.toMatch(/^skill_gap:|^grade:|^participation_history:/);
    const required = ["Middle", "Senior", "2"]; // grade, next_level/skill_gap number, both present
    for (const token of required) expect(text).toContain(token);
  });

  it("respects the requested locale (ru)", async () => {
    const result = await explain(rec, "ru");
    expect(result.source).toBe("mock");
    expect(result.why.join(" ")).toMatch(/грейд|пробел/);
  });

  it("an ungrounded number in the model's reply triggers the deterministic template fallback", async () => {
    const hallucinatingModel = createMockModel("hostile", {
      scenarios: [
        {
          name: "hallucinate",
          match: () => true,
          respond: () => ({
            kind: "object",
            value: {
              headline: rec.title,
              why: [
                "This event raises your salary by 47%.",
                "It guarantees promotion within 6 months.",
                "Every colleague who attended scored 99 out of 100.",
              ],
              expected_progress: "You will reach skill level 9 immediately.",
            },
          }),
        },
      ],
    });

    const result = await explain(rec, "en", hallucinatingModel);
    expect(result.source).toBe("template");
    expect(result.fallbackReason).toBeTruthy();
    expect(result.fallbackReason).toContain("grounding_failed");
    // The template itself must still be grounded.
    const text = [result.headline, ...result.why, result.expected_progress].join("\n");
    expect(groundingCheck(text, { factors: rec.factors, expected: rec.expected })).toEqual({ grounded: true });
  });

  it("a provider that never resolves (timeout) also falls back to the template", async () => {
    const hangingModel = createMockModel("hanging", {
      scenarios: [
        {
          name: "hang",
          match: () => true,
          respond: () => {
            throw new Error("simulated provider outage");
          },
        },
      ],
    });
    const result = await explain(rec, "en", hangingModel);
    expect(result.source).toBe("template");
  });
});

describe("groundingCheck", () => {
  it("rejects a number that does not appear in the factors or expected changes", () => {
    const result = groundingCheck("This will score you 999 points.", {
      factors: rec.factors,
      expected: rec.expected,
    });
    expect(result).toEqual({
      grounded: false,
      reason: 'Number "999" does not appear in the engine\'s factors/expected.',
    });
  });

  it("rejects an SK_/EV_ id that the engine never produced", () => {
    const result = groundingCheck("This unlocks SK_GHOST_SKILL.", { factors: rec.factors, expected: rec.expected });
    expect(result.grounded).toBe(false);
  });

  it("requires at least 3 distinct factor kinds to be cited", () => {
    const text = "This closes a gap worth 6 points."; // "6" only appears in the skill_gap factor's contribution
    const result = groundingCheck(text, { factors: rec.factors, expected: rec.expected });
    expect(result.grounded).toBe(false);
  });

  it("a zero-contribution factor is never counted as 'cited' just because its weight/constant renders as a common digit (e.g. bare 0/1)", () => {
    const factorsWithZero: Recommendation["factors"] = [
      { kind: "skill_gap", code: "F1", weight: 3, raw: 2, contribution: 6, values: { closure: 2 } },
      { kind: "grade", code: "F_grade", weight: 1, raw: 1, contribution: 1, values: { grade: "Middle", targetGrade: "Senior" } },
      // Did NOT contribute: raw is 0. Its weight (1) and contribution (0) must not count as citation evidence.
      { kind: "career_goal", code: "F4", weight: 1, raw: 0, contribution: 0, values: { hasGoal: 0 } },
    ];
    // Only mentions the number "1" (career_goal's weight / grade's raw) and "0" (career_goal's raw/contribution) -
    // neither of those should let career_goal count as a cited, contributing kind.
    const text = "It closes 2 levels of skill gap for Middle heading to Senior (0, 1).";
    const result = groundingCheck(text, { factors: factorsWithZero, expected: [] });
    expect(result.grounded).toBe(false);
  });

  it("does not mistake digits inside a known id (SK_PYTHON3) for an ungrounded bare number", () => {
    const factorsWithDigitId: Recommendation["factors"] = [
      { kind: "skill_gap", code: "F1", weight: 1, raw: 1, contribution: 1, values: { skill: "SK_PYTHON3" } },
      { kind: "grade", code: "F3", weight: 1, raw: 1, contribution: 1, values: { grade: "Middle" } },
      {
        kind: "participation_history",
        code: "F4",
        weight: 2,
        raw: -1,
        contribution: -2,
        values: { negative: 1 },
      },
    ];
    const text =
      "skill_gap: contributes 1 (skill=SK_PYTHON3) grade: contributes 1 (grade=Middle) " +
      "participation_history: contributes -2 (negative=1) Related to SK_PYTHON3.";
    const result = groundingCheck(text, { factors: factorsWithDigitId });
    expect(result.grounded).toBe(true);
  });
});
