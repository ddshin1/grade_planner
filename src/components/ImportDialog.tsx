"use client";

import { useState } from "react";
import { type Course, DEFAULT_SCALE } from "@/lib/grades";
import type { ImportedCourse } from "@/lib/import-schema";
import { actions, newAssignment, newCategory, uid } from "@/lib/store";
import { Modal, btnCls, num, primaryBtnCls } from "./ui";

type Status =
  | { step: "pick" }
  | { step: "reading"; fileName: string }
  | { step: "error"; message: string }
  | { step: "review"; data: ImportedCourse };

function toCourse(data: ImportedCourse): Course {
  return {
    id: uid(),
    name: data.courseName || "Imported class",
    college: "",
    mode: data.mode,
    scale: (data.scale.length > 0 ? data.scale : DEFAULT_SCALE).map((s) => ({ letter: s.letter, min: s.min })),
    categories: data.categories.map((c) =>
      newCategory(c.name, c.weight, {
        drops: Math.max(0, Math.floor(c.drops)),
        assignments: c.assignments.map((a) =>
          newAssignment(a.name, { possible: a.possible, earned: a.earned, extraCredit: a.extraCredit }),
        ),
      }),
    ),
  };
}

export default function ImportDialog({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status>({ step: "pick" });

  async function upload(file: File) {
    setStatus({ step: "reading", fileName: file.name });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.course) {
        setStatus({ step: "error", message: json?.error ?? "Something went wrong reading that file." });
        return;
      }
      setStatus({ step: "review", data: json.course as ImportedCourse });
    } catch {
      setStatus({ step: "error", message: "Could not reach the server. Check your connection and try again." });
    }
  }

  return (
    <Modal title="Import from a syllabus or gradebook" onClose={onClose}>
        {(status.step === "pick" || status.step === "error") && (
          <>
            <p className="mt-2 text-sm text-muted">
              Upload a PDF or a screenshot. AI reads the categories, weights, drop rules and any scores it can see,
              and you check the result before it is added.
            </p>
            {status.step === "error" && (
              <p className="mt-3 rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">{status.message}</p>
            )}
            <label className="mt-4 flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-line px-4 py-8 text-center hover:border-accent">
              <span className="font-medium">Choose a file</span>
              <span className="text-sm text-muted">PDF, PNG or JPEG, up to 4 MB</span>
              <input
                type="file"
                className="sr-only"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                }}
              />
            </label>
            <p className="mt-3 text-xs text-muted">
              The file is sent to an AI service to be read and is not saved by this site. Gradebook screenshots can
              include your name, so crop it out if you prefer.
            </p>
          </>
        )}

        {status.step === "reading" && (
          <p className="mt-6 mb-4 text-center text-sm text-muted" role="status">
            Reading {status.fileName}… this can take up to a minute.
          </p>
        )}

        {status.step === "review" && (
          <>
            {status.data.categories.length === 0 ? (
              <p className="mt-3 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
                No grading setup was found in that file.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted">Check this against your syllabus. You can edit everything after adding it.</p>
                <div className="mt-3 font-medium">{status.data.courseName || "Imported class"}</div>
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line text-sm">
                  {status.data.categories.map((c, i) => {
                    const graded = c.assignments.filter((a) => a.earned !== null).length;
                    return (
                      <li key={i} className="flex justify-between gap-3 px-3 py-2">
                        <span>
                          <span className="font-medium">{c.name}</span>
                          <span className="block text-muted">
                            {c.assignments.length} assignment{c.assignments.length === 1 ? "" : "s"}, {graded} graded
                            {c.drops > 0 && `, drops lowest ${c.drops}`}
                          </span>
                        </span>
                        {status.data.mode === "weighted" && (
                          <span className="shrink-0 tabular-nums">{num(c.weight)}%</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {status.data.scale.length === 0 && (
                  <p className="mt-2 text-sm text-muted">
                    No letter-grade cutoffs were found, so the standard ones (A = 93, A- = 90…) are used.
                  </p>
                )}
              </>
            )}
            {status.data.notes.length > 0 && (
              <div className="mt-3 rounded-md bg-warn-soft px-3 py-2 text-sm">
                <div className="font-medium text-warn">Things to double-check</div>
                <ul className="mt-1 list-disc pl-5">
                  {status.data.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnCls} onClick={() => setStatus({ step: "pick" })}>
                Try another file
              </button>
              {status.data.categories.length > 0 && (
                <button
                  className={primaryBtnCls}
                  onClick={() => {
                    actions.addCourse(toCourse(status.data));
                    onClose();
                  }}
                >
                  Add class
                </button>
              )}
            </div>
          </>
        )}
    </Modal>
  );
}
