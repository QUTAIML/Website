export function loadAboutData() {
  // =========================
  // TEAM DATA
  // =========================

  const teamFiles = import.meta.glob(
    "/public/data/about/*/team-details.json",
    { eager: true }
  );

  const teamFileYears = Object.keys(teamFiles)
    .map(path => {
      const folderName = path.split("/").at(-2);

      return {
        path,
        year: parseInt(folderName),
        valid: /^\d{4}$/.test(folderName),
      };
    })
    .filter(f => f.valid);

  const latestTeamFile = teamFileYears
    .sort((a, b) => b.year - a.year)[0];

  if (!latestTeamFile) {
    throw new Error("No valid year found in about data");
  }

  const latestTeamData =
    teamFiles[latestTeamFile.path].default;

  const teamsForClient = latestTeamData.map(section => ({
    ...section,
    items: section.items.map(member => ({
      ...member,
      image: member.image
        ? `/data/about/${latestTeamFile.year}/exec-photos/${member.image}`
        : null,
    })),
  }));

  // =========================
  // DEGREE DATA
  // =========================

  const degreeFiles = import.meta.glob(
    "/public/data/about/degrees.json",
    { eager: true }
  );

  const degreeData =
    degreeFiles["/public/data/about/degrees.json"].default;

  const degreesForClient = degreeData.map(section => ({
    ...section,
    items: section.items.map(item => ({
      ...item,
      image: null,
    })),
  }));

  return {
    teamsForClient,
    degreesForClient,
    currentYear: latestTeamFile.year,
  };
}