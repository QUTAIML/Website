// src/loaders/events-loader.js

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function loadEventsData() {
  const rawEventFiles = import.meta.glob(
    "/public/data/events/*/*.json",
    { eager: true }
  );

  const semestersMap = {};

  for (const [path, mod] of Object.entries(rawEventFiles)) {
    const segments = path.split("/");
    const folder = segments.at(-2);

    if (!semestersMap[folder]) semestersMap[folder] = [];

    const data = mod.default;

    if (Array.isArray(data)) {
      semestersMap[folder].push(...data);
    } else if (data && typeof data === "object") {
      semestersMap[folder].push(data);
    }
  }

  const semesters = Object.entries(semestersMap).map(([id, events]) => ({
    id,
    label: id
      .replace(/-/g, " ")
      .replace(/^sem/i, "Sem")
      .replace(/\b(\d)\b/g, " $1"),

    events: events.map((ev, index) => ({
      ...ev,
      id: ev.id ?? `${id}-${index}`,
      slug: slugify(ev.title),

      dateLabel: new Date(ev.date).toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),

      image: ev.image
        ? `/data/events/${id}/images/${ev.image}`
        : null,
    })),
  }));

  const eventsBySemester = semesters
    .map(s =>
      s.events.map(ev => ({
        ...ev,
        semesterId: s.id,
      }))
    )
    .flat()
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      dateA.setHours(0, 0, 0, 0);
      dateB.setHours(0, 0, 0, 0);

      return dateA - dateB;
    });

  const preferred = [
    "Social",
    "Industry",
    "Projects",
    "Major",
  ];

  const allTypesSet = new Set();

  eventsBySemester.forEach(ev => {
    const t = (ev.type ?? ev.category ?? "Other").toString();

    if (t) allTypesSet.add(t);
  });

  const preferredExisting = preferred.filter(p =>
    allTypesSet.has(p)
  );

  const remaining = [...allTypesSet]
    .filter(t => !preferredExisting.includes(t))
    .sort((a, b) => a.localeCompare(b));

  const types = [
    "All",
    ...preferredExisting,
    ...remaining,
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const featuredEvents = eventsBySemester
    .filter(ev => ev.featured === true)
    .filter(ev => {
      const eventDate = new Date(ev.date);

      eventDate.setHours(0, 0, 0, 0);

      return eventDate >= today;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      dateA.setHours(0, 0, 0, 0);
      dateB.setHours(0, 0, 0, 0);

      return dateA - dateB;
    });

  return {
    semesters,
    eventsBySemester,
    types,
    featuredEvents,
  };
}