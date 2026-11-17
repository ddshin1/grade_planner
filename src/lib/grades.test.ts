import { describe, expect, it } from "vitest";
import {
  type Assignment,
  type Category,
  type Course,
  DEFAULT_SCALE,
  currentGrade,
  estimatedGrade,
  gradeRange,
  letterFor,
  requiredScore,
  skipPlan,
} from "./grades";

let n = 0;
const a = (earned: number | null, possible = 100, extra: Partial<Assignment> = {}): Assignment => ({
  id: `a${++n}`,
  name: `A${n}`,
  possible,
  earned,
  whatIf: null,
  extraCredit: false,
  ...extra,
});
const cat = (name: string, weight: number, assignments: Assignment[], drops = 0): Category => ({
  id: `c-${name}`,
  name,
  weight,
  drops,
  assignments,
});
const course = (categories: Category[], mode: Course["mode"] = "weighted"): Course => ({
  id: "c",
  name: "Test",
  college: "",
  mode,
  categories,
  scale: DEFAULT_SCALE,
});

describe("current grade", () => {
  it("weights categories", () => {
    const c = course([cat("hw", 40, [a(90), a(100)]), cat("exam", 60, [a(80)])]);
    // 0.4 * 95 + 0.6 * 80
    expect(currentGrade(c).percent).toBeCloseTo(86);
  });

  it("ignores categories with nothing graded and renormalises weights", () => {
    const c = course([cat("hw", 40, [a(90)]), cat("exam", 60, [a(null)])]);
    expect(currentGrade(c).percent).toBeCloseTo(90);
  });

  it("is null with nothing graded", () => {
    expect(currentGrade(course([cat("hw", 100, [a(null)])])).percent).toBeNull();
  });

  it("pools points within a category", () => {
    const c = course([cat("hw", 100, [a(10, 10), a(45, 90)])]);
    expect(currentGrade(c).percent).toBeCloseTo(55);
  });

  it("uses total points in points mode", () => {
    const c = course([cat("hw", 0, [a(40, 50)]), cat("exam", 0, [a(120, 150)])], "points");
    expect(currentGrade(c).percent).toBeCloseTo(80);
  });

  it("adds extra credit without adding to the total", () => {
    const c = course([cat("hw", 100, [a(80), a(5, 5, { extraCredit: true })])]);
    expect(currentGrade(c).percent).toBeCloseTo(85);
  });
});

describe("drops", () => {
  it("drops the lowest score", () => {
    const low = a(50);
    const c = course([cat("quiz", 100, [a(90), low, a(100)], 1)]);
    const r = currentGrade(c);
    expect(r.percent).toBeCloseTo(95);
    expect(r.dropped).toEqual([low.id]);
  });

  it("never drops the only score", () => {
    const c = course([cat("quiz", 100, [a(50)], 2)]);
    expect(currentGrade(c).percent).toBeCloseTo(50);
  });

  it("drops the score that helps most, not the lowest percentage", () => {
    // Dropping the 20/100 gives 101/120 = 84.2%. Dropping the lowest
    // percentage (1/20 = 5%) would give only 120/200 = 60%.
    const big = a(20, 100);
    const c = course([cat("hw", 100, [a(100, 100), big, a(1, 20)], 1)]);
    const r = currentGrade(c);
    expect(r.dropped).toEqual([big.id]);
    expect(r.percent).toBeCloseTo((101 / 120) * 100);
  });

  it("applies drops per category in points mode", () => {
    const c = course([cat("quiz", 0, [a(0, 10), a(10, 10)], 1), cat("exam", 0, [a(80, 100)])], "points");
    expect(currentGrade(c).percent).toBeCloseTo((90 / 110) * 100);
  });
});

describe("range", () => {
  it("gives min and max from the work left", () => {
    const c = course([cat("hw", 50, [a(80)]), cat("final", 50, [a(null)])]);
    expect(gradeRange(c)).toEqual({ min: 40, max: 90 });
  });

  it("uses drops on missing work in the minimum", () => {
    const c = course([cat("quiz", 100, [a(90), a(null)], 1)]);
    expect(gradeRange(c).min).toBeCloseTo(90);
    expect(gradeRange(c).max).toBeCloseTo(100);
  });
});

describe("what-if estimate", () => {
  it("includes what-if scores and leaves out the rest", () => {
    const c = course([cat("hw", 50, [a(80)]), cat("final", 50, [a(null, 100, { whatIf: 90 }), a(null)])]);
    expect(estimatedGrade(c).percent).toBeCloseTo(85);
  });
});

describe("target solver", () => {
  it("finds the score needed on the final", () => {
    const c = course([cat("hw", 50, [a(80)]), cat("final", 50, [a(null)])]);
    const r = requiredScore(c, 90);
    expect(r.status).toBe("needed");
    if (r.status === "needed") expect(r.percent).toBeCloseTo(100, 4);
    const b = requiredScore(c, 83);
    if (b.status === "needed") expect(b.percent).toBeCloseTo(86, 4);
    else throw new Error("expected needed");
  });

  it("reports a secured target", () => {
    const c = course([cat("hw", 90, [a(100)]), cat("final", 10, [a(null)])]);
    expect(requiredScore(c, 90).status).toBe("secured");
  });

  it("reports an unreachable target with the best possible grade", () => {
    const c = course([cat("hw", 50, [a(60)]), cat("final", 50, [a(null)])]);
    expect(requiredScore(c, 93)).toEqual({ status: "unreachable", best: 80 });
  });

  it("treats what-if scores as fixed", () => {
    const c = course([cat("hw", 50, [a(80)]), cat("exams", 50, [a(null, 100, { whatIf: 70 }), a(null)])]);
    // exams must average 86, one is fixed at 70, so the other needs 102: unreachable.
    expect(requiredScore(c, 83).status).toBe("unreachable");
    const r = requiredScore(c, 80);
    // exams must average 80 -> other exam needs 90
    if (r.status === "needed") expect(r.percent).toBeCloseTo(90, 4);
    else throw new Error("expected needed");
  });

  it("handles nothing left to solve", () => {
    const c = course([cat("hw", 100, [a(95)])]);
    expect(requiredScore(c, 93)).toEqual({ status: "no-open", final: 95, met: true });
  });
});

describe("skip finder", () => {
  it("uses drops as free skips", () => {
    const q3 = a(null);
    const c = course([cat("quiz", 100, [a(95), a(95), q3], 1)]);
    const plan = skipPlan(c, 93, 95);
    expect(plan.reachable).toBe(true);
    expect(plan.skipTogether).toEqual([q3.id]);
    expect(plan.finalAfterSkips).toBeCloseTo(95);
  });

  it("does not skip when the target would be missed", () => {
    const c = course([cat("hw", 50, [a(90)]), cat("final", 50, [a(null)])]);
    const plan = skipPlan(c, 90, 95);
    expect(plan.skipTogether).toEqual([]);
    expect(plan.options[0].ok).toBe(false);
  });

  it("skips as many small assignments as the target allows", () => {
    const hw = [a(100), a(100), a(100), a(100), a(100), a(100), a(null), a(null), a(null), a(null)];
    const c = course([cat("hw", 100, hw)]);
    // Each skipped homework costs 10 points of 100. Target 80 with 100% on the rest: skip 2.
    const plan = skipPlan(c, 80, 100);
    expect(plan.skipTogether).toHaveLength(2);
    expect(plan.finalAfterSkips).toBeCloseTo(80);
  });

  it("says when the target is out of reach at the assumed score", () => {
    const c = course([cat("hw", 50, [a(60)]), cat("final", 50, [a(null)])]);
    const plan = skipPlan(c, 90, 90);
    expect(plan.reachable).toBe(false);
    expect(plan.skipTogether).toEqual([]);
  });
});

describe("letters", () => {
  it("maps percentages to letters", () => {
    expect(letterFor(93, DEFAULT_SCALE)).toBe("A");
    expect(letterFor(92.99, DEFAULT_SCALE)).toBe("A-");
    expect(letterFor(12, DEFAULT_SCALE)).toBe("F");
    expect(letterFor(null, DEFAULT_SCALE)).toBeNull();
  });
});
