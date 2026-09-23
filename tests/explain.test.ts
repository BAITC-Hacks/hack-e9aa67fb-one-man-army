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
      values: { skill: "SK_SYSTEM_DESIGN", effective: 2, required: 4 },
    },
    { kind: "grade", code: "F3", weight: 1, raw: 1, contribution: 1, values: { grade: "Middle" } },
    {
      kind: "participation_history",
      code: "F4",
      weight: 2,
      raw: -1,
      contribution: -2,
      values: { negative: 1 },
    },
  ],
  expected: [{ skill_id: "SK_SYSTEM_DESIGN", from: 2, to: 3, max_level: 5 }],
  rules: [],
};

describe("explain (mock:demo)", () => {
  it("a mock explanation passes the grounding check", async () => {
    const result = await explain(rec, "en");
    expect(result.source).toBe("llm");
    const text = [result.headline, ...result.why, result.expected_progress].join("\n");
    expect(groundingCheck(text, { factors: rec.factors, expected: rec.expected })).toEqual({ grounded: true });
  });

  it("respects the requested locale (ru)", async () => {
    const result = await explain(rec, "ru");
    expect(result.source).toBe("llm");
    expect(result.why.join(" ")).toMatch(/вклад/);
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
    const text = "skill_gap: contributes 6 (skill=SK_SYSTEM_DESIGN, effective=2, required=4)";
    const result = groundingCheck(text, { factors: rec.factors, expected: rec.expected });
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
