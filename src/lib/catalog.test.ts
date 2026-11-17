import { describe, expect, it } from "vitest";
import { type Catalog, type CatalogCourse, searchCourses, shareWithLetter, termLabel } from "./catalog";

const course = (s: string, n: string, t: string): CatalogCourse => ({
  s, n, t, last: "2026-sp", gpa: 3, d: [1, 5, 2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0], w: 0, i: [],
});
const catalog: Catalog = {
  school: {
    id: "x", name: "X", source: "", sourceUrl: "", terms: ["2021-wi", "2026-sp"],
    grades: ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"],
  },
  courses: [
    course("CS", "124", "Intro to Computer Science I"),
    course("CS", "225", "Data Structures"),
    course("STAT", "225", "Statistical Data Management"),
    course("CSE", "401", "Numerical Analysis"),
  ],
};
const codes = (q: string) => searchCourses(catalog, q).map((c) => `${c.s} ${c.n}`);

describe("course search", () => {
  it("finds by code with or without a space", () => {
    expect(codes("cs 225")[0]).toBe("CS 225");
    expect(codes("CS225")[0]).toBe("CS 225");
  });
  it("ranks the exact subject above subjects that only start with it", () => {
    expect(codes("cs")).toEqual(["CS 124", "CS 225", "CSE 401"]);
  });
  it("finds by title words", () => {
    expect(codes("data")).toEqual(["CS 225", "STAT 225"]);
    expect(codes("data structures")).toEqual(["CS 225"]);
  });
  it("does not match short codes inside title words", () => {
    // "cs" is inside "Statistical", which must not make STAT 225 a match for "cs 225".
    expect(codes("cs225")).toEqual(["CS 225"]);
  });
  it("needs every word to match", () => {
    expect(codes("cs chemistry")).toEqual([]);
    expect(codes("  ")).toEqual([]);
  });
  it("does not break on punctuation", () => {
    expect(() => codes("c++ (data) [x]\\")).not.toThrow();
    expect(codes("data*")).toEqual(["CS 225", "STAT 225"]);
  });
});

describe("helpers", () => {
  it("labels terms", () => expect(termLabel("2026-sp")).toBe("Spring 2026"));
  it("sums a letter's share", () => {
    expect(shareWithLetter(catalog, catalog.courses[0], "A")).toBeCloseTo(80);
    expect(shareWithLetter(catalog, catalog.courses[0], "B")).toBeCloseTo(20);
  });
});
