#!/usr/bin/env node
// Checks everything in /content before a build: valid JSON, required fields,
// and that every image named in JSON or in a page actually exists.
// Run with `npm run check`. Errors fail the build; unused images are only listed.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CONTENT = join(ROOT, "content");
const SEMESTER = /^\d{4}-sem-[12]$/;
const YEAR = /^\d{4}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE = /\.(png|jpe?g|webp|gif|svg)$/i;

const errors = [];
const used = new Set();
const rel = p => relative(ROOT, p);

const list = dir => (existsSync(dir) ? readdirSync(dir).filter(n => !n.startsWith(".")) : []);
const walk = dir => list(dir).flatMap(n => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

function readJson(file) {
  if (!existsSync(file)) {
    errors.push(`${rel(file)}: file is missing`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${rel(file)}: invalid JSON — ${e.message}`);
    return null;
  }
}

function requireFields(file, label, obj, fields) {
  for (const f of fields) {
    if (obj?.[f] === undefined || obj[f] === "") errors.push(`${rel(file)}: ${label} is missing "${f}"`);
  }
}

function requireImage(file, label, path) {
  const full = join(CONTENT, path);
  used.add(full);
  if (!existsSync(full)) errors.push(`${rel(file)}: ${label} uses image "${path.split("/").at(-1)}", but content/${path} does not exist`);
}

function requireArray(file, data) {
  if (data && !Array.isArray(data)) errors.push(`${rel(file)}: must be a list — wrap the entries in [ ... ]`);
  return Array.isArray(data) ? data : [];
}

// --- events/<semester>/events.json and projects/<semester>/projects.json ----
for (const [section, required] of [["events", ["title", "date", "category"]], ["projects", ["title", "category"]]]) {
  for (const sem of list(join(CONTENT, section))) {
    const file = join(CONTENT, section, sem, `${section}.json`);
    if (!SEMESTER.test(sem)) {
      errors.push(`content/${section}/${sem}: folder must be named YYYY-sem-N (e.g. 2026-sem-1)`);
      continue;
    }
    requireArray(file, readJson(file)).forEach((entry, i) => {
      const label = `entry ${i + 1} ("${entry.title ?? "untitled"}")`;
      requireFields(file, label, entry, required);
      if (entry.date && !DATE.test(entry.date)) errors.push(`${rel(file)}: ${label} date "${entry.date}" must be YYYY-MM-DD`);
      if (entry.image) requireImage(file, label, `${section}/${sem}/${entry.image}`);
    });
  }
}

// --- team/<year>/team.json --------------------------------------------------
for (const year of list(join(CONTENT, "team"))) {
  const file = join(CONTENT, "team", year, "team.json");
  if (!YEAR.test(year)) {
    errors.push(`content/team/${year}: folder must be a year, e.g. 2027`);
    continue;
  }
  for (const group of requireArray(file, readJson(file))) {
    requireFields(file, "group", group, ["title", "items"]);
    for (const m of group.items ?? []) {
      requireFields(file, `"${group.title}" member`, m, ["role", "name"]);
      if (m.image) requireImage(file, m.name, `team/${year}/${m.image}`);
    }
  }
  for (const ext of ["png", "jpg", "jpeg", "webp"]) used.add(join(CONTENT, "team", year, `team-photo.${ext}`));
}

// --- site.json, faq.json, degrees.json, co-founders.json ----------------------
const siteFile = join(CONTENT, "site.json");
const site = readJson(siteFile);
for (const p of site?.partners ?? []) {
  requireFields(siteFile, `partner "${p.name ?? "?"}"`, p, ["name", "tier", "url", "logo"]);
  if (p.tier && !["sponsor", "supporter"].includes(p.tier)) errors.push(`content/site.json: partner "${p.name}" tier must be "sponsor" or "supporter"`);
  if (p.logo) requireImage(siteFile, `partner "${p.name}"`, `images/${p.logo}`);
}
requireArray(join(CONTENT, "faq.json"), readJson(join(CONTENT, "faq.json")))
  .forEach((q, i) => requireFields(join(CONTENT, "faq.json"), `question ${i + 1}`, q, ["title", "body"]));
readJson(join(CONTENT, "degrees.json"));
readJson(join(CONTENT, "co-founders.json"));
used.add(join(CONTENT, "images", "team-placeholder.png"));

// --- image("...") calls in pages/components ---------------------------------
for (const file of walk(join(ROOT, "src")).filter(f => /\.(astro|js|ts|tsx)$/.test(f))) {
  for (const [, path] of readFileSync(file, "utf8").matchAll(/image\(["'`]([^"'`$]+)["'`]\)/g)) {
    requireImage(file, "page", path);
  }
}

// --- report -----------------------------------------------------------------
const unused = walk(CONTENT).filter(p => IMAGE.test(p) && !used.has(p));
if (unused.length) {
  console.warn(`⚠ ${unused.length} image(s) in content/ are not used anywhere (safe to delete if unwanted):`);
  unused.forEach(p => console.warn(`   ${rel(p)}`));
}

if (errors.length) {
  console.error(`\n✖ Content check found ${errors.length} problem(s):`);
  errors.forEach(e => console.error(`   ${e}`));
  process.exit(1);
}
console.log("✔ Content check passed.");
