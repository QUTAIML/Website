import { answerQuestion, buildIndex } from "./assistant-engine.js";
import { searchPages } from "./assistant-pages.js";
import { searchAssistant } from "./assistant-search.js";

const NOT_FOUND_MESSAGE = "I couldn't find that in AIML's published information. Try asking about events, projects, the team, partners, or how to get involved.";

const STARTER_QUESTIONS = ["What's the next event?", "Who is on the team?", "How do I join?", "What can you do?"];

// The chat is kept in session storage so it follows the person between pages.
// It never leaves their browser and is dropped when they arrive from elsewhere.
const STORAGE_KEY = "aiml-assistant-chat";
const MAX_SAVED_TURNS = 40;
const OPEN_ON_NEW_PAGE_MIN_WIDTH = 700;

let knowledgeIndex;

function readSavedChat() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return { turns: Array.isArray(saved?.turns) ? saved.turns : [], isOpen: Boolean(saved?.isOpen) };
  } catch {
    return { turns: [], isOpen: false };
  }
}

function writeSavedChat(chat) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...chat, turns: chat.turns.slice(-MAX_SAVED_TURNS) }));
  } catch {
    // Without storage the chat still works, it just won't follow them to the next page.
  }
}

function clearSavedChat() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was saved in the first place.
  }
}

// Moving between this site's pages or reloading keeps the chat. Anything else is a new visit.
function isNewVisit() {
  const navigation = performance.getEntriesByType("navigation")[0];
  if (navigation && navigation.type !== "navigate") return false;
  try {
    return new URL(document.referrer).origin !== window.location.origin;
  } catch {
    return true;
  }
}

const savableSection = ({ text, parts, items, more, sources, suggestions }) => ({ text, parts, items, more, sources, suggestions });

function savableAnswer(answer) {
  return { ...savableSection(answer), sections: answer.sections?.map(savableSection) };
}

// Page search can return a whole section with its words run together.
function isReadableEvidence(value) {
  const text = cleanDisplayText(value);
  const gluedWords = text.match(/[a-z][A-Z]|\d[A-Z]/g)?.length ?? 0;
  return text.length > 0 && text.length <= 700 && gluedWords <= 2;
}

// The knowledge file is only fetched once someone asks a question.
function loadKnowledgeIndex() {
  knowledgeIndex ??= fetch(new URL("assistant-knowledge.json", new URL(import.meta.env.BASE_URL, window.location.origin)))
    .then((response) => {
      if (!response.ok) throw new Error(`Knowledge file responded with ${response.status}`);
      return response.json();
    })
    .then(buildIndex);
  return knowledgeIndex;
}

function cleanDisplayText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function lastCompleteSentenceEnd(value) {
  let lastEnd = 0;

  for (const match of value.matchAll(/[.!?](?:["'’”\)\]]+)?(?=\s|$)/gu)) {
    lastEnd = match.index + match[0].length;
  }

  return lastEnd;
}

export function cleanEvidenceForDisplay(value) {
  let evidence = cleanDisplayText(value);

  // Zero-padded numbers at the very start are section counters, not answer
  // content. Requiring an uppercase heading immediately after the counter
  // avoids touching ordinary dates, quantities, and numbers elsewhere.
  evidence = evidence.replace(/^0[1-9]\s+(?=\p{Lu})/u, "");

  // Pagefind can append the next section's short numbered label to an otherwise
  // complete excerpt. Remove only an all-caps, numbered trailing label.
  const sectionLabel = evidence.match(/(?:^|\s)[A-Z][A-Z0-9&/ -]{2,}\s\d{1,3}\.$/u);
  if (sectionLabel) {
    const precedingEvidence = evidence.slice(0, sectionLabel.index).trim();
    if (lastCompleteSentenceEnd(precedingEvidence) === precedingEvidence.length) {
      evidence = precedingEvidence;
    }
  }

  const withoutTrailingEllipsis = evidence.replace(/\s*(?:…|\.\.\.)\s*$/u, "").trim();
  const completeEnd = lastCompleteSentenceEnd(withoutTrailingEllipsis);

  // If Pagefind stopped midway through a final sentence, keep every complete
  // sentence before it. Retain the original only when no complete sentence is
  // available, so a valid short result is not turned into an empty response.
  if (completeEnd > 0 && completeEnd < withoutTrailingEllipsis.length) {
    return withoutTrailingEllipsis.slice(0, completeEnd).trim();
  }

  return withoutTrailingEllipsis;
}

function comparableText(value) {
  return cleanDisplayText(value)
    .toLocaleLowerCase("en-AU")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function evidenceIncludesOpeningLabel(evidence, label) {
  const comparableEvidence = comparableText(evidence);
  const comparableLabel = comparableText(label);
  const labelWords = comparableLabel.split(" ");
  const openingWords = comparableEvidence
    .split(" ")
    .slice(0, labelWords.length + 8)
    .join(" ");

  return Boolean(
    comparableLabel &&
    (` ${openingWords} `).includes(` ${comparableLabel} `)
  );
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function scrollConversation(messages) {
  requestAnimationFrame(() => {
    messages.scrollTop = messages.scrollHeight;
  });
}

function appendUserMessage(messages, question) {
  const message = createElement("article", "assistant-message assistant-message--user");
  message.append(createElement("div", "assistant-message-label", "You"));

  const bubble = createElement("div", "assistant-bubble");
  bubble.append(createElement("p", "", question));
  message.append(bubble);
  messages.append(message);
  scrollConversation(messages);
}

function appendLoadingMessage(messages) {
  const message = createElement(
    "article",
    "assistant-message assistant-message--assistant assistant-message--loading"
  );
  message.setAttribute("role", "status");
  message.append(createElement("div", "assistant-message-label", "AIML Assistant"));

  const bubble = createElement("div", "assistant-bubble");
  bubble.append(createElement("p", "", "Working on it…"));
  message.append(bubble);
  messages.append(message);
  scrollConversation(messages);
  return message;
}

function sourceLabel(result) {
  // Pagefind section headings can lose spaces at inline-element boundaries.
  // Its page-level title is clean on this site, so prefer it and fall back to a
  // neutral label rather than exposing a malformed section heading.
  return cleanDisplayText(result.pageTitle) || "AIML website";
}

function safeSourceUrl(value) {
  const url = cleanDisplayText(value);
  return /^(?:javascript|data):/i.test(url) ? "" : url;
}

function appendAssistantMessage(messages, result) {
  const message = createElement("article", "assistant-message assistant-message--assistant");
  message.append(createElement("div", "assistant-message-label", "AIML Assistant"));

  const bubble = createElement("div", "assistant-bubble");
  const evidence = result.status === "found"
    ? cleanEvidenceForDisplay(result.evidence?.text || result.excerpt)
    : "";

  if (result.status !== "found" || !evidence) {
    bubble.append(createElement("p", "", NOT_FOUND_MESSAGE));
  } else {
    bubble.append(createElement("p", "", evidence));

    const sourceUrl = safeSourceUrl(result.url);
    if (sourceUrl) {
      const source = createElement("div", "assistant-source");
      const label = sourceLabel(result);
      if (!evidenceIncludesOpeningLabel(evidence, label)) {
        source.append(createElement("span", "assistant-source-title", label));
      }

      const link = createElement("a", "assistant-source-link", "View source");
      // Use the Pagefind URL unchanged so any section anchor is retained.
      link.setAttribute("href", sourceUrl);
      source.append(link);
      bubble.append(source);
    }
  }

  message.append(bubble);
  messages.append(message);
  scrollConversation(messages);
}

function appendLink(parent, url, text, className) {
  const safeUrl = safeSourceUrl(url);
  if (!/^(?:https:\/\/|\/)/.test(safeUrl)) {
    parent.append(createElement("span", className, text));
    return;
  }
  const link = createElement("a", className, text);
  link.setAttribute("href", safeUrl);
  if (safeUrl.startsWith("https://")) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  parent.append(link);
}

function appendAnswerSection(bubble, answer) {
  if (answer.text) bubble.append(createElement("p", "", answer.text));
  (answer.parts ?? []).forEach((part) => bubble.append(createElement("p", "", part)));

  if (answer.items?.length) {
    const list = createElement("ul", "assistant-list");
    answer.items.forEach((item) => {
      const row = createElement("li");
      if (item.url) appendLink(row, item.url, item.label, "assistant-list-label");
      else row.append(createElement("span", "assistant-list-label", item.label));
      if (item.detail) row.append(createElement("span", "assistant-list-detail", item.detail));
      list.append(row);
    });
    bubble.append(list);
  }
  if (answer.more) bubble.append(createElement("p", "assistant-more", `and ${answer.more} more. Ask “show more” to see them.`));
}

function appendComputedAnswer(messages, answer, ask) {
  const message = createElement("article", "assistant-message assistant-message--assistant");
  message.append(createElement("div", "assistant-message-label", "AIML Assistant"));

  const bubble = createElement("div", "assistant-bubble");
  (answer.sections ?? [answer]).forEach((section) => appendAnswerSection(bubble, section));

  if (answer.sources?.length) {
    const sources = createElement("div", "assistant-source");
    answer.sources.forEach((source) => appendLink(sources, source.url, source.label, "assistant-source-link"));
    bubble.append(sources);
  }
  message.append(bubble);

  if (answer.suggestions?.length) message.append(createSuggestions(answer.suggestions, ask));
  messages.append(message);
  scrollConversation(messages);
}

function createSuggestions(questions, ask) {
  const row = createElement("div", "assistant-suggestions");
  questions.forEach((question) => {
    const button = createElement("button", "assistant-suggestion", question);
    button.type = "button";
    button.addEventListener("click", () => ask(question));
    row.append(button);
  });
  return row;
}

function initializeAssistant(root) {
  if (root.dataset.assistantInitialized === "true") return;
  root.dataset.assistantInitialized = "true";

  const panel = root.querySelector("[data-assistant-panel]");
  const toggle = root.querySelector("[data-assistant-toggle]");
  const close = root.querySelector("[data-assistant-close]");
  const form = root.querySelector("[data-assistant-form]");
  const input = root.querySelector("[data-assistant-input]");
  const send = root.querySelector("[data-assistant-send]");
  const messages = root.querySelector("[data-assistant-messages]");
  const clear = root.querySelector("[data-assistant-clear]");

  if (!panel || !toggle || !close || !form || !input || !send || !messages) return;

  let processingQuestion = "";
  let conversationContext = null;
  let isContextRestored = false;

  if (isNewVisit()) clearSavedChat();

  function renderTurn(turn) {
    appendUserMessage(messages, turn.question);
    renderReply(turn);
  }

  function renderReply(turn) {
    if (turn.answer) appendComputedAnswer(messages, turn.answer, ask);
    else if (turn.result?.status === "found") appendAssistantMessage(messages, turn.result);
    else appendComputedAnswer(messages, { text: NOT_FOUND_MESSAGE, suggestions: STARTER_QUESTIONS }, ask);
  }

  function clearConversation() {
    messages.querySelectorAll(".assistant-message:not(:first-child)").forEach((message) => message.remove());
    conversationContext = null;
    isContextRestored = false;
  }

  function renderSavedChat() {
    clearConversation();
    const { turns } = readSavedChat();
    turns.forEach(renderTurn);
    if (clear) clear.hidden = turns.length === 0;
  }

  // Asking the saved questions again rebuilds what the engine remembered.
  function restoreContext(index) {
    if (isContextRestored) return;
    isContextRestored = true;
    readSavedChat().turns.forEach((turn) => {
      conversationContext = answerQuestion(turn.question, index, conversationContext).context;
    });
  }

  // The panel grows out of the button when it opens and folds back into it when it
  // closes (see "Open and close" in assistant.css). data-assistant-state tracks
  // opening → open → closing → closed so the CSS can stage each part.
  let transitionToken = 0;
  const isOpen = () => !panel.hidden && root.dataset.assistantState !== "closing";
  const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function afterPanelAnimation(token, done) {
    let isDone = false;
    const finish = (event) => {
      if (event && event.target !== panel) return;
      panel.removeEventListener("animationend", finish);
      if (isDone || token !== transitionToken) return;
      isDone = true;
      done();
    };
    panel.addEventListener("animationend", finish);
    // A backstop in case the animation is skipped or interrupted.
    window.setTimeout(finish, 900);
  }

  // The site header is fixed above everything, so the panel is sized to fit
  // between the bottom of the header and the Ask AIML button (see assistant.css).
  function measureHeaderClearance() {
    const header = document.querySelector(".navbar");
    const bottom = header ? header.getBoundingClientRect().bottom : 0;
    root.style.setProperty("--assistant-header-clearance", `${Math.max(0, Math.round(bottom))}px`);
  }

  measureHeaderClearance();
  window.addEventListener("resize", () => { if (!panel.hidden) measureHeaderClearance(); }, { passive: true });

  function setOpen(open, restoreToggleFocus = false, moveFocus = true, animate = true) {
    const token = ++transitionToken;
    const shouldAnimate = animate && !prefersReducedMotion();
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close AIML Assistant" : "Open AIML Assistant");
    root.classList.toggle("is-open", open);
    writeSavedChat({ ...readSavedChat(), isOpen: open });

    if (open) {
      measureHeaderClearance();
      // The panel starts as a pill the size of the button, so it needs the button's width.
      root.style.setProperty("--assistant-toggle-width", `${toggle.offsetWidth}px`);
      root.style.setProperty("--assistant-toggle-height", `${toggle.offsetHeight}px`);
      panel.hidden = false;
      root.dataset.assistantState = shouldAnimate ? "opening" : "open";
      if (shouldAnimate) afterPanelAnimation(token, () => { root.dataset.assistantState = "open"; });
      if (moveFocus) input.focus({ preventScroll: true });
      scrollConversation(messages);
      return;
    }

    const finishClosing = () => {
      panel.hidden = true;
      root.dataset.assistantState = "closed";
    };
    if (shouldAnimate && !panel.hidden) {
      root.dataset.assistantState = "closing";
      afterPanelAnimation(token, finishClosing);
    } else {
      finishClosing();
    }
    if (restoreToggleFocus) toggle.focus();
  }

  function setBusy(busy) {
    form.setAttribute("aria-busy", String(busy));
    messages.setAttribute("aria-busy", String(busy));
    input.readOnly = busy;
    send.disabled = busy;
  }

  toggle.addEventListener("click", () => setOpen(!isOpen(), isOpen()));
  close.addEventListener("click", () => setOpen(false, true));

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      event.preventDefault();
      setOpen(false, true);
    }
  });

  async function getReply(question) {
    try {
      const index = await loadKnowledgeIndex();
      restoreContext(index);
      const { answer, context } = answerQuestion(question, index, conversationContext);
      conversationContext = context;
      if (answer) return { answer };
    } catch (error) {
      console.error("AIML Assistant could not compute an answer.", error);
    }
    // Anything the data can't answer falls back to searching the site's text.
    try {
      const passage = await searchPages(question);
      if (passage) return { answer: passage };
    } catch (error) {
      console.error("AIML Assistant could not search the site's pages.", error);
    }
    const result = await searchAssistant(question);
    return { result: isReadableEvidence(result.evidence?.text || result.excerpt) ? result : { status: "not_found" } };
  }

  async function ask(rawQuestion) {
    const question = cleanDisplayText(rawQuestion);
    const duplicateKey = question.toLocaleLowerCase("en-AU");
    if (!question || duplicateKey === processingQuestion) return;

    processingQuestion = duplicateKey;
    input.value = "";
    appendUserMessage(messages, question);
    const loadingMessage = appendLoadingMessage(messages);
    setBusy(true);

    try {
      const { answer, result } = await getReply(question);
      loadingMessage.remove();

      if (answer?.clearsMemory) {
        clearSavedChat();
        clearConversation();
        if (clear) clear.hidden = true;
        appendComputedAnswer(messages, answer, ask);
      } else {
        const turn = { question, answer: answer ? savableAnswer(answer) : undefined, result: answer ? undefined : result };
        renderReply(turn);
        const saved = readSavedChat();
        writeSavedChat({ ...saved, isOpen: !panel.hidden, turns: [...saved.turns, turn] });
        if (clear) clear.hidden = false;
      }
    } catch (error) {
      loadingMessage.remove();
      appendAssistantMessage(messages, { status: "error" });
      console.error("AIML Assistant search failed.", error);
    } finally {
      processingQuestion = "";
      setBusy(false);
      if (!panel.hidden) input.focus();
    }
  }

  clear?.addEventListener("click", () => {
    clearSavedChat();
    clearConversation();
    clear.hidden = true;
    input.focus();
  });

  // Pages restored by the back button may be behind the chat on the page they came from.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) renderSavedChat();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
  });

  root.querySelectorAll("[data-assistant-suggestion]").forEach((button) => {
    button.addEventListener("click", () => ask(button.textContent));
  });

  renderSavedChat();
  if (readSavedChat().isOpen && window.innerWidth >= OPEN_ON_NEW_PAGE_MIN_WIDTH) setOpen(true, false, false, false);
}

export function initializeWebsiteAssistants() {
  document.querySelectorAll("[data-assistant-root]").forEach(initializeAssistant);
}
