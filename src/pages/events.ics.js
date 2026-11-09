// The subscribable feed of every AIML event: https://qutaiml.org/events.ics
import { getEvents } from "@/lib/content";
import { buildIcs, icsResponse } from "@/lib/calendar";

export async function GET() {
  return icsResponse(buildIcs(await getEvents()));
}
