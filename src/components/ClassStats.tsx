"use client";

import { useEffect, useState } from "react";
import {
  type Catalog,
  type CatalogCourse,
  loadCatalog,
  shareWithLetter,
  termLabel,
  totalStudents,
} from "@/lib/catalog";
import { num } from "./ui";

type Loaded = { status: "loading" } | { status: "error" } | { status: "ready"; catalog: Catalog };

/** Loads a school's catalog. Starts over when the school changes. */
export function useCatalog(schoolId: string): Loaded {
  const [state, setState] = useState<{ id: string; value: Loaded }>({ id: schoolId, value: { status: "loading" } });
  useEffect(() => {
    let live = true;
    loadCatalog(schoolId).then(
      (catalog) => live && setState({ id: schoolId, value: { status: "ready", catalog } }),
      () => live && setState({ id: schoolId, value: { status: "error" } }),
    );
    return () => {
      live = false;
    };
  }, [schoolId]);
  return state.id === schoolId ? state.value : { status: "loading" };
}

/** How past students did in a class: average GPA, grade distribution, and instructors. */
export default function ClassStats({ catalog, course }: { catalog: Catalog; course: CatalogCourse }) {
  const total = totalStudents(course);
  const aShare = shareWithLetter(catalog, course, "A");
  const [from, to] = catalog.school.terms;
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="Average GPA" value={course.gpa === null ? "–" : course.gpa.toFixed(2)} />
        <Stat label="Got an A" value={aShare === null ? "–" : `${num(aShare, 0)}%`} />
        <Stat label="Students" value={total.toLocaleString()} />
      </div>

      <Distribution grades={catalog.school.grades} counts={course.d} />

      {course.i.length > 0 && (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-muted">
              <th className="pb-1 font-medium">Instructor</th>
              <th className="pb-1 text-right font-medium">Avg GPA</th>
              <th className="pb-1 text-right font-medium">Students</th>
              <th className="hidden pb-1 text-right font-medium sm:table-cell">Last taught</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-t border-line">
            {course.i.map((p) => (
              <tr key={p.name}>
                <td className="py-1.5 pr-2">{p.name}</td>
                <td className="py-1.5 text-right tabular-nums">{p.gpa === null ? "–" : p.gpa.toFixed(2)}</td>
                <td className="py-1.5 text-right tabular-nums text-muted">{p.st.toLocaleString()}</td>
                <td className="hidden py-1.5 text-right text-muted sm:table-cell">{termLabel(p.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-3 text-xs text-muted">
        {termLabel(from)} to {termLabel(to)}, sections with more than 20 students. Withdrawals ({course.w.toLocaleString()})
        are not counted. Source:{" "}
        <a className="underline" href={catalog.school.sourceUrl} target="_blank" rel="noreferrer">
          {catalog.school.source}
        </a>
        .
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-soft px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/** Bar chart of the share of students at each letter grade. Hover or focus a bar for its numbers. */
function Distribution({ grades, counts }: { grades: string[]; counts: number[] }) {
  const total = counts.reduce((s, x) => s + x, 0);
  const max = Math.max(...counts, 1);
  const top = counts.indexOf(max);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? top;
  if (total === 0) return null;
  return (
    <figure className="mt-4">
      <figcaption className="flex items-baseline justify-between text-xs text-muted">
        <span>Share of students by grade</span>
        <span className="tabular-nums text-ink">
          {grades[shown]}: {num((counts[shown] / total) * 100)}% ({counts[shown].toLocaleString()})
        </span>
      </figcaption>
      <div className="mt-2 flex h-24 items-end gap-0.5 border-b border-line" onMouseLeave={() => setHover(null)}>
        {counts.map((c, i) => (
          <button
            key={grades[i]}
            type="button"
            className="group flex h-full flex-1 items-end outline-none"
            aria-label={`${grades[i]}: ${num((c / total) * 100)}% of students, ${c.toLocaleString()}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          >
            <span
              className={`w-full rounded-t ${shown === i ? "bg-accent" : "bg-accent/55"} group-focus-visible:ring-2 group-focus-visible:ring-accent/40`}
              style={{ height: c === 0 ? 0 : `${Math.max(2, (c / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 text-center text-[11px] text-muted">
        {grades.map((g) => (
          <span key={g} className="flex-1">
            {g}
          </span>
        ))}
      </div>
    </figure>
  );
}
