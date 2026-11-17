import { describe, expect, it } from "vitest";
import {
  type Assignment,
  type Course,
  DEFAULT_SCALE,
  currentGrade,
  evaluate,
  gradeRange,
  projectedGrade,
  requiredScore,
  skipPlan,
} from "./grades";

/** Small seeded generator so failures are reproducible. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function randomCourse(seed: number): Course {
  const r = rng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  let id = 0;
  return {
    id: "c",
    name: "",
    college: "",
    mode: r() < 0.5 ? "weighted" : "points",
    scale: DEFAULT_SCALE,
    categories: Array.from({ length: int(1, 3) }, (_, ci) => ({
      id: `c${ci}`,
      name: `c${ci}`,
      weight: int(0, 4) * 10,
      drops: int(0, 2),
      assignments: Array.from({ length: int(0, 5) }, (): Assignment => {
        const possible = [5, 10, 20, 50, 100][int(0, 4)];
        const graded = r() < 0.55;
        return {
          id: `a${id++}`,
          name: "",
          possible,
          earned: graded ? Math.round(r() * possible * 1.05) : null,
          whatIf: !graded && r() < 0.25 ? Math.round(r() * possible) : null,
          extraCredit: r() < 0.1,
        };
      }),
    })),
  };
}

/** Best grade over every allowed choice of drops, tried one by one. */
function bruteForce(course: Course, scoreOf: (a: Assignment) => number | null): number | null {
  const perCat = course.categories.map((cat) => {
    const items = cat.assignments.filter((a) => scoreOf(a) !== null && !a.extraCredit && a.possible > 0);
    const bonus = cat.assignments
      .filter((a) => scoreOf(a) !== null && (a.extraCredit || a.possible <= 0))
      .reduce((s, a) => s + (scoreOf(a) as number), 0);
    const drops = Math.max(0, Math.min(cat.drops, items.length - 1));
    const keep = items.length - drops;
    const options: { num: number; den: number }[] = [];
    for (let mask = 0; mask < 1 << items.length; mask++) {
      const kept = items.filter((_, i) => mask & (1 << i));
      if (kept.length !== keep) continue;
      options.push({
        num: bonus + kept.reduce((s, a) => s + (scoreOf(a) as number), 0),
        den: kept.reduce((s, a) => s + a.possible, 0),
      });
    }
    return { cat, options };
  });

  if (course.mode === "weighted") {
    let sum = 0;
    let weights = 0;
    for (const { cat, options } of perCat) {
      const ratios = options.filter((o) => o.den > 0).map((o) => o.num / o.den);
      if (ratios.length === 0 || !(cat.weight > 0)) continue;
      sum += cat.weight * Math.max(...ratios);
      weights += cat.weight;
    }
    return weights > 0 ? (sum / weights) * 100 : null;
  }
  let best: number | null = null;
  const walk = (i: number, num: number, den: number) => {
    if (i === perCat.length) {
      if (den > 0 && (best === null || num / den > best)) best = num / den;
      return;
    }
    for (const o of perCat[i].options) walk(i + 1, num + o.num, den + o.den);
  };
  walk(0, 0, 0);
  return best === null ? null : best * 100;
}

const close = (a: number | null, b: number | null) =>
  a === null || b === null ? a === b : Math.abs(a - b) < 1e-6;

describe("random courses", () => {
  const seeds = Array.from({ length: 400 }, (_, i) => i + 1);

  it("drops match trying every combination", () => {
    for (const seed of seeds) {
      const c = randomCourse(seed);
      for (const scoreOf of [
        (a: Assignment) => a.earned,
        (a: Assignment) => a.earned ?? 0,
        (a: Assignment) => a.earned ?? a.possible,
      ]) {
        const got = evaluate(c, scoreOf).percent;
        const want = bruteForce(c, scoreOf);
        if (!close(got, want)) throw new Error(`seed ${seed}: got ${got}, want ${want}`);
      }
    }
  });

  it("keeps the range in order", () => {
    for (const seed of seeds) {
      const { min, max } = gradeRange(randomCourse(seed));
      if (min !== null && max !== null && min > max + 1e-9) throw new Error(`seed ${seed}: ${min} > ${max}`);
    }
  });

  it("required score reaches the target and no lower score does", () => {
    for (const seed of seeds) {
      const c = randomCourse(seed);
      for (const target of [70, 83, 93]) {
        const r = requiredScore(c, target);
        const at = (p: number) =>
          projectedGrade(c, (a) => (a.whatIf !== null ? a.whatIf : (p / 100) * a.possible)).percent;
        if (r.status === "needed") {
          const hit = at(r.percent);
          const under = at(Math.max(0, r.percent - 0.01));
          if (hit === null || hit < target - 1e-6) throw new Error(`seed ${seed}: ${r.percent}% gives ${hit}`);
          if (under !== null && under >= target + 1e-9 && r.percent > 0.01) {
            throw new Error(`seed ${seed}: lower score also reaches ${target}`);
          }
        }
        if (r.status === "secured") expect(at(0)).toBeGreaterThanOrEqual(target - 1e-6);
        if (r.status === "unreachable") expect(at(100) ?? -1).toBeLessThan(target);
      }
    }
  });

  it("skip plans still meet the target", () => {
    for (const seed of seeds) {
      const c = randomCourse(seed);
      const plan = skipPlan(c, 80, 90);
      if (plan.skipTogether.length === 0) continue;
      const skip = new Set(plan.skipTogether);
      const g = projectedGrade(c, (a) =>
        skip.has(a.id) ? 0 : a.whatIf !== null ? a.whatIf : 0.9 * a.possible,
      ).percent;
      if (g === null || g < 80 - 1e-6) throw new Error(`seed ${seed}: skipping gives ${g}`);
      expect(close(g, plan.finalAfterSkips)).toBe(true);
    }
  });

  it("current grade never errors", () => {
    for (const seed of seeds) expect(() => currentGrade(randomCourse(seed))).not.toThrow();
  });
});
