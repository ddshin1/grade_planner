"use client";

import { useEffect, useId, useState } from "react";
import { type College, loadColleges, searchColleges } from "@/lib/colleges";
import type { ChosenCollege } from "@/lib/store";
import { inputCls } from "./ui";

type Colleges = Awaited<ReturnType<typeof loadColleges>>;

/**
 * College search box with suggestions. Picking a suggestion gives a college
 * with an id; typing a name that is not in the list is also accepted, since
 * the list does not have every college.
 */
export default function CollegePicker({
  value,
  onChange,
  autoFocus = false,
  placeholder = "Search for your college",
}: {
  value: ChosenCollege | null;
  onChange: (college: ChosenCollege | null) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const listId = useId();
  const [text, setText] = useState(value?.name ?? "");
  const [seen, setSeen] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [colleges, setColleges] = useState<Colleges | null>(null);
  const [failed, setFailed] = useState(false);

  // Follow the value when it is changed from outside.
  if ((value?.name ?? "") !== seen) {
    setSeen(value?.name ?? "");
    setText(value?.name ?? "");
  }

  useEffect(() => {
    if (!open || colleges) return;
    let live = true;
    loadColleges().then(
      (c) => live && setColleges(c),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [open, colleges]);

  const matches: College[] = open && colleges ? searchColleges(colleges, text) : [];
  const typed = text.trim();
  const exact = matches.some((m) => m.name.toLowerCase() === typed.toLowerCase());
  const showCustom = open && typed !== "" && !exact && (colleges !== null || failed);
  const optionCount = matches.length + (showCustom ? 1 : 0);

  function choose(college: ChosenCollege | null) {
    setOpen(false);
    setText(college?.name ?? "");
    setSeen(college?.name ?? "");
    onChange(college);
  }

  function chooseIndex(i: number) {
    if (i < matches.length) choose({ id: matches[i].id, name: matches[i].name });
    else if (showCustom) choose({ name: typed });
  }

  return (
    <div className="relative">
      <input
        className={inputCls}
        role="combobox"
        aria-expanded={open && optionCount > 0}
        aria-controls={listId}
        aria-label="College"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => {
          // Leaving the box keeps what was typed as a hand-entered college.
          setOpen(false);
          if (typed === (value?.name ?? "")) return;
          choose(typed === "" ? null : { name: typed });
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, optionCount - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && optionCount > 0) {
            e.preventDefault();
            chooseIndex(active);
          } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {open && typed !== "" && (optionCount > 0 || colleges === null) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          {colleges === null && !failed && <li className="px-3 py-2 text-sm text-muted">Loading colleges…</li>}
          {matches.map((m, i) => (
            <li
              key={m.id}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-accent-soft" : ""}`}
              onMouseEnter={() => setActive(i)}
              // mousedown, not click, so it fires before the input's blur.
              onMouseDown={(e) => {
                e.preventDefault();
                chooseIndex(i);
              }}
            >
              <span className="font-medium">{m.name}</span>
              <span className="ml-2 text-muted">{[m.state, m.country].filter(Boolean).join(", ")}</span>
            </li>
          ))}
          {showCustom && (
            <li
              role="option"
              aria-selected={active === matches.length}
              className={`cursor-pointer px-3 py-2 text-sm ${active === matches.length ? "bg-accent-soft" : ""}`}
              onMouseEnter={() => setActive(matches.length)}
              onMouseDown={(e) => {
                e.preventDefault();
                chooseIndex(matches.length);
              }}
            >
              Use “{typed}” <span className="text-muted">(not in the list)</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
