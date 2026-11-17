"use client";

import { useState } from "react";
import { type Assignment, type Category, type Course, type Evaluation, weightTotal } from "@/lib/grades";
import { toShared } from "@/lib/shared";
import { actions, newAssignment, newCategory } from "@/lib/store";
import CollegePicker from "./CollegePicker";
import { Card, NumInput, btnCls, inputCls, num, pct } from "./ui";

export default function CourseEditor({ course, current }: { course: Course; current: Evaluation }) {
  const update = (fn: (c: Course) => Course) => actions.updateCourse(course.id, fn);
  const updateCat = (catId: string, fn: (c: Category) => Category) =>
    update((c) => ({ ...c, categories: c.categories.map((k) => (k.id === catId ? fn(k) : k)) }));
  const updateAsg = (catId: string, id: string, patch: Partial<Assignment>) =>
    updateCat(catId, (k) => ({
      ...k,
      assignments: k.assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));

  const total = weightTotal(course);
  const dropped = new Set(current.dropped);
  const unweighted = course.categories.filter((c) => !(c.weight > 0) && c.assignments.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Class name</span>
            <input
              className={inputCls}
              value={course.name}
              onChange={(e) => update((c) => ({ ...c, name: e.target.value }))}
            />
          </label>
          <div>
            <span className="mb-1 block text-xs font-medium text-muted">College</span>
            <CollegePicker
              value={course.college ? { id: course.collegeId, name: course.college } : null}
              placeholder="Search for your college (optional)"
              onChange={(col) => {
                update((c) => ({ ...c, college: col?.name ?? "", collegeId: col?.id }));
                if (col) actions.setCollege(col);
              }}
            />
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Instructor (optional)</span>
            <input
              className={inputCls}
              value={course.instructor ?? ""}
              onChange={(e) => update((c) => ({ ...c, instructor: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Term (optional)</span>
            <input
              className={inputCls}
              value={course.term ?? ""}
              placeholder="e.g. Fall 2026"
              onChange={(e) => update((c) => ({ ...c, term: e.target.value }))}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-xs font-medium text-muted">How is this class graded?</span>
          <div className="inline-flex rounded-md border border-line p-0.5">
            {(
              [
                ["weighted", "Weighted categories"],
                ["points", "Total points"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => update((c) => ({ ...c, mode }))}
                className={`h-7 rounded px-2.5 text-xs font-medium ${
                  course.mode === mode ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {course.mode === "weighted" && Math.abs(total - 100) > 0.01 && (
          <p className="mt-3 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
            Category weights add up to {num(total)}%, not 100%. Grades are calculated as if they were scaled to
            100%.
          </p>
        )}
        {course.mode === "weighted" && unweighted.length > 0 && (
          <p className="mt-3 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
            {unweighted.map((c) => c.name || "Untitled").join(", ")} {unweighted.length === 1 ? "has" : "have"} a
            weight of 0%, so {unweighted.length === 1 ? "it does" : "they do"} not count toward the grade.
          </p>
        )}
      </Card>

      {course.categories.map((cat) => (
        <Card key={cat.id}>
          <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
            <label className="min-w-40 flex-1">
              <span className="mb-1 block text-xs font-medium text-muted">Category</span>
              <input
                className={`${inputCls} font-medium`}
                value={cat.name}
                onChange={(e) => updateCat(cat.id, (k) => ({ ...k, name: e.target.value }))}
              />
            </label>
            {course.mode === "weighted" && (
              <label className="w-24">
                <span className="mb-1 block text-xs font-medium text-muted">Weight %</span>
                <NumInput value={cat.weight} onChange={(v) => updateCat(cat.id, (k) => ({ ...k, weight: v ?? 0 }))} />
              </label>
            )}
            <label className="w-24">
              <span className="mb-1 block text-xs font-medium text-muted">Drop lowest</span>
              <NumInput
                value={cat.drops}
                onChange={(v) => updateCat(cat.id, (k) => ({ ...k, drops: Math.floor(v ?? 0) }))}
              />
            </label>
            <div className="w-20 pb-2 text-right text-sm tabular-nums text-muted" title="Category grade so far">
              {pct(current.byCategory[cat.id] ?? null)}
            </div>
            <button
              className={`${btnCls} px-2 text-muted`}
              title="Delete category"
              aria-label={`Delete category ${cat.name}`}
              onClick={() => {
                if (cat.assignments.length === 0 || confirm(`Delete "${cat.name}" and its assignments?`)) {
                  update((c) => ({ ...c, categories: c.categories.filter((k) => k.id !== cat.id) }));
                }
              }}
            >
              ✕
            </button>
          </div>

          <div className="p-4 pt-3">
            {cat.assignments.length > 0 && (
              <div className="mb-1 hidden grid-cols-[1fr_150px_90px_44px_32px] gap-2 text-xs font-medium text-muted sm:grid">
                <span>Assignment</span>
                <span>Score / out of</span>
                <span>What if</span>
                <span title="Extra credit">Extra</span>
                <span />
              </div>
            )}
            <ul className="flex flex-col gap-2 sm:gap-1.5">
              {cat.assignments.map((a) => (
                <li
                  key={a.id}
                  className="grid grid-cols-[1fr_84px_28px_32px] items-center gap-2 sm:grid-cols-[1fr_150px_90px_44px_32px]"
                >
                  <div className="relative order-1 col-span-3 sm:col-span-1">
                    <input
                      className={inputCls}
                      value={a.name}
                      aria-label="Assignment name"
                      onChange={(e) => updateAsg(cat.id, a.id, { name: e.target.value })}
                    />
                    {dropped.has(a.id) && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-soft px-1.5 py-0.5 text-[11px] font-medium text-muted">
                        dropped
                      </span>
                    )}
                  </div>
                  <div className="order-3 flex items-center gap-1 sm:order-2">
                    <NumInput
                      value={a.earned}
                      placeholder="–"
                      aria-label={`${a.name} score`}
                      onChange={(v) => updateAsg(cat.id, a.id, { earned: v })}
                    />
                    <span className="text-muted">/</span>
                    <NumInput
                      value={a.possible}
                      aria-label={`${a.name} points possible`}
                      onChange={(v) => updateAsg(cat.id, a.id, { possible: v ?? 0 })}
                    />
                  </div>
                  <div className="order-4 sm:order-3">
                    {a.earned !== null ? (
                      <span className="block text-center text-sm text-muted">graded</span>
                    ) : (
                      <NumInput
                        value={a.whatIf}
                        placeholder="what if"
                        aria-label={`${a.name} what-if score`}
                        className="border-dashed"
                        onChange={(v) => updateAsg(cat.id, a.id, { whatIf: v })}
                      />
                    )}
                  </div>
                  <div className="order-5 col-span-2 flex items-center gap-1.5 sm:order-4 sm:col-span-1 sm:justify-center">
                    <input
                      type="checkbox"
                      id={`ec-${a.id}`}
                      className="h-4 w-4 accent-(--accent)"
                      checked={a.extraCredit}
                      title="Extra credit"
                      aria-label={`${a.name} is extra credit`}
                      onChange={(e) => updateAsg(cat.id, a.id, { extraCredit: e.target.checked })}
                    />
                    <label htmlFor={`ec-${a.id}`} className="text-xs text-muted sm:hidden">
                      extra
                    </label>
                  </div>
                  <button
                    className="order-2 h-9 rounded-md text-muted hover:bg-soft hover:text-ink sm:order-5"
                    title="Delete assignment"
                    aria-label={`Delete ${a.name}`}
                    onClick={() =>
                      updateCat(cat.id, (k) => ({ ...k, assignments: k.assignments.filter((x) => x.id !== a.id) }))
                    }
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button
              className={`${btnCls} mt-3`}
              onClick={() =>
                updateCat(cat.id, (k) => {
                  const last = k.assignments[k.assignments.length - 1];
                  return {
                    ...k,
                    assignments: [
                      ...k.assignments,
                      newAssignment(nextName(k), { possible: last?.possible ?? 100 }),
                    ],
                  };
                })
              }
            >
              + Add assignment
            </button>
            <AddSeveral
              onAdd={(count, possible) =>
                updateCat(cat.id, (k) => {
                  const added: Assignment[] = [];
                  for (let i = 0; i < count; i++) {
                    added.push(newAssignment(nextName({ ...k, assignments: [...k.assignments, ...added] }), { possible }));
                  }
                  return { ...k, assignments: [...k.assignments, ...added] };
                })
              }
              defaultPossible={cat.assignments[cat.assignments.length - 1]?.possible ?? 100}
            />
          </div>
        </Card>
      ))}

      <div className="flex flex-wrap gap-2">
        <button
          className={btnCls}
          onClick={() => update((c) => ({ ...c, categories: [...c.categories, newCategory("New category", 0)] }))}
        >
          + Add category
        </button>
      </div>

      <Card className="p-4">
        <details>
          <summary className="cursor-pointer text-sm font-medium">Letter grade cutoffs</summary>
          <p className="mt-2 text-sm text-muted">
            The lowest percentage that earns each letter. Check your syllabus: these vary by class.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {course.scale.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  className={`${inputCls} w-14 text-center font-medium`}
                  value={s.letter}
                  aria-label="Letter"
                  onChange={(e) =>
                    update((c) => ({
                      ...c,
                      scale: c.scale.map((x, j) => (j === i ? { ...x, letter: e.target.value } : x)),
                    }))
                  }
                />
                <NumInput
                  value={s.min}
                  aria-label={`Minimum percent for ${s.letter}`}
                  onChange={(v) =>
                    update((c) => ({ ...c, scale: c.scale.map((x, j) => (j === i ? { ...x, min: v ?? 0 } : x)) }))
                  }
                />
                <button
                  className="h-9 px-1 text-muted hover:text-ink"
                  aria-label={`Remove ${s.letter}`}
                  onClick={() => update((c) => ({ ...c, scale: c.scale.filter((_, j) => j !== i) }))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            className={`${btnCls} mt-3`}
            onClick={() => update((c) => ({ ...c, scale: [...c.scale, { letter: "", min: 0 }] }))}
          >
            + Add letter
          </button>
        </details>
      </Card>

      <ShareCard course={course} />

      <div>
        <button
          className="text-sm text-bad hover:underline"
          onClick={() => {
            if (confirm(`Delete "${course.name}"? This can't be undone.`)) actions.removeCourse(course.id);
          }}
        >
          Delete this class
        </button>
      </div>
    </div>
  );
}

/** "Quiz 3" after "Quiz 2"; otherwise a generic name. */
function nextName(cat: Category): string {
  const last = cat.assignments[cat.assignments.length - 1];
  const m = last?.name.match(/^(.*?)(\d+)\s*$/);
  if (m) return `${m[1]}${Number(m[2]) + 1}`;
  return `Assignment ${cat.assignments.length + 1}`;
}

/** Adds a run of numbered assignments at once, e.g. 10 quizzes out of 10. */
function AddSeveral({
  onAdd,
  defaultPossible,
}: {
  onAdd: (count: number, possible: number) => void;
  defaultPossible: number;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(5);
  const [possible, setPossible] = useState<number | null>(defaultPossible);
  if (!open) {
    return (
      <button
        className={`${btnCls} mt-3 ml-2`}
        onClick={() => {
          setPossible(defaultPossible);
          setOpen(true);
        }}
      >
        + Add several
      </button>
    );
  }
  const n = Math.min(50, Math.floor(count ?? 0));
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-soft px-3 py-2 text-sm">
      <span>Add</span>
      <NumInput value={count} onChange={setCount} className="!w-16" aria-label="How many assignments" />
      <span>assignments, each out of</span>
      <NumInput value={possible} onChange={setPossible} className="!w-20" aria-label="Points each" />
      <button
        className={btnCls}
        disabled={n < 1}
        onClick={() => {
          onAdd(n, possible ?? 100);
          setOpen(false);
        }}
      >
        Add
      </button>
      <button className="px-1 text-muted hover:text-ink" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

/** Shares the class's grading setup (never scores) so classmates can find it in search. */
function ShareCard({ course }: { course: Course }) {
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; sent?: string }>({
    status: "idle",
  });
  const shared = toShared(course);
  const body = shared ? JSON.stringify(shared) : null;
  // Once the setup changes, it can be shared again.
  const status = state.status === "done" && state.sent !== body ? "idle" : state.status;

  async function share() {
    if (!body) return;
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      setState(res.ok ? { status: "done", sent: body } : { status: "error" });
    } catch {
      setState({ status: "error" });
    }
  }

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold">Share this setup with classmates</h2>
      <p className="mt-1 text-sm text-muted">
        Adds the categories, weights, drop rules and assignment names to the class search for{" "}
        {course.college.trim() || "your college"}, so other students in this class do not have to type them in.
        Your scores are never shared.
      </p>
      {!shared ? (
        <p className="mt-2 text-sm text-warn">Add a class name and a college above to share.</p>
      ) : status === "done" ? (
        <p className="mt-2 text-sm text-good">Shared. Classmates can now find it under “Find your class”.</p>
      ) : (
        <>
          <button className={`${btnCls} mt-3`} disabled={status === "sending"} onClick={share}>
            {status === "sending" ? "Sharing…" : "Share setup"}
          </button>
          {status === "error" && (
            <p className="mt-2 text-sm text-bad">Could not share right now. Try again in a moment.</p>
          )}
        </>
      )}
    </Card>
  );
}
