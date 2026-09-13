import { searchAssistant } from "./assistant-search.js";

const NOT_FOUND_MESSAGE = "I couldn't find that information on the AIML website.";

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
  bubble.append(createElement("p", "", "Searching the AIML website…"));
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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = cleanDisplayText(input.value);
    const duplicateKey = question.toLocaleLowerCase("en-AU");
    if (!question || duplicateKey === processingQuestion) return;

    processingQuestion = duplicateKey;
    input.value = "";
    appendUserMessage(messages, question);
    const loadingMessage = appendLoadingMessage(messages);
    setBusy(true);

    try {
      const result = await searchAssistant(question);
      loadingMessage.remove();
      appendAssistantMessage(messages, result);
    } catch (error) {
      loadingMessage.remove();
      appendAssistantMessage(messages, { status: "error" });
      console.error("AIML Assistant search failed.", error);
    } finally {
      processingQuestion = "";
      setBusy(false);
      if (!panel.hidden) input.focus();
    }
  });
}

export function initializeWebsiteAssistants() {
  document.querySelectorAll("[data-assistant-root]").forEach(initializeAssistant);
}
