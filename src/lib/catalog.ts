/**
 * Course catalogs: one static JSON file per school in public/data, built by a
 * script in scripts/. Loaded in the browser only when the student searches.
 *
 * A catalog knows which classes exist and how past students did in them. It
 * does not know a class's grading setup (weights, drops): that comes from the
 * syllabus.
 */

export type School = { id: string; name: string; short: string };

/** Schools with course data. Add a school by adding a build script, its JSON file, and a line here. */
export const SCHOOLS: School[] = [
  { id: "uiuc", name: "University of Illinois Urbana-Champaign", short: "UIUC" },
];

export type CatalogInstructor = { name: string; gpa: number | null; st: number; last: string };

export type CatalogCourse = {
  /** Subject code, e.g. "CS". */
  s: string;
  /** Course number, e.g. "225". */
  n: string;
  /** Title. */
  t: string;
  /** Most recent term offered, e.g. "2026-sp". */
  last: string;
  /** Average GPA across all recorded students. */
  gpa: number | null;
  /** Student counts per letter grade, in the order of `school.grades`. */
  d: number[];
  /** Withdrawals. */
  w: number;
  /** Instructors with the most students, largest first. */
  i: CatalogInstructor[];
};

export type Catalog = {
  school: {
    id: string;
    name: string;
    source: string;
    sourceUrl: string;
    terms: [string, string];
    grades: string[];
  };
  courses: CatalogCourse[];
};

/** Link from a saved class to its catalog entry. */
export type CatalogRef = { school: string; subject: string; number: string };

const cache = new Map<string, Promise<Catalog>>();

export function loadCatalog(schoolId: string): Promise<Catalog> {
  let p = cache.get(schoolId);
  if (!p) {
    p = fetch(`/data/${schoolId}.json`).then((r) => {
      if (!r.ok) throw new Error(`Could not load course data (${r.status})`);
      return r.json() as Promise<Catalog>;
    });
    p.catch(() => cache.delete(schoolId));
    cache.set(schoolId, p);
  }
  return p;
}

export function findCourse(catalog: Catalog, ref: CatalogRef): CatalogCourse | null {
  return catalog.courses.find((c) => c.s === ref.subject && c.n === ref.number) ?? null;
}

/**
 * Search by code ("cs 225", "cs225", "stat"), title words ("data structures"),
 * or a mix. Every word typed must match; code matches rank first.
 */
export function searchCourses(catalog: Catalog, query: string, limit = 40): CatalogCourse[] {
  const words = query
    .toLowerCase()
    // "cs225" -> "cs 225"
    .replace(/([a-z])(\d)/g, "$1 $2")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return [];

  const scored: { c: CatalogCourse; score: number }[] = [];
  for (const c of catalog.courses) {
    const subject = c.s.toLowerCase();
    const title = c.t.toLowerCase();
    let score = 0;
    let ok = true;
    for (const w of words) {
      if (subject === w) score += 100;
      else if (c.n === w) score += 60;
      else if (subject.startsWith(w)) score += 40;
      else if (/^\d+$/.test(w) && c.n.startsWith(w)) score += 30;
      else if (new RegExp(`\\b${w}`).test(title)) score += 10;
      else if (w.length >= 4 && title.includes(w)) score += 5;
      else {
        ok = false;
        break;
      }
    }
    if (ok) scored.push({ c, score });
  }
  // Ties keep catalog order (subject, then number).
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.c);
}

const TERM_NAMES: Record<string, string> = { wi: "Winter", sp: "Spring", su: "Summer", fa: "Fall" };

/** "2026-sp" -> "Spring 2026". */
export function termLabel(term: string): string {
  const [year, t] = term.split("-");
  return TERM_NAMES[t] ? `${TERM_NAMES[t]} ${year}` : term;
}

export const totalStudents = (c: CatalogCourse) => c.d.reduce((s, x) => s + x, 0);

/** Share of students (0-100) whose grade starts with the given letter, e.g. "A" covers A+, A, A-. */
export function shareWithLetter(catalog: Catalog, c: CatalogCourse, letter: string): number | null {
  const total = totalStudents(c);
  if (!total) return null;
  const n = c.d.reduce((s, x, i) => s + (catalog.school.grades[i].startsWith(letter) ? x : 0), 0);
  return (n / total) * 100;
}
