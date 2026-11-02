// src/scripts/assistant/assistant-pages.js
// Last-resort lookup: finds the passage on the site's pages that best matches a
// question. It quotes the page, so anything written on the site stays answerable
// without being repeated in the knowledge file.
import { normalize, stem, STOP_WORDS } from "./assistant-engine.js";

const PAGE_PATHS = ["", "about/", "team/", "events/", "projects/", "projects/sandbox/", "hackathon/", "partners/", "contact/", "about/faq/", "about/community/", "about/history/", "about/exec-application/"];
const MIN_PASSAGE_LENGTH = 40;
const MIN_SCORE = 2.2;

let passagesPromise;

const termsOf = (text) => normalize(text).split(" ").filter((word) => word.length > 1 && !STOP_WORDS.has(word)).map(stem);

async function loadPage(path) {
  const url = new URL(path, new URL(import.meta.env.BASE_URL, window.location.origin));
  const response = await fetch(url);
  if (!response.ok) return [];

  const page = new DOMParser().parseFromString(await response.text(), "text/html");
  const root = page.querySelector("[data-pagefind-body]") ?? page.querySelector("main") ?? page.body;
  root.querySelectorAll("[data-pagefind-ignore], script, style, nav").forEach((element) => element.remove());
  root.querySelectorAll("br").forEach((lineBreak) => lineBreak.replaceWith(" "));
  const source = { label: page.title.split("|")[0].trim() || "AIML website", url: url.pathname };

  return [...root.querySelectorAll("p, li")]
    .filter((element) => !element.querySelector("p, li"))
    .map((element) => {
      const text = element.textContent.replace(/\s+/g, " ").trim();
      const container = element.closest("article, aside, section, li, div");
      const heading = (container?.querySelector("h1, h2, h3, h4, strong") ?? container?.querySelector(":scope > span"))?.textContent.replace(/\s+/g, " ").trim() ?? "";
      const section = element.closest("section");
      return { text, heading: heading === text ? "" : heading, section, sectionTitle: section?.querySelector("h1, h2")?.textContent.replace(/\s+/g, " ").trim() ?? "", sectionLabel: section?.querySelector("[class*='kicker']")?.textContent.trim() ?? "", source };
    })
    .filter((passage) => passage.text.length >= MIN_PASSAGE_LENGTH);
}

function loadPassages() {
  passagesPromise ??= Promise.all(PAGE_PATHS.map(loadPage)).then((pages) => {
    const passages = pages.flat().map((passage) => {
      const headingTerms = termsOf(passage.heading);
      const sectionTerms = termsOf(`${passage.sectionTitle} ${passage.sectionLabel}`);
      return { ...passage, sectionTerms, terms: [...termsOf(passage.text), ...headingTerms, ...headingTerms, ...sectionTerms, ...sectionTerms, ...termsOf(passage.source.label)] };
    });
    const frequency = new Map();
    passages.forEach((passage) => new Set(passage.terms).forEach((term) => frequency.set(term, (frequency.get(term) ?? 0) + 1)));
    return { passages, frequency };
  });
  return passagesPromise;
}

/** Returns an answer quoting the best passage, or null when nothing fits well enough. */
export async function searchPages(question) {
  const terms = [...new Set(termsOf(question))];
  if (!terms.length) return null;

  const { passages, frequency } = await loadPassages();
  let best = null;

  for (const passage of passages) {
    const counts = new Map();
    passage.terms.forEach((term) => counts.set(term, (counts.get(term) ?? 0) + 1));
    const matched = terms.filter((term) => counts.has(term));
    // Every term of a short question must match, and most of a longer one.
    if (matched.length / terms.length < (terms.length <= 2 ? 1 : 0.67)) continue;

    const score = matched.reduce((total, term) => {
      const rarity = Math.log(1 + passages.length / (frequency.get(term) ?? 1));
      return total + rarity * (counts.get(term) / (counts.get(term) + 1.2));
    }, 0);
    const titled = matched.some((term) => passage.sectionTerms.includes(term));
    const weighted = titled ? score * 1.6 : score;
    if (!best || weighted > best.score) best = { ...passage, score: weighted };
  }

  if (!best || best.score < MIN_SCORE) return null;

  // Asking about a whole section ("what are AIML's values?") lists what's in it.
  const siblings = passages.filter((passage) => passage.section && passage.section === best.section && passage.heading && passage.heading !== passage.sectionTitle);
  if (siblings.length > 1 && siblings.length <= 8 && terms.every((term) => best.sectionTerms.includes(term))) {
    return { text: `${best.sectionTitle.replace(/[.:]+$/, "")}:`, items: siblings.map((passage) => ({ label: passage.heading, detail: passage.text })), sources: [best.source], suggestions: [] };
  }

  const heading = best.heading && !best.text.startsWith(best.heading) ? `${best.heading.replace(/[.:]+$/, "")}: ` : "";
  return { text: `${heading}${best.text}`, items: [], sources: [best.source], suggestions: [] };
}
