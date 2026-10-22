# Website content: start here

Everything you'd normally want to change on the website is in this folder:
events, projects, the team, partners, links, FAQ, and all photos.
You don't need to touch any code.

```
content/
├── site.json            Social/membership links + sponsors & supporters
├── faq.json             FAQ page questions
├── degrees.json         Degrees listed on the About page
├── co-founders.json     Co-founders on the History page
│
├── events/
│   └── 2026-sem-1/      events.json  + the photos it uses
├── projects/
│   └── 2025-sem-2/      projects.json + the images it uses
├── team/
│   └── 2027/            team.json + headshots + team-photo.jpg
│
└── images/              Every other picture on the site (logos, page banners,
                         hackathon photos, partner logos)
```

**The one rule:** a JSON file only refers to images **in its own folder**, by
filename. For example, `"image": "trivia.jpg"` in `events/2026-sem-1/events.json`
means `events/2026-sem-1/trivia.jpg`. Partner logos in `site.json` refer to files
in `images/`.

Images are resized and compressed automatically when the site is built, so you
can drop in full-size photos straight from a phone.

---

## Add or edit an event

Open `events/<semester>/events.json` and copy an existing entry. Events can be in
any order; the site sorts them by date.

```json
{
  "title": "Trivia Night",
  "date": "2026-08-12",
  "time": "5:30 PM to 7:30 PM",
  "location": "QUT GP-D108",
  "category": "Social Event",
  "excerpt": "One or two sentences shown on the event card.",
  "image": "trivia.jpg",
  "rubric": "https://campus.hellorubric.com/?eid=...",
  "featured": false,
  "isCollab": false
}
```

- **Required:** `title`, `date` (`YYYY-MM-DD`), `category`. Everything else is optional.
- `category` becomes the filter on the Events page. Reuse an existing one:
  `Social Event`, `Project Night`, `Industry Event`, `Flagship Event`, `Meeting`, `Other`.
- `"featured": true` pins an upcoming event to the top of the Events page.
- `rubric` makes the card link to the sign-up page.
- Fields like `attendance`, `week`, `notes` and `confirmed` are for the club's own records.
  They aren't shown on the site.

**New semester:** create a folder named `YYYY-sem-N` (e.g. `2027-sem-1`) containing
an `events.json` that starts as `[]`.

## Add or edit a project

Same idea: `projects/<semester>/projects.json`.

```json
{
  "title": "Penguin Species",
  "category": "Clustering",
  "excerpt": "One or two sentences shown on the project card.",
  "image": "penguin-species.jpg",
  "github": "https://github.com/QUTAIML/..."
}
```

For a new semester whose projects aren't announced yet, create the folder with
`projects.json` containing just `[]`. The site will show "coming soon".

## New executive team (each year)

1. Copy last year's folder, e.g. `team/2027` → `team/2028`.
2. Edit `team.json`: names, roles, LinkedIn links, groups.
3. Replace the headshots, and the group photo as `team-photo.jpg` (or `.png`).
4. Delete any headshots you no longer need.

The newest year automatically becomes "Meet the team" on the About page. Every
year appears on the History page.

- `"image": ""` shows the default silhouette (`images/team-placeholder.png`).
- `"showOnAbout": false` keeps a person on the History page but hides them from About.

## Sponsors, supporters and links: `site.json`

- `links`: Discord, Instagram, LinkedIn, GitHub and the membership sign-up link.
  These are used on every page, so change them here once.
- `partners`: each has a `tier` of `"sponsor"` (big spotlight card) or `"supporter"`.
  Put the logo in `images/` and set `"logo"` to its filename. Partners appear on both
  the home page and the Partners page, in the order listed.

## Page photos

Banner and feature photos on specific pages live in `images/`. They're
referenced in the page files under `src/pages/` as `image("images/<name>")`. To
swap a photo, replace the file and keep the same name.

---

## Check before you push

```bash
npm run check
```

This reports JSON typos, missing required fields, wrong date formats, and any image
that's named but doesn't exist, with the file and entry at fault. It also lists
images nothing uses. The same check runs automatically on every deploy, so a
mistake stops the deploy instead of breaking the live site.

To preview locally: `npm install` once, then `npm run dev` and open the URL it prints.

**Gotchas**
- Filenames are case-sensitive on the live site: `Photo.JPG` is not `photo.jpg`.
- JSON needs double quotes, and there's no comma after the last item in a list.
