// Builds public/data/uiuc.json from the public UIUC GPA dataset
// (https://github.com/wadefagen/datasets/tree/main/gpa), which is compiled
// from records released by the University of Illinois.
//
//   node scripts/build-uiuc.mjs [path-to-csv]
//
// Without a path it downloads the CSV. Only recent terms are kept so the
// numbers reflect how a class is graded now.
import { readFile, writeFile } from "node:fs/promises";

const CSV_URL = "https://raw.githubusercontent.com/wadefagen/datasets/main/gpa/uiuc-gpa-dataset.csv";
const SINCE = 2021;
const GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"];
const POINTS = [4, 4, 3.67, 3.33, 3, 2.67, 2.33, 2, 1.67, 1.33, 1, 0.67, 0];
const MAX_INSTRUCTORS = 8;

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const buf = process.argv[2] ? await readFile(process.argv[2]) : Buffer.from(await (await fetch(CSV_URL)).arrayBuffer());
// The file is mostly UTF-8 with a few Latin-1 bytes in instructor names.
const [header, ...rows] = parseCsv(new TextDecoder("latin1").decode(buf));
const col = Object.fromEntries(header.map((h, i) => [h, i]));

const gpa = (d) => {
  const n = d.reduce((s, x) => s + x, 0);
  return n ? Math.round((d.reduce((s, x, i) => s + x * POINTS[i], 0) / n) * 100) / 100 : null;
};
const termOrder = { wi: 0, sp: 1, su: 2, fa: 3 };
const later = (a, b) => {
  const [ya, ta] = a.split("-"), [yb, tb] = b.split("-");
  return ya !== yb ? ya > yb : termOrder[ta] > termOrder[tb];
};

const courses = new Map();
let first = null, last = null;
for (const r of rows) {
  if (r.length < header.length || Number(r[col.Year]) < SINCE) continue;
  const term = r[col.YearTerm];
  if (!first || later(first, term)) first = term;
  if (!last || later(term, last)) last = term;
  const key = `${r[col.Subject]} ${r[col.Number]}`;
  let c = courses.get(key);
  if (!c) courses.set(key, (c = { s: r[col.Subject], n: r[col.Number], t: "", last: "", d: GRADES.map(() => 0), w: 0, inst: new Map() }));
  if (!c.last || later(term, c.last)) { c.last = term; c.t = r[col["Course Title"]]; }
  const d = GRADES.map((g) => Number(r[col[g]]) || 0);
  d.forEach((x, i) => (c.d[i] += x));
  c.w += Number(r[col.W]) || 0;
  const name = r[col["Primary Instructor"]].trim();
  if (name) {
    let p = c.inst.get(name);
    if (!p) c.inst.set(name, (p = { name, d: GRADES.map(() => 0), last: term }));
    d.forEach((x, i) => (p.d[i] += x));
    if (later(term, p.last)) p.last = term;
  }
}

const out = {
  school: {
    id: "uiuc",
    name: "University of Illinois Urbana-Champaign",
    source: "UIUC GPA Dataset by Wade Fagen-Ulmschneider, from records released by the University of Illinois",
    sourceUrl: "https://github.com/wadefagen/datasets/tree/main/gpa",
    terms: [first, last],
    grades: GRADES,
  },
  courses: [...courses.values()]
    .sort((a, b) => a.s.localeCompare(b.s) || a.n.localeCompare(b.n))
    .map((c) => ({
      s: c.s, n: c.n, t: c.t, last: c.last, gpa: gpa(c.d), d: c.d, w: c.w,
      i: [...c.inst.values()]
        .map((p) => ({ name: p.name, gpa: gpa(p.d), st: p.d.reduce((s, x) => s + x, 0), last: p.last }))
        .sort((a, b) => b.st - a.st)
        .slice(0, MAX_INSTRUCTORS),
    })),
};
await writeFile(new URL("../public/data/uiuc.json", import.meta.url), JSON.stringify(out));
console.log(`${out.courses.length} courses, terms ${first} to ${last}`);
