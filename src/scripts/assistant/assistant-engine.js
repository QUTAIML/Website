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
  team: { label: "Meet the team", url: "/team/" },
  history: { label: "Team history", url: "/about/history/" },
  partners: { label: "Partners", url: "/partners/" },
  hackathon: { label: "Hackathons", url: "/hackathon/" },
  faq: { label: "FAQ", url: "/about/faq/" },
  exec: { label: "Executive applications", url: "/about/exec-application/" },
  contact: { label: "Connect", url: "/contact/" },
  about: { label: "About AIML", url: "/about/" },
};

export const STOP_WORDS = new Set(`a about after all also am an and any anything are as at available be been before being but by can could
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
turnout attendees easiest experience code coded never community history presidents notebook notebooks repo repository repositories
today tomorrow tonight week weekend monday tuesday wednesday thursday friday saturday sunday usually normally typically often frequently regularly average
long until till venue ticket tickets book booking stand acronym abbreviation name based located campus university uni old established began website
contribute contributed contributes contribution contributions favourite favorite hardest smartest coolest nicest valuable impressive helpful ranking mvp meant instead sorry actually rather sure right correct true really talked discussed asked remember forget recap summarise summarize repeat conversation question questions interested keen
chatgpt gemini claude gpt openai copilot talk talks speak speaker speakers giving page link url ever altogether joined left newcomers departed replaced positions boss leader mean understand teach longest multi semester`.split(/\s+/));

const TOPIC_ALIASES = {
  CNN: ["cnn", "cnns", "convolutional", "convolutional neural network", "convolutional neural networks", "computer vision", "image classification", "vision"],
  "Linear Regression": ["linear regression", "linear"],
  "Logistic Regression": ["logistic regression", "logistic"],
  "K-Nearest Neighbours": ["knn", "k nearest neighbours", "k nearest neighbors", "nearest neighbours", "nearest neighbors", "k nearest"],
  "Random Forest": ["random forest", "random forests", "decision tree", "decision trees", "ensemble"],
  "Reinforcement Learning": ["reinforcement learning", "reinforcement", "rl", "q learning", "deep q", "dqn"],
  Transformers: ["transformer", "transformers", "vit", "vision transformer", "vision transformers", "attention"],
  LLM: ["llm", "llms", "large language model", "large language models", "gpt", "chatbot", "chatbots", "generative ai", "genai"],
  Clustering: ["clustering", "cluster", "clusters", "k means", "kmeans"],
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

// Concepts with no project topic of their own. Written for this assistant, not taken from the site.
const EXTRA_CONCEPTS = {
  "Artificial intelligence": { aliases: ["artificial intelligence"], text: "Artificial intelligence (AI) is the broad field of building systems that perform tasks normally needing human intelligence, such as understanding language, recognising images, and making decisions." },
  "Machine learning": { aliases: ["machine learning"], text: "Machine learning (ML) is the part of AI where systems learn patterns from data instead of following hand-written rules. Models improve by being trained on examples." },
  "Deep learning": { aliases: ["deep learning"], text: "Deep learning is machine learning with neural networks of many layers. It powers modern image recognition, speech, and language models, and usually needs plenty of data and computing power." },
  "Neural network": { aliases: ["neural network", "neural networks", "neural net", "neural nets"], text: "A neural network is a model made of layers of connected units. Each connection has a weight, and training adjusts those weights so the network's outputs match the examples it sees." },
  "Supervised learning": { aliases: ["supervised learning", "supervised"], text: "Supervised learning trains a model on labelled examples, so it learns to map inputs to known answers. Regression and classification are the two common kinds." },
  "Unsupervised learning": { aliases: ["unsupervised learning"], text: "Unsupervised learning finds structure in data without labels. Clustering and dimensionality reduction are common examples." },
  Overfitting: { aliases: ["overfitting", "overfit", "over fitting"], text: "Overfitting is when a model learns its training data too closely, including the noise, so it performs well there but poorly on new data. More data, simpler models, and regularisation all help." },
  Underfitting: { aliases: ["underfitting", "underfit", "under fitting"], text: "Underfitting is when a model is too simple to capture the pattern in the data, so it performs poorly on both training and new data." },
  "Gradient descent": { aliases: ["gradient descent"], text: "Gradient descent trains a model by repeatedly nudging its parameters in the direction that most reduces the error." },
  Backpropagation: { aliases: ["backpropagation", "backprop"], text: "Backpropagation works out how much each weight in a neural network contributed to the error, so gradient descent knows how to adjust it." },
  "Loss function": { aliases: ["loss function", "cost function"], text: "A loss function measures how wrong a model's predictions are. Training is the process of making that number smaller." },
  Hyperparameter: { aliases: ["hyperparameter", "hyperparameters"], text: "A hyperparameter is a setting chosen before training rather than learned from data, such as the learning rate or the K in K-means." },
  "Cross-validation": { aliases: ["cross validation"], text: "Cross-validation tests a model on several different splits of the data, giving a more reliable estimate of how it will perform on new data." },
  Regression: { aliases: ["regression"], text: "Regression predicts a continuous number, such as a price or temperature." },
  Classification: { aliases: ["classification", "classifier", "classifiers"], text: "Classification predicts a category, such as whether an email is spam or which species an animal is." },
  PCA: { aliases: ["pca", "principal component analysis", "dimensionality reduction"], text: "Principal component analysis (PCA) reduces data to fewer dimensions while keeping as much of its variation as possible, which makes it easier to visualise and model." },
  NLP: { aliases: ["nlp", "natural language processing"], text: "Natural language processing (NLP) is the area of AI that works with human language, including translation, summarising, and chatbots." },
  Embedding: { aliases: ["embedding", "embeddings"], text: "An embedding represents something like a word or image as a list of numbers, placed so that similar things sit close together." },
  RAG: { aliases: ["rag", "retrieval augmented generation"], text: "Retrieval-augmented generation (RAG) has a language model look up relevant documents first and use them when answering, which helps it stay accurate on specific information." },
  "Prompt engineering": { aliases: ["prompt engineering", "prompting"], text: "Prompt engineering is the practice of wording instructions to a language model so that it produces more useful and reliable output." },
  RNN: { aliases: ["rnn", "rnns", "recurrent neural network", "lstm", "lstms"], text: "A recurrent neural network (RNN) processes sequences one step at a time while keeping a memory of earlier steps. An LSTM is a popular type that remembers longer patterns." },
  GAN: { aliases: ["gan", "gans", "generative adversarial network"], text: "A generative adversarial network (GAN) trains two networks against each other: one creates fake samples and the other tries to spot them, which pushes the generator to improve." },
  Python: { aliases: ["python"], text: "Python is the most widely used programming language in machine learning, thanks to its readable syntax and libraries such as NumPy, pandas, scikit-learn, and PyTorch." },
  PyTorch: { aliases: ["pytorch"], text: "PyTorch is a popular open-source Python library for building and training neural networks." },
  TensorFlow: { aliases: ["tensorflow"], text: "TensorFlow is an open-source library from Google for building and training machine learning models." },
  "Jupyter notebook": { aliases: ["jupyter", "jupyter notebook", "ipynb"], text: "A Jupyter notebook is a document that mixes runnable code, results, charts, and written notes. AIML's project archive is mostly made of them." },
  GPU: { aliases: ["gpu", "gpus"], text: "A GPU is a processor that does many calculations in parallel, which makes training neural networks far faster than on a typical CPU." },
  MNIST: { aliases: ["mnist"], text: "MNIST is a classic dataset of 70,000 handwritten digits, widely used as a first image classification exercise. The ML Sandbox's digit classifier was trained on it." },
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

export function stem(word) {
  if (word.length <= 3) return word;
  if (word.startsWith("eligib")) return "eligib";
  if (word.endsWith("e")) return word.slice(0, -1);
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ing") && word.length > 5) return word.slice(0, -3);
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
    // "(S1)" / "(S2)": the role was held for that semester only (a mid-year handover).
    term: Number(member.name.match(/\(S(\d)\)$/)?.[1]) || null,
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
  EVERYDAY_WORDS.forEach((word) => vocabulary.add(word));

  return { kb, events, projects, teams, members, roles, groups, names, documents, documentFrequency, vocabulary };
}

// Ordinary words the typo fixer must leave alone, since they are a letter or two away
// from words in the data ("both" → "bots", "division" → "decision").
const EVERYDAY_WORDS = new Set("both either neither division divisions portfolio portfolios replaced replace replacement successor successors predecessor predecessors preceded succeeded before after held hold holds role roles former previous current currently sure certain correct incorrect right wrong check checked verify confirm accurate really true false mistake missed missing forgot forgotten actually think thought count counted recount again double total name names list someone anyone everyone nobody".split(" "));

const SHORTHAND = { u: "you", r: "are", ya: "you", wat: "what", wht: "what", wot: "what", hw: "how", whn: "when", whr: "where", abt: "about", pls: "please", plz: "please", ur: "your", yr: "year" };

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
  // Everyday ways of asking for the society's leader.
  const tokens = correctTypos(tokensOf(question), index).join(" ")
    .replace(/\b(boss|leader|head) of (aiml|qut aiml|the club|the society)\b/g, "president")
    .replace(/\b(runs|leads|in charge of) (aiml|qut aiml|the club|the society)\b/g, "is the president")
    .replace(/^who is in charge$/, "who is the president")
    .split(" ").filter(Boolean);
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

  const dayFormat = (offset) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return isoDay(date);
  };
  const mondayOffset = (now.getDay() + 6) % 7;
  let range = null;
  if (has("today", "tonight")) range = { from: dayFormat(0), to: dayFormat(0), label: "today" };
  else if (has("tomorrow")) range = { from: dayFormat(1), to: dayFormat(1), label: "tomorrow" };
  else if (has("this week")) range = { from: dayFormat(-mondayOffset), to: dayFormat(6 - mondayOffset), label: "this week" };
  else if (has("next week")) range = { from: dayFormat(7 - mondayOffset), to: dayFormat(13 - mondayOffset), label: "next week" };
  else if (has("last week")) range = { from: dayFormat(-7 - mondayOffset), to: dayFormat(-1 - mondayOffset), label: "last week" };
  else if (has("this weekend")) range = { from: dayFormat(5 - mondayOffset), to: dayFormat(6 - mondayOffset), label: "this weekend" };
  else if (has("this month", "next month", "last month")) {
    const shift = has("next month") ? 1 : has("last month") ? -1 : 0;
    const start = new Date(now.getFullYear(), now.getMonth() + shift, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + shift + 1, 0);
    range = { from: isoDay(start), to: isoDay(end), label: has("next month") ? "next month" : has("last month") ? "last month" : "this month" };
  }
  const currentSemester = now.getMonth() >= 6 ? 2 : 1;
  const thisSemester = has("this semester", "current semester");
  const lastSemester = has("last semester", "previous semester");
  const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const weekday = WEEKDAYS.findIndex((day) => tokens.includes(day) || tokens.includes(`${day}s`));
  const weekend = has("weekend", "weekends") && !range;

  const concepts = Object.entries(EXTRA_CONCEPTS).filter(([, concept]) => concept.aliases.some((alias) => hasPhrase(text, alias))).map(([name]) => name);
  const meaningful = tokens.filter((token) => !STOP_WORDS.has(token) || token === "ai" || token === "ml");
  if (meaningful.join(" ") === "ai" && !concepts.length) concepts.push("Artificial intelligence");
  if (meaningful.join(" ") === "ml" && !concepts.length) concepts.push("Machine learning");
  // Longer phrases win: "unsupervised learning" shouldn't also count as "supervised".
  if (tokens.includes("ai") && has("difference", "vs", "versus", "compare") && !concepts.includes("Artificial intelligence")) concepts.push("Artificial intelligence");
  const namedConcepts = concepts.filter((name) => !concepts.some((other) => other !== name && EXTRA_CONCEPTS[other].aliases.some((alias) => hasPhrase(text, alias) && EXTRA_CONCEPTS[name].aliases.some((inner) => alias !== inner && hasPhrase(alias, inner)))));

  // Words left over once everything recognised above is removed.
  const consumed = [
    ...Object.values(EXTRA_CONCEPTS).flatMap((concept) => concept.aliases).filter((alias) => hasPhrase(text, alias)),
    ...Object.values(TOPIC_ALIASES).flat().filter((alias) => hasPhrase(text, alias)),
    ...Object.values(EVENT_CATEGORIES).flat().filter((alias) => hasPhrase(text, alias)),
    ...Object.keys(LOCATION_ALIASES).filter((alias) => hasPhrase(text, alias)),
  ].flatMap(tokensOf);
  const ignore = new Set([...STOP_WORDS, ...DOMAIN_WORDS, ...consumed, ...COMMON_WORDS, ...MONTHS, ...WEEKDAYS, ...WEEKDAYS.map((day) => `${day}s`), "today", "tomorrow", "tonight", "week", "weekend", "weekends", "month", "last", "next", "this", "current", "day", "days", "usually", "normally", "typically", "often", "frequently", "regularly", "average", "long", "until", "till", "starts", "start", "ends", "end", "finish", "take", "place", "ticket", "tickets", "book", "booking", "free", "money", "pay", "longest", "multi", "try", "im", "interest", "mention", "mentions", "mentioning", "include", "includes", "including", "time", "date", "left", "exactly", "actually", "officer", "officers", "upcoming", "coming", "up", "future", "soon", "planned", "still", "remaining", "so", "far", "already", "ago", "s", "1", "2", "second", "collab", "collabs", "collaboration", "collaborations", "collaborative", "joint", "partnered", "other", "clubs", "only", "recent", "old", "new", "again", "ones", "scheduled", "yet", "have", "breakdown", "break", "down", "per", "early", "late", "mean", "meant", "instead", "sorry", "actually", "rather", "just", "then", "though", "no", "nah", "nope", "ok", "okay", "yes", "yeah", "wait", "oops", "hmm", "well", "that", "before", "after", "previous", "following", "other", "same", "try", "make", "said", "asking", "else"]);
  const keywords = tokens.filter((token) => !ignore.has(token) && !/^20\d\d$/.test(token));

  return {
    question, tokens, text, has, range, weekday: weekday >= 0 ? weekday : null, weekend, concepts: namedConcepts,
    years: thisSemester ? [currentYear] : lastSemester ? [currentSemester === 1 ? currentYear - 1 : currentYear] : years.length ? years : inherited.years ?? [],
    semester: thisSemester ? currentSemester : lastSemester ? (currentSemester === 1 ? 2 : 1) : semester ?? inherited.semester ?? null,
    allTime: has("ever", "all time", "have there been", "has there been", "there been", "altogether", "over the years", "every year", "each year", "all years", "history", "past", "in total", "so far", "by year", "per year"),
    month: month >= 0 ? month : null, time, superlative, topics, categories, locations, collab, wantsCount, wantsBreakdown, wantsMost,
    wantsLeast, refersToPrevious, ordinal: ordinalWord ? ordinalWords[ordinalWord] : null, keywords,
    isDefinition: has("what is", "what are", "whats", "explain", "define", "meaning of", "how does", "how do", "what does", "tell me about", "teach me", "understand", "what do you mean by") || (tokens[0] === "what" && tokens.length <= 4),
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
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekdayOf = (event) => {
  const [year, month, day] = event.date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};
const daysBetween = (from, to) => Math.round((Date.UTC(...to.split("-").map((part, position) => Number(part) - (position === 1 ? 1 : 0))) - Date.UTC(...from.split("-").map((part, position) => Number(part) - (position === 1 ? 1 : 0)))) / 86400000);

function describeEventFilters(parsed) {
  const parts = [];
  if (parsed.range) parts.push(parsed.range.label);
  if (parsed.weekday !== null) parts.push(`on a ${WEEKDAY_NAMES[parsed.weekday]}`);
  if (parsed.weekend) parts.push("on a weekend");
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
    if (parsed.range && (eventEnd(event) < parsed.range.from || event.date > parsed.range.to)) return false;
    if (parsed.weekday !== null && weekdayOf(event) !== parsed.weekday) return false;
    if (parsed.weekend && ![0, 6].includes(weekdayOf(event))) return false;
    if (parsed.categories.length && !parsed.categories.includes(event.category)) return false;
    if (parsed.locations.length && !parsed.locations.some((needle) => hasPhrase(normalize(event.location), needle) || normalize(event.location).includes(needle))) return false;
    if (parsed.collab && !event.collab) return false;
    if (parsed.time === "upcoming" && eventEnd(event) < today) return false;
    if (parsed.time === "past" && eventEnd(event) >= today) return false;
    return parsed.keywords.every((keyword) => event.text.split(" ").some((word) => stem(word) === stem(keyword)));
  }).sort((a, b) => a.date.localeCompare(b.date));
}

function isEventQuestion(parsed, index) {
  if (parsed.categories.length || parsed.has("event", "events", "workshop", "workshops", "happening", "calendar", "whats on", "what is on", "busiest", "anything on", "whats happening", "what is happening", "venue", "venues") || parsed.range || parsed.weekday !== null) return true;
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

// Questions about patterns across events rather than a list of them.
function eventPatternAnswer(parsed, matches, shared, noun, nounPlural, filters, index, now) {
  const today = isoDay(now);

  if (parsed.has("how long until", "how long till", "how soon", "how many days until", "how many days till", "days until", "days till", "how long before")) {
    const next = matches.find((event) => eventEnd(event) >= today);
    if (!next) return answerWith(`There are no upcoming ${nounPlural}${filters} on the calendar right now.`, shared);
    const days = daysBetween(today, next.date);
    return answerWith(`${next.title} is ${days <= 0 ? "on today" : days === 1 ? "tomorrow" : `in ${days} days`}: ${eventItem(next).detail}.`, { ...shared, set: [next] });
  }

  if (parsed.has("how often", "how frequently", "how regularly", "per semester", "each semester", "average", "on average") && !parsed.has("by semester", "breakdown")) {
    const semesters = [...new Set(matches.map((event) => event.semester))];
    if (!semesters.length) return answerWith(`I couldn't find any ${nounPlural}${filters}.`, shared);
    const average = matches.length / semesters.length;
    return answerWith(`AIML has run ${plural(matches.length, noun, nounPlural)} across ${plural(semesters.length, "semester")}, which is about ${Math.round(average * 10) / 10} per semester.`, { ...shared, items: countBy(matches, (event) => event.semesterLabel).map(([label, count]) => ({ label, detail: String(count) })) });
  }

  if (parsed.has("what day", "which day", "what days", "which days", "day of the week", "usually on")) {
    const rows = countBy(matches, (event) => WEEKDAY_NAMES[weekdayOf(event)]).sort((a, b) => b[1] - a[1]);
    if (!rows.length) return answerWith(`I couldn't find any ${nounPlural}${filters}.`, shared);
    return answerWith(`${nounPlural[0].toUpperCase()}${nounPlural.slice(1)}${filters} most often run on ${rows[0][0]}, with ${rows[0][1]} of ${matches.length}.`, { ...shared, items: rows.map(([label, count]) => ({ label, detail: String(count) })) });
  }

  if (parsed.has("what time", "when do", "usually start", "start time", "starts") && parsed.has("usually", "normally", "typically", "generally", "what time do", "when do")) {
    const timed = matches.filter((event) => event.time);
    if (!timed.length) return answerWith(`The site doesn't list times for those ${nounPlural}.`, shared);
    const [time, count] = countBy(timed, (event) => event.time).sort((a, b) => b[1] - a[1])[0];
    return answerWith(`The most common time for ${nounPlural}${filters} is ${time}, used by ${count} of the ${timed.length} with a listed time.`, shared);
  }

  if (parsed.has("venue", "venues", "rooms", "locations", "places") && parsed.has("how many", "what", "which", "list", "all")) {
    const rows = countBy(matches.filter((event) => event.location), (event) => event.location).sort((a, b) => b[1] - a[1]);
    return answerWith(`AIML's ${nounPlural}${filters} have used ${plural(rows.length, "location")}:`, { ...shared, ...limitItems(rows.map(([label, count]) => ({ label, detail: String(count) }))) });
  }

  if (parsed.has("longest", "multi day", "multiday", "several days", "more than one day")) {
    const long = matches.filter((event) => event.endDate && event.endDate !== event.date).sort((a, b) => daysBetween(b.date, b.endDate) - daysBetween(a.date, a.endDate));
    if (!long.length) return answerWith("None of those events ran for more than one day.", shared);
    if (parsed.has("longest")) return answerWith(`${long[0].title} is the longest, running ${daysBetween(long[0].date, long[0].endDate) + 1} days: ${eventItem(long[0]).detail}.`, { ...shared, set: [long[0]] });
    return answerWith(`${plural(long.length, "event")} ran for more than one day:`, { ...shared, set: long, ...limitItems(long.map(eventItem)) });
  }

  if (parsed.has("ticket", "tickets", "book", "booking", "free", "cost", "price", "pay", "rsvp", "register", "registration", "sign up")) {
    const booked = index.events.filter((event) => event.rubric);
    return answerWith(`The website doesn't list event prices. ${booked.length} of the ${index.events.length} events on record link to a Rubric page, which is where any booking details and pricing appear. New events are also announced in the Discord.`, { ...shared, items: [{ label: "AIML on Rubric", url: index.kb.links.membership }, { label: "Discord", url: index.kb.links.discord }] });
  }

  return null;
}

function eventsAnswer(parsed, index, now, base) {
  const matches = filterEvents(parsed, index, now, base);
  const shared = { sources: [PAGES.events], domain: "events", set: matches };
  const filters = describeEventFilters(parsed);
  const noun = parsed.categories.length === 1 ? parsed.categories[0].toLowerCase() : "event";
  const nounPlural = noun.endsWith("s") ? noun : `${noun}s`;

  const pattern = eventPatternAnswer(parsed, matches, shared, noun, nounPlural, filters, index, now);
  if (pattern) return pattern;

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
    if (base) return answerWith(`None of those ${nounPlural} were${filters}.`, { ...shared, set: base });
    if (parsed.time === "upcoming" || parsed.range) {
      const next = index.events.filter((event) => eventEnd(event) >= isoDay(now)).sort((a, b) => a.date.localeCompare(b.date))[0];
      return answerWith(`There are no ${parsed.range ? "" : "upcoming "}${nounPlural}${filters} on the calendar.${next && !parsed.keywords.length ? ` The next event is ${next.title} on ${formatDate(next.date)}.` : " New events are announced on the Events page and in the Discord."}`, shared);
    }
    const latestYear = Math.max(...index.events.map((event) => Number(event.date.slice(0, 4))));
    if (parsed.years.length && parsed.years.every((year) => year > latestYear)) {
      const period = parsed.semester ? `Semester ${parsed.semester} ${latestYear}` : String(latestYear);
      return answerWith(`AIML hasn't listed any ${nounPlural}${filters} yet.`, { ...shared, suggestions: [`How many events were there in ${period}?`, "What events are coming up?"] });
    }
    return answerWith(`I couldn't find any ${nounPlural}${filters}.`, { ...shared, suggestions: ["What events are coming up?", "How many events have you run?"] });
  }

  if (parsed.wantsCount) {
    const tense = parsed.time === "upcoming" ? "still to come" : "on record";
    return answerWith(`There ${matches.length === 1 ? "is" : "are"} ${plural(matches.length, noun, nounPlural)}${filters} ${tense}.`, { ...shared, ...limitItems(matches.map(eventItem)) });
  }

  const singleWanted = parsed.time === "upcoming" && !parsed.range && !parsed.has("upcoming events", "events coming", "all", "list", "which", "coming up", "remaining", "future");
  if (parsed.superlative === "first" || parsed.superlative === "latest" || singleWanted || (parsed.has("last") && !parsed.range && !parsed.has("last year", "last semester"))) {
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
  const text = roleText(parsed.text);
  const exact = [];
  let remaining = text;
  index.roles.forEach((role) => {
    const form = [role, `${role}s`, pluralTitle(role)].find((candidate) => hasPhrase(remaining, candidate));
    if (form) { exact.push(role); remaining = ` ${remaining} `.replace(` ${form} `, " | ").trim(); }
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

const TITLE_WORDS = ["director", "officer", "manager", "champion", "returning officer"];

// Everyday names for roles.
const roleText = (text) => text.replace(/\bvps\b/g, "vice presidents").replace(/\b(?:vp|veep|vice prez)\b/g, "vice president").replace(/\bprez\b/g, "president").replace(/\bvice presidency\b/g, "vice president").replace(/\bpresidency\b/g, "president");

// ── Role terms ──
// Each member record is one person in one role for one year, or for one semester of
// it when the role changed hands mid-year. These helpers order and describe them.
const termOrder = (member) => member.year * 10 + (member.term ?? 0);
const byTerm = (a, b) => termOrder(a) - termOrder(b);
const termLabel = (member) => (member.term ? `${member.year}, Semester ${member.term}` : String(member.year));
const roleTitle = (index, role) => index.members.find((member) => member.roleNorm === role)?.role ?? role;
function pluralTitle(title) {
  return /[^aeiou]y$/i.test(title) ? `${title.slice(0, -1)}ies` : `${title}s`;
}
const latestYear = (index) => index.teams[0]?.year;
const isCurrentTerm = (index, member) => member.year === latestYear(index);
const asksCurrent = (parsed) => parsed.has("current", "currently", "now", "right now", "at the moment", "today", "present", "these days", "nowadays");
const isYesNoQuestion = (parsed) => /^(?:was|is|has|have|had|did|does|do|were|are)\b/.test(parsed.text);

// A role with one seat a year (President) rather than several (Projects Officer).
function isSingleSeat(index, role) {
  return index.teams.every((team) => countBy(index.members.filter((member) => member.year === team.year && member.roleNorm === role), (member) => member.term ?? 0).every(([, count]) => count <= 1));
}

// One line per person, in the order they first held the role(s), with every term.
function holderItems(index, holders, showRole = false) {
  const people = new Map();
  [...holders].sort(byTerm).forEach((member) => {
    const entry = people.get(member.nameNorm) ?? { member, terms: [] };
    entry.terms.push(member);
    people.set(member.nameNorm, entry);
  });
  return [...people.values()].map(({ member, terms }) => ({
    label: member.cleanName,
    detail: [terms.map((term) => (showRole ? `${term.role}, ${termLabel(term)}` : termLabel(term))).join("; "), terms.some((term) => isCurrentTerm(index, term)) ? "current" : ""].filter(Boolean).join(" · "),
  }));
}

const distinctPeople = (members) => [...new Map(members.map((member) => [member.nameNorm, member])).values()];

// What an answer was about, so follow-ups ("who were they?", "how many of them…")
// can work on it. Kept small: it is held for the whole conversation.
function focusOf(members, roles = [], groups = []) {
  return { roles, groups, members: members.map(({ cleanName, nameNorm, role, roleNorm, year, term, group }) => ({ cleanName, nameNorm, role, roleNorm, year, term, group })) };
}

// "In 2026, the Vice President was Iwan (Semester 1) and Jackson (Semester 2)."
function yearHoldersText(index, year, role) {
  const holders = index.members.filter((member) => member.year === year && member.roleNorm === role).sort(byTerm);
  const title = roleTitle(index, role);
  if (!holders.length) return `The ${year} team doesn't list a ${title}.`;
  const isCurrent = year === latestYear(index);
  if (holders.some((member) => member.term) && isSingleSeat(index, role)) {
    return `In ${year}, the ${title} ${isCurrent ? "is" : "was"} ${joinList(holders.map((member) => (member.term ? `${member.cleanName} (Semester ${member.term})` : member.cleanName)))}.`;
  }
  if (holders.length === 1) return `The ${year} ${title} ${isCurrent ? "is" : "was"} ${holders[0].cleanName}.`;
  return `The ${year} ${pluralTitle(title)} ${isCurrent ? "are" : "were"} ${groupNames(holders)}.`;
}

// Questions that pair a person with a role: "when was Jackson VP?", "was Zac ever
// treasurer?", "who were the VPs before Rajinder?", "who replaced Jackson as VP?"
function personRoleAnswer(parsed, index, people, roles, shared) {
  const role = roles[0];
  const title = roleTitle(index, role);
  const holders = index.members.filter((member) => member.roleNorm === role).sort(byTerm);
  const asksBefore = /\b(?:did|does)\b.*\b(?:replace|succeed|take over from)\b/.test(parsed.text) || parsed.has("before", "preceded", "predecessor", "predecessors", "prior to", "earlier than", "came before");
  const asksAfter = !asksBefore && parsed.has("after", "replaced", "replace", "replacement", "succeeded", "succeed", "successor", "successors", "took over", "take over", "came after", "next");
  const immediate = parsed.has("replaced", "replace", "replacement", "succeeded", "succeed", "successor", "predecessor", "took over", "take over", "preceded", "was right before", "right before", "right after", "just before", "just after", "directly before", "directly after");
  const yesNo = isYesNoQuestion(parsed);
  const parts = [];
  let items = [];
  const mentioned = [];

  people.slice(0, 3).forEach((name) => {
    const own = holders.filter((member) => member.nameNorm === name);
    const records = index.members.filter((member) => member.nameNorm === name).sort(byTerm);
    const person = records[0]?.cleanName ?? name;
    const first = person.split(" ")[0];
    if (!own.length) {
      const held = [...new Set(records.map((member) => member.role))].map((other) => `${other} (${records.filter((member) => member.role === other).map(termLabel).join(", ")})`);
      parts.push(`${yesNo ? "No, " : ""}${person} hasn't been ${title}.${held.length ? ` ${first} has been ${joinList(held)}.` : ""}`);
      mentioned.push(...records);
      return;
    }
    mentioned.push(...own);
    if (asksBefore || asksAfter) {
      const pivot = asksBefore ? termOrder(own[0]) : termOrder(own.at(-1));
      let others = holders.filter((member) => member.nameNorm !== name && (asksBefore ? termOrder(member) < pivot : termOrder(member) > pivot));
      if (immediate && others.length) {
        const next = asksBefore ? others.at(-1) : others[0];
        others = others.filter((member) => member.nameNorm === next.nameNorm);
      }
      mentioned.push(...others);
      if (!others.length) {
        parts.push(asksBefore ? `${person} was AIML's first ${title}, in ${termLabel(own[0])}.` : own.some((member) => isCurrentTerm(index, member)) ? `${person} is the current ${title}, so no one has taken over yet.` : `The record doesn't list a ${title} after ${person}.`);
      } else if (immediate) {
        const other = others[0];
        parts.push(asksBefore ? `${person} took over as ${title} from ${other.cleanName}, who held it in ${joinList(others.map(termLabel))}.` : `${other.cleanName} took over from ${person} as ${title}, in ${termLabel(other)}.`);
      } else {
        parts.push(`${asksBefore ? `Before ${person}` : `After ${person}`}, AIML's ${pluralTitle(title)} ${asksBefore ? "were" : "have been"}:`);
        items = holderItems(index, others);
      }
      return;
    }
    const current = own.filter((member) => isCurrentTerm(index, member));
    const past = own.filter((member) => !isCurrentTerm(index, member));
    const sentence = current.length && past.length
      ? `${person} was ${title} in ${joinList(past.map(termLabel))}, and is the current ${title}.`
      : current.length ? `${person} is the current ${title} (${joinList(current.map(termLabel))}).`
      : `${person} was ${title} in ${joinList(past.map(termLabel))}.`;
    parts.push(`${yesNo ? "Yes. " : ""}${sentence}`);
  });

  return answerWith("", { ...shared, parts, items, focus: focusOf(mentioned, roles) });
}

// "Who has held more than one role?"
function multipleRolesAnswer(parsed, index, shared) {
  const tally = new Map();
  [...index.members].sort(byTerm).forEach((member) => {
    const entry = tally.get(member.nameNorm) ?? { name: member.cleanName, roles: new Map(), records: [] };
    entry.roles.set(member.role, [...(entry.roles.get(member.role) ?? []), termLabel(member)]);
    entry.records.push(member);
    tally.set(member.nameNorm, entry);
  });
  let people = [...tally.values()].filter((person) => person.roles.size > 1).sort((a, b) => b.roles.size - a.roles.size || a.name.localeCompare(b.name));
  if (parsed.has("most roles", "most different roles")) people = people.filter((person) => person.roles.size === people[0].roles.size);
  const describe = (person) => [...person.roles].map(([role, terms]) => `${role} (${terms.join(", ")})`).join(" → ");
  if (!people.length) return answerWith("No one on the record has held more than one role.", shared);
  const text = parsed.has("most roles", "most different roles")
    ? `${joinList(people.map((person) => person.name))} ${people.length === 1 ? "has" : "have"} held the most roles, with ${people[0].roles.size} each:`
    : `${plural(people.length, "person has", "people have")} held more than one role on the executive team:`;
  return answerWith(text, { ...shared, ...limitItems(people.map((person) => ({ label: person.name, detail: describe(person) }))), focus: focusOf(people.flatMap((person) => person.records)) });
}
const titleWordIn = (parsed) => TITLE_WORDS.find((title) => parsed.has(title, `${title}s`));

const asksMultipleRoles = (parsed) => parsed.has("more than one role", "multiple roles", "different roles", "several roles", "two roles", "changed roles", "change roles", "switched roles", "most roles", "more than one position", "multiple positions", "different positions");

const isPeopleWord = (parsed) => parsed.has("division", "divisions", "who is new", "who left", "who joined", "roles", "positions", "presidents", "directors", "officers", "managers", "members of the team", "team members", "team", "teams", "exec", "execs", "executive", "executives", "committee", "portfolio", "portfolios", "leadership", "founder", "founders", "cofounder", "cofounders", "co founder", "co founders", "founded", "started aiml", "started the club", "president", "leads", "runs", "in charge", "lead", "run the", "served", "serve", "serving", "returning");

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
  const namedRoles = findRoles(parsed, index);
  if (people.length && namedRoles.length) return personRoleAnswer(parsed, index, people, namedRoles, shared);
  if (!people.length && asksMultipleRoles(parsed)) return multipleRolesAnswer(parsed, index, shared);

  if (people.length) {
    return answerWith("", { ...shared, parts: people.slice(0, 3).map((name) => {
      const record = index.members.filter((member) => member.nameNorm === name);
      const founder = index.kb.coFounders.find((person) => normalize(person.name) === name);
      if (!record.length) return founder ? `${founder.name} is a co-founder of AIML.` : "";
      const byYear = [...new Set(record.map((member) => member.year))].sort();
      const yearsText = plural(byYear.length, "year");
      const roleText = byYear.map((year) => `${year}: ${joinList([...new Set(record.filter((member) => member.year === year).map((member) => member.role))])}`).join("; ");
      const degree = record.find((member) => member.degree)?.degree;
      return `${record[0].cleanName}${founder ? " is a co-founder of AIML and" : ""} has served ${yearsText} on the team. ${roleText}.${degree ? ` Degree: ${degree}.` : ""}`;
    }).filter(Boolean), items: (() => {
      const link = index.members.find((member) => member.nameNorm === people[0] && member.linkedin);
      return people.length === 1 && link ? [{ label: `${link.cleanName} on LinkedIn`, url: link.linkedin }] : [];
    })() });
  }

  // Who joined or moved on between two teams.
  if (parsed.has("joined", "new", "newcomers", "first time", "left", "departed", "no longer", "stepped down") && !findRoles(parsed, index).length) {
    const leaving = parsed.has("left", "departed", "no longer", "stepped down");
    const years = index.teams.map((team) => team.year).sort((a, b) => a - b);
    const named = parsed.years[0];
    const later = leaving ? (named ? (parsed.has("after") ? years[years.indexOf(named) + 1] : named) : years.at(-1)) : named ?? years.at(-1);
    const earlier = years[years.indexOf(later) - 1];
    if (!earlier || !later) return answerWith(`${years[0]} was AIML's first team, so there isn't an earlier one to compare it with.`, shared);
    const namesIn = (year) => new Map(index.members.filter((member) => member.year === year).map((member) => [member.nameNorm, member]));
    const [before, after] = [namesIn(earlier), namesIn(later)];
    const everBefore = new Set(index.members.filter((member) => member.year < later).map((member) => member.nameNorm));
    const list = leaving ? [...before.values()].filter((member) => !after.has(member.nameNorm)) : [...after.values()].filter((member) => !everBefore.has(member.nameNorm));
    return answerWith(leaving ? `${plural(list.length, "person", "people")} on the ${earlier} team ${list.length === 1 ? "isn't" : "aren't"} listed on the ${later} team:` : `${plural(list.length, "person", "people")} joined the executive team for the first time in ${later}:`, { ...shared, ...limitItems(list.map((member) => ({ label: member.cleanName, detail: member.role }))) });
  }

  if (parsed.has("what roles", "which roles", "what positions", "which positions", "list of roles", "list roles", "all roles", "all the roles", "what exec roles", "what executive roles", "how many roles", "how many positions")) {
    const year = teamYear(parsed, index);
    const roles = [...new Set(index.members.filter((member) => member.year === year).map((member) => member.role))];
    return answerWith(`The ${year} team has ${plural(roles.length, "different role")}:`, { ...shared, items: roles.map((label) => ({ label })) });
  }

  if (parsed.wantsCount && parsed.has("ever", "all time", "altogether", "in total", "total", "have there been", "so far", "over the years") && !findRoles(parsed, index).length && !findGroups(parsed, index).length && !titleWordIn(parsed)) {
    const everyone = new Set(index.members.map((member) => member.nameNorm));
    return answerWith(`${plural(everyone.size, "person has", "different people have")} served on AIML's executive team across ${plural(index.teams.length, "year")}.`, { ...shared, items: index.teams.map((team) => ({ label: String(team.year), detail: plural(index.members.filter((member) => member.year === team.year).length, "person", "people") })).reverse() });
  }

  const allYears = parsed.allTime || parsed.has("past presidents", "change", "changed", "changes");
  const returning = parsed.has("more than one year", "multiple years", "returning", "served twice", "more than once", "every year", "longest", "most years", "longest serving", "served the most", "served most");
  if (returning && !findRoles(parsed, index).length) {
    const tally = new Map();
    index.members.forEach((member) => { const years = tally.get(member.nameNorm) ?? { name: member.cleanName, years: new Set() }; years.years.add(member.year); tally.set(member.nameNorm, years); });
    const repeat = [...tally.values()].filter((person) => person.years.size > 1).sort((a, b) => b.years.size - a.years.size || a.name.localeCompare(b.name));
    if (parsed.has("longest", "most years", "every year", "longest serving", "served the most", "served most")) {
      const most = repeat[0].years.size;
      const top = repeat.filter((person) => person.years.size === most);
      return answerWith(`${plural(top.length, "person has", "people have")} served ${most === index.teams.length ? `all ${most} years on record` : `the most, with ${most} years`}:`, { ...shared, ...limitItems(top.map((person) => ({ label: person.name, detail: [...person.years].sort().join(", ") }))) });
    }
    return answerWith(`${plural(repeat.length, "person has", "people have")} served on the team across more than one year:`, { ...shared, ...limitItems(repeat.map((person) => ({ label: person.name, detail: [...person.years].sort().join(", ") }))) });
  }

  const roles = namedRoles;
  if (roles.length) {
    const holders = index.members.filter((member) => roles.includes(member.roleNorm)).sort(byTerm);
    const titleOf = (role) => roleTitle(index, role);
    const titles = joinList(roles.map(titleOf));
    const showRole = roles.length > 1;
    const singleSeat = roles.every((role) => isSingleSeat(index, role));
    const current = asksCurrent(parsed);
    const firstYear = Math.min(...holders.map((member) => member.year));

    // "Has anyone been both President and Vice President?"
    if (roles.length >= 2 && parsed.has("both", "as well as", "and also", "same person", "each of")) {
      const sets = roles.map((role) => new Set(holders.filter((member) => member.roleNorm === role).map((member) => member.nameNorm)));
      const both = [...sets[0]].filter((name) => sets.every((set) => set.has(name)));
      const records = holders.filter((member) => both.includes(member.nameNorm));
      if (!both.length) return answerWith(`No one has held both ${titles}.`, { ...shared, focus: focusOf([], roles) });
      return answerWith(`${plural(both.length, "person has", "people have")} held both ${titles}:`, { ...shared, items: holderItems(index, records, true), focus: focusOf(records, roles) });
    }

    if (parsed.superlative === "first" && !parsed.years.length) {
      const earliest = Math.min(...holders.map(termOrder));
      const first = holders.filter((member) => termOrder(member) === earliest);
      return answerWith(`AIML's first ${titles} ${first.length > 1 ? "were" : "was"} ${groupNames(first)}, in ${termLabel(first[0])}.`, { ...shared, focus: focusOf(first, roles) });
    }
    if (parsed.superlative === "latest" && !parsed.years.length && !current) {
      const latest = Math.max(...holders.map(termOrder));
      const last = holders.filter((member) => termOrder(member) === latest);
      return answerWith(`The most recent ${titles} ${last.length > 1 ? "are" : "is"} ${groupNames(last)} (${termLabel(last[0])}).`, { ...shared, focus: focusOf(last, roles) });
    }

    // Counting across every year, or within one. Roles with one seat a year count
    // across all years by default; roles with several seats count the current team.
    const scopedToYear = parsed.years.length > 0 || current || (!parsed.allTime && !singleSeat);
    if (parsed.wantsCount) {
      if (scopedToYear) {
        const years = parsed.years.length ? parsed.years : [teamYear(parsed, index, holders)];
        const parts = years.map((year) => {
          const inYear = holders.filter((member) => member.year === year);
          const people = distinctPeople(inYear);
          const word = people.length === 1 ? titles : roles.length === 1 ? pluralTitle(titleOf(roles[0])) : titles;
          const split = singleSeat && inYear.some((member) => member.term) ? ` (the role changed hands mid-year: ${joinList(inYear.map((member) => `${member.cleanName}, Semester ${member.term ?? "1 and 2"}`))})` : "";
          return `The ${year} team ${year === latestYear(index) ? "has" : "had"} ${people.length} ${word}${split}.`;
        });
        const listed = holders.filter((member) => years.includes(member.year));
        return answerWith("", { ...shared, parts, items: holderItems(index, listed, showRole), focus: focusOf(listed, roles) });
      }
      const people = distinctPeople(holders);
      const handovers = [...new Set(holders.filter((member) => member.term).map((member) => member.year))];
      const word = people.length === 1 ? titles : roles.length === 1 ? pluralTitle(titleOf(roles[0])) : `people in those roles`;
      const note = handovers.length ? `, including a mid-year handover in ${joinList(handovers)}` : "";
      const text = people.length === 1
        ? `AIML has had 1 ${titles} since ${firstYear}: ${people[0].cleanName}${new Set(holders.map((member) => member.year)).size > 1 ? `, every year since ${firstYear}` : ""}.`
        : `AIML has had ${people.length} ${word} since ${firstYear}${note}:`;
      return answerWith(text, { ...shared, items: holderItems(index, holders, showRole), focus: focusOf(holders, roles) });
    }

    // Listing everyone who has held the role, in order.
    const pluralForm = roles.some((role) => hasPhrase(roleText(parsed.text), pluralTitle(role)) || hasPhrase(roleText(parsed.text), `${role}s`));
    const wantsHistory = parsed.allTime || parsed.has("all the", "list all", "all of the", "every", "past", "previous", "former", "history of", "over the years", "timeline", "list the", "in order", "so far", "change", "changed", "changes", "past presidents") || (pluralForm && singleSeat);
    if (wantsHistory && !parsed.years.length && !current) {
      const people = distinctPeople(holders);
      if (people.length === 1 && roles.length === 1) {
        return answerWith(`${people[0].cleanName} has been ${titles} every year on record (${[...new Set(holders.map((member) => member.year))].join(", ")}).`, { ...shared, focus: focusOf(holders, roles) });
      }
      return answerWith(`Everyone who has been ${titles}, in order:`, { ...shared, items: holderItems(index, holders, showRole), focus: focusOf(holders, roles) });
    }

    const year = teamYear(parsed, index, holders);
    const years = parsed.years.length > 1 ? parsed.years : [year];
    const parts = years.flatMap((each) => roles.map((role) => yearHoldersText(index, each, role)));
    const listed = holders.filter((member) => years.includes(member.year));
    return answerWith("", { ...shared, parts, context: { year }, focus: focusOf(listed, roles) });
  }

  const groups = findGroups(parsed, index);
  const titleWord = titleWordIn(parsed);
  if (titleWord && !groups.length) {
    const year = teamYear(parsed, index);
    const members = index.members.filter((member) => member.year === year && member.roleNorm.includes(titleWord));
    if (parsed.wantsCount) return answerWith(`The ${year} team has ${plural(members.length, titleWord)}.`, { ...shared, ...limitItems(members.map((member) => ({ label: member.cleanName, detail: member.role }))) });
    return answerWith(`The ${year} team's ${titleWord}s:`, { ...shared, ...limitItems(members.map((member) => ({ label: member.cleanName, detail: member.role }))) });
  }
  if (groups.length) {
    const inGroups = index.members.filter((member) => groups.includes(member.group));
    const overTime = parsed.allTime || parsed.has("over the years", "ever", "every year", "each year", "history", "in total", "altogether", "all time", "since");
    if (overTime && !parsed.years.length) {
      const people = distinctPeople(inGroups);
      const groupYears = [...new Set(inGroups.map((member) => member.year))].sort();
      const perYear = groupYears.map((year) => ({ label: String(year), detail: plural(distinctPeople(inGroups.filter((member) => member.year === year)).length, "person", "people") }));
      if (parsed.wantsCount) return answerWith(`${plural(people.length, "person has", "different people have")} been on the ${joinList(groups)} since ${groupYears[0]}:`, { ...shared, items: perYear, focus: focusOf(inGroups, [], groups) });
      return answerWith(`Everyone who has been on the ${joinList(groups)}:`, { ...shared, items: holderItems(index, inGroups, true), focus: focusOf(inGroups, [], groups) });
    }
    const year = teamYear(parsed, index, inGroups);
    const members = inGroups.filter((member) => member.year === year && (!parsed.wantsCount || !titleWord || member.roleNorm.includes(titleWord)));
    if (!members.length) return answerWith(`The ${year} team doesn't have a ${joinList(groups)}.`, shared);
    if (parsed.wantsCount) return answerWith(`The ${year} ${joinList(groups)} ${groups.length > 1 ? "have" : "has"} ${plural(members.length, titleWord ?? "person", titleWord ? `${titleWord}s` : "people")}.`, { ...shared, items: members.map((member) => ({ label: member.cleanName, detail: member.role })) });
    if (parsed.has("lead", "leads", "runs", "director", "directors", "head", "heads", "in charge")) {
      const leaders = members.filter((member) => /director|president/i.test(member.role));
      if (leaders.length) return answerWith(`${groupNames(leaders)} ${leaders.length > 1 ? "lead" : "leads"} the ${year} ${joinList(groups)} (${leaders[0].role}).`, shared);
    }
    return answerWith(`The ${year} ${joinList(groups)}:`, { ...shared, ...limitItems(members.map((member) => ({ label: member.cleanName, detail: member.role }))) });
  }

  // "Most" only has a published answer when it is about team size.
  if ((parsed.wantsMost || parsed.wantsLeast || parsed.wantsBreakdown) && (parsed.wantsBreakdown || parsed.has("portfolio", "portfolios", "division", "divisions", "team", "teams", "group", "groups"))) {
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
// Judgement questions
// ---------------------------------------------------------------------------

// Nothing published measures who or what is best, so say so and offer what is known.
function judgementAnswer(parsed, index) {
  const judging = parsed.has("contribute", "contributed", "contributes", "contribution", "contributions", "best", "worst", "favourite", "favorite", "hardest", "smartest", "coolest", "nicest", "most valuable", "most important", "most impressive", "most helpful", "most impact", "mvp", "better", "ranking");
  if (!judging || parsed.topics.length >= 2 || parsed.concepts.length || parsed.has("best way", "better way", "how can i", "how do i", "beginner", "beginners", "start", "learn", "recommend", "should i", "hackathon", "hackathons", "award")) return null;

  if (parsed.has("project", "projects", "notebook", "notebooks")) {
    return answerWith("AIML doesn't rank its projects, so I can't name a best one. I can show you what's in the archive, or suggest projects if you tell me what interests you.", { sources: [PAGES.projects], suggestions: ["Which topic has the most projects?", "I'm a beginner, where should I start?"] });
  }
  if (parsed.has("event", "events", "night", "nights")) {
    return answerWith("AIML doesn't rank its events or publish attendance for them, so I can't name a best one. I can tell you about event types, dates, and locations.", { sources: [PAGES.events], suggestions: ["What events are coming up?", "What types of events do you run?"] });
  }

  if (!isPeopleWord(parsed) && parsed.tokens[0] !== "who") return null;
  const tally = new Map();
  index.members.forEach((member) => {
    const person = tally.get(member.nameNorm) ?? { name: member.cleanName, years: new Set() };
    person.years.add(member.year);
    tally.set(member.nameNorm, person);
  });
  const ranked = [...tally.values()].sort((a, b) => b.years.size - a.years.size || a.name.localeCompare(b.name));
  const most = ranked[0].years.size;
  const longest = ranked.filter((person) => person.years.size === most);
  return answerWith(`AIML doesn't publish any measure of individual contribution, so it wouldn't be fair for me to name one person. What the site does show is time on the team: ${plural(longest.length, "person has", "people have")} served the longest, with ${plural(most, "year")}.`, {
    ...limitItems(longest.map((person) => ({ label: person.name, detail: [...person.years].sort().join(", ") }))),
    sources: [PAGES.team, PAGES.history],
    domain: "people",
    suggestions: ["Who is the president?", "Who is on the projects team?"],
  });
}

// ---------------------------------------------------------------------------
// Comparisons
// ---------------------------------------------------------------------------

function compareAnswer(parsed, index, now) {
  const comparing = parsed.has("compare", "comparison", "versus", "vs", "difference between", "difference", "differ", "better", "more", "fewer", "larger", "bigger", "smaller", "grow", "grew", "change", "changed") || (parsed.has(" or ") && parsed.years.length > 1);
  if (!comparing) return null;

  const conceptCount = parsed.topics.length + parsed.concepts.length;
  if (conceptCount >= 2 && parsed.concepts.length) {
    const items = [...parsed.topics.map((topic) => ({ label: topic, detail: GLOSSARY[topic] })), ...parsed.concepts.map((name) => ({ label: name, detail: EXTRA_CONCEPTS[name].text }))];
    return answerWith("Here's how they compare:", { items, sources: [PAGES.projects] });
  }

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

  if (parsed.has("become an executive", "become an exec", "join the team", "join the exec", "join the committee", "apply", "application", "applications", "nominate", "exec role", "executive role", "executive roles", "exec roles") && !parsed.has("event", "what roles", "which roles", "what exec roles", "what executive roles", "how many roles") && !findPeople(parsed, index).length) {
    return answerWith("Executive applications open once a year at AIML's Annual General Meeting. The application page explains the process, expectations, and responsibilities.", { sources: [PAGES.exec], domain: "people" });
  }

  if (!isPeopleQuestion && !parsed.has("event", "events", "ticket", "tickets") && parsed.has("join", "joining", "sign up", "signup", "become a member", "membership", "member fee", "fee", "fees", "cost", "price", "how much")) {
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

  if (!isPeopleQuestion && !findPeople(parsed, index).length && parsed.has("contact", "email", "reach", "get in touch", "discord", "instagram", "linkedin", "socials", "social media", "follow", "github", "code of conduct", "constitution")) {
    if (parsed.has("code of conduct")) return answerWith("AIML's Code of Conduct is published on GitHub.", { items: [{ label: "Code of Conduct", url: kb.links.codeOfConduct }] });
    if (parsed.has("constitution")) return answerWith("AIML's governing document and role descriptions are published on GitHub.", { items: [{ label: "Constitution and role descriptions", url: kb.links.roleDescriptions }] });
    const named = socials.filter(([name]) => parsed.has(name.toLowerCase()));
    return answerWith("The best way to reach AIML is through its community channels:", { items: (named.length ? named : socials).map(([label, url]) => ({ label, url })), sources: [PAGES.contact] });
  }

  if (parsed.has("business", "businesses", "company", "companies", "become a sponsor", "become a partner", "partner with", "sponsor aiml", "sponsor you", "sponsor the club", "how do i sponsor")) {
    const how = kb.faq.find((item) => /sponsor|partner|business/i.test(item.title));
    if (how) return answerWith(how.body, { sources: [PAGES.partners, PAGES.contact] });
  }

  if (parsed.has("partner", "partners", "sponsor", "sponsors", "supporter", "supporters", "backed") || kb.partners.some((partner) => hasPhrase(parsed.text, normalize(partner.name)))) {
    const named = kb.partners.filter((partner) => hasPhrase(parsed.text, normalize(partner.name)));
    const tier = parsed.has("sponsor", "sponsors") ? kb.partners.filter((partner) => partner.tier === "sponsor") : parsed.has("supporter", "supporters") ? kb.partners.filter((partner) => partner.tier === "supporter") : kb.partners;
    const list = named.length ? named : tier;
    if (parsed.wantsCount) return answerWith(`AIML has ${plural(list.length, parsed.has("sponsor", "sponsors") ? "sponsor" : parsed.has("supporter", "supporters") ? "supporter" : "partner")}.`, { items: list.map((partner) => ({ label: partner.name, detail: partner.tag, url: partner.url })), sources: [PAGES.partners] });
    if (named.length === 1) return answerWith(`${named[0].name} is an AIML ${named[0].tier}. ${named[0].description}`, { items: [{ label: `Visit ${named[0].name}`, url: named[0].url }], sources: [PAGES.partners] });
    return answerWith(parsed.has("sponsor", "sponsors", "sponsored") ? "AIML's sponsors:" : parsed.has("supporter", "supporters") ? "AIML's supporters:" : "AIML's sponsors and supporters:", { items: list.map((partner) => ({ label: partner.name, detail: partner.description, url: partner.url })), sources: [PAGES.partners] });
  }

  if (parsed.has("sandbox", "demo", "demos", "playground", "interactive", "digit classifier", "route planner", "k means visualiser", "k means visualizer", "decision boundary")) {
    return answerWith("The ML Sandbox has four browser-based demos: a K-means clustering visualiser, a live digit classifier, a city route planner, and a decision boundary playground. Nothing you enter leaves your device.", { sources: [PAGES.sandbox] });
  }

  if (!findPeople(parsed, index).length && parsed.has("degree", "degrees", "course", "courses", "study", "bachelor", "bachelors", "master", "masters", "pathway", "pathways")) {
    const level = kb.degrees.filter((group) => parsed.has(normalize(group.title), stem(normalize(group.title))));
    const groups = level.length ? level : kb.degrees;
    const items = groups.flatMap((group) => group.items.map((item) => ({ label: item.name.replace(/^Coming Soon - /, ""), detail: `${group.title}${item.name.startsWith("Coming Soon") ? " · Coming soon" : ""}` })));
    if (parsed.wantsCount) return answerWith(`The About page lists ${plural(items.length, "relevant course")}${level.length ? ` under ${joinList(level.map((group) => group.title))}` : ""}.`, { ...limitItems(items), sources: [PAGES.about] });
    return answerWith(`The study pathways listed for AIML${level.length ? ` under ${joinList(level.map((group) => group.title))}` : ""}:`, { ...limitItems(items), sources: [PAGES.about] });
  }

  return null;
}

function recommendationAnswer(parsed, index, now, isDirect = false) {
  const asking = isDirect || parsed.has("beginner", "beginners", "new to", "where should i start", "where do i start", "how do i start", "how to start", "get started", "getting started", "no experience", "dont know how to code", "cant code", "never coded", "recommend", "suggest", "should i try", "should i start", "should i attend", "good first", "easiest", "start with", "learn", "for me", "would i like", "would i enjoy");
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

function factsAnswer(parsed, index, now) {
  const firstYear = Math.min(...index.teams.map((team) => team.year));

  if (parsed.has("stand for", "acronym", "abbreviation", "full name", "aiml mean", "does aiml mean")) {
    return answerWith("AIML stands for Artificial Intelligence and Machine Learning. The full name is the QUT AI & ML Society.", { sources: [PAGES.about] });
  }

  const asksWhenStarted = (parsed.tokens[0] === "when" && parsed.has("founded", "start", "started", "established", "begin", "began", "created", "formed"))
    || parsed.has("how old", "how long has", "how long have", "what year was", "founding year", "year founded");
  if (asksWhenStarted && !findPeople(parsed, index).length && !findRoles(parsed, index).length) {
    const first = [...index.events].sort((a, b) => a.date.localeCompare(b.date))[0];
    const age = now.getFullYear() - firstYear;
    return answerWith(`AIML was founded in ${firstYear}${age > 0 ? `, so it is in its ${age === 1 ? "second" : age === 2 ? "third" : `${age + 1}th`} year` : ""}. Its first recorded event was the ${first.title} on ${formatDate(first.date)}.`, { sources: [PAGES.about, PAGES.history] });
  }

  if (parsed.has("where is aiml", "where are you", "where is the club", "where is the society", "based", "located", "which university", "what university", "which uni", "what uni", "which campus", "what campus")) {
    const onCampus = index.events.filter((event) => /\bGP\b/.test(event.location)).length;
    return answerWith(`AIML is a student society at Queensland University of Technology (QUT) in Brisbane. ${onCampus} of its ${index.events.length} recorded events were held at QUT's Gardens Point campus.`, { sources: [PAGES.about, PAGES.events] });
  }

  if (parsed.has("where can i", "where do i", "link to", "link for", "which page", "what page", "url", "take me to", "go to the", "open the")) {
    const places = [
      [["event", "events", "calendar"], PAGES.events], [["sandbox", "demo", "demos"], PAGES.sandbox], [["project", "projects", "notebook", "notebooks"], PAGES.projects],
      [["history", "past teams"], PAGES.history], [["team", "exec", "executive", "executives"], PAGES.team], [["partner", "partners", "sponsor", "sponsors"], PAGES.partners],
      [["hackathon", "hackathons"], PAGES.hackathon], [["faq", "faqs", "questions"], PAGES.faq], [["contact", "socials"], PAGES.contact], [["apply", "application", "applications"], PAGES.exec],
    ].filter(([words]) => words.some((word) => parsed.has(word))).map(([, page]) => page);
    if (places.length) return answerWith("You can find that here:", { items: places.slice(0, 3).map((page) => ({ label: page.label, url: page.url })) });
  }
  return null;
}

function conceptAnswer(parsed, index) {
  if (!parsed.concepts.length || parsed.topics.length) return null;
  const asks = parsed.isDefinition || parsed.has("difference between", "vs", "versus", "compare");
  if (!asks || parsed.has("project", "projects", "event", "events") || parsed.keywords.length > 1) return null;
  const parts = parsed.concepts.map((name) => EXTRA_CONCEPTS[name].text);
  return answerWith("", { parts, sources: [PAGES.projects, PAGES.sandbox], suggestions: ["What projects have you done?", "What is a CNN?"] });
}

function glossaryAnswer(parsed, index) {
  if (!parsed.topics.length || !parsed.isDefinition) return null;
  if (parsed.has("project", "projects", "notebook")) return null;
  const parts = parsed.topics.map((topic) => GLOSSARY[topic]);
  const related = index.projects.filter((project) => parsed.topics.includes(project.topic));
  return answerWith("", { parts: [...parts, `AIML has ${plural(related.length, "project")} on ${joinList(parsed.topics)}:`], ...limitItems(related.map(projectItem)), sources: [PAGES.projects], domain: "projects", set: related });
}

function overviewAnswer(parsed, index) {
  if (!parsed.has("what is aiml", "what is qut aiml", "who are you", "what do you do", "what does aiml do", "what does the society do", "what does the club do", "about aiml", "about the society", "about the club", "what is the society", "what is the club", "what is this", "what is the qut ai and ml society", "what is the ai and ml society", "what is qut ai and ml", "what is ai and ml society")) return null;
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
  if (findRoles(parsed, index).length || findGroups(parsed, index).length || findPeople(parsed, index).length || titleWordIn(parsed)) return true;
  if (asksMultipleRoles(parsed)) return true;
  return parsed.has("team", "teams", "exec", "execs", "executive", "executives", "committee", "portfolio", "portfolios", "division", "divisions", "founder", "founders", "founded", "served", "serve", "longest serving") && !parsed.has("event", "events");
}

// The page text answers these better than any computed list.
const PAGE_TEXT_TOPICS = ["eligible", "eligibility", "requirement", "requirements", "qualify", "responsibilities", "expectations", "time commitment", "give a talk", "give talk", "giving talks", "guest speaker", "speak at", "present at", "values", "mission", "objectives"];

function route(parsed, index, now) {
  if (parsed.has(...PAGE_TEXT_TOPICS)) return null;

  const multiple = parsed.wantsCount && parsed.has("event", "events") && parsed.has("project", "projects") && !parsed.keywords.length;
  if (multiple) {
    const eventTotal = filterEvents({ ...parsed, categories: [], keywords: [] }, index, now).length;
    return answerWith(`AIML has ${plural(eventTotal, "event")}${describeEventFilters({ ...parsed, keywords: [] })} and ${plural(index.projects.length, "project")} on record.`, { sources: [PAGES.events, PAGES.projects] });
  }

  return judgementAnswer(parsed, index)
    ?? compareAnswer(parsed, index, now)
    ?? hackathonAnswer(parsed, index)
    ?? factsAnswer(parsed, index, now)
    ?? fixedTopicAnswer(parsed, index)
    ?? overviewAnswer(parsed, index)
    ?? conceptAnswer(parsed, index)
    ?? recommendationAnswer(parsed, index, now)
    ?? glossaryAnswer(parsed, index)
    ?? (isClearlyAboutPeople(parsed, index) ? peopleAnswer(parsed, index) : null)
    ?? (isEventQuestion(parsed, index) && (parsed.categories.length || !parsed.has("project", "projects")) ? eventsAnswer(parsed, index, now) : null)
    ?? (isProjectQuestion(parsed, index) ? projectsAnswer(parsed, index) : null)
    ?? (isPeopleWord(parsed) ? peopleAnswer(parsed, index) : null)
    ?? searchDocuments(parsed, index);
}

// Openers and closers that turn a message into a change to the previous question.
const SHIFT_OPENING = /^\s*(?:(?:no|nah|nope|sorry|oops|actually|wait|well|ok|okay|hmm|yes|yeah)\b[,.!\s]*)*(?:(?:i|we)\s+(?:meant?|said)|i\s+was\s+asking\s+about|i\s*a?m\s+asking\s+about|what\s+about|how\s+about|and\s+what\s+about|what\s+of|same\s+(?:but\s+)?for|and\s+for|and\s+in|make\s+that|try|rather|only|just|and)\b[,:\s]*/i;
const SOFT_OPENING = /^\s*(?:no|nah|nope|sorry|oops|actually|wait)\b[,.!\s]+/i;
const SHIFT_CLOSING = /[,\s]+(?:instead|then|please|sorry|though|rather)\s*[?.!]*\s*$/i;

const PERSON_PRONOUN = /\b(?:he|she|they|them|him|her|hers|his|their|theirs|that person|this person)\b/gi;

function detailOfItem(item, set) {
  if (item.kind === "event") return answerWith(`${item.title}: ${eventItem(item).detail}. ${item.excerpt}`.trim(), { sources: [PAGES.events], domain: "events", set });
  return answerWith(`${item.title} (${item.topic}): ${item.excerpt}`, { items: [{ label: "Open the notebook on GitHub", url: item.github }], sources: [PAGES.projects], domain: "projects", set });
}

function hasOwnSubject(parsed, index) {
  return isEventQuestion(parsed, index) || isProjectQuestion(parsed, index) || isClearlyAboutPeople(parsed, index) || parsed.concepts.length > 0 || parsed.has("hackathon", "hackathons", "partner", "partners", "sponsor", "sponsors", "join", "membership", "degree", "degrees", "sandbox");
}

// ── People follow-ups ──
// Work on whoever the last answer was about (context.focus): "who were they?",
// "how many of them are officers?", "tell me about them", "who leads it?".
const GROUP_POINTER = /\b(?:they|them|those|these|their|theirs)\b/;

function peopleFollowUp(question, parsed, index, now, context) {
  const focus = context.focus;
  if (!focus?.members?.length || findPeople(parsed, index).length) return null;
  const shared = { sources: [PAGES.team, PAGES.history], domain: "people" };
  const members = focus.members;
  const people = distinctPeople(members);
  const pointsBack = GROUP_POINTER.test(parsed.text);
  const mixedRoles = new Set(members.map((member) => member.roleNorm)).size > 1;

  if (pointsBack && parsed.tokens.length <= 8 && !parsed.wantsCount && (/^(?:and |so |ok )?(?:who|what|which) (?:were|are|was|is) (?:they|them|those|these)\b/.test(parsed.text) || parsed.has("list them", "name them", "show them", "their names", "names of them", "list those", "name those", "who are those", "who were those", "what are their names", "what were their names"))) {
    const isCurrent = members.every((member) => isCurrentTerm(index, member));
    return answerWith(people.length === 1 ? "That's:" : isCurrent ? "They are:" : "Here they are, in order:", { ...shared, items: holderItems(index, members, mixedRoles), focus });
  }

  if (pointsBack && parsed.wantsCount) {
    const roles = findRoles(parsed, index);
    const title = titleWordIn(parsed);
    const groups = findGroups(parsed, index);
    const matches = distinctPeople(members.filter((member) => (!roles.length || roles.includes(member.roleNorm)) && (!title || member.roleNorm.includes(title)) && (!groups.length || groups.includes(member.group))));
    if (!roles.length && !title && !groups.length) return answerWith(`That's ${plural(people.length, "person", "people")}.`, { ...shared, focus });
    const what = roles.length ? (matches.length === 1 ? roleTitle(index, roles[0]) : pluralTitle(roleTitle(index, roles[0]))) : title ? (matches.length === 1 ? title : `${title}s`) : `on the ${joinList(groups)}`;
    const article = (roles.length || title) && matches.length === 1 ? (/^[aeiou]/i.test(what) ? "an " : "a ") : "";
    const verb = members.every((member) => member.year < latestYear(index)) ? (matches.length === 1 ? "was" : "were") : (matches.length === 1 ? "is" : "are");
    const kept = members.filter((member) => matches.some((match) => match.nameNorm === member.nameNorm));
    return answerWith(`${matches.length} of the ${plural(people.length, "person", "people")} ${verb} ${article}${what}${matches.length ? ":" : "."}`, { ...shared, items: holderItems(index, kept, true), focus: focusOf(kept.length ? kept : members, roles.length ? roles : focus.roles, groups.length ? groups : focus.groups) });
  }

  // "Who was the first one?" / "and the current one?" while talking about a role.
  if (focus.roles?.length === 1 && parsed.tokens.length <= 7 && !findRoles(parsed, index).length && !/\b(?:before|after|replace|replaced|succeed|succeeded)\b/.test(parsed.text)) {
    const title = roleTitle(index, focus.roles[0]);
    if (parsed.has("first one", "the first", "first ever", "earliest", "earliest one", "original")) return peopleAnswer(parseQuestion(`who was the first ${title}`, index, now), index);
    if (parsed.has("current one", "latest one", "the current", "the latest", "most recent one", "newest", "now")) return peopleAnswer(parseQuestion(`who is the current ${title}`, index, now), index);
  }

  const asksRelation = /\b(?:replace|replaced|replacement|succeed|succeeded|successor|successors|predecessor|predecessors|before|after|took over|take over|came next|next one)\b/.test(parsed.text);
  if (asksRelation && focus.roles?.length && people.length > 1 && (pointsBack || parsed.tokens.length <= 8)) {
    const role = focus.roles[0];
    const inRole = members.filter((member) => member.roleNorm === role).sort(byTerm);
    const before = /\b(?:before|predecessor|predecessors|did\b.*\breplace)\b/.test(parsed.text);
    const pointsAtLatest = parsed.has("latest", "last one", "most recent", "current", "newest", "the last");
    const pointsAtFirst = parsed.has("first", "earliest", "first one", "oldest");
    const pivot = pointsAtLatest ? inRole.at(-1) : pointsAtFirst ? inRole[0] : parsed.ordinal !== null ? inRole[parsed.ordinal] : before ? inRole[0] : inRole.at(-1);
    if (pivot) return peopleAnswer(parseQuestion(`${before ? "who was right before" : "who replaced"} ${pivot.cleanName} as ${roleTitle(index, role)}`, index, now), index);
  }

  if (pointsBack && people.length > 1 && parsed.has("tell me about", "more about", "more on", "details", "info", "information", "who are they", "what do they do")) {
    return mergeAnswers(people.slice(0, 4).map((person) => route(parseQuestion(`tell me about ${person.cleanName}`, index, now), index, now)).filter(Boolean));
  }

  if (focus.groups?.length && parsed.has("lead", "leads", "runs", "run", "in charge", "head", "heads", "director", "directors") && (parsed.tokens.some((token) => ["it", "that", "this", "them", "they", "their"].includes(token)) || parsed.tokens.length <= 4)) {
    const year = members[0]?.year ?? latestYear(index);
    return peopleAnswer(parseQuestion(`who leads the ${focus.groups[0]} in ${year}`, index, now), index);
  }
  return null;
}

// "Their" for "there" ("how many VPs have their been?") would otherwise read as a pronoun.
function fixHomophones(text) {
  return text
    .replace(/\btheir\s+(?=(?:been|was|were|is|are|be|any|many|much)\b)/gi, "there ")
    .replace(/\bthere\s+(?=(?:names|name|roles|role|degrees|degree|years)\b)/gi, "their ");
}

// Keeps the previous question and applies only what this message changes.
function applyShift(shifted, base) {
  const baseYear = base.years[0];
  const relativeYear = baseYear && shifted.has("year before", "previous year", "the year prior") ? baseYear - 1 : baseYear && shifted.has("year after", "following year") ? baseYear + 1 : null;
  const otherSemester = base.semester && shifted.has("other semester", "other sem") ? 3 - base.semester : null;
  const isListing = shifted.has("which", "what are", "list", "show", "who");
  return {
    ...base,
    years: relativeYear ? [relativeYear] : shifted.years.length ? shifted.years : base.years,
    semester: otherSemester ?? shifted.semester ?? base.semester,
    month: shifted.month ?? base.month,
    range: shifted.range ?? base.range,
    weekday: shifted.weekday ?? base.weekday,
    weekend: shifted.weekend || base.weekend,
    time: shifted.time ?? (shifted.years.length || shifted.semester || relativeYear || otherSemester ? null : base.time),
    categories: shifted.categories.length ? shifted.categories : base.categories,
    topics: shifted.topics.length ? shifted.topics : base.topics,
    locations: shifted.locations.length ? shifted.locations : base.locations,
    wantsCount: shifted.wantsCount || (!isListing && base.wantsCount),
  };
}

function answerForDomain(domain, parsed, index, now) {
  if (domain === "events") return eventsAnswer(parsed, index, now);
  if (domain === "projects") return projectsAnswer(parsed, index);
  if (domain === "people") return peopleAnswer(parsed, index);
  return null;
}

function followUpAnswer(question, parsed, index, now, context) {
  const opened = question.replace(SHIFT_OPENING, "").replace(SOFT_OPENING, "");
  const stripped = opened.replace(SHIFT_CLOSING, "").replace(/[?.!\s]+$/, "").trim();
  const wasRephrased = stripped !== question.replace(/[?.!\s]+$/, "").trim();
  if (wasRephrased && !stripped) return null;

  if (context?.domain) {
    const aboutPeople = context.domain === "people" ? peopleFollowUp(question, parsed, index, now, context) : null;
    if (aboutPeople) return aboutPeople;

    const asksPerson = context.domain === "people" && context.people?.length;
    PERSON_PRONOUN.lastIndex = 0;
    if (asksPerson && PERSON_PRONOUN.test(question) && !findPeople(parsed, index).length) {
      if (context.people.length === 1) {
        const name = context.people[0];
        // "who replaced them?" after "who was VP in 2026?" keeps the role being discussed.
        const asksRelation = /\b(?:replace|replaced|succeed|succeeded|successor|predecessor|before|after|took over|take over)\b/i.test(question);
        const role = asksRelation && context.focus?.roles?.length && !findRoles(parsed, index).length ? ` as ${roleTitle(index, context.focus.roles[0])}` : "";
        return route(parseQuestion(`${question.replace(PERSON_PRONOUN, name).replace(/[?.!\s]+$/, "")}${role}`, index, now), index, now);
      }
      return answerWith("Which person do you mean?", { domain: "people", suggestions: context.people.slice(0, 4).map((name) => `Tell me about ${name}`) });
    }

    // "tell me about the second one", "what's the last project?", "the second person"
    const fromEnd = parsed.has("last one", "final one", "last project", "last event") && context.set?.length && parsed.tokens.length <= 8;
    if (fromEnd) return detailOfItem(context.set.at(-1), context.set);
    if (parsed.ordinal !== null && parsed.has("one", "item", "project", "event", "person") && !parsed.years.length && parsed.tokens.length <= 9) {
      if (context.domain === "people" && context.people?.[parsed.ordinal]) return route(parseQuestion(`tell me about ${context.people[parsed.ordinal]}`, index, now), index, now);
      if (context.set?.[parsed.ordinal]) return detailOfItem(context.set[parsed.ordinal], context.set);
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

    // "any projects on that?" after "what is a CNN?"
    const pointsBack = parsed.tokens.some((token) => ["it", "that", "this"].includes(token));
    if (pointsBack && parsed.has("project", "projects", "notebook", "notebooks", "example", "examples") && !parsed.topics.length && context.parsed?.topics?.length) {
      return projectsAnswer({ ...parsed, topics: context.parsed.topics, keywords: [] }, index);
    }

    // "which of those are in 2026?", or "those events" after talking about something else.
    if (parsed.refersToPrevious) {
      const named = parsed.has("event", "events") ? "events" : parsed.has("project", "projects") ? "projects" : context.domain;
      const base = context.byDomain?.[named]?.set;
      if (base?.length && named === "events") return eventsAnswer(parsed, index, now, base);
      if (base?.length && named === "projects") return projectsAnswer(parsed, index, base);
    }

    // "what about 2025?", "i mean 2026 sem 1", "how many in March?", "just the socials"
    if (context.parsed) {
      const shifted = parseQuestion(stripped || question, index, now);
      const changesFilter = shifted.years.length || shifted.semester || shifted.time || shifted.month !== null || shifted.range || shifted.weekday !== null || shifted.has("year before", "previous year", "year after", "following year", "other semester", "other sem");
      const changesSubject = (context.domain === "events" && shifted.categories.length) || (context.domain === "projects" && shifted.topics.length);
      // "how many?" counts whatever was just listed.
      const isBareCount = shifted.wantsCount && !changesFilter && !changesSubject && !shifted.keywords.length && !hasOwnSubject(shifted, index);
      if (isBareCount && context.set && ["events", "projects"].includes(context.domain)) {
        const noun = context.domain === "events" ? "event" : "project";
        return answerWith(context.set.length ? `That's ${plural(context.set.length, noun)}.` : `That's no ${noun}s.`, { domain: context.domain, set: context.set, sources: context.sources ?? [] });
      }
      const isOnlyThat = !shifted.keywords.length && !shifted.concepts.length && (changesFilter || changesSubject || shifted.wantsCount);
      const isPartOfLast = wasRephrased || parsed.tokens.length <= 3 || !hasOwnSubject(shifted, index);
      if (isOnlyThat && isPartOfLast) {
        const answer = answerForDomain(context.domain, applyShift(shifted, context.parsed), index, now);
        if (answer) return { ...answer, parsedOverride: applyShift(shifted, context.parsed) };
      }
    }
  }

  // "i mean the projects team": a new subject that still keeps the last question's shape.
  if (wasRephrased) {
    const inheritance = context?.parsed ? { wantsCount: context.parsed.wantsCount, years: context.parsed.years, semester: context.parsed.semester } : {};
    return route(parseQuestion(stripped, index, now, inheritance), index, now);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Conversation memory
// ---------------------------------------------------------------------------

function learnAboutUser(question, parsed, index, profile) {
  const learned = { ...profile, topics: [...(profile.topics ?? [])], interests: [...(profile.interests ?? [])] };
  const named = question.match(/\b(?:my name is|my name's|call me)\s+([a-z][a-z'-]+)/i) ?? (parsed.tokens.length <= 3 ? question.match(/^\s*(?:hi[,!\s]+)?(?:i am|i'm|im)\s+([A-Z][a-z'-]+)\s*[.!]?\s*$/) : null);
  if (named && !(index.vocabulary.has(normalize(named[1])) && !/my name|call me/i.test(question))) {
    learned.name = named[1][0].toUpperCase() + named[1].slice(1);
    learned.justNamed = true;
  }
  if (/\b(?:(?:i am|im|i m)\s+(?:really\s+|very\s+)?(?:interested in|into|keen on)|i\s+(?:really\s+)?(?:like|love|enjoy))\b/.test(parsed.text)) {
    const interests = parsed.keywords.filter((keyword) => SUBJECT_ALIASES[keyword] || index.projects.some((project) => projectMatches(project, keyword)));
    learned.topics = [...new Set([...learned.topics, ...parsed.topics])];
    learned.interests = [...new Set([...learned.interests, ...interests])];
    learned.justInterested = parsed.topics.length > 0 || interests.length > 0;
  }
  return learned;
}

// ── Double-checking ──
// "Are you sure?", "check again", "I think there were 5", "you forgot Iwan".
// The last real question is worked out again from scratch, from the same point in
// the conversation, and compared with what was said. The reply says what was
// checked and either confirms the answer or corrects it. Any number or person the
// message brings up is checked against the record too.
const CHALLENGE_PHRASES = ["are you sure", "you sure", "sure about that", "are you certain", "you certain", "is that right", "is that correct", "is that true", "is that accurate", "is it right", "is it correct", "that right", "really", "double check", "check again", "check that", "check it", "recheck", "re check", "verify", "confirm that", "can you confirm", "thats wrong", "that is wrong", "thats not right", "that is not right", "not right", "incorrect", "youre wrong", "you are wrong", "you re wrong", "wrong", "mistake", "i dont think so", "i do not think so", "that cant be right", "cant be right", "that doesnt sound right", "doesnt sound right", "doesnt seem right", "i think there", "i thought there", "i thought it was", "you missed", "you forgot", "you left out", "missing someone", "isnt it", "wasnt it", "arent there", "werent there"];
const STRONG_CHALLENGES = ["are you sure", "you sure", "sure about that", "are you certain", "double check", "check again", "recheck", "re check", "verify", "can you confirm", "thats wrong", "that is wrong", "thats not right", "youre wrong", "you are wrong", "you re wrong", "i dont think so", "that cant be right", "cant be right", "you missed", "you forgot", "you left out", "doesnt sound right", "doesnt seem right"];

function isChallenge(parsed) {
  if (parsed.has(...STRONG_CHALLENGES)) return true;
  // Weaker phrases ("really?", "what about…", "wrong") only count in a short reply.
  return parsed.tokens.length <= 6 && parsed.has(...CHALLENGE_PHRASES);
}

const answerSignature = (answer) => JSON.stringify((answer?.sections ?? [answer]).filter(Boolean).map((section) => [section.text, section.parts ?? [], (section.items ?? []).map((item) => [item.label, item.detail])]));
const firstCount = (answer) => Number((answer?.sections?.[0] ?? answer)?.text?.match(/\b(\d{1,3})\b/)?.[1] ?? (answer?.sections?.[0] ?? answer)?.parts?.join(" ").match(/\b(\d{1,3})\b/)?.[1] ?? NaN);

function howChecked(answer, index) {
  const domain = answer?.domain ?? answer?.sections?.at(-1)?.domain;
  const years = index.teams.map((team) => team.year).sort();
  if (domain === "people") return `I went back through every role on the ${joinList(years)} executive teams (${plural(index.members.length, "role record")}), including roles held for one semester.`;
  if (domain === "events") return `I went back through all ${plural(index.events.length, "event")} on record.`;
  if (domain === "projects") return `I went back through all ${plural(index.projects.length, "project")} in the archive.`;
  return "I worked it out again from AIML's published information.";
}

function verifyAnswer(question, parsed, index, now, memory) {
  const history = memory.history ?? [];
  const position = history.findLastIndex((turn) => !turn.answer?.verification && !isChallenge(parseQuestion(fixHomophones(turn.question), index, now)));
  const turn = history[position];
  if (!turn) return answerWith("There isn't an earlier answer for me to check yet.", { verification: true });
  if (!turn.answer) {
    return answerWith(`I couldn't work out “${turn.question}” from AIML's records, so that reply came from searching the site's pages. Try asking it a different way, or check the page it pointed to.`, { verification: true, restore: turn.snapshot });
  }

  // Work the question out again from the same point in the conversation.
  const before = history[position - 1]?.snapshot ?? {};
  const replayMemory = { profile: memory.profile ?? {}, byDomain: {}, ...before, history: history.slice(0, position) };
  const fresh = answerPart(turn.question, index, now, replayMemory).answer;
  const changed = fresh && answerSignature(fresh) !== answerSignature(turn.answer);
  const current = changed ? fresh : turn.answer;
  const checked = howChecked(current, index);
  const sources = current.sources ?? current.sections?.flatMap((section) => section.sources ?? []) ?? [];
  const shared = { verification: true, sources, restore: turn.snapshot, domain: current.domain };
  const body = current.sections ?? [current];

  // A person the message says was missed: "you forgot Iwan".
  const named = findPeople(parsed, index);
  const roles = turn.snapshot?.focus?.roles ?? [];
  if (named.length && roles.length) {
    const listed = new Set((turn.snapshot?.focus?.members ?? []).map((member) => member.nameNorm));
    const missed = named.filter((name) => !listed.has(name) && index.members.some((member) => member.nameNorm === name && roles.includes(member.roleNorm)));
    const check = personRoleAnswer({ ...parsed, text: "was", has: () => false }, index, named, roles, { sources });
    const intro = missed.length ? `You're right to check. ${joinList(missed.map((name) => index.members.find((member) => member.nameNorm === name).cleanName))} should have been included. Here's the full, corrected answer:` : `I checked ${joinList(named.map((name) => index.members.find((member) => member.nameNorm === name)?.cleanName ?? name))} against the record:`;
    return { ...answerWith(""), ...shared, sections: missed.length ? [answerWith(intro), ...(fresh.sections ?? [fresh])] : [answerWith(intro), check, answerWith(`So the answer to “${turn.question}” stands. ${checked}`)] };
  }

  // A number the message suggests instead: "I think there were 5".
  const claimed = parsed.text.match(/\b(\d{1,3})\b/)?.[1];
  const counted = firstCount(current);
  if (claimed && !Number.isNaN(counted) && Number(claimed) !== counted) {
    return { ...answerWith(""), ...shared, sections: [answerWith(`I double-checked, and the published record shows ${counted}, not ${claimed}. ${checked} Here is every one, so you can see what I counted:`), ...body, answerWith(current.domain === "people" || current.sections?.at(-1)?.domain === "people" ? "If someone is missing, they may not have been added to the site's team records yet." : "If something is missing, it may not have been added to the site yet.")] };
  }

  if (changed) {
    return { ...answerWith(""), ...shared, sections: [answerWith(`Good catch. I worked “${turn.question}” out again and got a different result, so here's the corrected answer. ${checked}`), ...body] };
  }
  const confirm = claimed && Number(claimed) === counted ? `Yes, it's ${counted}.` : "Yes.";
  return { ...answerWith(""), ...shared, sections: [answerWith(`${confirm} I worked “${turn.question}” out again from scratch and got the same answer. ${checked}`), ...body] };
}

// ── Recalling earlier parts of the conversation ──
// "What did I ask about vice presidents earlier?", "go back to the treasurers".
const RECALL_PATTERN = /\b(?:what (?:did|have|was it) (?:i|we|you) (?:ask|asked|say|said|talk|talked|discuss|discussed|mention|mentioned|tell|told)(?: me)?|what was (?:the|your) answer|what you said|what you told me|remind me|earlier you said|you said earlier|you mentioned|you told me)\b/;
const BACK_PATTERN = /^\s*(?:(?:ok(?:ay)?|so|right|now|and|anyway)[,\s]+)?(?:(?:let'?s|lets|can we|could we|please)\s+)?(?:go(?:ing)?\s+back\s+to|back\s+to|return\s+to|returning\s+to|revisit|circle\s+back\s+to)\s+(.+?)\s*[?.!]*$/i;
const RECALL_FILLER = new Set(["earlier", "before", "previously", "ago", "again", "question", "questions", "asked", "ask", "said", "say", "talk", "talked", "discuss", "discussed", "mention", "mentioned", "tell", "told", "answer", "answers", "remind", "conversation", "chat", "topic", "thing", "stuff", "bit", "part", "what", "did", "you", "we", "me", "i", "my", "your", "our", "the", "about", "on", "regarding"]);

const recallWords = (text) => tokensOf(roleText(normalize(text))).filter((token) => !STOP_WORDS.has(token) && !RECALL_FILLER.has(token)).map(stem);

function findEarlierTurn(history, words) {
  let best = null;
  let bestScore = 0;
  history.forEach((turn) => {
    const own = new Set(tokensOf(roleText(normalize(turn.question))).map(stem));
    const score = words.filter((word) => own.has(word)).length;
    if (score > 0 && score >= bestScore) { best = turn; bestScore = score; }
  });
  return best;
}

function recallAnswer(question, parsed, history) {
  const back = question.match(BACK_PATTERN);
  if (!back && !RECALL_PATTERN.test(parsed.text)) return null;
  const words = recallWords(back ? back[1] : parsed.text.replace(RECALL_PATTERN, " "));
  if (!words.length) return null;
  const turn = findEarlierTurn(history, words);
  if (!turn) return answerWith(`I can't find anything about ${back ? back[1].replace(/[?.!]+$/, "") : "that"} earlier in this chat.`, { suggestions: ["What have we talked about?"] });
  const prefix = back ? `Going back to “${turn.question}”:` : `Earlier you asked “${turn.question}”. I said:`;
  if (!turn.answer) return answerWith(`${prefix} I wasn't able to answer that one at the time.`, { restore: turn.snapshot });
  return { ...answerWith(""), sections: [answerWith(prefix), ...(turn.answer.sections ?? [turn.answer])], sources: turn.answer.sources ?? [], suggestions: turn.answer.suggestions ?? [], restore: turn.snapshot };
}

function memoryAnswer(question, parsed, index, now, memory) {
  const { history = [], profile = {} } = memory ?? {};
  const last = history.at(-1);

  if (parsed.has("forget everything", "forget this", "forget our", "forget that", "clear the chat", "clear chat", "clear our", "clear this", "start over", "start again", "new chat", "new conversation", "delete our")) {
    return answerWith("Done, I've forgotten this conversation.", { clearsMemory: true, suggestions: ["What's the next event?", "What can you do?"] });
  }
  const recalled = history.length ? recallAnswer(question, parsed, history) : null;
  if (recalled) return recalled;
  if (profile.justNamed) return answerWith(`Nice to meet you, ${profile.name}! I'll remember that until you leave the site.`, { suggestions: ["What's the next event?", "What can you do?"] });
  if (profile.justInterested) {
    const noted = recommendationAnswer({ ...parsed, topics: profile.topics, keywords: profile.interests }, index, now, true);
    return { ...noted, text: `I'll keep that in mind. ${noted.text}` };
  }

  if (parsed.has("what is my name", "whats my name", "what my name", "do you know my name", "who am i")) {
    return answerWith(profile.name ? `You told me your name is ${profile.name}.` : "You haven't told me your name yet.");
  }
  if (parsed.has("what do you know about me", "what do you remember", "do you remember", "can you remember", "do you have memory", "do you have a memory", "will you remember", "do you save", "is this saved", "are you saving", "do you store", "is this private")) {
    const known = [profile.name && `your name is ${profile.name}`, [...(profile.topics ?? []), ...(profile.interests ?? [])].length && `you're interested in ${joinList([...(profile.topics ?? []), ...(profile.interests ?? [])])}`, history.length && `we've covered ${plural(history.length, "question")} so far`].filter(Boolean);
    return answerWith(`I remember this conversation while you're on the site, including across pages. It stays in your browser, isn't sent anywhere, and is gone once you leave.${known.length ? ` So far I know ${joinList(known)}.` : ""}`);
  }
  if (parsed.has("what did i ask", "what did i just ask", "what did i say", "what was my question", "my last question", "my previous question", "my first question", "what have i asked", "what have we talked", "what have we discussed", "what did we talk", "what did we discuss", "summarise our", "summarize our", "summarise this", "summarize this", "recap")) {
    if (!history.length) return answerWith("We haven't talked about anything yet.");
    if (parsed.has("first question")) return answerWith(`Your first question was “${history[0].question}”`);
    if (parsed.has("last question", "previous question", "just ask", "what was my question")) return answerWith(`Your last question was “${last.question}”`);
    return answerWith(`We've covered ${plural(history.length, "question")}. The most recent:`, { items: history.slice(-LIST_LIMIT).map((turn) => ({ label: turn.question })) });
  }
  if (isChallenge(parsed)) return verifyAnswer(question, parsed, index, now, memory);
  if (!last) return null;
  if (parsed.has("repeat that", "say that again", "what did you say", "what did you just say", "your last answer", "your previous answer", "come again")) {
    return last.answer ?? answerWith("I wasn't able to answer that last one.");
  }
  if (parsed.tokens[0] === "why" && parsed.tokens.length <= 3) {
    return answerWith("The site doesn't give reasons for that, so I can only tell you what's published. The team would know more, and Discord is the best place to ask.", { items: [{ label: "Discord", url: index.kb.links.discord }] });
  }
  return null;
}

// When an answer didn't say what it was about, rebuild it from the names it mentioned.
function focusFromNames(names, parsed, index) {
  const wanted = new Set(names.map(normalize));
  const years = parsed.years?.length ? parsed.years : null;
  const records = index.members.filter((member) => wanted.has(member.nameNorm));
  const latest = new Map();
  records.forEach((member) => { if (!latest.has(member.nameNorm) || member.year > latest.get(member.nameNorm)) latest.set(member.nameNorm, member.year); });
  const members = records.filter((member) => (years ? years.includes(member.year) : member.year === latest.get(member.nameNorm)));
  return focusOf(members, findRoles(parsed, index), findGroups(parsed, index));
}

// Names mentioned in an answer, so that "they" and "the second one" can refer to them.
function peopleInAnswer(answer, index) {
  const sections = answer.sections ?? [answer];
  const text = ` ${normalize(sections.flatMap((section) => [section.text, ...(section.parts ?? []), ...(section.items ?? []).flatMap((item) => [item.label, item.detail])]).filter(Boolean).join(" | "))} `;
  return index.names
    .map((name) => ({ name, position: text.indexOf(` ${name} `) }))
    .filter(({ position }) => position >= 0)
    .sort((a, b) => a.position - b.position)
    .map(({ name }) => index.members.find((member) => member.nameNorm === name)?.cleanName ?? index.kb.coFounders.find((person) => normalize(person.name) === name)?.name ?? name);
}

function smallTalk(parsed) {
  const onlyTokens = (...words) => parsed.tokens.length > 0 && parsed.tokens.every((token) => words.includes(token));
  if (onlyTokens("hi", "hello", "hey", "there", "gday", "good", "morning", "afternoon", "evening", "yo")) {
    return answerWith("Hi! Ask me anything about AIML's events, projects, team, partners, or how to get involved.", { suggestions: ["What's the next event?", "Which project topic has the most work?", "Who is the president?"] });
  }
  if (parsed.has("thanks", "thank you", "cheers", "thx", "ty")) return answerWith("You're welcome!");
  if (parsed.has("how are you", "hows it going", "how is it going")) return answerWith("All good, thanks for asking! What would you like to know about AIML?");
  if (parsed.has("your name", "who are you", "what are you", "are you a bot", "are you real", "are you human", "are you an ai", "are you ai", "are you chatgpt", "are you gpt", "are you claude", "who made you", "who built you", "who created you", "how do you know", "how smart")) {
    return answerWith("I'm the AIML Assistant, a built-in helper for this website. I'm not a general AI chatbot: I work out answers from AIML's published information, and the short machine learning explanations are written into me.", { suggestions: ["What can you do?", "What's the next event?"] });
  }
  if (parsed.has("good bye", "goodbye", "bye", "see ya", "see you")) return answerWith("See you around!");
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

// Works out one question (or one part of a multi-part message) from the conversation so far.
function answerPart(rawPart, index, now, memory) {
  const part = fixHomophones(rawPart);
  let parsed = parseQuestion(part, index, now);
  const profile = learnAboutUser(part, parsed, index, memory.profile ?? {});
  const withProfile = { ...memory, profile };

  // Earlier interests answer "what should I try?" when this message doesn't name any.
  const wantsSuggestion = parsed.has("recommend", "suggest", "should i try", "should i start", "good first", "for me", "would i like", "would i enjoy");
  if (wantsSuggestion && !parsed.topics.length && !parsed.keywords.length && (profile.topics?.length || profile.interests?.length)) {
    parsed = { ...parsed, topics: profile.topics, keywords: profile.interests };
  }

  const answer = memoryAnswer(part, parsed, index, now, withProfile)
    ?? smallTalk(parsed)
    ?? followUpAnswer(part, parsed, index, now, withProfile)
    ?? route(parsed, index, now);
  return { answer, parsed, profile };
}

/**
 * Returns { answer, context }. `answer` is null when the data doesn't cover the
 * question. Pass the returned context back in and it carries the conversation:
 * earlier questions and answers, what they were about, and anything the person
 * has said about themselves. It lives only as long as the caller keeps it.
 */
export function answerQuestion(question, index, context = null, now = new Date()) {
  index.currentYear = now.getFullYear();
  let memory = context ?? { history: [], profile: {}, byDomain: {} };
  const answers = [];

  splitQuestion(question).forEach((rawPart) => {
    const part = fixHomophones(rawPart);
    const { answer, parsed, profile } = answerPart(rawPart, index, now, memory);
    memory = { ...memory, profile };
    answers.push(answer);

    const { justNamed, justInterested, ...settled } = memory.profile;
    memory = { ...memory, profile: settled };
    if (answer?.clearsMemory) {
      memory = { history: [], profile: {}, byDomain: {} };
    } else if (answer?.restore) {
      // Going back to an earlier topic: follow-ups now work on that topic again.
      memory = { ...memory, ...answer.restore };
    } else if (answer?.domain) {
      const remembered = answer.parsedOverride ?? parsed;
      const mentioned = answer.domain === "people" ? peopleInAnswer(answer, index) : [];
      const people = mentioned.length ? mentioned : memory.people;
      memory = {
        ...memory,
        domain: answer.domain,
        set: answer.set,
        parsed: remembered,
        sources: answer.sources,
        people,
        focus: answer.domain === "people" ? (answer.sections?.at(-1)?.focus ?? answer.focus ?? focusFromNames(mentioned, remembered, index)) : memory.focus,
        byDomain: { ...memory.byDomain, [answer.domain]: { set: answer.set } },
      };
    }
  });

  const useful = answers.filter(Boolean);
  const merged = useful.length ? mergeAnswers(useful) : null;
  // Each turn keeps a snapshot of what it was about, so the chat can go back to it.
  const snapshot = { domain: memory.domain, set: memory.set, parsed: memory.parsed, sources: memory.sources, people: memory.people, focus: memory.focus };
  if (!merged?.clearsMemory) memory = { ...memory, history: [...(memory.history ?? []), { question, answer: merged, snapshot }].slice(-40) };
  return { answer: merged, context: memory };
}
