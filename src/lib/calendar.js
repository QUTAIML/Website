// Calendar exports for events: .ics files (Apple, Outlook and anything else)
// and Google Calendar links. Used by /events.ics, the per-event .ics files and
// the "Add to calendar" buttons on the Events page.
//
// All AIML events are in Brisbane, which is UTC+10 all year (no daylight saving),
// so local times convert to UTC with a fixed offset.

export const SITE_URL = "https://qutaiml.org";
export const FEED_PATH = "/events.ics";
export const TIMEZONE = "Australia/Brisbane";
const UTC_OFFSET_HOURS = 10;
const DEFAULT_LENGTH_HOURS = 2;

const pad = n => String(n).padStart(2, "0");

/**
 * Reads a free-text time such as "5:30 PM to 7:30 PM", "6 PM to 9 PM" or
 * "Doors 5:45 PM. Movie 6:10 PM to 8:45 PM". The first time is the start and the
 * last is the end. Returns null when there is no time, so the event is all-day.
 */
export function parseTimes(text = "") {
  const times = [...text.matchAll(/(\d{1,2})(?::(\d{2}))?\s*([AP])\.?M\.?/gi)].map(([, h, m = "0", ap]) => {
    let hours = Number(h) % 12;
    if (ap.toUpperCase() === "P") hours += 12;
    return { hours, minutes: Number(m) };
  });
  if (!times.length) return null;
  const start = times[0];
  const end = times.length > 1 ? times.at(-1) : { hours: start.hours + DEFAULT_LENGTH_HOURS, minutes: start.minutes };
  return { start, end };
}

/** "2026-07-21" + { hours, minutes } → a Date at that Brisbane time. */
function brisbaneDate(date, { hours, minutes }) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hours - UTC_OFFSET_HOURS, minutes));
}

const compactDate = date => date.replaceAll("-", "");
const utcStamp = date => `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
const localStamp = date => {
  const local = new Date(date.getTime() + UTC_OFFSET_HOURS * 3600e3);
  return utcStamp(local).slice(0, -1);
};

/** The day after "YYYY-MM-DD", as YYYYMMDD. Calendar all-day ends are exclusive. */
function dayAfter(date) {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`;
}

/** Start and end of an event, either timed (Dates) or all-day (YYYYMMDD strings). */
export function eventSpan(ev) {
  const endDate = ev.endDate || ev.date;
  const times = parseTimes(ev.time);
  if (!times) return { allDay: true, start: compactDate(ev.date), end: dayAfter(endDate) };
  return { allDay: false, start: brisbaneDate(ev.date, times.start), end: brisbaneDate(endDate, times.end) };
}

const eventUrl = ev => ev.rubric || `${SITE_URL}/events`;
const describe = ev => [ev.excerpt, ev.rubric ? `Register: ${ev.rubric}` : "", `${SITE_URL}/events`].filter(Boolean).join("\n\n");

/** A one-click Google Calendar link that opens the event ready to save. */
export function googleCalendarUrl(ev) {
  const span = eventSpan(ev);
  const dates = span.allDay ? `${span.start}/${span.end}` : `${localStamp(span.start)}/${localStamp(span.end)}`;
  const params = new URLSearchParams({ action: "TEMPLATE", text: ev.title, dates, details: describe(ev), location: ev.location ?? "", ctz: TIMEZONE });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Where each event's own .ics file lives. */
export const icsPath = ev => `/events/calendar/${ev.id}.ics`;

// --- .ics (RFC 5545) ----------------------------------------------------------

const escapeText = text => String(text ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lines longer than 75 characters are folded onto continuation lines that start with a space.
function fold(line) {
  const parts = [];
  for (let i = 0; i < line.length; i += 73) parts.push((i ? " " : "") + line.slice(i, i + 73));
  return parts.join("\r\n");
}

function vevent(ev, stamp) {
  const span = eventSpan(ev);
  return [
    "BEGIN:VEVENT",
    `UID:${ev.id}@qutaiml.org`,
    `DTSTAMP:${stamp}`,
    span.allDay ? `DTSTART;VALUE=DATE:${span.start}` : `DTSTART:${utcStamp(span.start)}`,
    span.allDay ? `DTEND;VALUE=DATE:${span.end}` : `DTEND:${utcStamp(span.end)}`,
    `SUMMARY:${escapeText(ev.title)}`,
    `DESCRIPTION:${escapeText(describe(ev))}`,
    ev.location ? `LOCATION:${escapeText(ev.location)}` : null,
    `URL:${eventUrl(ev)}`,
    ev.category ? `CATEGORIES:${escapeText(ev.category)}` : null,
    "END:VEVENT",
  ].filter(Boolean);
}

/** A whole calendar file holding the given events. */
export function buildIcs(events, { name = "QUT AIML Events" } = {}) {
  const stamp = utcStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//QUT AI & ML Society//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-TIMEZONE:${TIMEZONE}`,
    "X-PUBLISHED-TTL:PT12H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    ...events.flatMap(ev => vevent(ev, stamp)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export const icsResponse = body => new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8" } });

// --- Subscribing to the whole feed -------------------------------------------

const feedHttps = `${SITE_URL}${FEED_PATH}`;
const feedWebcal = feedHttps.replace(/^https:/, "webcal:");

export const subscribeLinks = {
  feed: feedHttps,
  apple: feedWebcal,
  google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedWebcal)}`,
  outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedHttps)}&name=${encodeURIComponent("QUT AIML Events")}`,
};
