import { getTeams, degrees } from "@/lib/content";

export async function loadAboutData() {
  const latest = (await getTeams())[0];
  if (!latest) throw new Error("No team folders found in content/team/");

  const teamsForClient = latest.groups.map(section => ({
    ...section,
    items: section.items
      .filter(member => member.showOnAbout !== false)
      .map(member => ({
        ...member,
        // Semester markers stay in the historical record, but are not part of
        // the current-team display name.
        name: member.name.replace(/\s*\(S\d+\)$/, ""),
      })),
  }));

  const degreesForClient = degrees.map(section => ({
    ...section,
    items: section.items.map(item => ({ ...item, image: null })),
  }));

  return {
    teamsForClient,
    degreesForClient,
    currentYear: latest.year,
  };
}
