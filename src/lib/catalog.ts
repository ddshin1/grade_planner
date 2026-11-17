import { words } from "./text";

/**
 * Official course lists, for the colleges that have one: a static JSON file
 * per college in public/data/catalog, built by a script in scripts/.
 *
 * A course list only knows which classes exist. How a class is graded comes
 * from the student (typed in, imported from a syllabus, or shared by a
 * classmate).
 */

/** College ids (from colleges.json) that have a course list. */
export const CATALOG_COLLEGES = new Set(["uiuc.edu"]);

export type CatalogCourse = { subject: string; number: string; title: string };

const cache = new Map<string, Promise<CatalogCourse[]>>();

/** The college's course list, or an empty list when it has none. */
export function loadCatalog(collegeId: string): Promise<CatalogCourse[]> {
  if (!CATALOG_COLLEGES.has(collegeId)) return Promise.resolve([]);
  let p = cache.get(collegeId);
  if (!p) {
    p = fetch(`/data/catalog/${encodeURIComponent(collegeId)}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load course list (${r.status})`);
        return r.json() as Promise<{ courses: [string, string, string][] }>;
      })
      .then((d) => d.courses.map(([subject, number, title]) => ({ subject, number, title })));
    p.catch(() => cache.delete(collegeId));
    cache.set(collegeId, p);
  }
  return p;
}

/**
 * Search by code ("cs 225", "cs225", "stat"), title words ("data structures"),
 * or a mix. Every word typed must match; code matches rank first.
 */
export function searchCourses(courses: CatalogCourse[], query: string, limit = 30): CatalogCourse[] {
  const q = words(query);
  if (q.length === 0) return [];
  const scored: { c: CatalogCourse; score: number }[] = [];
  for (const c of courses) {
    const subject = c.subject.toLowerCase();
    const number = c.number.toLowerCase();
    const title = words(c.title);
    let score = 0;
    let ok = true;
    for (const w of q) {
      if (subject === w) score += 100;
      else if (number === w) score += 60;
      else if (subject.startsWith(w)) score += 40;
      else if (/^\d/.test(w) && number.startsWith(w)) score += 30;
      else if (title.some((t) => t.startsWith(w))) score += 10;
      else {
        ok = false;
        break;
      }
    }
    if (ok) scored.push({ c, score });
  }
  // Ties keep the list's order (subject, then number).
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.c);
}
