/**
 * Minimal file-backed storage.
 *
 * Chosen over a database on purpose: a hackathon judge must be able to clone,
 * install and run with no daemon, no migration step and no native build. Seed
 * data is a git-diffable file and "reset the demo" is a file copy. Swap for
 * node:sqlite or Postgres only when a real requirement demands it (see
 * docs/adr/0003-storage.md).
 */
import { mkdir, readFile, writeFile, appendFile, rm } from "node:fs/promises";
import { dirname, join, normalize, isAbsolute } from "node:path";

/**
 * Read lazily rather than at module load, so a test can point DATA_DIR at a
 * temp directory after importing this module.
 */
function dataDir(): string {
  return process.env.DATA_DIR ?? join(process.cwd(), "data");
}

/**
 * Rejects traversal so a request-derived name can never escape the data dir.
 *
 * `turbopackIgnore` is required here: a `join()` on a runtime variable makes
 * Next.js trace the entire project into the standalone output, which bloats the
 * Docker image with every source file. The name is validated twice below, so
 * opting out of static analysis costs no safety.
 */
function resolveDataPath(name: string): string {
  if (isAbsolute(name) || name.includes("..")) {
    throw new Error(`Unsafe data file name: ${name}`);
  }
  const base = dataDir();
  const full = normalize(join(/* turbopackIgnore: true */ base, name));
  if (!full.startsWith(normalize(base))) {
    throw new Error(`Unsafe data file name: ${name}`);
  }
  return full;
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function appendJsonl<T>(name: string, row: T): Promise<void> {
  const path = resolveDataPath(name);
  await ensureDir(path);
  await appendFile(path, `${JSON.stringify(row)}\n`, "utf8");
}

export async function readJsonl<T>(name: string): Promise<T[]> {
  const path = resolveDataPath(name);
  try {
    const raw = await readFile(path, "utf8");
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  const path = resolveDataPath(name);
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJson<T>(name: string, value: T): Promise<void> {
  const path = resolveDataPath(name);
  await ensureDir(path);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function resetData(name: string): Promise<void> {
  await rm(resolveDataPath(name), { force: true });
}
