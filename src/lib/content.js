// The only code that reads the /content folder. Pages import from here.
// See content/README.md for the folder layout editors work with.

import { getImage } from "astro:assets";
import site from "../../content/site.json";
import faq from "../../content/faq.json";
import degrees from "../../content/degrees.json";
import coFounders from "../../content/co-founders.json";

export { site, faq, degrees, coFounders };
export const { links, partners } = site;

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------
// Every image under /content is resized and converted to WebP at build time,
// so editors can drop in full-size phone photos without slowing the site.

const imageFiles = import.meta.glob("/content/**/*.{png,jpg,jpeg,webp,gif,svg}", { eager: true, import: "default" });

// Longest edge per kind of image, in pixels.
const maxWidthFor = path => (/^team\/\d{4}\/(?!team-photo)/.test(path) ? 600 : /^images\/(partner|logo)/.test(path) ? 800 : 2000);

let urls;
async function buildImageUrls() {
  const entries = await Promise.all(
    Object.entries(imageFiles).map(async ([file, meta]) => {
      const path = file.replace(/^\/content\//, "");
      if (path.endsWith(".svg")) return [path, meta.src];
      // Read size via .clone: touching meta.width directly makes Astro ship the full-size original too.
      const { width } = meta.clone;
      const { src } = await getImage({ src: meta, width: Math.min(width, maxWidthFor(path)), format: "webp" });
      return [path, src];
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Returns a lookup function: image("images/home-1.png") → optimised URL.
 * Paths are relative to /content. A missing file fails the build with a clear message.
 *   const image = await loadImages();
 */
export async function loadImages() {
  urls ??= await buildImageUrls();
  return path => {
    const url = urls[path];
    if (!url) throw new Error(`Image not found: content/${path}`);
    return url;
  };
}

// ---------------------------------------------------------------------------
// Semesters ("2026-sem-1")
// ---------------------------------------------------------------------------

function parseSemester(id) {
  const match = id.match(/^(\d{4})-sem-(\d)$/);
  if (!match) throw new Error(`Folder "${id}" must be named YYYY-sem-N (e.g. 2026-sem-1).`);
  return { year: Number(match[1]), sem: Number(match[2]) };
}

/** "2026-sem-1" → "Sem 1 2026" */
export function semesterLabel(id) {
  const { year, sem } = parseSemester(id);
  return `Sem ${sem} ${year}`;
}

const newestSemesterFirst = (a, b) => {
  const x = parseSemester(a.id), y = parseSemester(b.id);
  return y.year - x.year || y.sem - x.sem;
};

const folderOf = path => path.split("/").at(-2);

// ---------------------------------------------------------------------------
// Events — content/events/<semester>/events.json
// ---------------------------------------------------------------------------

export function slugify(title) {
  return title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

/** Parse "YYYY-MM-DD" as a local date (avoids UTC off-by-one). */
export function parseDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const eventFiles = import.meta.glob("/content/events/*/events.json", { eager: true, import: "default" });

/** Every event, oldest first. */
export async function getEvents() {
  const image = await loadImages();
  return Object.entries(eventFiles)
    .flatMap(([path, events]) => {
      const semesterId = folderOf(path);
      return events.map((ev, index) => ({
        ...ev,
        id: ev.id ?? `${semesterId}-${index}`,
        semesterId,
        slug: slugify(ev.title),
        dateLabel: parseDate(ev.date).toLocaleDateString("en-AU", {
          weekday: "long", day: "numeric", month: "short", year: "numeric",
        }),
        image: ev.image ? image(`events/${semesterId}/${ev.image}`) : null,
      }));
    })
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));
}

/** Semesters that have events, newest first: [{ id, label }]. */
export function getEventSemesters() {
  return Object.keys(eventFiles)
    .map(path => ({ id: folderOf(path), label: semesterLabel(folderOf(path)) }))
    .sort(newestSemesterFirst);
}

// ---------------------------------------------------------------------------
// Projects — content/projects/<semester>/projects.json
// ---------------------------------------------------------------------------

const projectFiles = import.meta.glob("/content/projects/*/projects.json", { eager: true, import: "default" });

/** Project semesters, newest first: [{ id, label, projects }]. An empty list means "not announced yet". */
export async function getProjectSemesters() {
  const image = await loadImages();
  return Object.entries(projectFiles)
    .map(([path, projects]) => {
      const id = folderOf(path);
      return {
        id,
        label: semesterLabel(id),
        projects: projects.map(p => ({ ...p, semesterId: id, image: p.image ? image(`projects/${id}/${p.image}`) : null })),
      };
    })
    .sort(newestSemesterFirst);
}

// ---------------------------------------------------------------------------
// Team — content/team/<year>/team.json (+ headshots and team-photo.*)
// ---------------------------------------------------------------------------

const teamFiles = import.meta.glob("/content/team/*/team.json", { eager: true, import: "default" });

/**
 * Every team year, newest first:
 * [{ year, groups: [{ title, items: [{ role, name, image, ... }] }], people, teamPhoto }]
 */
export async function getTeams() {
  const image = await loadImages();
  const placeholder = image("images/team-placeholder.png");
  return Object.entries(teamFiles)
    .map(([path, file]) => {
      const year = Number(folderOf(path));
      const groups = file.map(group => ({
        ...group,
        items: group.items.map(member => ({
          ...member,
          image: member.image ? image(`team/${year}/${member.image}`) : placeholder,
        })),
      }));
      const photo = ["png", "jpg", "jpeg", "webp"].map(ext => `team/${year}/team-photo.${ext}`).find(p => imageFiles[`/content/${p}`]);
      return {
        year,
        groups,
        people: groups.reduce((total, group) => total + group.items.length, 0),
        teamPhoto: photo ? image(photo) : null,
      };
    })
    .sort((a, b) => b.year - a.year);
}
