import { answerQuestion, buildIndex } from "./assistant-engine.js";
import { searchPages } from "./assistant-pages.js";
import { searchAssistant } from "./assistant-search.js";

const NOT_FOUND_MESSAGE = "I couldn't find that in AIML's published information. Try asking about events, projects, the team, partners, or how to get involved.";

const STARTER_QUESTIONS = ["What's the next event?", "Who is on the team?", "How do I join?", "What can you do?"];

let knowledgeIndex;

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

  if (!panel || !toggle || !close || !form || !input || !send || !messages) return;

  let processingQuestion = "";
  let conversationContext = null;

  function setOpen(open, restoreToggleFocus = false) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close AIML Assistant" : "Open AIML Assistant");
    root.classList.toggle("is-open", open);

    if (open) {
      input.focus();
      scrollConversation(messages);
    } else if (restoreToggleFocus) {
      toggle.focus();
    }
  }

  function setBusy(busy) {
    form.setAttribute("aria-busy", String(busy));
    messages.setAttribute("aria-busy", String(busy));
    input.readOnly = busy;
    send.disabled = busy;
  }

  toggle.addEventListener("click", () => setOpen(panel.hidden, !panel.hidden));
  close.addEventListener("click", () => setOpen(false, true));

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      setOpen(false, true);
    }
  });

  async function getReply(question) {
    try {
      const { answer, context } = answerQuestion(question, await loadKnowledgeIndex(), conversationContext);
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
    return { result: await searchAssistant(question) };
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
      if (answer) appendComputedAnswer(messages, answer, ask);
      else if (result?.status === "found") appendAssistantMessage(messages, result);
      else appendComputedAnswer(messages, { text: NOT_FOUND_MESSAGE, suggestions: STARTER_QUESTIONS }, ask);
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
  });

  root.querySelectorAll("[data-assistant-suggestion]").forEach((button) => {
    button.addEventListener("click", () => ask(button.textContent));
  });
}

export function initializeWebsiteAssistants() {
  document.querySelectorAll("[data-assistant-root]").forEach(initializeAssistant);
}
