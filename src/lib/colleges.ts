import { matchesAll, slug, words } from "./text";

/**
 * The list of colleges students can pick from: about 10,000 worldwide, in
 * public/data/colleges.json (built by scripts/build-colleges.mjs). Loaded in
 * the browser the first time a college search is used.
 */

export type College = { id: string; name: string; country: string; state: string };

type Row = [id: string, name: string, country: string, state: string, keywords: string];
type Indexed = College & { nameWords: string[]; keyWords: string[] };

let cache: Promise<Indexed[]> | null = null;

export function loadColleges(): Promise<Indexed[]> {
  if (!cache) {
    cache = fetch("/data/colleges.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load colleges (${r.status})`);
        return r.json() as Promise<{ colleges: Row[] }>;
      })
      .then((d) => d.colleges.map(index));
    cache.catch(() => (cache = null));
  }
  return cache;
}

export function index([id, name, country, state, keywords]: Row): Indexed {
  return { id, name, country, state, nameWords: words(name), keyWords: words(keywords) };
}

const SKIP = new Set(["of", "the", "and", "at", "in", "for"]);

/**
 * Search by name ("illinois urbana"), nickname from the web address ("uiuc",
 * "mit"), or initials ("ucla"). Every word typed must match.
 */
export function searchColleges(colleges: Indexed[], query: string, limit = 8): College[] {
  const q = words(query);
  if (q.length === 0) return [];
  const scored: { c: Indexed; score: number }[] = [];
  for (const c of colleges) {
    let score = 0;
    if (q.length === 1 && c.keyWords.includes(q[0])) score = 100;
    else if (q.length === 1 && q[0].length >= 2 && initials(c.nameWords) === q[0]) score = 90;
    else if (matchesAll(q, c.nameWords)) score = c.nameWords[0].startsWith(q[0]) ? 60 : 50;
    else if (matchesAll(q, [...c.nameWords, ...c.keyWords])) score = 40;
    else continue;
    // Shorter names first: "Boston College" before "Boston College of Something".
    scored.push({ c, score: score - c.name.length / 100 });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ c }) => ({ id: c.id, name: c.name, country: c.country, state: c.state }));
}

const initials = (nameWords: string[]) =>
  nameWords
    .filter((w) => !SKIP.has(w))
    .map((w) => w[0])
    .join("");

/**
 * The key classes are filed under. A college picked from the list uses its
 * id; one typed by hand uses its name, so students who type the same name
 * still find each other's classes.
 */
export function collegeKey(college: { collegeId?: string; college: string }): string | null {
  if (college.collegeId) return college.collegeId;
  const s = slug(college.college);
  return s ? `custom:${s}` : null;
}
