import type { Assignment, Category } from "./grades";

export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const newAssignment = (name: string, over: Partial<Assignment> = {}): Assignment => ({
  id: uid(),
  name,
  possible: 100,
  earned: null,
  whatIf: null,
  extraCredit: false,
  ...over,
});

export const newCategory = (name: string, weight: number, over: Partial<Category> = {}): Category => ({
  id: uid(),
  name,
  weight,
  drops: 0,
  assignments: [],
  ...over,
});
