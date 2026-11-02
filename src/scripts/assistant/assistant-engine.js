// src/scripts/assistant/assistant-engine.js
// Answers questions by computing over the site's published data
// (/assistant-knowledge.json). Every fact comes from that data or the short
// glossary below; when nothing supports an answer it returns null rather than guess.
// This file has no browser dependencies, so it can be run directly under Node.

const LIST_LIMIT = 8;

const PAGES = {
  events: { label: "Events", url: "/events/" },
  projects: { label: "Projects", url: "/projects/" },
  sandbox: { label: "ML Sandbox", url: "/projects/sandbox/" },
  team: { label: "Meet the team", url: "/about/" },
  history: { label: "Team history", url: "/about/history/" },
  partners: { label: "Partners", url: "/partners/" },
  hackathon: { label: "Hackathons", url: "/hackathon/" },
  faq: { label: "FAQ", url: "/about/faq/" },
  exec: { label: "Executive applications", url: "/about/exec-application/" },
  contact: { label: "Connect", url: "/contact/" },
  about: { label: "About AIML", url: "/about/" },
};

const STOP_WORDS = new Set(`a about after all also am an and any anything are as at available be been before being but by can could
currently did do does doing done during each ever every find for from get give got had has have held here how i if in info information is
it its just know let like list looking many me more most much my need number of on one or our out please provide run running runs say see
should show some tell than that the their them there these they this those to total u us use used using want was we were what whats when
where which who whom whose why will with would you your yours aiml qut society club currently`.split(/\s+/));

// Ordinary question words that must never be "corrected" into a data term.
const COMMON_WORDS = new Set(`attend attended attendance biggest busiest compare cost count difference earliest explain first free hello
help hey hi last largest latest least longest members newest next past previous recent smallest soon start thanks thank upcoming versus
beginner beginners recommend suggest suggestion started explain define meaning works work people person role roles held larger bigger smaller
fewer grown grew grow change changed compared comparison differ common popular type types contact email reach touch join joining signup sign
membership member fee fees price discord instagram linkedin socials media follow followers follower github conduct constitution partner partners
sponsor sponsors sponsored supporter supporters backed sandbox demo demos playground interactive degree degrees course courses study bachelor bachelors
master masters pathway pathways hackathon hackathons brains bots apply application applications nominate executive executives portfolio portfolios
leadership founder founders cofounder cofounders founded lead leads runs charge director directors officer officers manager head heads served serve
serving returning twice month months location locations venue venues room rooms look like love enjoy interested into should good best learn
turnout attendees easiest experience code coded never community history presidents notebook notebooks repo repository repositories`.split(/\s+/));

const TOPIC_ALIASES = {
  CNN: ["cnn", "cnns", "convolutional", "convolutional neural network", "convolutional neural networks", "computer vision", "image classification", "vision"],
  "Linear Regression": ["linear regression", "linear"],
  "Logistic Regression": ["logistic regression", "logistic"],
  "K-Nearest Neighbours": ["knn", "k nearest neighbours", "k nearest neighbors", "nearest neighbours", "nearest neighbors", "k nearest"],
  "Random Forest": ["random forest", "random forests", "decision tree", "decision trees", "ensemble"],
  "Reinforcement Learning": ["reinforcement learning", "reinforcement", "rl", "q learning", "deep q", "dqn"],
  Transformers: ["transformer", "transformers", "vit", "vision transformer", "vision transformers", "attention"],
  LLM: ["llm", "llms", "large language model", "large language models", "gpt", "chatbot", "chatbots", "generative ai", "genai"],
  Clustering: ["clustering", "cluster", "clusters", "k means", "kmeans", "unsupervised"],
};

// Maps everyday subject words onto words that appear in project descriptions.
const SUBJECT_ALIASES = {
  health: ["heart", "disease", "medical", "patient", "activity"], healthcare: ["heart", "disease", "medical", "patient"], medical: ["heart", "disease", "patient"], medicine: ["heart", "disease", "patient"],
  finance: ["bank", "loan", "income", "churn"], financial: ["bank", "loan", "income"], banking: ["bank", "loan"], money: ["bank", "loan", "income"],
  game: ["game", "pokemon", "snake"], games: ["game", "pokemon", "snake"], gaming: ["game", "pokemon", "snake"],
  security: ["cybersecurity", "attack"], cyber: ["cybersecurity", "attack"], sport: ["formula"], sports: ["formula"], f1: ["formula"], racing: ["formula"],
  business: ["customer", "churn", "retail", "marketing", "sales"], marketing: ["marketing", "customer"], retail: ["retail", "sales"],
  space: ["asteroid"], animals: ["penguin", "cats", "dogs"], nlp: ["text", "language", "news", "llm"], text: ["text", "language", "news"], language: ["text", "language", "llm"],
  video: ["video", "action"], engineering: ["concrete", "marine", "engine", "energy"], energy: ["energy"], image: ["image", "cnn", "vision"], images: ["image", "cnn", "vision"],
};

const GLOSSARY = {
  CNN: "A convolutional neural network (CNN) learns visual patterns by sliding small filters across an image, building from edges up to whole objects. CNNs are a standard choice for image classification.",
  "Linear Regression": "Linear regression predicts a continuous number, such as a price or energy use, by fitting a straight-line relationship between the input features and the target.",
  "Logistic Regression": "Logistic regression predicts the probability of a category, such as whether a loan is approved. Despite the name, it is a classification method.",
  "K-Nearest Neighbours": "K-nearest neighbours (KNN) classifies a data point by looking at the K most similar examples and taking the most common label among them. It has no real training phase; it compares against stored data.",
  "Random Forest": "A random forest trains many decision trees on random subsets of the data and combines their votes, which usually makes it more accurate and less prone to overfitting than a single tree.",
  "Reinforcement Learning": "Reinforcement learning trains an agent by trial and error: it takes actions, receives rewards, and learns a strategy that maximises long-term reward. Q-learning is a common approach.",
  Transformers: "A transformer is a neural network built around attention, which lets the model weigh how every part of an input relates to every other part. Transformers power modern language models and also work on images and video.",
  LLM: "A large language model (LLM) is a transformer trained on huge amounts of text to predict what comes next, which lets it answer questions, summarise, and generate language.",
  Clustering: "Clustering groups similar data points without any labels, making it a form of unsupervised learning. K-means is a popular method: it repeatedly assigns points to the nearest centre, then moves each centre.",
};

const EVENT_CATEGORIES = {
  "Social Event": ["social", "socials", "social event", "social events", "social night", "social nights"],
  "Project Night": ["project night", "project nights", "projects night", "projects nights"],
  "Industry Event": ["industry", "industry event", "industry events", "industry night", "industry nights", "networking"],
  "Flagship Event": ["flagship", "flagship event", "flagship events"],
  Meeting: ["meeting", "meetings", "agm"],
};

const LOCATION_ALIASES = {
  "gardens point": ["gp"], "garden point": ["gp"], gp: ["gp"], "kelvin grove": ["kg"], kg: ["kg"], online: ["online"], valley: ["valley"],
  "fortitude valley": ["valley"], precinct: ["precinct"], "west end": ["west end"], "botbar": ["botbar"], "bot bar": ["botbar"], "s block": ["s block"], "p block": ["p block"],
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const DOMAIN_WORDS = new Set("event events project projects team teams exec execs executive executives committee night nights semester sem year years held happen happening happened hosted ran scheduled topic topics category categories type types kind kinds done built build made completed archive involve involved related featuring called named".split(" "));

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
}

const tokensOf = (value) => normalize(value).split(" ").filter(Boolean);

function stem(word) {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ing") && word.length > 6) return word.slice(0, -3);
  if (word.endsWith("ed") && word.length > 5) return word.slice(0, -2);
  if (word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

const hasPhrase = (text, phrase) => ` ${text} `.includes(` ${phrase} `);

function editDistance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let before = null;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (before && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        current[j] = Math.min(current[j], before[j - 2] + 1);
      }
    }
    before = previous;
    previous = current;
  }
  return previous[b.length];
}

const plural = (count, word, pluralWord = `${word}s`) => `${count} ${count === 1 ? word : pluralWord}`;

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const isoDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function joinList(values) {
  if (values.length < 2) return values.join("");
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

// ---------------------------------------------------------------------------
// Knowledge index
// ---------------------------------------------------------------------------

export function buildIndex(kb) {
  const events = kb.events.map((event) => ({
    ...event,
    kind: "event",
    text: normalize(`${event.title} ${event.category} ${event.excerpt} ${event.location}`),
    titleNorm: normalize(event.title),
  }));
  const projects = kb.projects.map((project) => ({
    ...project,
    kind: "project",
    text: normalize(`${project.title} ${project.topic} ${project.excerpt}`),
    titleNorm: normalize(project.title),
  }));
  const teams = [...kb.teams].sort((a, b) => b.year - a.year);
  const members = teams.flatMap((team) => team.groups.flatMap((group) => group.members.map((member) => ({
    ...member,
    year: team.year,
    group: group.title,
    cleanName: member.name.replace(/\s*\(S\d+\)$/, ""),
    nameNorm: normalize(member.name.replace(/\s*\(S\d+\)$/, "")),
    roleNorm: normalize(member.role),
  }))));
  const roles = [...new Set(members.map((member) => member.roleNorm))].sort((a, b) => b.length - a.length);
  const groups = [...new Set(members.map((member) => member.group))];
  const names = [...new Set(members.map((member) => member.nameNorm).concat(kb.coFounders.map((person) => normalize(person.name))))];

  const documents = [
    ...kb.faq.map((item) => ({ type: "faq", title: item.title, body: item.body, source: PAGES.faq })),
    ...kb.partners.map((partner) => ({ type: "partner", title: partner.name, body: partner.description, source: PAGES.partners })),
    ...events.map((event) => ({ type: "event", title: event.title, body: `${event.excerpt}`, item: event, source: PAGES.events })),
    ...projects.map((project) => ({ type: "project", title: project.title, body: project.excerpt, item: project, source: PAGES.projects })),
  ].map((doc) => ({ ...doc, tokens: tokensOf(`${doc.title} ${doc.title} ${doc.body}`).map(stem) }));
  const documentFrequency = new Map();
  documents.forEach((doc) => new Set(doc.tokens).forEach((token) => documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1)));

  const vocabulary = new Set();
  const addWords = (value) => tokensOf(value).forEach((word) => vocabulary.add(word));
  documents.forEach((doc) => addWords(`${doc.title} ${doc.body}`));
  events.forEach((event) => addWords(`${event.location} ${event.category}`));
  projects.forEach((project) => addWords(project.topic));
  names.forEach(addWords);
  roles.forEach(addWords);
  groups.forEach(addWords);
  kb.degrees.forEach((group) => group.items.forEach((item) => addWords(`${group.title} ${item.name}`)));
  Object.values(TOPIC_ALIASES).flat().forEach(addWords);
  Object.keys(SUBJECT_ALIASES).forEach(addWords);
  Object.values(EVENT_CATEGORIES).flat().forEach(addWords);
  Object.keys(LOCATION_ALIASES).forEach(addWords);
  DOMAIN_WORDS.forEach((word) => vocabulary.add(word));
  COMMON_WORDS.forEach((word) => vocabulary.add(word));
  MONTHS.forEach((word) => vocabulary.add(word));

  return { kb, events, projects, teams, members, roles, groups, names, documents, documentFrequency, vocabulary };
}

const SHORTHAND = { wat: "what", wht: "what", wot: "what", hw: "how", whn: "when", whr: "where", abt: "about", pls: "please", plz: "please", ur: "your", yr: "year" };

function correctTypos(rawTokens, index) {
  return rawTokens.map((raw) => {
    const token = SHORTHAND[raw] ?? raw;
    if (token.length < 4 || /\d/.test(token) || STOP_WORDS.has(token) || COMMON_WORDS.has(token) || index.vocabulary.has(token)) return token;
    if (index.vocabulary.has(stem(token))) return token;
    const limit = token.length >= 7 ? 2 : 1;
    let best = token;
    let bestDistance = limit + 1;
    for (const word of index.vocabulary) {
      if (word.length < 3 || word[0] !== token[0]) continue;
      const distance = editDistance(token, word, limit);
      if (distance < bestDistance) { bestDistance = distance; best = word; }
    }
    return best;
  });
}

// ---------------------------------------------------------------------------
// Question parsing
// ---------------------------------------------------------------------------

function parseQuestion(question, index, now, inherited = {}) {
  const tokens = correctTypos(tokensOf(question), index);
  const text = tokens.join(" ");
  const has = (...phrases) => phrases.some((phrase) => hasPhrase(text, phrase));
  const currentYear = now.getFullYear();

  const years = [...new Set((text.match(/\b20\d\d\b/g) ?? []).map(Number))];
  if (has("this year")) years.push(currentYear);
  if (has("last year")) years.push(currentYear - 1);
  if (has("next year")) years.push(currentYear + 1);

  const semesterMatch = text.match(/\b(?:sem|semester|s)\s?([12])\b/) ?? (has("first semester") ? [0, "1"] : has("second semester") ? [0, "2"] : null);
  const semester = semesterMatch ? Number(semesterMatch[1]) : null;
  const month = MONTHS.findIndex((name, position) => tokens.includes(name) && !(name === "may" && !/\b(in|during|of) may\b/.test(text)) && position >= 0);

  let time = null;
  if (has("upcoming", "next", "coming up", "future", "soon", "planned", "still to come", "remaining", "left this year", "are left", "left in")) time = "upcoming";
  else if (has("past", "previous", "already", "happened", "so far")) time = "past";

  let superlative = null;
  if (has("first", "earliest", "oldest")) superlative = "first";
  else if (has("latest", "most recent", "newest", "last event", "last project", "last social", "last meeting", "last night")) superlative = "latest";

  const topics = Object.entries(TOPIC_ALIASES).filter(([, aliases]) => aliases.some((alias) => hasPhrase(text, alias))).map(([topic]) => topic);
  const categories = Object.entries(EVENT_CATEGORIES).filter(([, aliases]) => aliases.some((alias) => hasPhrase(text, alias))).map(([category]) => category);
  const locations = [...new Set(Object.entries(LOCATION_ALIASES).filter(([alias]) => hasPhrase(text, alias)).flatMap(([, needles]) => needles))];
  const collab = has("collab", "collabs", "collaboration", "collaborations", "collaborative", "with other clubs", "joint", "partnered");

  const wantsCount = inherited.wantsCount || has("how many", "number of", "count of", "total number", "how much");
  const wantsBreakdown = has("breakdown", "break down", "per topic", "per category", "per semester", "per year", "by topic", "by category", "by semester", "by year", "each topic", "each category", "each semester", "each year", "for each");
  const wantsMost = has("most", "biggest", "largest", "busiest", "highest", "most common", "most popular") && !has("most recent");
  const wantsLeast = has("least", "smallest", "fewest", "lowest");
  const refersToPrevious = tokens.some((token) => ["those", "them", "these", "ones"].includes(token));
  const ordinalWords = { first: 0, "1st": 0, second: 1, "2nd": 1, third: 2, "3rd": 2, fourth: 3, "4th": 3, fifth: 4, "5th": 4 };
  const ordinalWord = tokens.find((token) => token in ordinalWords);

  // Words left over once everything recognised above is removed.
  const consumed = [
    ...Object.values(TOPIC_ALIASES).flat().filter((alias) => hasPhrase(text, alias)),
    ...Object.values(EVENT_CATEGORIES).flat().filter((alias) => hasPhrase(text, alias)),
    ...Object.keys(LOCATION_ALIASES).filter((alias) => hasPhrase(text, alias)),
  ].flatMap(tokensOf);
  const ignore = new Set([...STOP_WORDS, ...DOMAIN_WORDS, ...consumed, ...COMMON_WORDS, ...MONTHS, "try", "im", "interest", "mention", "mentions", "mentioning", "include", "includes", "including", "time", "date", "left", "exactly", "actually", "officer", "officers", "upcoming", "coming", "up", "future", "soon", "planned", "still", "remaining", "so", "far", "already", "ago", "s", "1", "2", "second", "collab", "collabs", "collaboration", "collaborations", "collaborative", "joint", "partnered", "other", "clubs", "only", "recent", "old", "new", "again", "ones", "scheduled", "yet", "have", "breakdown", "break", "down", "per", "early", "late"]);
  const keywords = tokens.filter((token) => !ignore.has(token) && !/^20\d\d$/.test(token));

  return {
    question, tokens, text, has, years: years.length ? years : inherited.years ?? [], semester: semester ?? inherited.semester ?? null,
    month: month >= 0 ? month : null, time, superlative, topics, categories, locations, collab, wantsCount, wantsBreakdown, wantsMost,
    wantsLeast, refersToPrevious, ordinal: ordinalWord ? ordinalWords[ordinalWord] : null, keywords,
    isDefinition: has("what is", "what are", "whats", "explain", "define", "meaning of", "how does", "how do", "what does") || (tokens[0] === "what" && tokens.length <= 4),
    wantsWhere: tokens[0] === "where" || has("where is", "where was", "where are", "where does"),
    wantsWhen: tokens[0] === "when" || has("what time", "what date"),
  };
}

// ---------------------------------------------------------------------------
// Answer shapes
// ---------------------------------------------------------------------------

function answerWith(text, options = {}) {
  return { text, items: [], sources: [], suggestions: [], ...options };
}

function eventItem(event) {
  const when = event.endDate && event.endDate !== event.date ? `${formatDate(event.date)} to ${formatDate(event.endDate)}` : formatDate(event.date);
  return { label: event.title, detail: [when, event.time, event.location].filter(Boolean).join(" · "), url: event.rubric || null };
}

const projectItem = (project) => ({ label: project.title, detail: project.topic, url: project.github });

function limitItems(items) {
  return { items: items.slice(0, LIST_LIMIT), more: Math.max(0, items.length - LIST_LIMIT) };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const eventEnd = (event) => event.endDate || event.date;

function describeEventFilters(parsed) {
  const parts = [];
  if (parsed.semester) parts.push(`in Semester ${parsed.semester}`);
  if (parsed.years.length) parts.push(`${parsed.semester ? "" : "in "}${parsed.years.join(" and ")}`.trim());
  if (parsed.month !== null) parts.push(`in ${MONTHS[parsed.month][0].toUpperCase()}${MONTHS[parsed.month].slice(1)}`);
  if (parsed.locations.length) parts.push(`at ${parsed.question.match(/gardens? point/i)?.[0] ?? parsed.locations.join("/").toUpperCase()}`);
  if (parsed.collab) parts.push("run in collaboration with other groups");
  if (parsed.keywords.length) parts.push(`matching “${parsed.keywords.join(" ")}”`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

function filterEvents(parsed, index, now, base) {
  const today = isoDay(now);
  return (base ?? index.events).filter((event) => {
    if (parsed.years.length && !parsed.years.includes(Number(event.date.slice(0, 4)))) return false;
    if (parsed.semester && !event.semester.endsWith(`sem-${parsed.semester}`)) return false;
    if (parsed.month !== null && Number(event.date.slice(5, 7)) - 1 !== parsed.month) return false;
    if (parsed.categories.length && !parsed.categories.includes(event.category)) return false;
    if (parsed.locations.length && !parsed.locations.some((needle) => hasPhrase(normalize(event.location), needle) || normalize(event.location).includes(needle))) return false;
    if (parsed.collab && !event.collab) return false;
    if (parsed.time === "upcoming" && eventEnd(event) < today) return false;
    if (parsed.time === "past" && eventEnd(event) >= today) return false;
    return parsed.keywords.every((keyword) => event.text.split(" ").some((word) => stem(word) === stem(keyword)));
  }).sort((a, b) => a.date.localeCompare(b.date));
}

function isEventQuestion(parsed, index) {
  if (parsed.categories.length || parsed.has("event", "events", "workshop", "workshops", "happening", "calendar", "whats on", "what is on", "busiest")) return true;
  if (parsed.locations.length && !parsed.topics.length) return true;
  return index.events.some((event) => event.titleNorm.length > 3 && hasPhrase(parsed.text, event.titleNorm));
}

function answerBreakdown(rows, intro, sources, suffix = "") {
  return answerWith(intro, { ...limitItems(rows.map(([label, count]) => ({ label, detail: `${count}${suffix}` }))), sources });
}

function countBy(list, keyOf) {
  const counts = new Map();
  list.forEach((item) => counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1));
  return [...counts.entries()];
}

function eventsAnswer(parsed, index, now, base) {
  const matches = filterEvents(parsed, index, now, base);
  const shared = { sources: [PAGES.events], domain: "events", set: matches };
  const filters = describeEventFilters(parsed);
  const noun = parsed.categories.length === 1 ? parsed.categories[0].toLowerCase() : "event";
  const nounPlural = noun.endsWith("s") ? noun : `${noun}s`;

  if (parsed.wantsBreakdown || parsed.wantsMost || parsed.wantsLeast || parsed.has("what type", "what types", "what kind", "what kinds", "types of", "kinds of")) {
    const byPlace = parsed.has("where", "location", "locations", "venue", "venues", "room", "rooms");
    const bySemester = parsed.has("semester", "semesters", "sem", "busiest") && !byPlace;
    const byYear = parsed.has("per year", "by year", "each year");
    const byMonth = parsed.has("month", "months");
    const keyOf = byPlace ? (event) => event.location || "Location to be confirmed" : byMonth ? (event) => `${MONTHS[Number(event.date.slice(5, 7)) - 1][0].toUpperCase()}${MONTHS[Number(event.date.slice(5, 7)) - 1].slice(1)}` : byYear ? (event) => event.date.slice(0, 4) : bySemester ? (event) => event.semesterLabel : (event) => event.category;
    const rows = countBy(matches, keyOf).sort((a, b) => b[1] - a[1]);
    const dimension = byPlace ? "location" : byMonth ? "month" : byYear ? "year" : bySemester ? "semester" : "type";
    if (!rows.length) return answerWith(`I couldn't find any events${filters}.`, shared);
    if (parsed.wantsMost || parsed.wantsLeast) {
      const [label, count] = parsed.wantsMost ? rows[0] : rows.at(-1);
      const tied = rows.filter((row) => row[1] === count).map((row) => row[0]);
      const rank = parsed.has("busiest") ? "busiest" : `${parsed.wantsMost ? "most" : "least"} common`;
      return answerWith(`${joinList(tied)} ${tied.length > 1 ? "are" : "is"} the ${rank} ${dimension}${tied.length > 1 ? "s" : ""}${filters}, with ${plural(count, "event")}${tied.length > 1 ? " each" : ""}.`, { ...shared, items: rows.slice(0, LIST_LIMIT).map(([name, total]) => ({ label: name, detail: String(total) })), label });
    }
    return { ...answerBreakdown(rows, `Here are the ${plural(matches.length, "event")}${filters} by ${dimension}:`, [PAGES.events]), domain: "events", set: matches };
  }

  if (!matches.length) {
    if (parsed.time === "upcoming") return answerWith(`There are no upcoming ${nounPlural}${filters} on the calendar right now. New events are announced on the Events page and in the Discord.`, shared);
    return answerWith(`I couldn't find any ${nounPlural}${filters}.`, { ...shared, suggestions: ["What events are coming up?", "How many events have you run?"] });
  }

  if (parsed.wantsCount) {
    const tense = parsed.time === "upcoming" ? "still to come" : "on record";
    return answerWith(`There ${matches.length === 1 ? "is" : "are"} ${plural(matches.length, noun, nounPlural)}${filters} ${tense}.`, { ...shared, ...limitItems(matches.map(eventItem)) });
  }

  const singleWanted = parsed.time === "upcoming" && !parsed.has("upcoming events", "events coming", "all", "list", "which", "coming up", "remaining", "future");
  if (parsed.superlative === "first" || parsed.superlative === "latest" || singleWanted || parsed.has("last") && !parsed.has("last year")) {
    const pool = parsed.has("last") || parsed.superlative === "latest"
      ? (matches.filter((event) => eventEnd(event) < isoDay(now)).length ? matches.filter((event) => eventEnd(event) < isoDay(now)) : matches)
      : matches;
    const event = parsed.superlative === "first" || singleWanted ? pool[0] : pool.at(-1);
    const lead = singleWanted ? "The next" : parsed.superlative === "first" ? "The first" : "The most recent";
    const item = eventItem(event);
    const verb = eventEnd(event) < isoDay(now) ? "was" : "is";
    return answerWith(`${lead} ${noun}${filters} ${verb} ${event.title}: ${item.detail}. ${event.excerpt}`.trim(), { ...shared, set: [event], sources: [PAGES.events] });
  }

  const titled = matches.filter((event) => hasPhrase(parsed.text, event.titleNorm));
  if (titled.length > 1) {
    return answerWith(`${titled[0].title} has run ${titled.length} times:`, { ...shared, ...limitItems(titled.map(eventItem)) });
  }
  if (titled.length === 1 || matches.length === 1) {
    const event = titled[0] ?? matches[0];
    const item = eventItem(event);
    return answerWith(`${event.title}: ${item.detail}. ${event.excerpt}`.trim(), { ...shared, set: [event] });
  }

  return answerWith(`I found ${plural(matches.length, noun, nounPlural)}${filters}:`, { ...shared, ...limitItems(matches.map(eventItem)) });
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

function isProjectQuestion(parsed, index) {
  if (parsed.has("project", "projects", "notebook", "notebooks", "repo", "repository", "repositories", "github project")) return true;
  if (parsed.topics.length && !parsed.isDefinition) return true;
  return index.projects.some((project) => hasPhrase(parsed.text, project.titleNorm));
}

function projectMatches(project, keyword) {
  const needles = [keyword, ...(SUBJECT_ALIASES[keyword] ?? [])];
  return project.text.split(" ").some((word) => needles.some((needle) => stem(word) === stem(needle)));
}

function projectsAnswer(parsed, index, base) {
  const titled = index.projects.filter((project) => hasPhrase(parsed.text, project.titleNorm));
  const shared = { sources: [PAGES.projects], domain: "projects" };

  if (titled.length === 1 && !base) {
    const [project] = titled;
    return answerWith(`${project.title} is a ${project.topic} project. ${project.excerpt}`, { ...shared, set: titled, items: [{ label: "Open the notebook on GitHub", url: project.github }] });
  }

  if (parsed.superlative && !base && !parsed.keywords.length) {
    const semesters = [...new Set(index.projects.map((project) => project.semester))].sort();
    const id = parsed.superlative === "first" ? semesters[0] : semesters.at(-1);
    const list = index.projects.filter((project) => project.semester === id && (!parsed.topics.length || parsed.topics.includes(project.topic)));
    return answerWith(`Projects are recorded by semester rather than by date, so I can't single one out. The ${parsed.superlative === "first" ? "earliest" : "most recent"} semester in the archive is ${id.replace(/(\d+)-sem-(\d)/, "Semester $2, $1")}, with ${plural(list.length, "project")}.`, { ...shared, set: list, ...limitItems(list.map(projectItem)) });
  }

  const pool = base ?? index.projects;
  const matches = pool.filter((project) => {
    if (parsed.topics.length && !parsed.topics.includes(project.topic)) return false;
    if (parsed.semester && !project.semester.endsWith(`sem-${parsed.semester}`)) return false;
    if (parsed.years.length && !parsed.years.includes(Number(project.semester.slice(0, 4)))) return false;
    return parsed.keywords.every((keyword) => projectMatches(project, keyword));
  });
  const topicLabel = parsed.topics.join(" or ");
  const about = parsed.keywords.length ? ` about “${parsed.keywords.join(" ")}”` : "";

  if (parsed.wantsBreakdown || parsed.wantsMost || parsed.wantsLeast || parsed.has("what topics", "which topics", "what fields", "what areas", "what type", "what types", "what kind", "what kinds")) {
    const rows = countBy(matches, (project) => project.topic).sort((a, b) => b[1] - a[1]);
    if (parsed.wantsMost || parsed.wantsLeast) {
      const count = (parsed.wantsMost ? rows[0] : rows.at(-1))[1];
      const tied = rows.filter((row) => row[1] === count).map((row) => row[0]);
      return answerWith(`${joinList(tied)} ${tied.length > 1 ? "have" : "has"} the ${parsed.wantsMost ? "most" : "fewest"} projects, with ${count}${tied.length > 1 ? " each" : ""}.`, { ...shared, set: matches, items: rows.map(([label, total]) => ({ label, detail: String(total) })) });
    }
    return { ...answerBreakdown(rows, `The ${plural(matches.length, "project")} in the archive by topic:`, [PAGES.projects]), domain: "projects", set: matches, more: 0, items: rows.map(([label, total]) => ({ label, detail: String(total) })) };
  }

  if (!matches.length) {
    return answerWith(`I couldn't find any ${topicLabel ? `${topicLabel} ` : ""}projects${about}${parsed.years.length ? ` from ${parsed.years.join(" or ")}` : ""}. The archive covers ${joinList(Object.keys(TOPIC_ALIASES))}.`, { ...shared, set: [], suggestions: ["How many projects are there per topic?"] });
  }

  if (parsed.wantsCount) {
    return answerWith(`There ${matches.length === 1 ? "is" : "are"} ${plural(matches.length, `${topicLabel ? `${topicLabel} ` : ""}project`)}${about} in the archive.`, { ...shared, set: matches, ...limitItems(matches.map(projectItem)) });
  }
  if (matches.length === 1) {
    const [project] = matches;
    return answerWith(`${project.title} (${project.topic}): ${project.excerpt}`, { ...shared, set: matches, items: [{ label: "Open the notebook on GitHub", url: project.github }] });
  }
  return answerWith(`Here are the ${plural(matches.length, `${topicLabel ? `${topicLabel} ` : ""}project`)}${about}:`, { ...shared, set: matches, ...limitItems(matches.map(projectItem)) });
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

function findPeople(parsed, index) {
  const full = index.names.filter((name) => hasPhrase(parsed.text, name));
  if (full.length) return full;

  // A lone first or last name must be capitalised in the question, or asked about
  // directly, so that ordinary words are not mistaken for people.
  const direct = /\b(who is|who was|who s|whos|about|role of|is|does|did|has)\b/.test(parsed.text);
  const originalWords = new Set((parsed.question.match(/\b[A-Z][a-z]+\b/g) ?? []).map((word) => normalize(word)));
  return index.names.filter((name) => name.split(" ").some((part) => part.length >= 3 && !STOP_WORDS.has(part) && !DOMAIN_WORDS.has(part) && parsed.tokens.includes(part) && (originalWords.has(part) || (direct && part.length >= 4))));
}

function findRoles(parsed, index) {
  const text = parsed.text.replace(/\bvp\b/g, "vice president").replace(/\bprez\b/g, "president");
  const exact = [];
  let remaining = text;
  index.roles.forEach((role) => {
    if (hasPhrase(remaining, role)) { exact.push(role); remaining = ` ${remaining} `.replace(` ${role} `, " | ").trim(); }
  });
  return exact;
}

function findGroups(parsed, index) {
  return index.groups.filter((group) => {
    const groupText = normalize(group);
    const word = groupText.split(" ")[0];
    return hasPhrase(parsed.text, groupText) || hasPhrase(parsed.text, `${word} team`) || hasPhrase(parsed.text, `${stem(word)} team`) || (["director", "directors", "officer", "officers", "manager", "lead", "leads", "runs", "head", "heads"].some((title) => parsed.tokens.includes(title)) && parsed.tokens.some((token) => stem(token) === stem(word)));
  });
}

const isPeopleWord = (parsed) => parsed.has("team", "teams", "exec", "execs", "executive", "executives", "committee", "portfolio", "portfolios", "leadership", "founder", "founders", "cofounder", "cofounders", "co founder", "co founders", "founded", "started aiml", "started the club", "president", "leads", "runs", "in charge", "lead", "run the", "served", "serve", "serving", "returning");

function teamYear(parsed, index, candidates) {
  const available = index.teams.map((team) => team.year);
  const wanted = parsed.years.find((year) => available.includes(year));
  if (wanted) return wanted;
  return candidates?.length ? Math.max(...candidates.map((member) => member.year)) : available[0];
}

function groupNames(members) {
  return joinList([...new Set(members.map((member) => member.cleanName))]);
}

function peopleAnswer(parsed, index) {
  const shared = { sources: [PAGES.team, PAGES.history], domain: "people" };
  const missingYear = parsed.years.filter((year) => !index.teams.some((team) => team.year === year));
  if (missingYear.length && !index.teams.some((team) => parsed.years.includes(team.year))) {
    return answerWith(`I don't have a team on record for ${joinList(missingYear)}. The history covers ${joinList(index.teams.map((team) => team.year).sort())}.`, shared);
  }

  if (parsed.has("founder", "founders", "cofounder", "cofounders", "co founder", "co founders", "founded", "started aiml", "started the club")) {
    return answerWith(`AIML's co-founders are ${joinList(index.kb.coFounders.map((person) => person.name))}.`, { ...shared, sources: [PAGES.history], items: index.kb.coFounders.map((person) => ({ label: person.name, url: person.linkedin })) });
  }

  const people = findPeople(parsed, index);
  if (people.length) {
    return answerWith("", { ...shared, parts: people.slice(0, 3).map((name) => {
      const record = index.members.filter((member) => member.nameNorm === name);
      const founder = index.kb.coFounders.find((person) => normalize(person.name) === name);
      if (!record.length) return founder ? `${founder.name} is a co-founder of AIML.` : "";
      const byYear = [...new Set(record.map((member) => member.year))].sort();
      const roleText = byYear.map((year) => `${year}: ${joinList([...new Set(record.filter((member) => member.year === year).map((member) => member.role))])}`).join("; ");
      return `${record[0].cleanName}${founder ? " is a co-founder of AIML and" : ""} has served as ${roleText}.`;
    }).filter(Boolean), items: (() => {
      const link = index.members.find((member) => member.nameNorm === people[0] && member.linkedin);
      return people.length === 1 && link ? [{ label: `${link.cleanName} on LinkedIn`, url: link.linkedin }] : [];
    })() });
  }

  const allYears = parsed.has("every year", "each year", "all years", "over the years", "history", "past presidents", "per year", "by year");
  const returning = parsed.has("more than one year", "multiple years", "returning", "served twice", "more than once", "every year");
  if (returning && !findRoles(parsed, index).length) {
    const tally = new Map();
    index.members.forEach((member) => { const years = tally.get(member.nameNorm) ?? { name: member.cleanName, years: new Set() }; years.years.add(member.year); tally.set(member.nameNorm, years); });
    const repeat = [...tally.values()].filter((person) => person.years.size > 1).sort((a, b) => b.years.size - a.years.size || a.name.localeCompare(b.name));
    return answerWith(`${plural(repeat.length, "person has", "people have")} served on the team across more than one year:`, { ...shared, ...limitItems(repeat.map((person) => ({ label: person.name, detail: [...person.years].sort().join(", ") }))) });
  }

  const roles = findRoles(parsed, index);
  if (roles.length) {
    if (allYears) {
      const lines = index.teams.map((team) => {
        const holders = index.members.filter((member) => member.year === team.year && roles.includes(member.roleNorm));
        return holders.length ? { label: String(team.year), detail: groupNames(holders) } : null;
      }).filter(Boolean).reverse();
      return answerWith(`Here is who has held ${joinList(roles.map((role) => [...new Set(index.members.filter((member) => member.roleNorm === role).map((member) => member.role))][0]))} each year:`, { ...shared, items: lines });
    }
    const year = teamYear(parsed, index, index.members.filter((member) => roles.includes(member.roleNorm)));
    const parts = roles.map((role) => {
      const holders = index.members.filter((member) => member.year === year && member.roleNorm === role);
      const title = index.members.find((member) => member.roleNorm === role).role;
      if (!holders.length) return `The ${year} team doesn't list a ${title}.`;
      const verb = year >= index.currentYear ? "is" : "was";
      return holders.length === 1 ? `The ${year} ${title} ${verb} ${holders[0].cleanName}.` : `The ${year} ${title}s are ${groupNames(holders)}.`;
    });
    return answerWith("", { ...shared, parts, context: { year } });
  }

  const groups = findGroups(parsed, index);
  if (groups.length) {
    const inGroups = index.members.filter((member) => groups.includes(member.group));
    const year = teamYear(parsed, index, inGroups);
    const titleWord = ["officer", "director", "manager"].find((title) => parsed.tokens.includes(title) || parsed.tokens.includes(`${title}s`));
    const members = inGroups.filter((member) => member.year === year && (!parsed.wantsCount || !titleWord || member.roleNorm.includes(titleWord)));
    if (!members.length) return answerWith(`The ${year} team doesn't have a ${joinList(groups)}.`, shared);
    if (parsed.wantsCount) return answerWith(`The ${year} ${joinList(groups)} ${groups.length > 1 ? "have" : "has"} ${plural(members.length, titleWord ?? "person", titleWord ? `${titleWord}s` : "people")}.`, { ...shared, items: members.map((member) => ({ label: member.cleanName, detail: member.role })) });
    if (parsed.has("lead", "leads", "runs", "director", "directors", "head", "heads", "in charge")) {
      const leaders = members.filter((member) => /director|president/i.test(member.role));
      if (leaders.length) return answerWith(`${groupNames(leaders)} ${leaders.length > 1 ? "lead" : "leads"} the ${year} ${joinList(groups)} (${leaders[0].role}).`, shared);
    }
    return answerWith(`The ${year} ${joinList(groups)}:`, { ...shared, ...limitItems(members.map((member) => ({ label: member.cleanName, detail: member.role }))) });
  }

  if (parsed.wantsMost || parsed.wantsLeast || parsed.wantsBreakdown) {
    const year = teamYear(parsed, index);
    const members = index.members.filter((member) => member.year === year);
    if (parsed.wantsBreakdown && parsed.has("each year", "per year", "by year")) {
      return answerWith("Team size by year:", { ...shared, items: index.teams.map((team) => ({ label: String(team.year), detail: plural(index.members.filter((member) => member.year === team.year).length, "person", "people") })).reverse() });
    }
    const rows = countBy(members, (member) => member.group).sort((a, b) => b[1] - a[1]);
    const [label, count] = parsed.wantsLeast ? rows.at(-1) : rows[0];
    return answerWith(parsed.wantsBreakdown ? `The ${year} team by portfolio:` : `The ${parsed.wantsLeast ? "smallest" : "largest"} portfolio in ${year} is the ${label}, with ${plural(count, "person", "people")}.`, { ...shared, items: rows.map(([name, total]) => ({ label: name, detail: String(total) })) });
  }

  const year = teamYear(parsed, index);
  const members = index.members.filter((member) => member.year === year);
  const team = index.teams.find((entry) => entry.year === year);
  if (parsed.wantsCount) return answerWith(`The ${year} team has ${plural(members.length, "person", "people")} across ${plural(team.groups.length, "portfolio")}.`, { ...shared, context: { year }, items: team.groups.map((group) => ({ label: group.title, detail: String(group.members.length) })) });
  return answerWith(`The ${year} team has ${plural(members.length, "person", "people")} across ${plural(team.groups.length, "portfolio")}. Ask about a portfolio or role for names.`, { ...shared, context: { year }, items: team.groups.map((group) => ({ label: group.title, detail: groupNames(index.members.filter((member) => member.year === year && member.group === group.title)) })), suggestions: ["Who is the president?", "Who is on the projects team?"] });
}

// ---------------------------------------------------------------------------
// Comparisons
// ---------------------------------------------------------------------------

function compareAnswer(parsed, index, now) {
  const comparing = parsed.has("compare", "comparison", "versus", "vs", "difference between", "differ", "more", "fewer", "larger", "bigger", "smaller", "grow", "grew", "change", "changed") || (parsed.has(" or ") && parsed.years.length > 1);
  if (!comparing) return null;

  if (parsed.topics.length >= 2) {
    const items = parsed.topics.map((topic) => ({ label: topic, detail: GLOSSARY[topic] }));
    const counts = parsed.topics.map((topic) => `${topic}: ${plural(index.projects.filter((project) => project.topic === topic).length, "project")}`).join(", ");
    return answerWith(`Here's how they compare. In AIML's archive, ${counts}.`, { items, sources: [PAGES.projects], domain: "projects" });
  }

  const years = parsed.years.length >= 2 ? parsed.years : null;
  const semesters = (parsed.text.match(/\b(?:sem|semester|s)\s?[12]\s+20\d\d\b/g) ?? []).map((value) => value.replace(/\D*([12])\s+(20\d\d)/, "$2-sem-$1"));
  if (semesters.length >= 2 && !isPeopleWord(parsed)) {
    const rows = semesters.map((id) => [id, index.events.filter((event) => event.semester === id).length]);
    const [high, low] = [...rows].sort((a, b) => b[1] - a[1]);
    const label = (id) => index.events.find((event) => event.semester === id)?.semesterLabel ?? id;
    return answerWith(high[1] === low[1] ? `Both had ${plural(high[1], "event")}.` : `${label(high[0])} had more events: ${high[1]} compared with ${low[1]} in ${label(low[0])}.`, { items: rows.map(([id, count]) => ({ label: label(id), detail: plural(count, "event") })), sources: [PAGES.events], domain: "events" });
  }
  if (!years) {
    if (isPeopleWord(parsed) && parsed.has("grow", "grew", "change", "changed", "bigger", "larger", "over time")) {
      return answerWith("Team size by year:", { items: index.teams.map((team) => ({ label: String(team.year), detail: plural(index.members.filter((member) => member.year === team.year).length, "person", "people") })).reverse(), sources: [PAGES.history], domain: "people" });
    }
    return null;
  }

  const today = isoDay(now);
  const [a, b] = years;
  if (isPeopleWord(parsed)) {
    const size = (year) => index.members.filter((member) => member.year === year).length;
    const items = [a, b].map((year) => ({ label: String(year), detail: size(year) ? plural(size(year), "person", "people") : "No team on record" }));
    if (!size(a) || !size(b)) return answerWith("I can only compare years with a team on record.", { items, sources: [PAGES.history], domain: "people" });
    const [big, small] = size(a) >= size(b) ? [a, b] : [b, a];
    return answerWith(size(a) === size(b) ? `Both teams had ${plural(size(a), "person", "people")}.` : `The ${big} team was larger: ${size(big)} people compared with ${size(small)} in ${small}.`, { items, sources: [PAGES.history], domain: "people" });
  }
  if (parsed.has("project", "projects") && !parsed.categories.length) {
    const size = (year) => index.projects.filter((project) => project.semester.startsWith(String(year))).length;
    return answerWith(`Project archive: ${a} has ${size(a)} and ${b} has ${size(b)}.`, { sources: [PAGES.projects], domain: "projects" });
  }

  const eventsIn = (year) => index.events.filter((event) => event.date.startsWith(String(year)) && (!parsed.categories.length || parsed.categories.includes(event.category)));
  const noun = parsed.categories.length === 1 ? parsed.categories[0].toLowerCase() : "event";
  const describe = (year) => {
    const list = eventsIn(year);
    const semestersRun = [...new Set(list.map((event) => event.semesterLabel))].length;
    const future = list.filter((event) => eventEnd(event) >= today).length;
    return `${plural(list.length, noun)} across ${plural(semestersRun, "semester")}${future ? `, ${future} still to come` : ""}`;
  };
  const [countA, countB] = [eventsIn(a).length, eventsIn(b).length];
  const lead = countA === countB ? `Both years have ${plural(countA, noun)}.` : `${countA > countB ? a : b} has more ${noun}s: ${Math.max(countA, countB)} compared with ${Math.min(countA, countB)}.`;
  return answerWith(lead, { items: [a, b].map((year) => ({ label: String(year), detail: describe(year) })), sources: [PAGES.events], domain: "events" });
}

// ---------------------------------------------------------------------------
// General topics
// ---------------------------------------------------------------------------

function hackathonAnswer(parsed, index) {
  if (!parsed.has("hackathon", "hackathons", "brains and bots", "brains bots")) return null;
  const { hackathons, nextHackathon } = index.kb;
  const shared = { sources: [PAGES.hackathon], domain: "hackathon" };
  const named = hackathons.filter((event) => hasPhrase(parsed.text, normalize(event.name).replace(/ 20\d\d$/, "")) || (parsed.has("brains", "bots") && /brains/i.test(event.name)) || parsed.years.some((year) => event.name.includes(String(year))));

  if (parsed.time === "upcoming" || parsed.wantsWhen && !named.length) return answerWith(`${nextHackathon}`, shared);
  if (parsed.wantsCount && parsed.has("hackathons") && !named.length) return answerWith(`AIML has run ${plural(hackathons.length, "hackathon")}, and the next is coming in Semester 1, 2027.`, { ...shared, items: hackathons.map((event) => ({ label: event.name, detail: `${event.participants} participants, ${event.teams} teams` })) });
  if (parsed.wantsMost) {
    const biggest = [...hackathons].sort((a, b) => parseInt(b.participants, 10) - parseInt(a.participants, 10))[0];
    return answerWith(`${biggest.name} is the largest, with ${biggest.participants} participants and ${biggest.teams} teams.`, shared);
  }
  if (named.length === 1) {
    const [event] = named;
    return answerWith(`${event.name} had ${event.participants} participants and ${event.teams} teams. ${event.summary}`, shared);
  }
  return answerWith(`AIML has run ${plural(hackathons.length, "hackathon")}. ${nextHackathon}`, { ...shared, items: hackathons.map((event) => ({ label: event.name, detail: `${event.participants} participants, ${event.teams} teams` })) });
}

function fixedTopicAnswer(parsed, index) {
  const { kb } = index;
  const socials = [["Discord", kb.links.discord], ["Instagram", kb.links.instagram], ["LinkedIn", kb.links.linkedin], ["GitHub", kb.links.github]];
  const isPeopleQuestion = isPeopleWord(parsed);

  if (parsed.has("attendance", "attended", "turnout", "showed up", "most popular event", "biggest event", "largest event", "attendees") && !parsed.has("hackathon", "hackathons")) {
    return answerWith("AIML doesn't publish attendance numbers for individual events, so I can't answer that. I can tell you about event types, dates, and locations.", { sources: [PAGES.events], suggestions: ["How many events have you run?", "What events are coming up?"] });
  }

  if (parsed.has("become an executive", "become an exec", "join the team", "join the exec", "join the committee", "apply", "application", "applications", "nominate", "exec role", "executive role", "executive roles", "exec roles") && !parsed.has("event") && !findPeople(parsed, index).length) {
    return answerWith("Executive applications open once a year at AIML's Annual General Meeting. The application page explains the process, expectations, and responsibilities.", { sources: [PAGES.exec], domain: "people" });
  }

  if (!isPeopleQuestion && parsed.has("join", "joining", "sign up", "signup", "become a member", "membership", "member fee", "fee", "fees", "cost", "price", "how much")) {
    const link = { items: [{ label: "Join AIML on Rubric", url: kb.links.membership }], sources: [PAGES.faq] };
    if (parsed.has("cost", "fee", "fees", "price", "how much")) {
      const priced = kb.faq.find((item) => /\b(cost|fee|fees|free|price)\b/i.test(`${item.title} ${item.body}`));
      return answerWith(priced?.body ?? "The website doesn't list a membership price. The membership page on Rubric shows the current details.", link);
    }
    const who = kb.faq.find((item) => /join/i.test(item.title));
    return answerWith(`${who ? `${who.body} ` : ""}You can sign up through AIML's membership page on Rubric.`, link);
  }

  if (!isPeopleQuestion && parsed.has("how many", "number of", "how big", "how large", "followers") && parsed.has("member", "members", "followers", "follower", "community", "people", "discord", "instagram", "linkedin")) {
    const platform = kb.stats.filter((stat) => ["discord", "instagram", "linkedin"].some((name) => parsed.has(name) && stat.label.toLowerCase().includes(name)));
    const followers = parsed.has("followers", "follower") ? kb.stats.filter((stat) => /followers/i.test(stat.label)) : [];
    const wanted = platform.length ? platform : followers;
    if (wanted.length) return answerWith(wanted.map((stat) => `AIML has ${stat.value} ${stat.label}.`).join(" "), { sources: [PAGES.about] });
    const [members, ...others] = kb.stats;
    return answerWith(`AIML has ${members.value} ${members.label}.`, { items: others.map((stat) => ({ label: stat.label, detail: stat.value })), sources: [PAGES.about] });
  }

  if (!isPeopleQuestion && parsed.has("contact", "email", "reach", "get in touch", "discord", "instagram", "linkedin", "socials", "social media", "follow", "github", "code of conduct", "constitution")) {
    if (parsed.has("code of conduct")) return answerWith("AIML's Code of Conduct is published on GitHub.", { items: [{ label: "Code of Conduct", url: kb.links.codeOfConduct }] });
    if (parsed.has("constitution")) return answerWith("AIML's governing document and role descriptions are published on GitHub.", { items: [{ label: "Constitution and role descriptions", url: kb.links.roleDescriptions }] });
    const named = socials.filter(([name]) => parsed.has(name.toLowerCase()));
    return answerWith("The best way to reach AIML is through its community channels:", { items: (named.length ? named : socials).map(([label, url]) => ({ label, url })), sources: [PAGES.contact] });
  }

  if (parsed.has("partner", "partners", "sponsor", "sponsors", "supporter", "supporters", "backed") || kb.partners.some((partner) => hasPhrase(parsed.text, normalize(partner.name)))) {
    const named = kb.partners.filter((partner) => hasPhrase(parsed.text, normalize(partner.name)));
    const tier = parsed.has("sponsor", "sponsors") ? kb.partners.filter((partner) => partner.tier === "sponsor") : parsed.has("supporter", "supporters") ? kb.partners.filter((partner) => partner.tier === "supporter") : kb.partners;
    const list = named.length ? named : tier;
    if (parsed.wantsCount) return answerWith(`AIML has ${plural(list.length, parsed.has("sponsor", "sponsors") ? "sponsor" : parsed.has("supporter", "supporters") ? "supporter" : "partner")}.`, { items: list.map((partner) => ({ label: partner.name, detail: partner.tag, url: partner.url })), sources: [PAGES.partners] });
    if (named.length === 1) return answerWith(`${named[0].name} is an AIML ${named[0].tier}. ${named[0].description}`, { items: [{ label: `Visit ${named[0].name}`, url: named[0].url }], sources: [PAGES.partners] });
    return answerWith(parsed.has("sponsor", "sponsors", "sponsored") ? "AIML's sponsors:" : parsed.has("supporter", "supporters") ? "AIML's supporters:" : "AIML's sponsors and supporters:", { items: list.map((partner) => ({ label: partner.name, detail: partner.description, url: partner.url })), sources: [PAGES.partners] });
  }

  if (parsed.has("sandbox", "demo", "demos", "playground", "interactive")) {
    return answerWith("The ML Sandbox has four browser-based demos: a K-means clustering visualiser, a live digit classifier, a city route planner, and a decision boundary playground. Nothing you enter leaves your device.", { sources: [PAGES.sandbox] });
  }

  if (parsed.has("degree", "degrees", "course", "courses", "study", "bachelor", "bachelors", "master", "masters", "pathway", "pathways")) {
    const level = kb.degrees.filter((group) => parsed.has(normalize(group.title), stem(normalize(group.title))));
    const groups = level.length ? level : kb.degrees;
    const items = groups.flatMap((group) => group.items.map((item) => ({ label: item.name.replace(/^Coming Soon - /, ""), detail: `${group.title}${item.name.startsWith("Coming Soon") ? " · Coming soon" : ""}` })));
    if (parsed.wantsCount) return answerWith(`The About page lists ${plural(items.length, "relevant course")}${level.length ? ` under ${joinList(level.map((group) => group.title))}` : ""}.`, { ...limitItems(items), sources: [PAGES.about] });
    return answerWith(`The study pathways listed for AIML${level.length ? ` under ${joinList(level.map((group) => group.title))}` : ""}:`, { ...limitItems(items), sources: [PAGES.about] });
  }

  return null;
}

function recommendationAnswer(parsed, index, now) {
  const asking = parsed.has("beginner", "beginners", "new to", "where should i start", "where do i start", "how do i start", "how to start", "get started", "getting started", "no experience", "dont know how to code", "cant code", "never coded", "recommend", "suggest", "should i try", "should i start", "should i attend", "good first", "easiest", "start with", "learn");
  if (!asking) return null;

  const upcoming = index.events.filter((event) => eventEnd(event) >= isoDay(now)).sort((a, b) => a.date.localeCompare(b.date));
  const projectNight = upcoming.find((event) => event.category === "Project Night");
  const interests = parsed.keywords.filter((keyword) => SUBJECT_ALIASES[keyword] || index.projects.some((project) => projectMatches(project, keyword)));
  const matching = interests.length ? index.projects.filter((project) => interests.some((keyword) => projectMatches(project, keyword))) : [];
  const topical = parsed.topics.length ? index.projects.filter((project) => parsed.topics.includes(project.topic)) : [];

  if (topical.length || matching.length) {
    const list = topical.length ? topical : matching;
    return answerWith(`Based on what you mentioned, these projects from the archive are worth a look:`, { ...limitItems(list.map(projectItem)), sources: [PAGES.projects], domain: "projects", set: list });
  }

  const starters = index.projects.filter((project) => /beginner/i.test(project.title) || project.topic === "Linear Regression").slice(0, 4);
  const lead = "AIML welcomes every skill level. A good route is to try the ML Sandbox first, then read through a beginner-friendly notebook. Linear regression is a common place to start because the idea is simple to follow.";
  const next = projectNight ? ` The next project night is ${projectNight.title} on ${formatDate(projectNight.date)}.` : "";
  return answerWith(`${lead}${next}`, { items: starters.map(projectItem), sources: [PAGES.sandbox, PAGES.projects, PAGES.events], domain: "projects", set: starters });
}

function glossaryAnswer(parsed, index) {
  if (!parsed.topics.length || !parsed.isDefinition) return null;
  if (parsed.has("project", "projects", "notebook")) return null;
  const parts = parsed.topics.map((topic) => GLOSSARY[topic]);
  const related = index.projects.filter((project) => parsed.topics.includes(project.topic));
  return answerWith("", { parts: [...parts, `AIML has ${plural(related.length, "project")} on ${joinList(parsed.topics)}:`], ...limitItems(related.map(projectItem)), sources: [PAGES.projects], domain: "projects", set: related });
}

function overviewAnswer(parsed, index) {
  if (!parsed.has("what is aiml", "what is qut aiml", "who are you", "what do you do", "what does aiml do", "what does the society do", "what does the club do", "about aiml", "about the society", "about the club", "what is the society", "what is the club", "what is this")) return null;
  const about = index.kb.faq[0];
  return answerWith(about.body, { sources: [PAGES.about], suggestions: ["What events are coming up?", "What projects have you done?", "How do I join?"] });
}

function searchDocuments(parsed, index) {
  const terms = [...new Set(parsed.tokens.filter((token) => !STOP_WORDS.has(token)).map(stem))].filter((term) => term.length > 1);
  if (!terms.length) return null;
  const total = index.documents.length;
  const scored = index.documents.map((doc) => {
    const counts = new Map();
    doc.tokens.forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
    let score = 0;
    let matched = 0;
    terms.forEach((term) => {
      const frequency = counts.get(term);
      if (!frequency) return;
      matched += 1;
      const rarity = Math.log(1 + total / (index.documentFrequency.get(term) ?? 1));
      score += rarity * (frequency / (frequency + 1.2));
    });
    return { doc, score: score * (doc.type === "faq" ? 1.3 : 1), matched };
  }).filter(({ matched }) => matched / terms.length >= (terms.length <= 2 ? 1 : 0.6))
    .sort((a, b) => b.score - a.score);
  if (!scored.length || scored[0].score < 1.2) return null;

  const [{ doc }] = scored;
  if (doc.type === "faq") return answerWith(doc.body, { sources: [doc.source] });
  if (doc.type === "project") return answerWith(`${doc.item.title} (${doc.item.topic}): ${doc.item.excerpt}`, { items: [{ label: "Open the notebook on GitHub", url: doc.item.github }], sources: [doc.source], domain: "projects", set: [doc.item] });
  if (doc.type === "event") return answerWith(`${doc.item.title}: ${eventItem(doc.item).detail}. ${doc.item.excerpt}`, { sources: [doc.source], domain: "events", set: [doc.item] });
  return answerWith(`${doc.title}: ${doc.body}`, { sources: [doc.source] });
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

function isClearlyAboutPeople(parsed, index) {
  if (findRoles(parsed, index).length || findGroups(parsed, index).length || findPeople(parsed, index).length) return true;
  return parsed.has("team", "teams", "exec", "execs", "executive", "executives", "committee", "portfolio", "portfolios", "founder", "founders", "founded", "served", "serve") && !parsed.has("event", "events");
}

function route(parsed, index, now) {
  const multiple = parsed.wantsCount && parsed.has("event", "events") && parsed.has("project", "projects") && !parsed.keywords.length;
  if (multiple) {
    const eventTotal = filterEvents({ ...parsed, categories: [], keywords: [] }, index, now).length;
    return answerWith(`AIML has ${plural(eventTotal, "event")}${describeEventFilters({ ...parsed, keywords: [] })} and ${plural(index.projects.length, "project")} on record.`, { sources: [PAGES.events, PAGES.projects] });
  }

  return compareAnswer(parsed, index, now)
    ?? hackathonAnswer(parsed, index)
    ?? fixedTopicAnswer(parsed, index)
    ?? overviewAnswer(parsed, index)
    ?? recommendationAnswer(parsed, index, now)
    ?? glossaryAnswer(parsed, index)
    ?? (isClearlyAboutPeople(parsed, index) ? peopleAnswer(parsed, index) : null)
    ?? (isEventQuestion(parsed, index) && (parsed.categories.length || !parsed.has("project", "projects")) ? eventsAnswer(parsed, index, now) : null)
    ?? (isProjectQuestion(parsed, index) ? projectsAnswer(parsed, index) : null)
    ?? (isPeopleWord(parsed) ? peopleAnswer(parsed, index) : null)
    ?? searchDocuments(parsed, index);
}

function detailOfItem(item, set) {
  if (item.kind === "event") return answerWith(`${item.title}: ${eventItem(item).detail}. ${item.excerpt}`.trim(), { sources: [PAGES.events], domain: "events", set });
  return answerWith(`${item.title} (${item.topic}): ${item.excerpt}`, { items: [{ label: "Open the notebook on GitHub", url: item.github }], sources: [PAGES.projects], domain: "projects", set });
}

function followUpAnswer(question, parsed, index, now, context) {
  if (!context?.domain) return null;

  // "tell me about the second one", "what's the first project?"
  if (parsed.ordinal !== null && parsed.has("one", "item", "project", "event") && context.set?.[parsed.ordinal] && !parsed.years.length && parsed.tokens.length <= 9) {
    return detailOfItem(context.set[parsed.ordinal], context.set);
  }
  const asksAboutIt = parsed.tokens.includes("it") && (parsed.wantsWhere || parsed.wantsWhen || parsed.has("about it", "more about", "details", "link"));
  if ((asksAboutIt || parsed.has("tell me more", "more details", "more info")) && context.set?.length === 1 && context.set[0].kind && parsed.tokens.length <= 8) {
    return detailOfItem(context.set[0], context.set);
  }
  if (parsed.has("more", "the rest", "show the rest", "others", "remaining ones") && parsed.tokens.length <= 5 && context.set?.length) {
    const rest = context.set.slice(LIST_LIMIT);
    if (!rest.length) return answerWith("That was the full list.", { domain: context.domain, set: context.set });
    return answerWith(`The remaining ${plural(rest.length, "result")}:`, { items: rest.map((item) => (item.kind === "event" ? eventItem(item) : projectItem(item))), domain: context.domain, set: context.set, sources: context.sources ?? [] });
  }

  // "which of those are in 2026?", "how many of them are collabs?"
  if (parsed.refersToPrevious && context.set?.length) {
    if (context.domain === "events") return eventsAnswer(parsed, index, now, context.set);
    if (context.domain === "projects") return projectsAnswer(parsed, index, context.set);
  }

  // "what about 2025?", "and semester 1?", "how about clustering?"
  const stripped = question.replace(/^\s*(what about|how about|and what about|and for|and in|and|what of|same for)\b/i, "").trim();
  const isShiftedQuestion = stripped !== question.trim() || parsed.tokens.length <= 3;
  if (!isShiftedQuestion || !context.parsed) return null;

  const shifted = parseQuestion(stripped, index, now);
  const filtersOnly = !shifted.keywords.length && !shifted.topics.length && !shifted.categories.length && (shifted.years.length || shifted.semester || shifted.time || shifted.month !== null);
  if (filtersOnly) {
    const merged = { ...context.parsed, years: shifted.years.length || !shifted.semester ? shifted.years : context.parsed.years, semester: shifted.semester, time: shifted.time ?? context.parsed.time, month: shifted.month };
    if (context.domain === "events") return eventsAnswer(merged, index, now);
    if (context.domain === "projects") return projectsAnswer(merged, index);
    if (context.domain === "people") return peopleAnswer(merged, index);
  }
  if (stripped !== question.trim()) {
    const inheritance = { wantsCount: context.parsed.wantsCount, years: context.parsed.years, semester: context.parsed.semester };
    return route(parseQuestion(stripped, index, now, inheritance), index, now);
  }
  return null;
}

function smallTalk(parsed) {
  const onlyTokens = (...words) => parsed.tokens.length > 0 && parsed.tokens.every((token) => words.includes(token));
  if (onlyTokens("hi", "hello", "hey", "there", "gday", "good", "morning", "afternoon", "evening", "yo")) {
    return answerWith("Hi! Ask me anything about AIML's events, projects, team, partners, or how to get involved.", { suggestions: ["What's the next event?", "Which project topic has the most work?", "Who is the president?"] });
  }
  if (parsed.has("thanks", "thank you", "cheers", "thx", "ty")) return answerWith("You're welcome!");
  if (parsed.has("what can you do", "what can i ask", "help me", "how do you work") || onlyTokens("help")) {
    return answerWith("I can look things up and work things out from AIML's published information. For example:", {
      items: [
        { label: "Filter and count", detail: "How many social events were there in Semester 1, 2026?" },
        { label: "Compare", detail: "Did you run more events in 2025 or 2026?" },
        { label: "Rank", detail: "Which topic has the most projects?" },
        { label: "Look up people", detail: "Who was treasurer in 2025?" },
        { label: "Find projects", detail: "Do you have any healthcare projects?" },
        { label: "Explain", detail: "What is the difference between linear and logistic regression?" },
      ],
    });
  }
  return null;
}

function splitQuestion(question) {
  return question.split(/\?\s+(?=\S)|\s*;\s*|\s+and also\s+/i).map((part) => part.trim()).filter(Boolean).slice(0, 4);
}

function mergeAnswers(answers) {
  if (answers.length === 1) return answers[0];
  const useful = answers.filter(Boolean);
  const last = useful.at(-1);
  return {
    sections: useful,
    text: "",
    items: [],
    sources: [...new Map(useful.flatMap((answer) => answer.sources ?? []).map((source) => [source.url, source])).values()],
    suggestions: last?.suggestions ?? [],
    domain: last?.domain,
    set: last?.set,
  };
}

/**
 * Returns { answer, context }. `answer` is null when the data doesn't cover the
 * question. Pass the returned context back in so follow-up questions work.
 */
export function answerQuestion(question, index, context = null, now = new Date()) {
  index.currentYear = now.getFullYear();
  const parts = splitQuestion(question);
  let currentContext = context;
  const answers = [];

  parts.forEach((part) => {
    const parsed = parseQuestion(part, index, now);
    const answer = smallTalk(parsed)
      ?? followUpAnswer(part, parsed, index, now, currentContext)
      ?? route(parsed, index, now);
    answers.push(answer);
    if (answer?.domain) currentContext = { domain: answer.domain, set: answer.set, parsed, sources: answer.sources };
  });

  const useful = answers.filter(Boolean);
  if (!useful.length) return { answer: null, context: currentContext };
  return { answer: mergeAnswers(useful), context: currentContext };
}
