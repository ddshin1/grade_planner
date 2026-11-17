import { z } from "zod";
import { type Course, DEFAULT_SCALE } from "./grades";
import { collegeKey } from "./colleges";
import { newAssignment, newCategory, uid } from "./ids";

/**
 * A class's grading setup as shared between students: categories, weights,
 * drop rules, assignment names and point values. Never scores.
 */
export const SharedClassSchema = z.object({
  collegeKey: z.string().min(1).max(120),
  collegeName: z.string().max(200),
  name: z.string().trim().min(1).max(120),
  instructor: z.string().trim().max(80),
  term: z.string().trim().max(40),
  mode: z.enum(["weighted", "points"]),
  categories: z
    .array(
      z.object({
        name: z.string().max(60),
        weight: z.number().min(0).max(1000),
        drops: z.number().int().min(0).max(50),
        assignments: z
          .array(
            z.object({
              name: z.string().max(80),
              possible: z.number().min(0).max(100000),
              extraCredit: z.boolean(),
            }),
          )
          .max(100),
      }),
    )
    .min(1)
    .max(20),
  scale: z.array(z.object({ letter: z.string().max(5), min: z.number().min(0).max(200) })).max(20),
});

export type SharedClass = z.infer<typeof SharedClassSchema>;
export type StoredClass = SharedClass & { id: string; createdAt: string };

/** The shareable part of a class, or null if it has no college or name yet. */
export function toShared(course: Course): SharedClass | null {
  const key = collegeKey(course);
  if (!key || !course.name.trim() || course.categories.length === 0) return null;
  return {
    collegeKey: key,
    collegeName: course.college.trim(),
    name: course.name.trim(),
    instructor: (course.instructor ?? "").trim(),
    term: (course.term ?? "").trim(),
    mode: course.mode,
    categories: course.categories.map((c) => ({
      name: c.name,
      weight: Math.max(0, c.weight),
      drops: Math.max(0, Math.floor(c.drops)),
      assignments: c.assignments.map((a) => ({
        name: a.name,
        possible: Math.max(0, a.possible),
        extraCredit: a.extraCredit,
      })),
    })),
    scale: course.scale.map((s) => ({ letter: s.letter, min: Math.max(0, s.min) })),
  };
}

/** A new class for this student from a shared setup, with no scores. */
export function fromShared(shared: SharedClass): Course {
  return {
    id: uid(),
    name: shared.name,
    college: shared.collegeName,
    collegeId: shared.collegeKey.startsWith("custom:") ? undefined : shared.collegeKey,
    instructor: shared.instructor,
    term: shared.term,
    mode: shared.mode,
    scale: (shared.scale.length > 0 ? shared.scale : DEFAULT_SCALE).map((s) => ({ ...s })),
    categories: shared.categories.map((c) =>
      newCategory(c.name, c.weight, {
        drops: c.drops,
        assignments: c.assignments.map((a) =>
          newAssignment(a.name, { possible: a.possible, extraCredit: a.extraCredit }),
        ),
      }),
    ),
  };
}

/** "Homework 20% · Exams 80%" or "4 categories, total points". */
export function describeShared(shared: SharedClass): string {
  const count = shared.categories.reduce((s, c) => s + c.assignments.length, 0);
  const parts =
    shared.mode === "weighted"
      ? shared.categories.map((c) => `${c.name || "Untitled"} ${Number(c.weight.toFixed(1))}%`).join(" · ")
      : `${shared.categories.length} categories, total points`;
  return `${parts} · ${count} assignment${count === 1 ? "" : "s"}`;
}
