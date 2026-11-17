import { describe, expect, it } from "vitest";
import { type CatalogCourse, searchCourses } from "./catalog";
import { collegeKey, index, searchColleges } from "./colleges";

const course = (subject: string, number: string, title: string): CatalogCourse => ({ subject, number, title });
const courses = [
  course("CS", "124", "Intro to Computer Science I"),
  course("CS", "225", "Data Structures"),
  course("STAT", "225", "Statistical Data Management"),
  course("CSE", "401", "Numerical Analysis"),
];
const codes = (q: string) => searchCourses(courses, q).map((c) => `${c.subject} ${c.number}`);

describe("course search", () => {
  it("finds by code with or without a space", () => {
    expect(codes("cs 225")).toEqual(["CS 225"]);
    expect(codes("CS225")).toEqual(["CS 225"]);
  });
  it("ranks the exact subject above subjects that only start with it", () => {
    expect(codes("cs")).toEqual(["CS 124", "CS 225", "CSE 401"]);
  });
  it("finds by title words", () => {
    expect(codes("data")).toEqual(["CS 225", "STAT 225"]);
    expect(codes("data structures")).toEqual(["CS 225"]);
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

describe("college search", () => {
  const colleges = [
    index(["uiuc.edu", "University of Illinois Urbana-Champaign", "US", "Illinois", "uiuc illinois"]),
    index(["uic.edu", "University of Illinois Chicago", "US", "Illinois", "uic"]),
    index(["ucla.edu", "University of California, Los Angeles", "US", "California", "ucla"]),
    index(["bc.edu", "Boston College", "US", "", "bc"]),
    index(["umontreal.ca", "Université de Montréal", "CA", "Quebec", "umontreal"]),
  ];
  const names = (q: string) => searchColleges(colleges, q).map((c) => c.id);

  it("finds by name words in any order", () => {
    expect(names("illinois urbana")).toEqual(["uiuc.edu"]);
    // illinois.edu belongs to Urbana-Champaign, so it ranks first.
    expect(names("illinois")).toEqual(["uiuc.edu", "uic.edu"]);
  });
  it("finds by nickname and initials", () => {
    expect(names("uiuc")).toEqual(["uiuc.edu"]);
    expect(names("UCLA")).toEqual(["ucla.edu"]);
    expect(names("bc")).toEqual(["bc.edu"]);
  });
  it("ignores accents", () => expect(names("montreal")).toEqual(["umontreal.ca"]));
  it("returns nothing for no match or an empty search", () => {
    expect(names("hogwarts")).toEqual([]);
    expect(names("")).toEqual([]);
  });
  it("files hand-typed colleges under their name", () => {
    expect(collegeKey({ collegeId: "uiuc.edu", college: "x" })).toBe("uiuc.edu");
    expect(collegeKey({ college: " My  Community College " })).toBe("custom:my-community-college");
    expect(collegeKey({ college: "  " })).toBeNull();
  });
});
