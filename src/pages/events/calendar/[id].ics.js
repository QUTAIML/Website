// One .ics file per event, for the "Apple / Outlook" add-to-calendar button.
import { getEvents } from "@/lib/content";
import { buildIcs, icsResponse } from "@/lib/calendar";

export async function getStaticPaths() {
  return (await getEvents()).map(ev => ({ params: { id: ev.id }, props: { ev } }));
}

export function GET({ props }) {
  return icsResponse(buildIcs([props.ev], { name: props.ev.title }));
}
