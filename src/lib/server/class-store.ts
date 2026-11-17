import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { SharedClass, StoredClass } from "../shared";
import { matchesAll, words } from "../text";

/**
 * Where shared class setups are kept. This version is a JSON file on the
 * server's disk (DATA_DIR, default ./.data), which is fine for development
 * and a single server. Hosts without a permanent disk (Vercel and similar)
 * need a hosted database instead: replace `readAll` and `writeAll`, and
 * nothing else in the app changes.
 */

const FILE = path.join(process.env.DATA_DIR ?? ".data", "shared-classes.json");
const MAX_STORED = 50_000;

async function readAll(): Promise<StoredClass[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as StoredClass[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeAll(all: StoredClass[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(all));
  await rename(tmp, FILE);
}

// One write at a time, so two students sharing at once do not overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

/** Everything about a setup except who shared it and when. */
const signature = (c: SharedClass) =>
  JSON.stringify([c.collegeKey, c.name.toLowerCase(), c.instructor.toLowerCase(), c.term.toLowerCase(), c.mode, c.categories, c.scale]);

/** Shared setups at one college matching the search, newest first. */
export async function searchShared(collegeKey: string, query: string, limit = 30): Promise<StoredClass[]> {
  const q = words(query);
  return (await readAll())
    .filter((c) => c.collegeKey === collegeKey && matchesAll(q, words(`${c.name} ${c.instructor} ${c.term}`)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** Save a setup. Sharing the exact same setup twice keeps one copy. */
export function addShared(shared: SharedClass): Promise<StoredClass> {
  return exclusive(async () => {
    const all = await readAll();
    const sig = signature(shared);
    const existing = all.find((c) => signature(c) === sig);
    if (existing) return existing;
    if (all.length >= MAX_STORED) throw new Error("The shared class library is full.");
    const stored: StoredClass = { ...shared, id: randomUUID(), createdAt: new Date().toISOString() };
    await writeAll([...all, stored]);
    return stored;
  });
}
