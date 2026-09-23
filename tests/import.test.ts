/**
 * Import tests (docs/plan.md T5; docs/threat-model.md T7-T10; R-09).
 *
 * Forces DATASET_DIR to the committed seed (as engine.test.ts does, since the
 * trap fixtures were authored against its small role profiles) and DATA_DIR
 * to a fresh temp directory per test, so the overlay write is real and
 * isolated. Proves the acceptance criterion end to end: uploading
 * trap-F01.json + trap-F01.csv makes T9001 show up and get recommendations
 * with no restart - just `getDataset()` being called again.
 */
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDataset, invalidateDataset } from "@/lib/data/load";
import { recommend } from "@/lib/domain/recommend";
import { importFiles, MAX_FILE_BYTES, type ImportFileInput } from "@/lib/data/import";

function fixtureText(name: string): string {
  return readFileSync(join(process.cwd(), "data/fixtures", name), "utf8");
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cq-import-"));
  process.env.DATASET_DIR = join(process.cwd(), "data/seed");
  process.env.DATA_DIR = tmpDir;
  invalidateDataset();
});

afterEach(() => {
  delete process.env.DATASET_DIR;
  delete process.env.DATA_DIR;
  invalidateDataset();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("importFiles: trap-F01 golden path (R-09)", () => {
  it("uploading employees.json + activity_history.csv makes T9001 visible with recommendations, no restart", async () => {
    const inputs: ImportFileInput[] = [
      { kind: "employees", filename: "trap-F01.json", text: fixtureText("trap-F01.json"), size: 0 },
      { kind: "activity_history", filename: "trap-F01.csv", text: fixtureText("trap-F01.csv"), size: 0 },
    ];

    const report = await importFiles(inputs);

    expect(report.errors).toEqual([]);
    expect(report.accepted.employees).toBe(1);
    expect(report.accepted.activity_history).toBe(4);

    // No restart: the next getDataset() call (import.ts already invalidated
    // the cache) reflects the upload immediately.
    const dataset = await getDataset();
    const employee = dataset.employees.find((e) => e.employee_id === "T9001");
    expect(employee).toBeDefined();
    expect(dataset.history.some((h) => h.employee_id === "T9001")).toBe(true);

    const result = recommend("T9001", dataset);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

describe("importFiles: per-row validation report", () => {
  it("keeps valid rows and rejects a bad row with a field-level reason", async () => {
    const validEmployee = JSON.parse(fixtureText("trap-F01.json")) as { employees: Record<string, unknown>[] };
    const badEmployee = { ...validEmployee.employees[0], employee_id: "T9099", grade: "NotAGrade" };
    const payload = { employees: [validEmployee.employees[0], badEmployee] };

    const report = await importFiles([
      { kind: "employees", filename: "mixed.json", text: JSON.stringify(payload), size: 0 },
    ]);

    expect(report.accepted.employees).toBe(1);
    expect(report.errors.length).toBe(1);
    expect(report.errors[0]?.file).toBe("employees");
    expect(report.errors[0]?.field).toBe("grade");

    const dataset = await getDataset();
    expect(dataset.employees.some((e) => e.employee_id === "T9001")).toBe(true);
    expect(dataset.employees.some((e) => e.employee_id === "T9099")).toBe(false);
  });

  it("rejects a history row referencing an unknown employee_id", async () => {
    const csv =
      "record_id,employee_id,event_id,date,due_date,status,completion_pct,score,feedback_rating,assigned_by\n" +
      "BADROW,E9999_GHOST,EV_005,2026-02-01,,completed,100,85,4,self\n";

    const report = await importFiles([
      { kind: "activity_history", filename: "bad.csv", text: csv, size: 0 },
    ]);

    expect(report.accepted.activity_history).toBe(0);
    expect(report.errors.length).toBe(1);
    expect(report.errors[0]?.message).toMatch(/Unknown employee_id/);
  });

  it("rejects an id that does not match ^[A-Z0-9_]+$", async () => {
    const payload = {
      employees: [{ ...JSON.parse(fixtureText("trap-F01.json")).employees[0], employee_id: "not-valid-id" }],
    };
    const report = await importFiles([
      { kind: "employees", filename: "badid.json", text: JSON.stringify(payload), size: 0 },
    ]);
    expect(report.accepted.employees ?? 0).toBe(0);
    expect(report.errors.some((e) => e.message.includes("^[A-Z0-9_]+$"))).toBe(true);
  });
});

describe("importFiles: role_profiles overlay merge (review-1430 #1)", () => {
  it("uploading a new role_profile + an employee in that role gives the employee a trajectory and recommendations", async () => {
    const skillsPayload = {
      role_profiles: [
        {
          role: "TEST_NEW_ROLE",
          grade: "Junior",
          required_skills: { SK_SYSTEM_DESIGN: 2 },
          critical_skills: ["SK_SYSTEM_DESIGN"],
        },
      ],
    };
    const employeesPayload = {
      employees: [
        {
          employee_id: "T9002",
          full_name: "Test Person",
          department: "Test",
          role: "TEST_NEW_ROLE",
          grade: "Junior",
          manager_id: null,
          hire_date: "2025-01-01",
          tenure_months: 12,
          work_format: "office",
          preferred_language: "en",
          career_goal: null,
          skills: { SK_SYSTEM_DESIGN: 1 },
          last_review_date: "2026-01-01",
        },
      ],
    };

    const report = await importFiles([
      { kind: "skills", filename: "skills.json", text: JSON.stringify(skillsPayload), size: 0 },
      { kind: "employees", filename: "employees.json", text: JSON.stringify(employeesPayload), size: 0 },
    ]);

    expect(report.errors).toEqual([]);
    expect(report.accepted.employees).toBe(1);

    const dataset = await getDataset();
    expect(dataset.roleProfiles.some((r) => r.role === "TEST_NEW_ROLE" && r.grade === "Junior")).toBe(true);

    const result = recommend("T9002", dataset);
    expect(result.noStep).not.toBe("DATA_INCOMPLETE");
  });
});

describe("MAX_FILE_BYTES", () => {
  it("is 5 MB, matching the documented cap", () => {
    expect(MAX_FILE_BYTES).toBe(5 * 1024 * 1024);
  });
});
