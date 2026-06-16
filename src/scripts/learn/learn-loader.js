// -----------------------------
// Import all learn JSON files
// -----------------------------
const rawLearnFiles = import.meta.glob(
  "/public/data/learn/data/*.json",
  { eager: true }
);

// -----------------------------
// Flatten files
// -----------------------------
let learnings = Object.values(rawLearnFiles)
  .map(mod => mod.default)
  .flat();

// -----------------------------
// Generate slugs + image paths
// -----------------------------
learnings = learnings.map(ev => {
  const title = ev.title ?? ev.slug ?? "untitled";

  const slug = title
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  const image = ev.image
    ? `/data/learn/data/images/${ev.image}`
    : null;

  return {
    ...ev,
    slug,
    image,
    dateLabel: ev.date
      ? new Date(ev.date).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "",
  };
});

// -----------------------------
// Categories
// -----------------------------
const allCategoriesSet = new Set();

learnings.forEach(ev => {
  allCategoriesSet.add(ev.category ?? "Other");
});

const categories = [
  "All",
  ...Array.from(allCategoriesSet).sort(),
];

// -----------------------------
// Featured
// -----------------------------
const featuredLearnings = learnings.filter(
  ev => ev.featured === true
);

// -----------------------------
// Date helper
// -----------------------------
function formatDate(dateStr) {
  if (!dateStr) return "";

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr));
}

export {
  learnings,
  categories,
  featuredLearnings,
  formatDate,
};