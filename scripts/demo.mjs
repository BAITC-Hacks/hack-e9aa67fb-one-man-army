#!/usr/bin/env node
/**
 * Demo state management.
 *
 *   node scripts/demo.mjs seed    deterministic synthetic fixtures
 *   node scripts/demo.mjs reset   back to exactly the seeded state
 *
 * The demo must be repeatable: seed -> demo -> reset -> demo must produce
 * identical state, or it will fail the second time in front of judges.
 *
 * All data here is SYNTHETIC and FICTIONAL. Never add real citizen data.
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), "data");
const command = process.argv[2] ?? "seed";

/**
 * Replace with fixtures for the real challenge.
 *
 * Rules for fixtures:
 *  - fixed ids and fixed ISO timestamps, so screenshots are reproducible
 *  - obviously fictional names; never a real IIN, phone, address or case number
 *  - enough variety to show the interesting paths (including a rejection)
 */
const FIXTURES = {
  "cases.jsonl": [
    {
      id: "demo-001",
      createdAt: "2026-09-23T09:00:00.000Z",
      citizen: { id: "cit-demo-1", label: "Демо Азаматов" },
      text: "Уличное освещение не работает на улице Абая, дом 12",
      locale: "ru",
    },
    {
      id: "demo-002",
      createdAt: "2026-09-23T09:05:00.000Z",
      citizen: { id: "cit-demo-2", label: "Demo Test-User" },
      text: "Көшедегі шұңқыр, Абай даңғылы",
      locale: "kk",
    },
  ],
};

function seed() {
  mkdirSync(DATA_DIR, { recursive: true });
  for (const [file, rows] of Object.entries(FIXTURES)) {
    const body = rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");
    writeFileSync(join(DATA_DIR, file), body, "utf8");
    console.log(`  seeded ${file} (${rows.length} rows)`);
  }
  // Derived state starts empty so each demo run recreates it.
  for (const derived of ["audit.jsonl", "decisions.jsonl"]) {
    writeFileSync(join(DATA_DIR, derived), "", "utf8");
  }
  console.log("Demo data seeded. State is deterministic.");
}

function reset() {
  if (existsSync(DATA_DIR)) {
    rmSync(DATA_DIR, { recursive: true, force: true });
    console.log("  cleared data directory");
  }
  seed();
  console.log("Demo reset complete.");
}

if (command === "seed") seed();
else if (command === "reset") reset();
else {
  console.error(`Unknown command "${command}". Use: seed | reset`);
  process.exit(1);
}
