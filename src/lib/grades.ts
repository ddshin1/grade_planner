/**
 * Grade engine. Pure functions, no UI or storage. Every feature (current
 * grade, min/max range, target solver, what-if, skip finder) is built on
 * `evaluate`, so they always agree with each other.
 */

export type Assignment = {
  id: string;
  name: string;
  /** Points the assignment is out of. For extra credit, the most bonus points available. */
  possible: number;
  /** Points earned, or null if not graded yet. */
  earned: number | null;
  /** Hypothetical points for an ungraded assignment, or null if not set. */
  whatIf: number | null;
  /** Extra credit adds to the points earned without adding to the points possible. */
  extraCredit: boolean;
};

export type Category = {
  id: string;
  name: string;
  /** Share of the final grade. Only used in "weighted" mode. Weights are normalised, so they need not sum to 100. */
  weight: number;
  /** How many of the lowest scores in this category are dropped. */
  drops: number;
  assignments: Assignment[];
};

export type GradeCutoff = { letter: string; min: number };

export type Course = {
  id: string;
  name: string;
  college: string;
  /** "weighted": each category is a percentage of the grade. "points": grade is total points earned / total points possible. */
  mode: "weighted" | "points";
  categories: Category[];
  /** Letter cutoffs, e.g. { letter: "A", min: 93 }. */
  scale: GradeCutoff[];
  /** Set when the class was added from a school's course catalog. */
  catalog?: { school: string; subject: string; number: string };
};

export const DEFAULT_SCALE: GradeCutoff[] = [
  { letter: "A", min: 93 },
  { letter: "A-", min: 90 },
  { letter: "B+", min: 87 },
  { letter: "B", min: 83 },
  { letter: "B-", min: 80 },
  { letter: "C+", min: 77 },
  { letter: "C", min: 73 },
  { letter: "C-", min: 70 },
  { letter: "D+", min: 67 },
  { letter: "D", min: 63 },
  { letter: "D-", min: 60 },
  { letter: "F", min: 0 },
];

const EPS = 1e-9;

type Item = { id: string; e: number; p: number };
type Group = { items: Item[]; keep: number; bonus: number };

/**
 * Pick which items to keep in each group (dropping the rest) so that
 * (bonus + sum of kept earned) / (sum of kept possible) is as high as possible.
 *
 * Dropping the lowest percentages is not always optimal when assignments are
 * worth different amounts, so this uses Dinkelbach's method: guess the ratio q,
 * keep the items with the largest e - q*p, recompute q, and repeat until stable.
 */
function bestKept(groups: Group[]): { ratio: number | null; dropped: string[] } {
  const pick = (q: number) => {
    let num = 0;
    let den = 0;
    const dropped: string[] = [];
    for (const g of groups) {
      num += g.bonus;
      const sorted = [...g.items].sort((a, b) => b.e - q * b.p - (a.e - q * a.p));
      sorted.forEach((it, i) => {
        if (i < g.keep) {
          num += it.e;
          den += it.p;
        } else dropped.push(it.id);
      });
    }
    return { num, den, dropped };
  };

  let cur = pick(0);
  if (cur.den <= 0) return { ratio: null, dropped: [] };
  let q = cur.num / cur.den;
  for (let i = 0; i < 100; i++) {
    const next = pick(q);
    if (next.den <= 0) break;
    const nq = next.num / next.den;
    if (nq <= q + 1e-12) break;
    q = nq;
    cur = next;
  }
  return { ratio: q, dropped: cur.dropped };
}

export type Evaluation = {
  /** Final percentage, or null when nothing is counted yet. */
  percent: number | null;
  /** Ids of assignments removed by drop rules. */
  dropped: string[];
  /** Percentage per category id (null when the category has nothing counted). */
  byCategory: Record<string, number | null>;
};

/**
 * Compute the grade given a score for each assignment. `scoreOf` returns the
 * points earned, or null to leave the assignment out entirely.
 */
export function evaluate(course: Course, scoreOf: (a: Assignment) => number | null): Evaluation {
  const groups: { cat: Category; group: Group }[] = course.categories.map((cat) => {
    const items: Item[] = [];
    let bonus = 0;
    for (const a of cat.assignments) {
      const s = scoreOf(a);
      if (s === null) continue;
      if (a.extraCredit || a.possible <= 0) bonus += s;
      else items.push({ id: a.id, e: s, p: a.possible });
    }
    // Always keep at least one score so a category never drops to nothing.
    const drops = Math.max(0, Math.min(Math.floor(cat.drops) || 0, items.length - 1));
    return { cat, group: { items, keep: items.length - drops, bonus } };
  });

  const byCategory: Record<string, number | null> = {};
  const dropped: string[] = [];

  if (course.mode === "points") {
    const all = bestKept(groups.map((g) => g.group));
    for (const { cat, group } of groups) {
      const keptIds = new Set(group.items.map((i) => i.id).filter((id) => !all.dropped.includes(id)));
      const kept = group.items.filter((i) => keptIds.has(i.id));
      const den = kept.reduce((s, i) => s + i.p, 0);
      const num = kept.reduce((s, i) => s + i.e, 0) + group.bonus;
      byCategory[cat.id] = den > 0 ? (num / den) * 100 : null;
    }
    return { percent: all.ratio === null ? null : all.ratio * 100, dropped: all.dropped, byCategory };
  }

  let weighted = 0;
  let weightTotal = 0;
  for (const { cat, group } of groups) {
    const r = bestKept([group]);
    byCategory[cat.id] = r.ratio === null ? null : r.ratio * 100;
    dropped.push(...r.dropped);
    if (r.ratio !== null && cat.weight > 0) {
      weighted += cat.weight * r.ratio;
      weightTotal += cat.weight;
    }
  }
  return {
    percent: weightTotal > 0 ? (weighted / weightTotal) * 100 : null,
    dropped,
    byCategory,
  };
}

const isGraded = (a: Assignment) => a.earned !== null;
const maxFor = (a: Assignment) => a.possible;

export function allAssignments(course: Course): Assignment[] {
  return course.categories.flatMap((c) => c.assignments);
}

/** Ungraded assignments. */
export function remaining(course: Course): Assignment[] {
  return allAssignments(course).filter((a) => !isGraded(a));
}

/** Ungraded assignments with no what-if score: the ones the solver is free to choose. */
export function openAssignments(course: Course): Assignment[] {
  return remaining(course).filter((a) => a.whatIf === null);
}

/** Grade on graded work only. */
export function currentGrade(course: Course): Evaluation {
  return evaluate(course, (a) => a.earned);
}

/** Grade on graded work plus any what-if scores. Ungraded work with no what-if is left out. */
export function estimatedGrade(course: Course): Evaluation {
  return evaluate(course, (a) => a.earned ?? a.whatIf);
}

/** Final grade if every remaining assignment scores `fill(a)` points. */
export function projectedGrade(course: Course, fill: (a: Assignment) => number): Evaluation {
  return evaluate(course, (a) => a.earned ?? fill(a));
}

/** Lowest and highest possible final grade (0 or full marks on everything left). */
export function gradeRange(course: Course): { min: number | null; max: number | null } {
  return {
    min: projectedGrade(course, () => 0).percent,
    max: projectedGrade(course, maxFor).percent,
  };
}

export function letterFor(percent: number | null, scale: GradeCutoff[]): string | null {
  if (percent === null) return null;
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  for (const c of sorted) if (percent + EPS >= c.min) return c.letter;
  return sorted.length ? sorted[sorted.length - 1].letter : null;
}

export type Requirement =
  /** Target is met even with 0 on everything open. */
  | { status: "secured"; finalIfZero: number }
  /** Need `percent`% on every open assignment. */
  | { status: "needed"; percent: number }
  /** Even 100% on everything open falls short; `best` is the highest reachable grade. */
  | { status: "unreachable"; best: number | null }
  /** Nothing left to solve for; `final` is where the grade lands. */
  | { status: "no-open"; final: number | null; met: boolean };

/**
 * The same percentage needed on every open assignment (ungraded, no what-if)
 * to finish at or above `target`. What-if scores are taken as given.
 *
 * `skip` is a set of assignment ids forced to 0.
 */
export function requiredScore(course: Course, target: number, skip: Set<string> = new Set()): Requirement {
  const open = openAssignments(course).filter((a) => !skip.has(a.id));
  const at = (pct: number) =>
    projectedGrade(course, (a) => {
      if (skip.has(a.id)) return 0;
      if (a.whatIf !== null) return a.whatIf;
      return (pct / 100) * a.possible;
    }).percent;

  if (open.length === 0) {
    const final = at(0);
    return { status: "no-open", final, met: final !== null && final + EPS >= target };
  }
  const low = at(0);
  if (low !== null && low + EPS >= target) return { status: "secured", finalIfZero: low };
  const high = at(100);
  if (high === null || high + EPS < target) return { status: "unreachable", best: high };

  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const g = at(mid);
    if (g !== null && g + EPS >= target) hi = mid;
    else lo = mid;
  }
  return { status: "needed", percent: hi };
}

export type SkipOption = {
  id: string;
  /** Final grade if only this one is skipped and the rest score `assume`%. */
  finalIfSkipped: number | null;
  /** Whether the target is still met in that case. */
  ok: boolean;
  /** What the rest of the open work would need if this one is skipped. */
  neededOnRest: Requirement;
};

export type SkipPlan = {
  /** Final grade doing everything at `assume`%. */
  baseline: number | null;
  /** False if the target is missed even without skipping anything. */
  reachable: boolean;
  /** Each open assignment considered on its own. */
  options: SkipOption[];
  /** A set of assignments that can all be skipped together while still meeting the target. */
  skipTogether: string[];
  /** Final grade after skipping everything in `skipTogether`. */
  finalAfterSkips: number | null;
};

/**
 * Which open assignments can be skipped (scored 0) while still finishing at or
 * above `target`, assuming `assume`% on the work that is done.
 *
 * `skipTogether` is built greedily: each round skips the assignment that costs
 * the least, as long as the target still holds. Drop rules make cheap skips
 * free, so those are picked up first.
 */
export function skipPlan(course: Course, target: number, assume: number): SkipPlan {
  const open = openAssignments(course);
  const gradeWith = (skip: Set<string>) =>
    projectedGrade(course, (a) => {
      if (skip.has(a.id)) return 0;
      if (a.whatIf !== null) return a.whatIf;
      return (assume / 100) * a.possible;
    }).percent;
  const meets = (g: number | null) => g !== null && g + EPS >= target;

  const baseline = gradeWith(new Set());
  const options: SkipOption[] = open.map((a) => {
    const only = new Set([a.id]);
    const g = gradeWith(only);
    return { id: a.id, finalIfSkipped: g, ok: meets(g), neededOnRest: requiredScore(course, target, only) };
  });

  const skipped = new Set<string>();
  let final = baseline;
  if (meets(baseline)) {
    for (;;) {
      let best: { id: string; g: number } | null = null;
      for (const a of open) {
        if (skipped.has(a.id)) continue;
        const g = gradeWith(new Set([...skipped, a.id]));
        if (g !== null && meets(g) && (best === null || g > best.g)) best = { id: a.id, g };
      }
      if (!best) break;
      skipped.add(best.id);
      final = best.g;
    }
  }

  return {
    baseline,
    reachable: meets(baseline),
    options,
    skipTogether: open.filter((a) => skipped.has(a.id)).map((a) => a.id),
    finalAfterSkips: final,
  };
}

/** Sum of category weights, for warning when a weighted course does not add up to 100. */
export function weightTotal(course: Course): number {
  return course.categories.reduce((s, c) => s + (c.weight > 0 ? c.weight : 0), 0);
}
