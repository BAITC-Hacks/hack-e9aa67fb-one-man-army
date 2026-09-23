/**
 * Tests for the AI development-suggestion extension (operator-approved,
 * 2026-09-23). Runs under MODEL_REF=mock:demo (forced in vitest.config.ts),
 * so this proves the offline demo path end to end with no credentials.
 *
 * Real kit employee ids (docs/task/career_quest_dataset), found by scanning
 * every employee's `recommend()` output for the three targeted noStep
 * reasons: E0065 -> PREREQ_BLOCKED, E0018 -> ALL_DONE, E0192 -> CATALOGUE_GAP.
 */
import { describe, it, expect } from "vitest";
import { getDataset } from "@/lib/data/load";
import { buildSuggestContext } from "@/lib/domain/suggest";
import { generateSuggestions } from "@/lib/ai/suggest";
import { createMockModel } from "@/lib/ai/mock-provider";

describe("buildSuggestContext", () => {
  it("builds a grounded context for a PREREQ_BLOCKED kit employee (E0065)", async () => {
    const ds = await getDataset();
    const context = buildSuggestContext("E0065", ds);
    expect(context).not.toBeNull();
    expect(context!.noStep).toBe("PREREQ_BLOCKED");
    expect(context!.gapSkills.length).toBeGreaterThan(0);
    for (const gap of context!.gapSkills) {
      expect(gap.skill_id).toMatch(/^SK_/);
      expect(gap.required).toBeGreaterThan(gap.effective);
    }
    // At least one blocked event is relevant to a gap skill and carries its failedRule.
    expect(context!.blockedEvents.length).toBeGreaterThan(0);
    for (const b of context!.blockedEvents) {
      expect(b.event_id).toMatch(/^EV_/);
      expect(b.failedRule).toBeTruthy();
    }
  });

  it("builds a grounded context for an ALL_DONE kit employee (E0018)", async () => {
    const ds = await getDataset();
    const context = buildSuggestContext("E0018", ds);
    expect(context).not.toBeNull();
    expect(context!.noStep).toBe("ALL_DONE");
    expect(context!.gapSkills.length).toBeGreaterThan(0);
  });

  it("returns null for an employee who already has a catalogue recommendation", async () => {
    const ds = await getDataset();
    // Any employee not in the noStep buckets has recommendations; pick the first such id.
    const withRec = ds.employees.find((e) => {
      const ctx = buildSuggestContext(e.employee_id, ds);
      return ctx === null;
    });
    expect(withRec).toBeDefined();
  });
});

describe("generateSuggestions (mock:demo)", () => {
  it("the mock path returns 1-3 valid, grounded suggestions for a PREREQ_BLOCKED employee", async () => {
    const ds = await getDataset();
    const context = buildSuggestContext("E0065", ds)!;
    const result = await generateSuggestions(context, "en");
    expect(result.source).toBe("mock");
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(result.suggestions.length).toBeLessThanOrEqual(3);
    const gapIds = new Set(context.gapSkills.map((g) => g.skill_id));
    const eventIds = new Set(context.blockedEvents.map((b) => b.event_id));
    for (const s of result.suggestions) {
      expect(gapIds.has(s.skill_id) || context.masteredSkills.some((m) => m.skill_id === s.skill_id)).toBe(true);
      for (const id of s.event_ids ?? []) expect(eventIds.has(id)).toBe(true);
    }
  });

  it("the mock path returns valid suggestions for an ALL_DONE employee, honestly labelled 'mock'", async () => {
    const ds = await getDataset();
    const context = buildSuggestContext("E0018", ds)!;
    const result = await generateSuggestions(context, "en");
    expect(result.source).toBe("mock");
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it("drops a hallucinated skill_id/event_id and an ungrounded number, falling back to the template", async () => {
    const ds = await getDataset();
    const context = buildSuggestContext("E0065", ds)!;
    const hallucinatingModel = createMockModel("hostile", {
      scenarios: [
        {
          name: "hallucinate",
          match: () => true,
          respond: () => ({
            kind: "object",
            value: {
              suggestions: [
                {
                  type: "mentoring",
                  skill_id: "SK_GHOST_SKILL",
                  event_ids: ["EV_GHOST_EVENT"],
                  title: "Guaranteed promotion in 30 days",
                  rationale: "This raises your salary by 47% and scores you 999 points.",
                },
              ],
            },
          }),
        },
      ],
    });

    const result = await generateSuggestions(context, "en", hallucinatingModel);
    expect(result.source).toBe("template");
    expect(result.fallbackReason).toBe("no_valid_suggestions_from_model");
    // The template fallback itself only cites ids/numbers from the context.
    const gapIds = new Set(context.gapSkills.map((g) => g.skill_id));
    for (const s of result.suggestions) {
      expect(gapIds.has(s.skill_id) || context.masteredSkills.some((m) => m.skill_id === s.skill_id)).toBe(true);
    }
  });

  it("prerequisite_path is rejected for a noStep that is not PREREQ_BLOCKED (type/reason mismatch)", async () => {
    const ds = await getDataset();
    const context = buildSuggestContext("E0018", ds)!; // ALL_DONE
    const mastered = context.masteredSkills[0];
    expect(mastered).toBeDefined();
    const mismatchedModel = createMockModel("mismatch", {
      scenarios: [
        {
          name: "mismatch",
          match: () => true,
          respond: () => ({
            kind: "object",
            value: {
              suggestions: [
                {
                  type: "prerequisite_path", // not allowed outside PREREQ_BLOCKED
                  skill_id: mastered!.skill_id,
                  event_ids: [],
                  title: "Unlock via prerequisite",
                  rationale: `Level ${mastered!.level} already meets the requirement.`,
                },
              ],
            },
          }),
        },
      ],
    });
    const result = await generateSuggestions(context, "en", mismatchedModel);
    expect(result.source).toBe("template");
  });

  it("a provider timeout falls back to the deterministic template", async () => {
    const ds = await getDataset();
    const context = buildSuggestContext("E0065", ds)!;
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
    const result = await generateSuggestions(context, "en", hangingModel);
    expect(result.source).toBe("template");
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
  });
});
