import { getEvents, getEventSemesters, parseDate } from "@/lib/content";

// Filter chips appear in this order; any other categories follow alphabetically.
const PREFERRED_TYPES = ["Social Event", "Project Night", "Industry Event", "Flagship Event"];

export async function loadEventsData() {
  const eventsBySemester = await getEvents();
  const semesters = getEventSemesters();

  const allTypes = new Set(eventsBySemester.map(ev => String(ev.type ?? ev.category ?? "Other")));
  const preferredExisting = PREFERRED_TYPES.filter(t => allTypes.has(t));
  const remaining = [...allTypes].filter(t => !preferredExisting.includes(t)).sort((a, b) => a.localeCompare(b));
  const types = ["All", ...preferredExisting, ...remaining];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const featuredEvents = eventsBySemester.filter(ev => ev.featured === true && parseDate(ev.date) >= today);

  return { semesters, eventsBySemester, types, featuredEvents };
}
