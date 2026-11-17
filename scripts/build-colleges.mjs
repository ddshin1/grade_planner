// Builds public/data/colleges.json from the public world universities list
// (https://github.com/Hipo/university-domains-list).
//
//   node scripts/build-colleges.mjs [path-to-json]
//
// Each college becomes [id, name, countryCode, stateOrProvince, keywords].
// The id is the college's main web domain, which is stable and unique.
// Keywords are its domain names without the ending ("uiuc illinois"), so
// searching "uiuc" or "mit" works.
import { readFile, writeFile } from "node:fs/promises";

const SRC = "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json";
const list = JSON.parse(process.argv[2] ? await readFile(process.argv[2], "utf8") : await (await fetch(SRC)).text());

const seen = new Set();
const colleges = [];
for (const u of list) {
  const name = (u.name ?? "").trim();
  if (!name || !u.domains?.length) continue;
  let id = u.domains[0].toLowerCase();
  for (let i = 2; seen.has(id); i++) id = `${u.domains[0].toLowerCase()}#${i}`;
  seen.add(id);
  const keywords = [...new Set(u.domains.map((d) => d.toLowerCase().split(".")[0]))].join(" ");
  colleges.push([id, name, u.alpha_two_code ?? "", u["state-province"] ?? "", keywords]);
}
colleges.sort((a, b) => a[1].localeCompare(b[1]));

await writeFile(
  new URL("../public/data/colleges.json", import.meta.url),
  JSON.stringify({ source: "https://github.com/Hipo/university-domains-list", colleges }),
);
console.log(`${colleges.length} colleges`);
