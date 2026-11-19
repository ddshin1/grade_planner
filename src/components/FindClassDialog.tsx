"use client";

import { useEffect, useMemo, useState } from "react";
import { type CatalogCourse, loadCatalog, searchCourses } from "@/lib/catalog";
import { collegeKey } from "@/lib/colleges";
import { type StoredClass, describeShared, fromShared } from "@/lib/shared";
import { type ChosenCollege, actions, newCourse, useStore } from "@/lib/store";
import CollegePicker from "./CollegePicker";
import { Modal, btnCls, inputCls, primaryBtnCls } from "./ui";

type Shared = { for: string; status: "loading" | "ready" | "error"; classes: StoredClass[] };

export default function FindClassDialog({ onClose }: { onClose: () => void }) {
  const college = useStore()?.college ?? null;
  return (
    <Modal title="Find your class" onClose={onClose} wide>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-muted">Your college</span>
        <CollegePicker value={college} onChange={actions.setCollege} autoFocus={college === null} />
      </label>
      {college === null ? (
        <p className="mt-4 mb-2 text-sm text-muted">
          Pick your college to search its classes. If it is not in the list, type its name and choose “Use” at the
          bottom of the suggestions.
        </p>
      ) : (
        <ClassSearch key={collegeKey({ collegeId: college.id, college: college.name })} college={college} onClose={onClose} />
      )}
    </Modal>
  );
}

function ClassSearch({ college, onClose }: { college: ChosenCollege; onClose: () => void }) {
  const key = collegeKey({ collegeId: college.id, college: college.name }) ?? "";
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [shared, setShared] = useState<Shared>({ for: "", status: "loading", classes: [] });
  const q = query.trim();

  useEffect(() => {
    let live = true;
    if (college.id) loadCatalog(college.id).then((c) => live && setCatalog(c), () => undefined);
    return () => {
      live = false;
    };
  }, [college.id]);

  // Ask the shared library shortly after the student stops typing.
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/classes?college=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(
          (d: { classes: StoredClass[] }) => setShared({ for: q, status: "ready", classes: d.classes }),
          (e) => e.name !== "AbortError" && setShared({ for: q, status: "error", classes: [] }),
        );
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [key, q]);

  const listed = useMemo(() => searchCourses(catalog, q), [catalog, q]);
  const sharedReady = shared.for === q && shared.status !== "loading";

  function add(course: ReturnType<typeof newCourse>) {
    actions.addCourse(course);
    onClose();
  }
  const blank = (name: string) => ({ ...newCourse(name), college: college.name, collegeId: college.id });

  return (
    <>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-muted">Class</span>
        <input
          className={inputCls}
          autoFocus
          value={query}
          placeholder="Search by code, title or instructor, e.g. CS 225"
          aria-label="Search classes"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="mt-3 min-h-40">
        {shared.classes.length > 0 && shared.for === q && (
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              {q === "" ? "Recently shared by students here" : "Grading setups shared by students"}
            </h3>
            <ul className="mt-1.5 divide-y divide-line rounded-lg border border-line">
              {shared.classes.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="line-clamp-2 text-sm text-muted">
                      {[c.instructor, c.term].filter(Boolean).join(" · ")}
                      {(c.instructor || c.term) && " · "}
                      {describeShared(c)}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button className={`${primaryBtnCls} h-8 px-2.5`} onClick={() => add(fromShared(c))}>
                      Use this
                    </button>
                    <ReportButton id={c.id} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {listed.length > 0 && (
          <section className="mt-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Classes at {college.name}</h3>
            <ul className="mt-1.5 divide-y divide-line rounded-lg border border-line">
              {listed.map((c) => {
                const code = `${c.subject} ${c.number}`;
                return (
                  <li key={code} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="shrink-0 font-semibold tabular-nums">{code}</span>
                      <span className="truncate text-sm">{c.title}</span>
                    </div>
                    <button className={`${btnCls} h-8 shrink-0 px-2.5`} onClick={() => add(blank(`${code}: ${c.title}`))}>
                      Add
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {shared.status === "error" && shared.for === q && (
          <p className="mt-3 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
            Could not check for setups shared by other students. You can still add your class below.
          </p>
        )}

        {q !== "" && sharedReady && (
          <div className="mt-3 rounded-lg border border-dashed border-line px-3 py-3">
            <p className="text-sm">
              {shared.classes.length === 0 && listed.length === 0
                ? `Nothing found for “${q}” yet. Set it up yourself:`
                : "Not the right one? Set it up yourself:"}
            </p>
            <button className={`${primaryBtnCls} mt-2`} onClick={() => add(blank(q))}>
              Add “{q}” and enter the details
            </button>
            <p className="mt-2 text-xs text-muted">
              You type in the categories, weights, drops and assignments from your syllabus. You can then share the
              setup so classmates find it here.
            </p>
          </div>
        )}

        {q === "" && sharedReady && shared.classes.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">
            Type your class code or title. If nobody has added it yet, you can set it up yourself.
          </p>
        )}
      </div>
    </>
  );
}

/** Flags a shared setup as wrong. Setups with several reports stop appearing in search. */
function ReportButton({ id }: { id: string }) {
  const [sent, setSent] = useState(false);
  if (sent) return <span className="text-xs text-muted">Reported, thanks</span>;
  return (
    <button
      className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
      onClick={() => {
        if (!confirm("Report this setup as wrong or spam?")) return;
        setSent(true);
        fetch(`/api/classes/${encodeURIComponent(id)}/report`, { method: "POST" }).catch(() => undefined);
      }}
    >
      Report wrong
    </button>
  );
}
