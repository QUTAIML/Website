// --- Load all event JSON files dynamically (exclude images folder)
const eventFiles = import.meta.glob("/public/data/events/*/*.json", { eager: true });

// --- Map events and attach slug + image
const eventsBySemester = Object.entries(eventFiles).map(([path, mod]) => {
  const event = mod.default;

  const semesterId = path.split("/").at(-2);

  const image = event.image
    ? `/data/events/${semesterId}/images/${event.image}`
    : null;

  const slug = event.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

  return {
    ...event,
    semesterId,
    image,
    slug,
    dateLabel: new Date(event.date).toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    url: `/events/${semesterId}/${slug}`,
  };
});

// --- Filter upcoming events
const today = new Date();
today.setHours(0, 0, 0, 0);

const upcomingEvents = eventsBySemester
  .filter(ev => {
    const [year, month, day] = ev.date.split("-").map(Number);

    const eventDate = new Date(year, month - 1, day);
    eventDate.setHours(0, 0, 0, 0);

    return eventDate >= today;
  })
  .sort((a, b) => {
    const [ay, am, ad] = a.date.split("-").map(Number);
    const [by, bm, bd] = b.date.split("-").map(Number);

    return (
      new Date(ay, am - 1, ad) -
      new Date(by, bm - 1, bd)
    );
  })
  .slice(0, 3);

export { upcomingEvents };