import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SharedClass, StoredClass } from "../shared";
import { matchesAll, words } from "../text";

/**
 * Where shared class setups are kept.
 *
 * - With SUPABASE_URL and SUPABASE_SECRET_KEY set (the hosted site), they go
 *   in the `shared_classes` table from supabase/schema.sql.
 * - Without them (on your own computer), they go in a JSON file in DATA_DIR
 *   (default ./.data).
 */

/** Setups with this many reports are hidden from search. */
export const HIDE_AFTER_REPORTS = 3;
/** How many recent setups per college are searched. */
const SCAN_LIMIT = 1000;

type Row = { id: string; data: SharedClass; created_at: string };

interface Backend {
  /** Recent setups at a college that have not been reported too often, newest first. */
  recent(collegeKey: string): Promise<StoredClass[]>;
  /** Saves a setup; if the same setup exists, returns that one. */
  add(shared: SharedClass, signature: string): Promise<StoredClass>;
  report(id: string): Promise<void>;
}

/** Everything about a setup except who shared it and when. */
const signature = (c: SharedClass) =>
  JSON.stringify([
    c.collegeKey,
    c.name.toLowerCase(),
    c.instructor.toLowerCase(),
    c.term.toLowerCase(),
    c.mode,
    c.categories,
    c.scale,
  ]);

// ---- Supabase -------------------------------------------------------------

function supabaseBackend(db: SupabaseClient): Backend {
  const toStored = (r: Row): StoredClass => ({ ...r.data, id: r.id, createdAt: r.created_at });
  return {
    async recent(collegeKey) {
      const { data, error } = await db
        .from("shared_classes")
        .select("id, data, created_at")
        .eq("college_key", collegeKey)
        .lt("reports", HIDE_AFTER_REPORTS)
        .order("created_at", { ascending: false })
        .limit(SCAN_LIMIT);
      if (error) throw new Error(`Database read failed: ${error.message}`);
      return (data as Row[]).map(toStored);
    },
    async add(shared, sig) {
      const { data, error } = await db
        .from("shared_classes")
        .upsert({ college_key: shared.collegeKey, signature: sig, data: shared }, {
          onConflict: "signature",
          ignoreDuplicates: true,
        })
        .select("id, data, created_at");
      if (error) throw new Error(`Database write failed: ${error.message}`);
      if (data && data.length > 0) return toStored(data[0] as Row);
      // Already shared: return the existing copy.
      const existing = await db
        .from("shared_classes")
        .select("id, data, created_at")
        .eq("signature", sig)
        .single();
      if (existing.error) throw new Error(`Database read failed: ${existing.error.message}`);
      return toStored(existing.data as Row);
    },
    async report(id) {
      const { error } = await db.rpc("report_shared_class", { class_id: id });
      if (error) throw new Error(`Database write failed: ${error.message}`);
    },
  };
}

// ---- JSON file ------------------------------------------------------------

type FileRow = StoredClass & { reports?: number };

function fileBackend(): Backend {
  const file = path.join(process.env.DATA_DIR ?? ".data", "shared-classes.json");

  async function readAll(): Promise<FileRow[]> {
    try {
      return JSON.parse(await readFile(file, "utf8")) as FileRow[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  async function writeAll(all: FileRow[]) {
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(all));
    await rename(tmp, file);
  }
  // One write at a time, so two students sharing at once do not overwrite each other.
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };
  const strip = (row: FileRow): StoredClass => {
    const c = { ...row };
    delete c.reports;
    return c;
  };

  return {
    async recent(collegeKey) {
      return (await readAll())
        .filter((c) => c.collegeKey === collegeKey && (c.reports ?? 0) < HIDE_AFTER_REPORTS)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, SCAN_LIMIT)
        .map(strip);
    },
    add(shared, sig) {
      return exclusive(async () => {
        const all = await readAll();
        const existing = all.find((c) => signature(c) === sig);
        if (existing) return strip(existing);
        const stored: StoredClass = { ...shared, id: randomUUID(), createdAt: new Date().toISOString() };
        await writeAll([...all, stored]);
        return stored;
      });
    },
    report(id) {
      return exclusive(async () => {
        const all = await readAll();
        const row = all.find((c) => c.id === id);
        if (!row) return;
        row.reports = (row.reports ?? 0) + 1;
        await writeAll(all);
      });
    },
  };
}

// ---------------------------------------------------------------------------

let backend: Backend | null = null;
function getBackend(): Backend {
  if (!backend) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    backend =
      url && key
        ? supabaseBackend(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }))
        : fileBackend();
  }
  return backend;
}

/** Shared setups at one college matching the search, newest first. */
export async function searchShared(collegeKey: string, query: string, limit = 30): Promise<StoredClass[]> {
  const q = words(query);
  return (await getBackend().recent(collegeKey))
    .filter((c) => matchesAll(q, words(`${c.name} ${c.instructor} ${c.term}`)))
    .slice(0, limit);
}

/** Save a setup. Sharing the exact same setup twice keeps one copy. */
export function addShared(shared: SharedClass): Promise<StoredClass> {
  return getBackend().add(shared, signature(shared));
}

export function reportShared(id: string): Promise<void> {
  return getBackend().report(id);
}
