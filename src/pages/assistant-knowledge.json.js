// Published data the Ask AIML assistant computes answers from. Only include what
// the site already shows: event attendance and notes are internal and stay out.
import { coFounders, degrees, faq, getProjectSemesters, getTeams, links, partners, semesterLabel, site } from "@/lib/content";
import { loadEventsData } from "@/scripts/events/events-loader";

export async function GET() {
  const { eventsBySemester } = await loadEventsData();
  const semesters = await getProjectSemesters();
  const teams = await getTeams();

  return new Response(JSON.stringify({
    events: eventsBySemester.map((event) => ({
      title: event.title,
      date: event.date,
      endDate: event.endDate ?? null,
      time: event.time ?? "",
      location: event.location ?? "",
      category: event.category ?? "Other",
      excerpt: event.excerpt ?? "",
      collab: Boolean(event.isCollab),
      rubric: event.rubric || null,
      semester: event.semesterId,
      semesterLabel: semesterLabel(event.semesterId),
    })),
    projects: semesters.flatMap((semester) => semester.projects.map((project) => ({
      title: project.title,
      topic: project.type ?? project.category ?? "Other",
      excerpt: project.excerpt ?? "",
      github: project.github,
      semester: project.semesterId,
    }))),
    teams: teams.map((team) => ({
      year: team.year,
      groups: team.groups.map((group) => ({
        title: group.title,
        // Everyone on the published record, including people who held a role for one
        // semester ("(S1)"/"(S2)"). showOnAbout only hides someone from the current
        // team's photo cards; the history page still lists them, so the assistant does too.
        members: group.items
          .map(({ role, name, linkedin, degree }) => ({ role, name, linkedin: linkedin ?? null, degree: degree ?? null })),
      })),
    })),
    partners: partners.map(({ name, tier, url, tag, description }) => ({ name, tier, url, tag, description })),
    faq,
    degrees,
    coFounders,
    links,
    stats: site.stats,
    hackathons: site.hackathons,
    nextHackathon: site.nextHackathon,
  }), { headers: { "Content-Type": "application/json" } });
}
