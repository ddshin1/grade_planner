"use client";

import { useMemo, useState } from "react";
import {
  type Course,
  type Evaluation,
  estimatedGrade,
  gradeRange,
  letterFor,
  openAssignments,
  remaining,
  requiredScore,
  skipPlan,
} from "@/lib/grades";
import { Card, NumInput, inputCls, num, pct } from "./ui";

export default function Results({ course, current }: { course: Course; current: Evaluation }) {
  const scale = useMemo(
    () => [...course.scale].filter((s) => s.letter.trim() !== "").sort((a, b) => b.min - a.min),
    [course.scale],
  );
  const [targetLetter, setTargetLetter] = useState<string | null>(null);
  const [assume, setAssume] = useState<number | null>(90);

  const target = scale.find((s) => s.letter === targetLetter) ?? scale[0] ?? null;
  const letter = (p: number | null) => letterFor(p, scale);

  const range = useMemo(() => gradeRange(course), [course]);
  const left = useMemo(() => remaining(course), [course]);
  const open = useMemo(() => openAssignments(course), [course]);
  const hasWhatIf = left.length > open.length;
  const estimate = useMemo(() => (hasWhatIf ? estimatedGrade(course) : null), [course, hasWhatIf]);
  const need = useMemo(() => (target ? requiredScore(course, target.min) : null), [course, target]);
  const plan = useMemo(
    () => (target && open.length > 0 ? skipPlan(course, target.min, assume ?? 0) : null),
    [course, target, assume, open.length],
  );

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of course.categories) for (const a of c.assignments) m.set(a.id, a.name || "Untitled");
    return (id: string) => m.get(id) ?? "";
  }, [course]);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Current grade</h2>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="text-4xl font-semibold tabular-nums">{pct(current.percent)}</span>
          {letter(current.percent) && (
            <span className="rounded-md bg-accent-soft px-2 py-0.5 text-lg font-semibold text-accent">
              {letter(current.percent)}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          {current.percent === null
            ? "Enter a score to see your grade."
            : `Based on graded work only. ${left.length} assignment${left.length === 1 ? "" : "s"} left.`}
        </p>

        {range.min !== null && range.max !== null && (
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Where you can finish</h3>
            <RangeBar min={range.min} max={range.max} current={current.percent} target={target?.min ?? null} />
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-muted">Lowest</div>
                <div className="font-semibold tabular-nums">
                  {pct(range.min)} <span className="font-normal text-muted">{letter(range.min)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-muted">Highest</div>
                <div className="font-semibold tabular-nums">
                  {pct(range.max)} <span className="font-normal text-muted">{letter(range.max)}</span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              Lowest is zeros on everything left; highest is full marks. Add every remaining assignment for this to
              be accurate.
            </p>
          </div>
        )}

        {estimate && (
          <div className="mt-4 rounded-lg border border-dashed border-line p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">With your what-if scores</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">
              {pct(estimate.percent)} <span className="font-normal text-muted">{letter(estimate.percent)}</span>
            </div>
          </div>
        )}
      </Card>

      {target && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="whitespace-nowrap text-sm font-semibold">Target grade</h2>
            <select
              className={`${inputCls} w-auto`}
              value={target.letter}
              aria-label="Target grade"
              onChange={(e) => setTargetLetter(e.target.value)}
            >
              {scale.map((s) => (
                <option key={s.letter} value={s.letter}>
                  {s.letter} ({num(s.min)}%+)
                </option>
              ))}
            </select>
          </div>

          {need?.status === "secured" && (
            <Verdict tone="good" title={`${target.letter} is locked in`}>
              Even with zeros on everything left you finish at {pct(need.finalIfZero)}.
            </Verdict>
          )}
          {need?.status === "unreachable" && (
            <Verdict tone="bad" title={`${target.letter} is out of reach`}>
              {need.best === null
                ? "There is nothing left to earn."
                : `Full marks on everything left gets you ${pct(need.best)} (${letter(need.best)}).`}
              {hasWhatIf && " Your what-if scores are counted as given."}
            </Verdict>
          )}
          {need?.status === "no-open" && (
            <Verdict
              tone={need.met ? "good" : "bad"}
              title={need.met ? `You get ${target.letter}` : `You miss ${target.letter}`}
            >
              {left.length === 0 ? "Everything is graded." : "With your what-if scores,"} you finish at{" "}
              {pct(need.final)} ({letter(need.final)}).
            </Verdict>
          )}
          {need?.status === "needed" && (
            <>
              <Verdict
                tone={need.percent > 95 ? "warn" : "neutral"}
                title={`You need ${pct(need.percent)} on ${open.length === 1 ? nameOf(open[0].id) : `the ${open.length} assignments left`}`}
              >
                {open.length > 1 && "That is the average you need across them. "}
                {hasWhatIf && "Your what-if scores are counted as given."}
              </Verdict>
              {open.length > 1 && (
                <ul className="mt-3 divide-y divide-line text-sm">
                  {open.map((a) => (
                    <li key={a.id} className="flex justify-between gap-3 py-1.5">
                      <span className="truncate">{a.name || "Untitled"}</span>
                      <span className="shrink-0 tabular-nums text-muted">
                        {num((need.percent / 100) * a.possible)} / {num(a.possible)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted">
                Type a score in a “what if” box to fix that assignment and see what the others then need.
              </p>
            </>
          )}
        </Card>
      )}

      {target && plan && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold">What can I skip?</h2>
          <label className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>If I score</span>
            <NumInput value={assume} onChange={setAssume} className="!w-16 shrink-0" aria-label="Assumed score percent" />
            <span>% on the work I do</span>
          </label>

          {!plan.reachable ? (
            <Verdict tone="bad" title="Nothing">
              At {num(assume ?? 0)}% on everything left you finish at {pct(plan.baseline)}, below{" "}
              {target.letter}. Skipping anything makes it worse.
            </Verdict>
          ) : plan.skipTogether.length === 0 ? (
            <Verdict tone="warn" title="Nothing">
              You finish at {pct(plan.baseline)} doing everything. Skipping any one assignment drops you below{" "}
              {target.letter}.
            </Verdict>
          ) : (
            <>
              <Verdict
                tone="good"
                title={`You can skip ${plan.skipTogether.length} assignment${plan.skipTogether.length === 1 ? "" : "s"}`}
              >
                Skip all of these and still finish at {pct(plan.finalAfterSkips)} ({letter(plan.finalAfterSkips)}).
              </Verdict>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {plan.skipTogether.map((id) => (
                  <li key={id} className="rounded-md bg-good-soft px-2 py-1 text-sm text-good">
                    {nameOf(id)}
                  </li>
                ))}
              </ul>
            </>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted">Each assignment on its own</summary>
            <ul className="mt-2 divide-y divide-line text-sm">
              {plan.options.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="truncate">{nameOf(o.id)}</span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums">
                    <span className="text-muted">skip → {pct(o.finalIfSkipped)}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        o.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"
                      }`}
                    >
                      {o.ok ? "OK" : "No"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              The grade you finish with if you skip only that assignment and score {num(assume ?? 0)}% on the rest.
            </p>
          </details>
        </Card>
      )}
    </div>
  );
}

function Verdict({
  tone,
  title,
  children,
}: {
  tone: "good" | "bad" | "warn" | "neutral";
  title: string;
  children: React.ReactNode;
}) {
  const cls = {
    good: "bg-good-soft text-good",
    bad: "bg-bad-soft text-bad",
    warn: "bg-warn-soft text-warn",
    neutral: "bg-accent-soft text-accent",
  }[tone];
  return (
    <div className={`mt-3 rounded-lg px-3 py-2.5 ${cls}`}>
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-ink/80">{children}</div>
    </div>
  );
}

function RangeBar({
  min,
  max,
  current,
  target,
}: {
  min: number;
  max: number;
  current: number | null;
  target: number | null;
}) {
  const x = (v: number) => `${Math.max(0, Math.min(100, v))}%`;
  return (
    <div
      className="relative mt-3 h-3 rounded-full bg-soft"
      role="img"
      aria-label={`Final grade can be between ${pct(min)} and ${pct(max)}`}
    >
      <div
        className="absolute inset-y-0 rounded-full bg-accent/70"
        style={{ left: x(min), width: `${Math.max(1, Math.min(100, max) - Math.max(0, min))}%` }}
      />
      {target !== null && (
        <div
          className="absolute -inset-y-1 w-0.5 bg-ink"
          style={{ left: x(target) }}
          title={`Target ${num(target)}%`}
        />
      )}
      {current !== null && (
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink"
          style={{ left: x(current) }}
          title={`Current ${pct(current)}`}
        />
      )}
    </div>
  );
}
