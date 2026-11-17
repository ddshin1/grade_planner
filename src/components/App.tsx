"use client";

import { useMemo, useState } from "react";
import { currentGrade, letterFor } from "@/lib/grades";
import { actions, newCourse, useStore } from "@/lib/store";
import CourseEditor from "./CourseEditor";
import ImportDialog from "./ImportDialog";
import Results from "./Results";
import { btnCls, pct, primaryBtnCls } from "./ui";

export default function App() {
  const state = useStore();
  const [importing, setImporting] = useState(false);

  const course = state?.courses.find((c) => c.id === state.selectedId) ?? state?.courses[0] ?? null;
  const current = useMemo(() => (course ? currentGrade(course) : null), [course]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div>
          <h1 className="text-xl font-semibold">Grade Planner</h1>
          <p className="text-sm text-muted">What you have, what you need, and what you can skip.</p>
        </div>
        <div className="flex gap-2">
          <button className={btnCls} onClick={() => setImporting(true)}>
            Import syllabus
          </button>
          <button className={primaryBtnCls} onClick={() => actions.addCourse(newCourse())}>
            + New class
          </button>
        </div>
      </header>

      {state === null ? (
        <p className="py-16 text-center text-sm text-muted">Loading your classes…</p>
      ) : course === null || current === null ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-16 text-center">
          <p className="font-medium">No classes yet</p>
          <p className="mt-1 text-sm text-muted">Add a class by hand, or import one from your syllabus.</p>
        </div>
      ) : (
        <>
          <nav className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Your classes">
            {state.courses.map((c) => {
              const g = currentGrade(c).percent;
              const active = c.id === course.id;
              return (
                <button
                  key={c.id}
                  onClick={() => actions.select(c.id)}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm ${
                    active ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-soft"
                  }`}
                >
                  <span className="block max-w-48 truncate font-medium">{c.name || "Untitled class"}</span>
                  <span className="block tabular-nums text-muted">
                    {pct(g)} {letterFor(g, c.scale)}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="order-2 lg:order-1">
              <CourseEditor key={course.id} course={course} current={current} />
            </div>
            <div className="order-1 lg:sticky lg:top-4 lg:order-2">
              <Results key={course.id} course={course} current={current} />
            </div>
          </div>
        </>
      )}

      <p className="mt-10 text-center text-xs text-muted">
        Your classes are saved in this browser only. Grades shown are estimates: your instructor&apos;s rounding
        and policies decide the real one.
      </p>

      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </div>
  );
}
