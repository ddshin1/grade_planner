"use client";

import { type Assignment, type Category, type Course, type Evaluation, weightTotal } from "@/lib/grades";
import { actions, newAssignment, newCategory } from "@/lib/store";
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

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Class name</span>
            <input
              className={inputCls}
              value={course.name}
              onChange={(e) => update((c) => ({ ...c, name: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">College (optional)</span>
            <input
              className={inputCls}
              value={course.college}
              placeholder="e.g. UC Davis"
              onChange={(e) => update((c) => ({ ...c, college: e.target.value }))}
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
                  className="grid grid-cols-[1fr_32px] items-center gap-2 sm:grid-cols-[1fr_150px_90px_44px_32px]"
                >
                  <div className="relative">
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
                  <div className="order-3 col-span-2 flex items-center gap-1 sm:order-none sm:col-span-1">
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
                    <span className="ml-2 flex items-center gap-2 sm:hidden">
                      <WhatIf a={a} onChange={(v) => updateAsg(cat.id, a.id, { whatIf: v })} />
                      <Extra a={a} onChange={(v) => updateAsg(cat.id, a.id, { extraCredit: v })} />
                    </span>
                  </div>
                  <div className="hidden sm:block">
                    <WhatIf a={a} onChange={(v) => updateAsg(cat.id, a.id, { whatIf: v })} />
                  </div>
                  <div className="hidden justify-center sm:flex">
                    <Extra a={a} onChange={(v) => updateAsg(cat.id, a.id, { extraCredit: v })} />
                  </div>
                  <button
                    className="order-2 h-9 rounded-md text-muted hover:bg-soft hover:text-ink sm:order-none"
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

function WhatIf({ a, onChange }: { a: Assignment; onChange: (v: number | null) => void }) {
  if (a.earned !== null) return <span className="block text-center text-sm text-muted">graded</span>;
  return (
    <NumInput
      value={a.whatIf}
      placeholder="what if"
      aria-label={`${a.name} what-if score`}
      className="min-w-20 border-dashed"
      onChange={onChange}
    />
  );
}

function Extra({ a, onChange }: { a: Assignment; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-(--accent)"
      checked={a.extraCredit}
      title="Extra credit"
      aria-label={`${a.name} is extra credit`}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}
