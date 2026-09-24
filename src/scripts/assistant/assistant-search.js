const TOKEN_PATTERN = /[\p{L}\p{N}]+(?:[+#.'-][\p{L}\p{N}+#.'-]+)*/gu;
const MAX_RESULTS_TO_EVALUATE = 8;
const LOCAL_SEARCH_PATHS = [
  "/", "/about/", "/about/faq/", "/about/community/", "/about/exec-application/",
  "/about/history/", "/events/", "/projects/", "/hackathon/", "/partners/", "/contact/",
];

// A compact set of grammatical and conversational terms. Domain words, names,
// dates, numbers, and technical tokens such as C++, C#, and node.js are kept.
const STOP_WORDS = new Set([
  "a", "about", "am", "an", "and", "any", "are", "at", "be", "been", "being",
  "can", "could", "did", "do", "does", "for", "from", "give", "had", "has",
  "have", "how", "i", "if", "in", "information", "is", "it", "its", "kind",
  "kinds", "may", "me", "might", "mine", "must", "my", "of", "on", "or",
  "our", "please", "run", "running", "runs", "should", "show", "site", "tell",
  "that", "the", "there", "these", "this", "those", "to", "us", "worked",
  "want", "was", "we", "website", "were", "what", "when", "where", "which",
  "who", "whom", "whose", "why", "would", "you", "your",
]);

const DOMAIN_TERMS = new Set(["aiml", "qut", "society", "club"]);

function normalizedTermStem(value) {
  return String(value).replace(/s$/u, "");
}

function isOneCharacterExtension(left, right) {
  return (
    Math.abs(left.length - right.length) <= 1 &&
    (left.startsWith(right) || right.startsWith(left))
  );
}

// Questions are often typed quickly on mobile. Treat a singular/plural form or
// one extra/missing final character as the same domain term (for example,
// "eventd" and "event"). This is intentionally conservative: it does not try
// to guess arbitrary spelling corrections.
const hasAny = (terms, candidates) => candidates.some((candidate) =>
  [...terms].some((term) => {
    const normalizedTerm = normalizedTermStem(term);
    const normalizedCandidate = normalizedTermStem(candidate);
    return (
      normalizedTerm === normalizedCandidate ||
      isOneCharacterExtension(normalizedTerm, normalizedCandidate)
    );
  })
);

function createCategoryAlias(id, terms, retrievalTerm, preferredPath) {
  return {
    id,
    matches({ allTerms }) {
      return hasAny(allTerms, terms);
    },
    retrievalTerms: [retrievalTerm],
    concepts: [{ name: id, terms }],
    consumedTerms: new Set([...terms, ...DOMAIN_TERMS]),
    category: { terms, preferredPath },
  };
}

const CATEGORY_INTENT_ALIASES = [
  createCategoryAlias(
    "hackathons",
    ["hackathon", "hackathons"],
    "hackathon",
    "/hackathon/"
  ),
  createCategoryAlias("projects", ["project", "projects"], "projects", "/projects/"),
  createCategoryAlias("events", ["event", "events"], "events", "/events/"),
];

// These aliases solve wording gaps in the index without becoming a parallel
// knowledge base. Each alias describes a retrieval query and the concepts that
// must still be present together in the returned evidence.
const INTENT_ALIASES = [
  {
    id: "executive_application",
    matches({ allTerms }) {
      return (
        hasAny(allTerms, ["executive", "executives", "committee"]) &&
        hasAny(allTerms, [
          "application", "applications", "apply", "applying", "become",
          "join", "nominate", "nomination", "role", "roles",
        ])
      );
    },
    retrievalTerms: ["executive", "applications", "nominate", "roles"],
    concepts: [
      { name: "executive", terms: ["executive", "executives"] },
      {
        name: "application",
        terms: [
          "application", "applications", "apply", "applying", "nominate",
          "nomination", "position", "positions", "role", "roles",
        ],
      },
    ],
    consumedTerms: new Set([
      "executive", "executives", "committee", "application", "applications",
      "apply", "applying", "become", "join", "nominate", "nomination", "role",
      "roles", "position", "positions", "aiml", "qut", "society", "club",
    ]),
  },
  {
    id: "membership",
    matches({ allTerms }) {
      const explicitlyAboutMembership = allTerms.has("membership");
      const hasJoinAction = hasAny(allTerms, ["become", "join", "joining"]);
      const hasMembershipSubject = hasAny(allTerms, [
        "aiml", "club", "member", "members", "qut", "society",
      ]);

      return explicitlyAboutMembership || (hasJoinAction && hasMembershipSubject);
    },
    retrievalTerms: ["membership", "join", "member"],
    concepts: [
      {
        name: "membership",
        terms: ["join", "joining", "member", "members", "membership"],
      },
    ],
    consumedTerms: new Set([
      "join", "joining", "member", "members", "membership", "become", "aiml",
      "qut", "society", "club",
    ]),
  },
  ...CATEGORY_INTENT_ALIASES,
  {
    id: "aiml_overview",
    matches({ allTerms, meaningfulTerms }) {
      const refersToAIML = hasAny(allTerms, ["aiml", "qut", "society", "club"]);
      const asksForOverview = hasAny(allTerms, [
        "activity", "activities", "do", "does", "offer", "offers", "purpose",
      ]);
      const specificTerms = meaningfulTerms.filter((term) => !DOMAIN_TERMS.has(term));

      return refersToAIML && (asksForOverview || specificTerms.length === 0);
    },
    retrievalTerms: [
      "artificial", "intelligence", "machine", "learning", "society", "workshops",
      "projects", "events",
    ],
    concepts: [
      { name: "AIML", terms: ["aiml", "society", "club"] },
      {
        name: "activities",
        terms: [
          "activity", "activities", "build", "building", "community", "event",
          "events", "learn", "learning", "project", "projects", "talk", "talks",
          "workshop", "workshops",
        ],
      },
    ],
    consumedTerms: new Set([
      "activity", "activities", "aiml", "club", "do", "does", "offer", "offers",
      "purpose", "qut", "society",
    ]),
  },
];

const pagefindModules = new Map();

function unique(values) {
  return [...new Set(values)];
}

function cleanDisplayText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Normalizes conversational punctuation and spacing while retaining technical
 * punctuation inside tokens, names, acronyms, dates, and numbers.
 */
export function normalizeAssistantQuestion(value) {
  return String(value ?? "")
    .slice(0, 500)
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/&/g, " and ")
    .replace(/\b(what|who|where|when|why|how)'s\b/gi, "$1 is")
    .replace(/\bi'm\b/gi, "i am")
    .toLocaleLowerCase("en-AU")
    .replace(/[^\p{L}\p{N}+#./' -]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeAssistantQuestion(value).match(TOKEN_PATTERN) ?? [];
}

/** Returns the non-grammatical terms used to build a generic Pagefind query. */
export function extractMeaningfulTerms(value) {
  return unique(tokenize(value).filter((term) => !STOP_WORDS.has(term)));
}

function lexicalForms(value) {
  const forms = new Set([value]);
  const possessiveFree = value.replace(/'s$/, "");
  forms.add(possessiveFree);

  if (/^[\p{L}]+$/u.test(possessiveFree) && possessiveFree.length > 4) {
    if (possessiveFree.endsWith("ies")) {
      forms.add(`${possessiveFree.slice(0, -3)}y`);
    } else if (possessiveFree.endsWith("es")) {
      forms.add(possessiveFree.slice(0, -2));
    } else if (possessiveFree.endsWith("s") && !possessiveFree.endsWith("ss")) {
      forms.add(possessiveFree.slice(0, -1));
    }

    if (possessiveFree.endsWith("ing") && possessiveFree.length > 6) {
      const root = possessiveFree.slice(0, -3);
      forms.add(root);
      if (root.at(-1) === root.at(-2)) forms.add(root.slice(0, -1));
    }

    if (possessiveFree.endsWith("ed") && possessiveFree.length > 5) {
      forms.add(possessiveFree.slice(0, -2));
    }
  }

  return forms;
}

function termsOverlap(left, right) {
  const leftForms = lexicalForms(left);
  const rightForms = lexicalForms(right);
  return [...leftForms].some((form) => rightForms.has(form));
}

function buildSearchPlan(question) {
  const normalizedQuestion = normalizeAssistantQuestion(question);
  const allTokens = tokenize(normalizedQuestion);
  const allTerms = new Set(allTokens);
  const meaningfulTerms = extractMeaningfulTerms(normalizedQuestion);
  const alias = INTENT_ALIASES.find((candidate) =>
    candidate.matches({ allTerms, meaningfulTerms, normalizedQuestion })
  );

  if (!alias) {
    return {
      normalizedQuestion,
      meaningfulTerms,
      intent: null,
      query: meaningfulTerms.join(" "),
      concepts: meaningfulTerms.map((term) => ({ name: term, terms: [term] })),
      aliasConceptCount: 0,
      category: null,
    };
  }

  // Preserve specific names, dates, event terms, and technical terms supplied
  // alongside an alias. Only the alias's conversational trigger terms vanish.
  const specificTerms = meaningfulTerms.filter(
    (term) => !alias.consumedTerms.has(term) && !DOMAIN_TERMS.has(term)
  );
  const concepts = [
    ...alias.concepts,
    ...specificTerms.map((term) => ({ name: term, terms: [term] })),
  ];

  return {
    normalizedQuestion,
    meaningfulTerms,
    intent: alias.id,
    query: unique([...alias.retrievalTerms, ...specificTerms]).join(" "),
    concepts,
    aliasConceptCount: alias.concepts.length,
    category: alias.category ?? null,
  };
}

function findConceptPositions(tokens, concept) {
  const positions = [];

  tokens.forEach((token, index) => {
    if (concept.terms.some((term) => termsOverlap(token, term))) positions.push(index);
  });

  return positions;
}

function shortestConceptWindow(positionGroups) {
  const matchedGroups = positionGroups
    .map((positions, conceptIndex) => ({ positions, conceptIndex }))
    .filter(({ positions }) => positions.length > 0);

  if (matchedGroups.length === 0) return null;
  if (matchedGroups.length === 1) return 1;

  const occurrences = matchedGroups
    .flatMap(({ positions, conceptIndex }) =>
      positions.map((position) => ({ position, conceptIndex }))
    )
    .sort((left, right) => left.position - right.position);
  const requiredGroups = matchedGroups.length;
  const counts = new Map();
  let coveredGroups = 0;
  let left = 0;
  let shortest = Number.POSITIVE_INFINITY;

  for (let right = 0; right < occurrences.length; right += 1) {
    const rightGroup = occurrences[right].conceptIndex;
    const rightCount = counts.get(rightGroup) ?? 0;
    counts.set(rightGroup, rightCount + 1);
    if (rightCount === 0) coveredGroups += 1;

    while (coveredGroups === requiredGroups) {
      shortest = Math.min(
        shortest,
        occurrences[right].position - occurrences[left].position + 1
      );
      const leftGroup = occurrences[left].conceptIndex;
      const leftCount = counts.get(leftGroup);
      counts.set(leftGroup, leftCount - 1);
      if (leftCount === 1) coveredGroups -= 1;
      left += 1;
    }
  }

  return Number.isFinite(shortest) ? shortest : null;
}

function categoryPathMatches(url, preferredPath) {
  try {
    const pathname = new URL(url, "https://aiml.invalid").pathname;
    const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
    return normalizedPath === preferredPath || normalizedPath.endsWith(preferredPath);
  } catch {
    return false;
  }
}

function urlHasFragment(url) {
  try {
    return Boolean(new URL(url, "https://aiml.invalid").hash);
  } catch {
    return false;
  }
}

function focusedExcerptVariants(excerpt) {
  const variants = [{ excerpt, focused: false }];

  // Pagefind excerpts can begin with the tail of the preceding section. When
  // that tail visibly starts mid-sentence, also evaluate the text after its
  // first sentence boundary. The shorter variant must still pass every normal
  // evidence check before it can be selected.
  if (!/^\p{Ll}/u.test(excerpt)) return variants;

  const firstBoundary = excerpt.match(/[.!?](?:["'’”\)\]]+)?\s+/u);
  if (!firstBoundary) return variants;

  const focused = excerpt
    .slice(firstBoundary.index + firstBoundary[0].length)
    .trim();

  if (focused.length < 20) return variants;
  return [{ excerpt: focused, focused: true }, ...variants];
}

function evaluateEvidence(candidate, plan) {
  const titleTokens = tokenize(candidate.title);
  const pageTitleTokens = tokenize(candidate.pageTitle);
  const excerptTokens = tokenize(candidate.excerpt);
  const evidenceTokens = [...titleTokens, ...excerptTokens];
  const urlTokens = tokenize(
    decodeURIComponent(candidate.url).replace(/[\/#?&=._-]+/g, " ")
  );
  const evidencePositions = plan.concepts.map((concept) =>
    findConceptPositions(evidenceTokens, concept)
  );
  const titlePositions = plan.concepts.map((concept) =>
    findConceptPositions(titleTokens, concept)
  );
  const urlPositions = plan.concepts.map((concept) =>
    findConceptPositions(urlTokens, concept)
  );
  const matchedIndexes = evidencePositions
    .map((positions, index) => (positions.length > 0 ? index : -1))
    .filter((index) => index >= 0);
  const matchedConceptCount = matchedIndexes.length;
  const conceptCount = plan.concepts.length;
  const coverage = conceptCount > 0 ? matchedConceptCount / conceptCount : 0;
  const proximity = shortestConceptWindow(evidencePositions);
  const titleMatchCount = titlePositions.filter((positions) => positions.length > 0).length;
  const urlMatchCount = urlPositions.filter((positions) => positions.length > 0).length;
  const occurrenceCount = evidencePositions.reduce(
    (total, positions) => total + positions.length,
    0
  );
  const categoryRouteMatch = Boolean(
    plan.category && categoryPathMatches(candidate.url, plan.category.preferredPath)
  );
  const categoryHeadingMatch = Boolean(
    plan.category &&
    [...titleTokens, ...pageTitleTokens].some((token) =>
      plan.category.terms.some((term) => termsOverlap(token, term))
    )
  );
  const categoryCorroborated = categoryRouteMatch || categoryHeadingMatch;
  const genericCategoryPageOverview = Boolean(
    plan.category &&
    plan.concepts.length === plan.aliasConceptCount &&
    categoryRouteMatch &&
    !urlHasFragment(candidate.url)
  );

  let accepted = false;

  if (plan.intent) {
    const requiredAliasConceptsPresent = Array.from(
      { length: plan.aliasConceptCount },
      (_, index) => evidencePositions[index].length > 0
    ).every(Boolean);
    const specificConceptsPresent = evidencePositions
      .slice(plan.aliasConceptCount)
      .every((positions) => positions.length > 0);

    const aliasEvidenceAccepted =
      requiredAliasConceptsPresent &&
      specificConceptsPresent &&
      (matchedConceptCount <= 1 || (proximity !== null && proximity <= 36));

    // Category wording is not enough on its own: the page path or a heading
    // must independently identify the category before the evidence is valid.
    accepted = aliasEvidenceAccepted && (!plan.category || categoryCorroborated);
  } else if (conceptCount === 1) {
    // A lone term needs corroboration: a heading/path match or repetition in
    // the same excerpt. This keeps a single incidental body mention out.
    const loneTerm = plan.concepts[0].terms[0];
    const sufficientlySpecific =
      loneTerm.length >= 4 || /[\d+#.]/.test(loneTerm);
    accepted =
      matchedConceptCount === 1 &&
      sufficientlySpecific &&
      (
        titleMatchCount > 0 ||
        urlMatchCount > 0 ||
        (loneTerm.length >= 6 && occurrenceCount >= 3)
      );
  } else if (conceptCount <= 3) {
    // Short questions are only supported when every meaningful concept occurs
    // in one section-sized piece of evidence.
    accepted =
      matchedConceptCount === conceptCount &&
      proximity !== null &&
      proximity <= (conceptCount === 2 ? 24 : 30);
  } else {
    // Longer questions may contain one non-essential modifier, but still need
    // at least 75% coverage and tight co-occurrence in the same excerpt.
    const requiredMatches = Math.max(3, Math.ceil(conceptCount * 0.75));
    accepted =
      matchedConceptCount >= requiredMatches &&
      proximity !== null &&
      proximity <= 36;
  }

  // This ranking is deliberately independent of Pagefind's score. Pagefind's
  // score retrieves candidates; coverage, heading matches, and proximity decide
  // whether a candidate is evidence and which accepted section is strongest.
  const evidenceScore =
    coverage * 100 +
    titleMatchCount * 12 +
    Math.min(occurrenceCount, 5) * 2 +
    (proximity === null ? 0 : Math.max(0, 20 - proximity) * 0.5) +
    (categoryRouteMatch ? 30 : 0) +
    (categoryHeadingMatch ? 12 : 0) +
    (genericCategoryPageOverview ? 10 : 0) +
    (candidate.focused ? 4 : 0);

  return {
    ...candidate,
    accepted,
    coverage,
    evidenceScore,
    matchedConcepts: matchedIndexes.map((index) => plan.concepts[index].name),
    proximity,
    titleMatchCount,
    categoryCorroborated,
  };
}

function siteBaseUrl(explicitBasePath) {
  if (typeof window === "undefined") {
    throw new Error("Pagefind requires a browser unless a Pagefind instance is supplied.");
  }

  const configuredBase = explicitBasePath ?? import.meta.env?.BASE_URL ?? "/";
  const baseWithSlash = configuredBase.endsWith("/")
    ? configuredBase
    : `${configuredBase}/`;
  return new URL(baseWithSlash, window.location.origin);
}

async function loadPagefind(explicitBasePath) {
  const baseUrl = siteBaseUrl(explicitBasePath);
  const moduleUrl = new URL("pagefind/pagefind.js", baseUrl).href;

  if (!pagefindModules.has(moduleUrl)) {
    pagefindModules.set(moduleUrl, import(/* @vite-ignore */ moduleUrl));
  }

  return pagefindModules.get(moduleUrl);
}

function notFoundResult(question, plan, reason) {
  return {
    status: "not_found",
    question,
    normalizedQuestion: plan.normalizedQuestion,
    query: plan.query,
    intent: plan.intent,
    meaningfulTerms: plan.meaningfulTerms,
    reason,
  };
}

function resultFromEvidence(question, plan, candidates) {
  const accepted = candidates
    .filter((candidate) => candidate.accepted)
    .sort((left, right) =>
      right.evidenceScore - left.evidenceScore ||
      left.resultIndex - right.resultIndex ||
      left.sectionIndex - right.sectionIndex ||
      left.variantIndex - right.variantIndex
    );

  if (accepted.length === 0) return null;

  const best = accepted[0];
  const alternatives = accepted
    .slice(1)
    .filter((candidate, index, all) =>
      candidate.url !== best.url &&
      all.findIndex((other) => other.url === candidate.url) === index
    )
    .slice(0, 2)
    .map((candidate) => ({
      title: candidate.title,
      url: candidate.url,
      excerpt: candidate.excerpt,
    }));

  return {
    status: "found",
    question,
    normalizedQuestion: plan.normalizedQuestion,
    query: plan.query,
    intent: plan.intent,
    meaningfulTerms: plan.meaningfulTerms,
    title: best.title,
    pageTitle: best.pageTitle,
    url: best.url,
    excerpt: best.excerpt,
    evidence: {
      heading: best.title,
      text: best.excerpt,
      matchedConcepts: best.matchedConcepts,
      coverage: best.coverage,
      proximity: best.proximity,
    },
    retrieval: {
      pagefindScore: best.pagefindScore,
      evidenceScore: best.evidenceScore,
    },
    alternatives,
  };
}

async function searchRenderedSite(question, plan, explicitBasePath) {
  const baseUrl = siteBaseUrl(explicitBasePath);
  const pages = await Promise.all(LOCAL_SEARCH_PATHS.map(async (path, resultIndex) => {
    const url = new URL(path.replace(/^\//, ""), baseUrl);
    const response = await fetch(url);
    if (!response.ok) return [];

    const document = new DOMParser().parseFromString(await response.text(), "text/html");
    const root = document.querySelector("[data-pagefind-body], main") ?? document.body;
    const sections = [...root.querySelectorAll("section, article, header")];
    const candidates = (sections.length ? sections : [root]).map((section, sectionIndex) => ({
      title: cleanDisplayText(section.querySelector("h1, h2, h3")?.textContent ?? document.title),
      pageTitle: cleanDisplayText(document.title),
      url: url.href,
      excerpt: cleanDisplayText(section.textContent),
      focused: false,
      pagefindScore: 0,
      resultIndex,
      sectionIndex,
      variantIndex: 0,
    })).filter((candidate) => candidate.excerpt.length > 0)
      .map((candidate) => evaluateEvidence(candidate, plan));
    return candidates;
  }));

  return resultFromEvidence(question, plan, pages.flat());
}

/**
 * Searches the static Pagefind index and returns grounded section evidence.
 * It never composes an answer or treats Pagefind's score as confidence.
 *
 * `options.pagefind` is an optional official Pagefind API instance used by
 * automated/local tests. Browser callers normally need no options.
 */
export async function searchAssistant(question, options = {}) {
  const originalQuestion = cleanDisplayText(question);
  const plan = buildSearchPlan(originalQuestion);

  if (!originalQuestion) return notFoundResult(originalQuestion, plan, "empty_question");
  if (!plan.query || plan.concepts.length === 0) {
    return notFoundResult(originalQuestion, plan, "no_meaningful_terms");
  }

  try {
    const pagefind = options.pagefind ?? await loadPagefind(options.basePath);
    const response = await pagefind.search(plan.query);

    if (!response?.results?.length) {
      return notFoundResult(originalQuestion, plan, "no_pagefind_results");
    }

    const candidates = [];
    const results = response.results.slice(
      0,
      options.maxResults ?? MAX_RESULTS_TO_EVALUATE
    );

    for (let resultIndex = 0; resultIndex < results.length; resultIndex += 1) {
      const result = results[resultIndex];
      const data = await result.data();
      const sections = data.sub_results?.length
        ? data.sub_results
        : [{
            title: data.meta?.title,
            url: data.url,
            plain_excerpt: data.plain_excerpt,
          }];

      sections.forEach((section, sectionIndex) => {
        const excerpt = cleanDisplayText(section.plain_excerpt ?? data.plain_excerpt);
        if (!excerpt) return;

        focusedExcerptVariants(excerpt).forEach((variant, variantIndex) => {
          candidates.push(evaluateEvidence({
            title: cleanDisplayText(section.title ?? data.meta?.title ?? "AIML website"),
            pageTitle: cleanDisplayText(data.meta?.title ?? section.title ?? "AIML website"),
            url: section.url ?? data.url,
            excerpt: variant.excerpt,
            focused: variant.focused,
            pagefindScore: result.score,
            resultIndex,
            sectionIndex,
            variantIndex,
          }, plan));
        });
      });
    }

    const found = resultFromEvidence(originalQuestion, plan, candidates);
    if (!found) {
      return notFoundResult(originalQuestion, plan, "insufficient_evidence");
    }
    return found;
  } catch (error) {
    try {
      const fallback = await searchRenderedSite(originalQuestion, plan, options.basePath);
      if (fallback) return fallback;
    } catch {
      // Preserve the original Pagefind error below if the local fallback also fails.
    }
    return {
      status: "error",
      question: originalQuestion,
      normalizedQuestion: plan.normalizedQuestion,
      query: plan.query,
      intent: plan.intent,
      meaningfulTerms: plan.meaningfulTerms,
      reason: "search_unavailable",
      message: error instanceof Error ? error.message : "Pagefind search is unavailable.",
    };
  }
}
