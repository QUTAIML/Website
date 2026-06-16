// -----------------------------
// Helpers
// -----------------------------
function isTBCProject(p) {
  return p?.overview?.title?.toLowerCase() === "tbc";
}

function formatSemesterLabel(label) {
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

// -----------------------------
// Step 1: Load all project.json files
// -----------------------------
const rawProjectFiles = import.meta.glob(
  "/public/data/projects/*/*.json",
  { eager: true }
);

// -----------------------------
// Step 2: Map files into semesters
// -----------------------------
const semestersMap = {};

for (const [path, mod] of Object.entries(rawProjectFiles)) {
  const semesterId = path.split("/").at(-2);

  if (!semestersMap[semesterId]) {
    semestersMap[semesterId] = [];
  }

  semestersMap[semesterId].push(mod.default);
}

// -----------------------------
// Step 3: Flatten semesters and add image paths
// -----------------------------
const semesters = Object.entries(semestersMap).map(([id, projects]) => ({
  id,
  label: formatSemesterLabel(id.replace(/-/g, " ")),
  projects: projects.map((p) => ({
    ...p,
    semesterId: id,
    image: p.image
      ? `/data/projects/${id}/images/${p.image}`
      : null,
  })),
}));

// -----------------------------
// Step 4: Sort semesters newest first
// -----------------------------
const sortedSemesters = [...semesters].sort((a, b) => {
  const [, aNum, aYear] = a.id.split("-");
  const [, bNum, bYear] = b.id.split("-");

  const yearDiff = parseInt(bYear) - parseInt(aYear);
  if (yearDiff !== 0) return yearDiff;

  return parseInt(bNum) - parseInt(aNum);
});

const latestSemester = sortedSemesters[0] ?? null;
const latestProjectsRaw = latestSemester?.projects ?? [];

// -----------------------------
// Step 5: Determine if latest semester is TBC
// -----------------------------
const latestIsTBC =
  latestProjectsRaw.length === 0 ||
  latestProjectsRaw.every(isTBCProject);

// -----------------------------
// Step 6: Current projects
// -----------------------------
const currentProjects = latestIsTBC
  ? []
  : latestProjectsRaw.map((p) => ({
      ...p,
      semesterId: latestSemester.id,
    }));

// -----------------------------
// Step 7: Past projects
// -----------------------------
const pastProjects = sortedSemesters
  .filter((s) => s.id !== latestSemester?.id || latestIsTBC)
  .flatMap((s) =>
    (s.projects ?? [])
      .filter((p) => !isTBCProject(p))
      .map((p) => ({
        ...p,
        semesterId: s.id,
      }))
  );

// -----------------------------
// Step 8: Build filter types
// -----------------------------
const preferred = ["CNN", "Linear Regression"];
const allTypesSet = new Set();

pastProjects.forEach((p) => {
  const t = (p.type ?? p.category ?? "Other")?.toString() ?? "Other";
  allTypesSet.add(t);
});

let types = ["All"];

if (allTypesSet.size > 1) {
  const preferredExisting = preferred.filter((p) =>
    allTypesSet.has(p)
  );

  const remaining = Array.from(allTypesSet)
    .filter((t) => !preferredExisting.includes(t))
    .sort((a, b) => a.localeCompare(b));

  types = ["All", ...preferredExisting, ...remaining];
}

export {
  semesters,
  sortedSemesters,
  latestSemester,
  currentProjects,
  pastProjects,
  types,
};