"use client";

import { useMemo, useState } from "react";
import { type CatalogCourse, SCHOOLS, searchCourses } from "@/lib/catalog";
import { actions, newCourse } from "@/lib/store";
import ClassStats, { useCatalog } from "./ClassStats";
import { Modal, inputCls, primaryBtnCls } from "./ui";

export default function FindClassDialog({ onClose }: { onClose: () => void }) {
  const [schoolId, setSchoolId] = useState(SCHOOLS[0].id);
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const loaded = useCatalog(schoolId);
  const school = SCHOOLS.find((s) => s.id === schoolId) ?? SCHOOLS[0];

  const results = useMemo(
    () => (loaded.status === "ready" ? searchCourses(loaded.catalog, query) : []),
    [loaded, query],
  );

  function add(c: CatalogCourse) {
    actions.addCourse({
      ...newCourse(`${c.s} ${c.n}: ${c.t}`),
      college: school.short,
      catalog: { school: school.id, subject: c.s, number: c.n },
    });
    onClose();
  }

  return (
    <Modal title="Find your class" onClose={onClose} wide>
      <div className="mt-3 grid gap-2 sm:grid-cols-[220px_1fr]">
        <select
          className={inputCls}
          value={schoolId}
          aria-label="School"
          onChange={(e) => {
            setSchoolId(e.target.value);
            setOpenKey(null);
          }}
        >
          {SCHOOLS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className={inputCls}
          autoFocus
          value={query}
          placeholder="Search by code or title, e.g. CS 225 or statistics"
          aria-label="Search classes"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-3 min-h-48">
        {loaded.status === "loading" && <p className="py-8 text-center text-sm text-muted">Loading classes…</p>}
        {loaded.status === "error" && (
          <p className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
            Could not load the class list. Check your connection and try again.
          </p>
        )}
        {loaded.status === "ready" && query.trim() === "" && (
          <p className="py-8 text-center text-sm text-muted">
            {loaded.catalog.courses.length.toLocaleString()} classes at {school.short}. Start typing to search.
          </p>
        )}
        {loaded.status === "ready" && query.trim() !== "" && results.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            No classes match “{query.trim()}”. You can still add it by hand with “New class”.
          </p>
        )}
        {loaded.status === "ready" && results.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {results.map((c) => {
              const key = `${c.s} ${c.n}`;
              const open = openKey === key;
              return (
                <li key={key}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button
                      className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
                      aria-expanded={open}
                      onClick={() => setOpenKey(open ? null : key)}
                    >
                      <span className="shrink-0 font-semibold tabular-nums">{key}</span>
                      <span className="truncate text-sm">{c.t}</span>
                    </button>
                    <span className="shrink-0 text-sm tabular-nums text-muted" title="Average GPA">
                      {c.gpa === null ? "" : `${c.gpa.toFixed(2)} GPA`}
                    </span>
                    <button className={`${primaryBtnCls} h-8 shrink-0 px-2.5`} onClick={() => add(c)}>
                      Add
                    </button>
                  </div>
                  {open && (
                    <div className="border-t border-line bg-bg/50 px-3 py-3">
                      <ClassStats catalog={loaded.catalog} course={c} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        Click a class to see how past students did. Adding it sets up the class name; the grading weights come from
        your syllabus, so enter those after adding. Only one school has class data so far.
      </p>
    </Modal>
  );
}
