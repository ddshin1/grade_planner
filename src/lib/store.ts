"use client";

import { useSyncExternalStore } from "react";
import { type Assignment, type Category, type Course, DEFAULT_SCALE } from "./grades";

/** Courses are kept in the browser's localStorage. No account or server needed. */
const KEY = "grade-planner:v1";

export type State = { courses: Course[]; selectedId: string | null };

let state: State | null = null;
const listeners = new Set<() => void>();

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

export const newCourse = (name = "New class"): Course => ({
  id: uid(),
  name,
  college: "",
  mode: "weighted",
  scale: DEFAULT_SCALE.map((c) => ({ ...c })),
  categories: [
    newCategory("Homework", 30, { assignments: [newAssignment("Homework 1")] }),
    newCategory("Exams", 70, { assignments: [newAssignment("Midterm"), newAssignment("Final")] }),
  ],
});

/** A filled-in example so a first-time visitor sees every feature working. */
export const sampleCourse = (): Course => {
  const hw = (i: number, earned: number | null) => newAssignment(`Homework ${i}`, { possible: 20, earned });
  const quiz = (i: number, earned: number | null) => newAssignment(`Quiz ${i}`, { possible: 10, earned });
  return {
    id: uid(),
    name: "Example: Intro Statistics",
    college: "",
    mode: "weighted",
    scale: DEFAULT_SCALE.map((c) => ({ ...c })),
    categories: [
      newCategory("Homework", 20, {
        drops: 1,
        assignments: [hw(1, 18), hw(2, 20), hw(3, 12), hw(4, 19), hw(5, null), hw(6, null)],
      }),
      newCategory("Quizzes", 15, {
        drops: 2,
        assignments: [quiz(1, 9), quiz(2, 7), quiz(3, 10), quiz(4, null), quiz(5, null), quiz(6, null)],
      }),
      newCategory("Midterms", 35, {
        assignments: [
          newAssignment("Midterm 1", { earned: 88 }),
          newAssignment("Midterm 2", { earned: null }),
        ],
      }),
      newCategory("Final exam", 30, { assignments: [newAssignment("Final")] }),
    ],
  };
};

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (Array.isArray(parsed.courses)) return parsed;
    }
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  const sample = sampleCourse();
  return { courses: [sample], selectedId: sample.id };
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): State {
  if (state === null) state = load();
  return state;
}

export function setState(update: (s: State) => State) {
  state = update(getSnapshot());
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: keep working in memory.
  }
  listeners.forEach((l) => l());
}

/** Returns null during server render and the first client paint, then the saved state. */
export function useStore(): State | null {
  return useSyncExternalStore<State | null>(subscribe, getSnapshot, () => null);
}

export const actions = {
  addCourse(course: Course) {
    setState((s) => ({ courses: [...s.courses, course], selectedId: course.id }));
  },
  select(id: string) {
    setState((s) => ({ ...s, selectedId: id }));
  },
  removeCourse(id: string) {
    setState((s) => {
      const courses = s.courses.filter((c) => c.id !== id);
      return { courses, selectedId: s.selectedId === id ? (courses[0]?.id ?? null) : s.selectedId };
    });
  },
  updateCourse(id: string, fn: (c: Course) => Course) {
    setState((s) => ({ ...s, courses: s.courses.map((c) => (c.id === id ? fn(c) : c)) }));
  },
};
