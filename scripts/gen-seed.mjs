#!/usr/bin/env node
/**
 * Deterministic synthetic dataset generator (Batch 0, AMB-01 fallback).
 *
 * Writes data/seed/{skills.json,events.json,employees.json,activity_history.csv}
 * and data/fixtures/trap-F01..F06.{json,csv}. All names and ids are obviously
 * fictional. Re-running this script must produce byte-identical output
 * (fixed PRNG seed, no Date.now(), no Math.random()).
 *
 * Same schema as docs/task/career_quest_dataset (docs/architecture.md §2).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AS_OF_DATE = "2026-10-01";

// --- deterministic PRNG (mulberry32), fixed seed -------------------------
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261001);
const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// --- skills ----------------------------------------------------------------
const SKILLS = [
  ["SK_SYSTEM_DESIGN", "System Design", "hard", "Architecture"],
  ["SK_API_DESIGN", "API Design", "hard", "Architecture"],
  ["SK_CLOUD", "Cloud Platforms", "hard", "Infrastructure"],
  ["SK_CONTAINERS", "Containers", "hard", "Infrastructure"],
  ["SK_OBSERVABILITY", "Observability", "hard", "Infrastructure"],
  ["SK_SQL", "SQL", "hard", "Data"],
  ["SK_DATA_VIZ", "Data Visualization", "hard", "Data"],
  ["SK_REACT", "React", "hard", "Frontend"],
  ["SK_TYPESCRIPT", "TypeScript", "hard", "Frontend"],
  ["SK_JAVASCRIPT", "JavaScript", "hard", "Frontend"],
  ["SK_WEB_PERFORMANCE", "Web Performance", "hard", "Frontend"],
  ["SK_PUBLIC_SPEAKING", "Public Speaking", "soft", "Communication"],
].map(([skill_id, name, type, category]) => ({
  skill_id,
  name,
  type,
  category,
  description: `${name} (demo synthetic skill).`,
}));

const ROLE_PROFILES = [
  { role: "Backend Engineer", grade: "Junior", required_skills: { SK_SYSTEM_DESIGN: 1, SK_API_DESIGN: 2, SK_CLOUD: 1, SK_CONTAINERS: 1, SK_OBSERVABILITY: 1, SK_PUBLIC_SPEAKING: 1 }, critical_skills: [] },
  { role: "Backend Engineer", grade: "Middle", required_skills: { SK_SYSTEM_DESIGN: 2, SK_API_DESIGN: 3, SK_CLOUD: 2, SK_CONTAINERS: 2, SK_OBSERVABILITY: 2, SK_PUBLIC_SPEAKING: 2 }, critical_skills: ["SK_SYSTEM_DESIGN"] },
  { role: "Backend Engineer", grade: "Senior", required_skills: { SK_SYSTEM_DESIGN: 4, SK_API_DESIGN: 4, SK_CLOUD: 3, SK_CONTAINERS: 3, SK_OBSERVABILITY: 3, SK_PUBLIC_SPEAKING: 2 }, critical_skills: ["SK_SYSTEM_DESIGN", "SK_API_DESIGN"] },
  { role: "Backend Engineer", grade: "Lead", required_skills: { SK_SYSTEM_DESIGN: 5, SK_API_DESIGN: 5, SK_CLOUD: 4, SK_CONTAINERS: 4, SK_OBSERVABILITY: 4, SK_PUBLIC_SPEAKING: 3 }, critical_skills: ["SK_SYSTEM_DESIGN"] },
  { role: "Frontend Engineer", grade: "Junior", required_skills: { SK_JAVASCRIPT: 1, SK_TYPESCRIPT: 1, SK_REACT: 1, SK_WEB_PERFORMANCE: 1 }, critical_skills: [] },
  { role: "Frontend Engineer", grade: "Middle", required_skills: { SK_JAVASCRIPT: 2, SK_TYPESCRIPT: 2, SK_REACT: 2, SK_WEB_PERFORMANCE: 2 }, critical_skills: ["SK_TYPESCRIPT"] },
  { role: "Frontend Engineer", grade: "Senior", required_skills: { SK_JAVASCRIPT: 3, SK_TYPESCRIPT: 4, SK_REACT: 3, SK_WEB_PERFORMANCE: 3 }, critical_skills: ["SK_TYPESCRIPT"] },
  { role: "Frontend Engineer", grade: "Lead", required_skills: { SK_JAVASCRIPT: 4, SK_TYPESCRIPT: 5, SK_REACT: 4, SK_WEB_PERFORMANCE: 4 }, critical_skills: ["SK_TYPESCRIPT"] },
  { role: "Data Analyst", grade: "Junior", required_skills: { SK_SQL: 1, SK_DATA_VIZ: 1 }, critical_skills: [] },
  { role: "Data Analyst", grade: "Middle", required_skills: { SK_SQL: 3, SK_DATA_VIZ: 2 }, critical_skills: ["SK_SQL"] },
  { role: "Data Analyst", grade: "Senior", required_skills: { SK_SQL: 4, SK_DATA_VIZ: 3 }, critical_skills: ["SK_SQL"] },
  { role: "Data Analyst", grade: "Lead", required_skills: { SK_SQL: 5, SK_DATA_VIZ: 4 }, critical_skills: ["SK_SQL"] },
  { role: "QA Engineer", grade: "Junior", required_skills: { SK_SQL: 1, SK_JAVASCRIPT: 1 }, critical_skills: [] },
  { role: "QA Engineer", grade: "Middle", required_skills: { SK_SQL: 2, SK_JAVASCRIPT: 2 }, critical_skills: [] },
  { role: "QA Engineer", grade: "Senior", required_skills: { SK_SQL: 3, SK_JAVASCRIPT: 3 }, critical_skills: [] },
  { role: "HR Business Partner", grade: "Junior", required_skills: { SK_PUBLIC_SPEAKING: 1 }, critical_skills: [] },
  { role: "HR Business Partner", grade: "Middle", required_skills: { SK_PUBLIC_SPEAKING: 2 }, critical_skills: [] },
  { role: "HR Business Partner", grade: "Senior", required_skills: { SK_PUBLIC_SPEAKING: 3 }, critical_skills: ["SK_PUBLIC_SPEAKING"] },
  { role: "HR Business Partner", grade: "Lead", required_skills: { SK_PUBLIC_SPEAKING: 4 }, critical_skills: ["SK_PUBLIC_SPEAKING"] },
];

const ROLES = ["Backend Engineer", "Frontend Engineer", "Data Analyst", "QA Engineer", "HR Business Partner"];
const GRADES = ["Junior", "Middle", "Senior", "Lead"];

// --- events ------------------------------------------------------------
const EVENTS = [
  { event_id: "EV_001", title: "Onboarding Essentials", description: "Company onboarding (demo synthetic).", type: "onboarding", format: "online", duration_hours: 2, mandatory: true, target_roles: ROLES, target_grades: GRADES, develops_skills: [], prerequisites: {}, upcoming_sessions: ["2026-10-05", "2026-10-19"] },
  { event_id: "EV_002", title: "Code of Conduct", description: "Compliance training (demo synthetic).", type: "compliance", format: "self_paced", duration_hours: 1, mandatory: true, target_roles: ROLES, target_grades: GRADES, develops_skills: [], prerequisites: {}, upcoming_sessions: [] },
  { event_id: "EV_003", title: "Security Basics", description: "Security awareness (demo synthetic).", type: "compliance", format: "self_paced", duration_hours: 1, mandatory: true, target_roles: ROLES, target_grades: GRADES, develops_skills: [], prerequisites: {}, upcoming_sessions: [] },
  { event_id: "EV_004", title: "Data Privacy Basics", description: "Privacy compliance (demo synthetic).", type: "compliance", format: "self_paced", duration_hours: 1, mandatory: true, target_roles: ROLES, target_grades: GRADES, develops_skills: [], prerequisites: {}, upcoming_sessions: [] },
  { event_id: "EV_005", title: "Confident Communication Workshop", description: "Public speaking practice (demo synthetic).", type: "workshop", format: "offline", duration_hours: 4, mandatory: false, target_roles: ROLES, target_grades: GRADES, develops_skills: [{ skill_id: "SK_PUBLIC_SPEAKING", gain: 1, max_level: 3 }], prerequisites: {}, upcoming_sessions: ["2026-10-10"] },
  { event_id: "EV_006", title: "System Design Fundamentals", description: "Core system design course (demo synthetic).", type: "course", format: "online", duration_hours: 8, mandatory: false, target_roles: ["Backend Engineer"], target_grades: ["Middle", "Senior"], develops_skills: [{ skill_id: "SK_SYSTEM_DESIGN", gain: 1, max_level: 4 }], prerequisites: { SK_SYSTEM_DESIGN: 2 }, upcoming_sessions: ["2026-10-08", "2026-11-05"] },
  { event_id: "EV_007", title: "System Design Advanced", description: "Advanced distributed systems (demo synthetic).", type: "course", format: "online", duration_hours: 10, mandatory: false, target_roles: ["Backend Engineer"], target_grades: ["Middle", "Senior"], develops_skills: [{ skill_id: "SK_SYSTEM_DESIGN", gain: 1, max_level: 5 }], prerequisites: { SK_SYSTEM_DESIGN: 2 }, upcoming_sessions: ["2026-10-15"] },
  { event_id: "EV_008", title: "API Design Practicum", description: "REST/GraphQL API design (demo synthetic).", type: "course", format: "online", duration_hours: 6, mandatory: false, target_roles: ["Backend Engineer"], target_grades: ["Middle", "Senior"], develops_skills: [{ skill_id: "SK_API_DESIGN", gain: 1, max_level: 4 }], prerequisites: { SK_API_DESIGN: 2 }, upcoming_sessions: ["2026-10-12"] },
  { event_id: "EV_009", title: "Cloud Practitioner Bootcamp", description: "Cloud fundamentals (demo synthetic).", type: "course", format: "offline", duration_hours: 12, mandatory: false, target_roles: ["Backend Engineer"], target_grades: ["Junior", "Middle"], develops_skills: [{ skill_id: "SK_CLOUD", gain: 1, max_level: 3 }], prerequisites: {}, upcoming_sessions: ["2026-10-20"] },
  { event_id: "EV_010", title: "Containers Workshop", description: "Docker/Kubernetes basics (demo synthetic).", type: "workshop", format: "offline", duration_hours: 6, mandatory: false, target_roles: ["Backend Engineer"], target_grades: ["Middle"], develops_skills: [{ skill_id: "SK_CONTAINERS", gain: 1, max_level: 3 }], prerequisites: {}, upcoming_sessions: ["2026-10-22"] },
  { event_id: "EV_011", title: "Observability Deep Dive", description: "Metrics, logs, traces (demo synthetic).", type: "course", format: "online", duration_hours: 5, mandatory: false, target_roles: ["Backend Engineer"], target_grades: ["Middle", "Senior"], develops_skills: [{ skill_id: "SK_OBSERVABILITY", gain: 1, max_level: 4 }], prerequisites: {}, upcoming_sessions: ["2026-10-18"] },
  { event_id: "EV_013", title: "TypeScript for Frontend Teams", description: "TS unlock course (demo synthetic).", type: "course", format: "online", duration_hours: 6, mandatory: false, target_roles: ["Frontend Engineer"], target_grades: ["Middle", "Senior"], develops_skills: [{ skill_id: "SK_TYPESCRIPT", gain: 2, max_level: 4 }], prerequisites: { SK_JAVASCRIPT: 2 }, upcoming_sessions: ["2026-10-09"] },
  { event_id: "EV_014", title: "TypeScript Expert Patterns", description: "Advanced TS (demo synthetic).", type: "course", format: "online", duration_hours: 6, mandatory: false, target_roles: ["Frontend Engineer"], target_grades: ["Senior", "Lead"], develops_skills: [{ skill_id: "SK_TYPESCRIPT", gain: 1, max_level: 5 }], prerequisites: { SK_TYPESCRIPT: 3 }, upcoming_sessions: ["2026-11-01"] },
  { event_id: "EV_015", title: "Web Performance Basics", description: "Core web vitals (demo synthetic).", type: "workshop", format: "self_paced", duration_hours: 3, mandatory: false, target_roles: ["Frontend Engineer"], target_grades: ["Junior", "Middle"], develops_skills: [{ skill_id: "SK_WEB_PERFORMANCE", gain: 1, max_level: 3 }], prerequisites: {}, upcoming_sessions: [] },
  { event_id: "EV_022", title: "SQL for Analysts", description: "Applied SQL (demo synthetic).", type: "course", format: "online", duration_hours: 8, mandatory: false, target_roles: ["Data Analyst"], target_grades: ["Junior", "Middle"], develops_skills: [{ skill_id: "SK_SQL", gain: 2, max_level: 4 }], prerequisites: {}, upcoming_sessions: ["2026-10-14"] },
  { event_id: "EV_036", title: "Public Speaking Practice Circle", description: "Repeatable practice sessions (demo synthetic).", type: "workshop", format: "offline", duration_hours: 2, mandatory: false, target_roles: ROLES, target_grades: GRADES, develops_skills: [{ skill_id: "SK_PUBLIC_SPEAKING", gain: 1, max_level: 5 }], prerequisites: {}, upcoming_sessions: ["2026-10-07", "2026-10-21"] },
];

// --- employees -----------------------------------------------------------
const NAME_POOL = Array.from({ length: 40 }, (_, i) => `Demo Person ${String(i + 1).padStart(2, "0")}`);
const DEPARTMENTS = ["Engineering", "Data", "Product", "People"];
const WORK_FORMATS = ["office", "hybrid", "remote"];
const LANGS = ["kk", "ru", "en"];

function pad4(n) {
  return `E${String(n).padStart(4, "0")}`;
}

function requiredFor(role, grade) {
  return ROLE_PROFILES.find((p) => p.role === role && p.grade === grade);
}

function synthEmployee(i) {
  const role = ROLES[i % ROLES.length];
  const grade = GRADES[Math.floor(i / ROLES.length) % GRADES.length];
  const profile = requiredFor(role, grade) ?? requiredFor(role, "Middle");
  const skills = {};
  for (const [skillId, level] of Object.entries(profile.required_skills)) {
    const delta = Math.round(rng() * 3) - 1; // -1..+1
    skills[skillId] = clamp(level + delta, 0, 5);
  }
  const hasGoal = rng() > 0.6;
  const nextGradeIdx = Math.min(GRADES.indexOf(grade) + 1, GRADES.length - 1);
  return {
    employee_id: pad4(i),
    full_name: NAME_POOL[(i - 1) % NAME_POOL.length],
    department: pick(DEPARTMENTS),
    role,
    grade,
    manager_id: i > 1 ? pad4(1) : null,
    hire_date: `202${1 + (i % 5)}-0${1 + (i % 9)}-15`,
    tenure_months: 12 + (i % 48),
    work_format: WORK_FORMATS[i % WORK_FORMATS.length],
    preferred_language: LANGS[i % LANGS.length],
    career_goal: hasGoal ? { target_role: role, target_grade: GRADES[nextGradeIdx] } : null,
    skills,
    last_review_date: `2026-0${3 + (i % 6)}-1${i % 9}`,
  };
}

const employees = [];
const history = [];
let recordSeq = 1;

for (let i = 1; i <= 40; i++) {
  if (i === 28) continue; // E0028 is hand-authored below, per the spec's golden example
  const emp = synthEmployee(i);
  employees.push(emp);
  const mandatoryEvent = `EV_00${1 + (i % 4)}`;
  history.push({
    record_id: `H${String(recordSeq++).padStart(5, "0")}`,
    employee_id: emp.employee_id,
    event_id: mandatoryEvent,
    date: "2026-01-15",
    due_date: "",
    status: "completed",
    completion_pct: 100,
    score: "",
    feedback_rating: "",
    assigned_by: "hr",
  });
}

// --- E0028, the golden employee (docs/requirements.md §"Recommender golden example") ---
const e0028 = {
  employee_id: "E0028",
  full_name: "Demo Person 28",
  department: "Engineering",
  role: "Backend Engineer",
  grade: "Middle",
  manager_id: "E0001",
  hire_date: "2021-09-01",
  tenure_months: 52,
  work_format: "hybrid",
  preferred_language: "ru",
  career_goal: null,
  skills: {
    SK_SYSTEM_DESIGN: 2,
    SK_PUBLIC_SPEAKING: 2,
    SK_CLOUD: 1,
    SK_CONTAINERS: 1,
    SK_OBSERVABILITY: 1,
    SK_API_DESIGN: 4,
  },
  last_review_date: "2026-06-24",
};
employees.push(e0028);
history.push(
  { record_id: `H${String(recordSeq++).padStart(5, "0")}`, employee_id: "E0028", event_id: "EV_006", date: "2026-09-08", due_date: "", status: "completed", completion_pct: 100, score: 90, feedback_rating: 5, assigned_by: "self" },
  { record_id: `H${String(recordSeq++).padStart(5, "0")}`, employee_id: "E0028", event_id: "EV_007", date: "2026-05-01", due_date: "2026-05-01", status: "no_show", completion_pct: 0, score: "", feedback_rating: "", assigned_by: "manager" },
  { record_id: `H${String(recordSeq++).padStart(5, "0")}`, employee_id: "E0028", event_id: "EV_007", date: "2026-06-10", due_date: "", status: "completed", completion_pct: 100, score: 80, feedback_rating: 4, assigned_by: "self" },
  { record_id: `H${String(recordSeq++).padStart(5, "0")}`, employee_id: "E0028", event_id: "EV_009", date: "2026-04-02", due_date: "", status: "dropped", completion_pct: 20, score: "", feedback_rating: "", assigned_by: "manager" },
  { record_id: `H${String(recordSeq++).padStart(5, "0")}`, employee_id: "E0028", event_id: "EV_009", date: "2026-08-05", due_date: "", status: "dropped", completion_pct: 10, score: "", feedback_rating: "", assigned_by: "self" },
  { record_id: `H${String(recordSeq++).padStart(5, "0")}`, employee_id: "E0028", event_id: "EV_010", date: "2026-06-01", due_date: "", status: "dropped", completion_pct: 15, score: "", feedback_rating: "", assigned_by: "manager" },
);

employees.sort((a, b) => a.employee_id.localeCompare(b.employee_id));

// --- CSV rendering ---------------------------------------------------------
const HISTORY_HEADER = ["record_id", "employee_id", "event_id", "date", "due_date", "status", "completion_pct", "score", "feedback_rating", "assigned_by"];

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header, rows) {
  const lines = [header.join(",")];
  for (const row of rows) lines.push(header.map((key) => csvEscape(row[key])).join(","));
  return `${lines.join("\n")}\n`;
}

// --- trap fixtures (docs/requirements.md §7) --------------------------
const traps = [
  {
    id: "F01",
    employee: {
      employee_id: "T9001",
      full_name: "Test Trap-One",
      department: "Engineering",
      role: "Backend Engineer",
      grade: "Middle",
      manager_id: "E0001",
      hire_date: "2022-02-01",
      tenure_months: 40,
      work_format: "office",
      preferred_language: "en",
      career_goal: null,
      skills: { SK_PUBLIC_SPEAKING: 0, SK_SYSTEM_DESIGN: 2, SK_API_DESIGN: 3, SK_CLOUD: 2, SK_CONTAINERS: 2, SK_OBSERVABILITY: 2 },
      last_review_date: "2026-06-01",
    },
    history: [
      { event_id: "EV_036", date: "2026-03-01", due_date: "2026-03-01", status: "no_show", completion_pct: 0, assigned_by: "manager" },
      { event_id: "EV_036", date: "2026-05-01", due_date: "2026-05-01", status: "no_show", completion_pct: 0, assigned_by: "manager" },
      { event_id: "EV_036", date: "2026-07-01", due_date: "2026-07-01", status: "declined", completion_pct: 0, assigned_by: "manager" },
      { event_id: "EV_005", date: "2026-02-01", due_date: "", status: "completed", completion_pct: 100, score: 85, feedback_rating: 4, assigned_by: "self" },
    ],
  },
  {
    id: "F02",
    employee: {
      employee_id: "T9002",
      full_name: "Test Trap-Two",
      department: "Data",
      role: "Data Analyst",
      grade: "Junior",
      manager_id: "E0001",
      hire_date: "2024-01-10",
      tenure_months: 20,
      work_format: "remote",
      preferred_language: "en",
      career_goal: { target_role: "Data Analyst", target_grade: "Middle" },
      skills: { SK_REACT: 0, SK_SQL: 1, SK_DATA_VIZ: 1 },
      last_review_date: "2026-06-01",
    },
    history: [],
  },
  {
    id: "F03",
    employee: {
      employee_id: "T9003",
      full_name: "Test Trap-Three",
      department: "Engineering",
      role: "Backend Engineer",
      grade: "Middle",
      manager_id: "E0001",
      hire_date: "2021-05-01",
      tenure_months: 60,
      work_format: "hybrid",
      preferred_language: "en",
      career_goal: null,
      skills: { SK_SYSTEM_DESIGN: 3, SK_API_DESIGN: 3, SK_CLOUD: 1, SK_CONTAINERS: 1, SK_OBSERVABILITY: 1, SK_PUBLIC_SPEAKING: 2 },
      last_review_date: "2026-05-01",
    },
    history: [{ event_id: "EV_007", date: "2026-08-12", due_date: "", status: "completed", completion_pct: 100, score: 88, feedback_rating: 5, assigned_by: "self" }],
  },
  {
    id: "F04",
    employee: {
      employee_id: "T9004",
      full_name: "Test Trap-Four",
      department: "Product",
      role: "Frontend Engineer",
      grade: "Middle",
      manager_id: "E0001",
      hire_date: "2022-09-01",
      tenure_months: 36,
      work_format: "hybrid",
      preferred_language: "en",
      career_goal: { target_role: "Frontend Engineer", target_grade: "Senior" },
      skills: { SK_TYPESCRIPT: 2, SK_WEB_PERFORMANCE: 3, SK_JAVASCRIPT: 3, SK_REACT: 2 },
      last_review_date: "2026-06-01",
    },
    history: [],
  },
  {
    id: "F05",
    employee: {
      employee_id: "T9005",
      full_name: "Test Trap-Five",
      department: "People",
      role: "HR Business Partner",
      grade: "Lead",
      manager_id: null,
      hire_date: "2018-01-01",
      tenure_months: 100,
      work_format: "office",
      preferred_language: "en",
      career_goal: null,
      skills: { SK_PUBLIC_SPEAKING: 5 },
      last_review_date: "2026-06-01",
    },
    history: [
      { event_id: "EV_036", date: "2026-01-10", due_date: "", status: "completed", completion_pct: 100, score: 95, feedback_rating: 5, assigned_by: "self" },
      { event_id: "EV_005", date: "2026-02-10", due_date: "", status: "completed", completion_pct: 100, score: 95, feedback_rating: 5, assigned_by: "self" },
    ],
  },
  {
    id: "F06",
    employee: {
      employee_id: "T9006",
      full_name: "Test Trap-Six",
      department: "Engineering",
      role: "QA Engineer",
      grade: "Middle",
      manager_id: "E0001",
      hire_date: "2023-03-01",
      tenure_months: 30,
      work_format: "office",
      preferred_language: "en",
      career_goal: { target_role: "Backend Engineer", target_grade: "Middle" },
      skills: { SK_SQL: 1, SK_JAVASCRIPT: 1, SK_SYSTEM_DESIGN: 0, SK_API_DESIGN: 0, SK_CLOUD: 0, SK_CONTAINERS: 0, SK_OBSERVABILITY: 0 },
      last_review_date: "2026-06-01",
    },
    history: [],
  },
];

async function writeAll() {
  const seedDir = join(ROOT, "data/seed");
  const fixturesDir = join(ROOT, "data/fixtures");
  await mkdir(seedDir, { recursive: true });
  await mkdir(fixturesDir, { recursive: true });

  await writeFile(
    join(seedDir, "skills.json"),
    `${JSON.stringify(
      {
        meta: { as_of_date: AS_OF_DATE },
        proficiency_scale: { "0": "None", "1": "Aware", "2": "Working", "3": "Proficient", "4": "Advanced", "5": "Expert" },
        skills: SKILLS,
        role_profiles: ROLE_PROFILES,
      },
      null,
      2,
    )}\n`,
  );

  await writeFile(
    join(seedDir, "events.json"),
    `${JSON.stringify({ meta: { as_of_date: AS_OF_DATE }, events: EVENTS }, null, 2)}\n`,
  );

  await writeFile(
    join(seedDir, "employees.json"),
    `${JSON.stringify({ meta: { as_of_date: AS_OF_DATE }, employees }, null, 2)}\n`,
  );

  await writeFile(join(seedDir, "activity_history.csv"), toCsv(HISTORY_HEADER, history));

  for (const trap of traps) {
    await writeFile(
      join(fixturesDir, `trap-${trap.id}.json`),
      `${JSON.stringify({ meta: { as_of_date: AS_OF_DATE }, employees: [trap.employee] }, null, 2)}\n`,
    );
    const rows = trap.history.map((h, idx) => ({
      record_id: `${trap.id}-H${idx + 1}`,
      employee_id: trap.employee.employee_id,
      event_id: h.event_id,
      date: h.date,
      due_date: h.due_date ?? "",
      status: h.status,
      completion_pct: h.completion_pct,
      score: h.score ?? "",
      feedback_rating: h.feedback_rating ?? "",
      assigned_by: h.assigned_by,
    }));
    await writeFile(join(fixturesDir, `trap-${trap.id}.csv`), toCsv(HISTORY_HEADER, rows));
  }

  console.log(`Wrote ${employees.length} employees, ${EVENTS.length} events, ${history.length} history rows, ${traps.length} trap fixtures.`);
}

await writeAll();
