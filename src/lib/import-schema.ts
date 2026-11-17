import { z } from "zod";

/** What the AI import returns. The student reviews and edits it before it becomes a class. */
export const ImportedCourseSchema = z.object({
  courseName: z.string().describe("Course code and title, e.g. 'STAT 101: Intro Statistics'. Empty string if not shown."),
  mode: z
    .enum(["weighted", "points"])
    .describe("'weighted' if categories are percentages of the grade; 'points' if the grade is total points earned over total points possible."),
  categories: z.array(
    z.object({
      name: z.string(),
      weight: z.number().describe("Percent of the final grade (0-100). Use 0 in points mode."),
      drops: z.number().describe("How many lowest scores are dropped in this category. 0 if none stated."),
      assignments: z.array(
        z.object({
          name: z.string(),
          possible: z.number().describe("Points the assignment is out of. Use 100 if only a percentage is known."),
          earned: z.number().nullable().describe("Points earned, or null if not graded yet or not shown."),
          extraCredit: z.boolean(),
        }),
      ),
    }),
  ),
  scale: z
    .array(z.object({ letter: z.string(), min: z.number().describe("Lowest percentage that earns this letter.") }))
    .describe("Letter grade cutoffs exactly as stated in the document. Empty array if the document does not state them."),
  notes: z
    .array(z.string())
    .describe("Short notes for the student about anything ambiguous, assumed, or not captured (e.g. 'final replaces lowest midterm')."),
});

export type ImportedCourse = z.infer<typeof ImportedCourseSchema>;
