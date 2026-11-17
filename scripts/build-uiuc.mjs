// Builds the UIUC course list (public/data/catalog/uiuc.edu.json) from the public UIUC GPA dataset
// (https://github.com/wadefagen/datasets/tree/main/gpa), which is compiled
// from records released by the University of Illinois.
//
//   node scripts/build-uiuc.mjs [path-to-csv]
//
// Without a path it downloads the CSV. Only course codes and titles are
// used, and only from recent terms so retired courses are left out.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const CSV_URL = "https://raw.githubusercontent.com/wadefagen/datasets/main/gpa/uiuc-gpa-dataset.csv";
const SINCE = 2021;
// Must match this college's id in public/data/colleges.json.
const COLLEGE_ID = "uiuc.edu";

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

const termOrder = { wi: 0, sp: 1, su: 2, fa: 3 };
const later = (a, b) => {
  const [ya, ta] = a.split("-"), [yb, tb] = b.split("-");
  return ya !== yb ? ya > yb : termOrder[ta] > termOrder[tb];
};

const courses = new Map();
for (const r of rows) {
  if (r.length < header.length || Number(r[col.Year]) < SINCE) continue;
  const term = r[col.YearTerm];
  const key = `${r[col.Subject]} ${r[col.Number]}`;
  let c = courses.get(key);
  if (!c) courses.set(key, (c = { s: r[col.Subject], n: r[col.Number], t: "", last: "" }));
  // Keep the title from the most recent term.
  if (!c.last || later(term, c.last)) { c.last = term; c.t = r[col["Course Title"]]; }
}

const out = {
  college: COLLEGE_ID,
  source: "UIUC GPA Dataset by Wade Fagen-Ulmschneider, from records released by the University of Illinois",
  sourceUrl: "https://github.com/wadefagen/datasets/tree/main/gpa",
  // Each course is [subject, number, title].
  courses: [...courses.values()]
    .sort((a, b) => a.s.localeCompare(b.s) || a.n.localeCompare(b.n))
    .map((c) => [c.s, c.n, c.t]),
};
await mkdir(new URL("../public/data/catalog/", import.meta.url), { recursive: true });
await writeFile(new URL(`../public/data/catalog/${COLLEGE_ID}.json`, import.meta.url), JSON.stringify(out));
console.log(`${out.courses.length} courses`);
