// src/scripts/projects/projects-script.js
// Project browser: pick a topic, pick a project, read its notebook.
// GitHub refuses to load inside an iframe, so notebooks are fetched from
// raw.githubusercontent.com and rendered in a sandboxed frame without scripts.

const NOTEBOOK_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+\.ipynb)$/;

const FRAME_STYLES = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { background: #0d0c0e; color: #e7dfe5; font: 15px/1.6 Inter, system-ui, sans-serif; margin: 0; padding: 1.5rem; overflow-wrap: anywhere; }
  main { margin: 0 auto; max-width: 860px; }
  h1, h2, h3, h4 { color: #fff; line-height: 1.2; margin: 1.6em 0 .6em; }
  h1 { font-size: 1.7rem; } h2 { font-size: 1.35rem; } h3 { font-size: 1.1rem; } h4 { font-size: 1rem; }
  main > section:first-child > :first-child { margin-top: 0; }
  a { color: #f173e5; }
  img { height: auto; max-width: 100%; }
  pre { font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; overflow-x: auto; padding: .85rem 1rem; white-space: pre; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; }
  .code { background: #1a171b; border: 1px solid rgba(255,255,255,.1); border-radius: 4px; margin: 1rem 0 0; }
  .output { border-left: 2px solid rgba(255,0,230,.4); margin: 0 0 1rem; padding: .5rem 0 .5rem .85rem; }
  .output pre { color: #cbc1ca; max-height: 320px; overflow: auto; padding: .25rem 0; }
  .table-scroll, .output { overflow-x: auto; }
  table { border-collapse: collapse; font-size: 12.5px; margin: .75rem 0; }
  th, td { border: 1px solid rgba(255,255,255,.14); padding: .3rem .55rem; text-align: left; }
  th { background: #1a171b; color: #fff; }
  blockquote { border-left: 3px solid rgba(255,255,255,.2); color: #cbc1ca; margin: 1em 0; padding-left: 1em; }
  .message { color: #cbc1ca; padding-top: 3rem; text-align: center; }
`;

const escapeHtml = (text) =>
  text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const joinSource = (source) => (Array.isArray(source) ? source.join("") : source ?? "");

// Strip terminal colour codes from text outputs.
const cleanOutput = (text) => joinSource(text).replace(/\u001b\[[0-9;]*m/g, "");

function renderOutput(output) {
  const data = output.data ?? {};
  if (output.output_type === "stream") {
    return output.name === "stderr" ? "" : `<pre>${escapeHtml(cleanOutput(output.text))}</pre>`;
  }
  if (data["image/png"]) return `<img alt="Notebook output" src="data:image/png;base64,${joinSource(data["image/png"]).trim()}">`;
  if (data["image/jpeg"]) return `<img alt="Notebook output" src="data:image/jpeg;base64,${joinSource(data["image/jpeg"]).trim()}">`;
  if (data["text/html"]) return joinSource(data["text/html"]);
  // Widgets (such as progress bars) only have a meaningless text fallback.
  if (data["application/vnd.jupyter.widget-view+json"]) return "";
  if (data["text/plain"]) return `<pre>${escapeHtml(cleanOutput(data["text/plain"]))}</pre>`;
  return "";
}

function renderNotebook(notebook, marked) {
  const cells = notebook.cells ?? notebook.worksheets?.[0]?.cells ?? [];

  return cells.map((cell) => {
    if (cell.cell_type === "markdown") return `<section>${marked.parse(joinSource(cell.source))}</section>`;
    if (cell.cell_type !== "code") return "";

    const outputs = (cell.outputs ?? []).map(renderOutput).filter(Boolean).join("");
    return `<div class="code"><pre><code>${escapeHtml(joinSource(cell.source))}</code></pre></div>${outputs ? `<div class="output">${outputs}</div>` : '<div style="height:1rem"></div>'}`;
  }).join("");
}

function frameDocument(body, baseUrl = "") {
  // The frame's sandbox already blocks scripts; this also blocks outside requests other than images.
  return `<!doctype html><html><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'">
    <base href="${escapeHtml(baseUrl)}" target="_blank"><style>${FRAME_STYLES}</style></head>
    <body><main>${body}</main></body></html>`;
}

document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("project-list");
  if (!list) return;

  const viewer = document.getElementById("project-viewer");
  const frame = document.getElementById("project-viewer-frame");
  const title = document.getElementById("project-viewer-title");
  const excerpt = document.getElementById("project-viewer-excerpt");
  const githubLink = document.getElementById("project-viewer-link");
  const topicSelect = document.getElementById("project-topic");
  const searchInput = document.getElementById("project-search");
  const emptyMessage = document.getElementById("project-empty");
  const items = [...list.querySelectorAll("li")];

  const renderedPages = new Map();
  let requestId = 0;
  let isViewerStarted = false;
  let selectedRow = null;

  async function loadNotebook(url) {
    if (renderedPages.has(url)) return renderedPages.get(url);

    const match = url.match(NOTEBOOK_URL);
    if (!match) throw new Error("Not a notebook link");
    const [, owner, repo, branch, path] = match;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

    const [response, { marked }] = await Promise.all([fetch(rawUrl), import("marked")]);
    if (!response.ok) throw new Error(`GitHub responded with ${response.status}`);

    const baseUrl = rawUrl.slice(0, rawUrl.lastIndexOf("/") + 1);
    const page = frameDocument(renderNotebook(await response.json(), marked), baseUrl);
    renderedPages.set(url, page);
    return page;
  }

  async function showProject(row) {
    selectedRow?.removeAttribute("aria-current");
    row.setAttribute("aria-current", "true");
    selectedRow = row;

    title.textContent = row.querySelector("strong").textContent;
    excerpt.textContent = row.querySelector("p").textContent;
    githubLink.href = row.href;
    if (!isViewerStarted) return;

    const currentRequest = ++requestId;
    frame.srcdoc = frameDocument('<p class="message">Loading the notebook…</p>');

    try {
      const page = await loadNotebook(row.href);
      if (currentRequest === requestId) frame.srcdoc = page;
    } catch (error) {
      console.error("Project notebook preview failed.", error);
      if (currentRequest === requestId) {
        frame.srcdoc = frameDocument('<p class="message">This preview is not available right now. Use “Open on GitHub” to see the project.</p>');
      }
    }
  }

  // Accents are ignored so that "pokemon" also finds "Pokémon".
  const searchable = (text) => text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function applyFilters() {
    const type = topicSelect.value;
    const words = searchable(searchInput.value).split(/\s+/).filter(Boolean);

    items.forEach((item) => {
      const text = searchable(item.textContent);
      item.hidden = (type !== "All" && item.dataset.type !== type) || !words.every((word) => text.includes(word));
    });

    const visibleItems = items.filter((item) => !item.hidden);
    list.scrollTop = 0;
    emptyMessage.hidden = visibleItems.length > 0;

    // Keep the open notebook while it still matches, to avoid reloading on each keystroke.
    const isSelectionVisible = selectedRow && !selectedRow.closest("li").hidden;
    if (visibleItems.length && !isSelectionVisible) showProject(visibleItems[0].querySelector(".project-row"));
  }

  topicSelect.addEventListener("change", applyFilters);
  searchInput.addEventListener("input", applyFilters);

  list.addEventListener("click", (event) => {
    const row = event.target.closest(".project-row");
    // Keep the browser's own behaviour for opening a link in a new tab.
    if (!row || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    showProject(row);
    if (window.matchMedia("(max-width: 900px)").matches) viewer.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  applyFilters();

  // Notebooks can be several megabytes, so wait until the browser is on screen.
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    isViewerStarted = true;
    showProject(selectedRow);
  }, { rootMargin: "200px" });
  observer.observe(viewer);
});
