"use client";

import { useState } from "react";

export const inputCls =
  "h-9 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/25";

export const btnCls =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-soft disabled:opacity-50";

export const primaryBtnCls =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-surface hover:opacity-90 disabled:opacity-50";

export const pct = (n: number | null, digits = 1) => (n === null ? "–" : `${n.toFixed(digits)}%`);

/** Trim trailing zeros: 18 -> "18", 17.5 -> "17.5", 86.04 -> "86". */
export const num = (n: number, digits = 1) => String(Number(n.toFixed(digits)));

/**
 * Number field that allows being empty (null). Keeps what the user typed
 * (e.g. "8.") while they type, and follows the value when it changes elsewhere.
 */
export function NumInput({
  value,
  onChange,
  className = "",
  ...rest
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    const parsed = text.trim() === "" ? null : Number(text);
    if (parsed !== value) setText(value === null ? "" : String(value));
  }
  return (
    <input
      {...rest}
      inputMode="decimal"
      className={`${inputCls} text-right tabular-nums ${className}`}
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        if (!/^\d*\.?\d*$/.test(t)) return;
        setText(t);
        const v = t === "" || t === "." ? null : Number(t);
        setSeen(v);
        onChange(v);
      }}
    />
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-surface ${className}`}>{children}</section>;
}
