import { getProjectSemesters } from "@/lib/content";

const PREFERRED_TYPES = ["CNN", "Linear Regression"];

export async function loadProjectsData() {
  const sortedSemesters = await getProjectSemesters();
  const latestSemester = sortedSemesters[0] ?? null;

  // An empty projects.json for the newest semester means "not announced yet",
  // so everything is shown as past work.
  const latestIsEmpty = !latestSemester?.projects.length;
  const currentProjects = latestIsEmpty ? [] : latestSemester.projects;
  const pastProjects = sortedSemesters
    .filter(s => s !== latestSemester || latestIsEmpty)
    .flatMap(s => s.projects);

  const allTypes = new Set(pastProjects.map(p => String(p.type ?? p.category ?? "Other")));
  let types = ["All"];
  if (allTypes.size > 1) {
    const preferredExisting = PREFERRED_TYPES.filter(t => allTypes.has(t));
    const remaining = [...allTypes].filter(t => !preferredExisting.includes(t)).sort((a, b) => a.localeCompare(b));
    types = ["All", ...preferredExisting, ...remaining];
  }

  return { semesters: sortedSemesters, sortedSemesters, latestSemester, currentProjects, pastProjects, types };
}
