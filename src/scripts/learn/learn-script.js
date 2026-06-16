const searchInput = document.getElementById("learning-search");
const grid = document.getElementById("learning-grid");

const sortDropdown = document.getElementById("sort-select-pop");
const filtersToggle = document.getElementById("filters-toggle");
const filtersPopover = document.getElementById("filters-popover");

let paginationContainer =
  document.getElementById("learning-pagination");

if (!paginationContainer) {
  paginationContainer = document.createElement("div");
  paginationContainer.id = "learning-pagination";
  paginationContainer.style.textAlign = "center";
  paginationContainer.style.marginTop = "2rem";

  grid.parentNode.appendChild(paginationContainer);
}

const DESKTOP_LEARNINGS_PER_PAGE = 6;
const MOBILE_LEARNINGS_PER_PAGE = 3;

let currentPage = 1;
let filteredCards = [];
let categoryButtons = [];

function getLearningsPerPage() {
  return window.innerWidth <= 768
    ? MOBILE_LEARNINGS_PER_PAGE
    : DESKTOP_LEARNINGS_PER_PAGE;
}

const allCards = Array.from(
  grid.querySelectorAll(".learn-card")
).map(card => ({
  apiData: {
    title: card.dataset.title,
    category: card.dataset.category,
    date: card.dataset.date,
    slug: card.dataset.slug,
    img: card.querySelector("img")?.src || null,
    description:
      card.querySelector("p")?.textContent || "",
  },
}));

const allCategoriesSet = new Set(
  allCards.map(c => c.apiData.category || "Other")
);

const allCategories = [
  "All",
  ...Array.from(allCategoriesSet).sort(),
];

function renderCategoryButtons(
  activeCategory = "All"
) {
  const container =
    document.getElementById("type-filters");

  container.innerHTML = "";

  allCategories.forEach(c => {
    const btn = document.createElement("button");

    btn.type = "button";
    btn.dataset.category = c;
    btn.textContent = c;

    btn.className =
      `type-btn ${c === activeCategory ? "active" : ""}`;

    btn.addEventListener("click", () => {
      categoryButtons.forEach(b =>
        b.classList.remove("active")
      );

      btn.classList.add("active");

      currentPage = 1;
      applyFilters();
    });

    container.appendChild(btn);
  });

  categoryButtons = Array.from(
    container.querySelectorAll(".type-btn")
  );
}

function applyFilters() {
  const query =
    searchInput.value.trim().toLowerCase();

  const activeBtn = categoryButtons.find(b =>
    b.classList.contains("active")
  );

  const selectedCategory =
    activeBtn?.dataset.category ?? "All";

  filteredCards = allCards.filter(c => {
    const {
      title,
      description,
      category,
    } = c.apiData;

    const matchesQuery =
      !query ||
      title.toLowerCase().includes(query) ||
      description.toLowerCase().includes(query);

    const matchesCategory =
      selectedCategory === "All" ||
      category === selectedCategory;

    return matchesQuery && matchesCategory;
  });

  applySort();

  currentPage = 1;

  renderPage();
  renderPagination();
  renderNoResults();
}

function applySort() {
  const sortOption = sortDropdown.value;

  filteredCards.sort((a, b) => {
    const aData = a.apiData;
    const bData = b.apiData;

    switch (sortOption) {
      case "title-asc":
        return aData.title.localeCompare(
          bData.title
        );

      case "title-desc":
        return bData.title.localeCompare(
          aData.title
        );

      case "date-asc":
        return (
          new Date(aData.date) -
          new Date(bData.date)
        );

      case "date-desc":
        return (
          new Date(bData.date) -
          new Date(aData.date)
        );

      default:
        return 0;
    }
  });
}

function renderPage(scrollToTop = false) {
  const LEARNINGS_PER_PAGE =
    getLearningsPerPage();

  const start =
    (currentPage - 1) * LEARNINGS_PER_PAGE;

  const end = start + LEARNINGS_PER_PAGE;

  const cardsToShow =
    filteredCards.slice(start, end);

  grid.innerHTML = cardsToShow
    .map(c => {
      const {
        title,
        category,
        date,
        slug,
        img,
        description,
      } = c.apiData;

      const formattedDate =
        new Date(date).toLocaleDateString(
          "en-GB",
          {
            weekday: "long",
            day: "numeric",
            month: "short",
            year: "numeric",
          }
        );

      return `
        <article class="learn-card"
          data-category="${category}"
          data-title="${title.toLowerCase()}"
          data-date="${date}"
          data-slug="${slug}">
          <a href="/learn/${slug}">
            <div class="card-media">
              ${
                img
                  ? `<img src="${img}" alt="${title}" />`
                  : '<div class="no-image">No image</div>'
              }
            </div>
            <div class="card-body">
              <h3 class="card-title">${title}</h3>
              <div class="card-divider"></div>
              <time class="card-date">${formattedDate}</time>
              <p class="card-description">${description}</p>
              <div class="card-footer">
                <span class="card-view-more">
                  View more →
                </span>
              </div>
            </div>
          </a>
        </article>
      `;
    })
    .join("");

  if (scrollToTop) {
    const scrollAmount =
      window.innerWidth <= 768
        ? 1300
        : 900;

    window.scrollBy({
      top: -scrollAmount,
      behavior: "smooth",
    });
  }
}

function renderPagination() {
  const LEARNINGS_PER_PAGE =
    getLearningsPerPage();

  const totalPages = Math.ceil(
    filteredCards.length /
      LEARNINGS_PER_PAGE
  );

  if (totalPages <= 1) {
    paginationContainer.innerHTML = "";
    return;
  }

  let html =
    `<button class="pagination-btn" data-page="${currentPage - 1}" ${
      currentPage === 1 ? "disabled" : ""
    }>Prev</button>`;

  for (let i = 1; i <= totalPages; i++) {
    html += `
      <button
        class="pagination-btn ${
          i === currentPage ? "active" : ""
        }"
        data-page="${i}">
        ${i}
      </button>
    `;
  }

  html +=
    `<button class="pagination-btn" data-page="${currentPage + 1}" ${
      currentPage === totalPages
        ? "disabled"
        : ""
    }>Next</button>`;

  paginationContainer.innerHTML = html;

  paginationContainer
    .querySelectorAll(".pagination-btn")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        const page = parseInt(
          btn.dataset.page
        );

        if (isNaN(page)) return;

        currentPage = Math.min(
          Math.max(page, 1),
          totalPages
        );

        renderPage(true);
        renderPagination();
      });
    });
}

function renderNoResults() {
  let msg = document.getElementById(
    "no-learning-message"
  );

  if (!msg) {
    msg = document.createElement("div");

    msg.id = "no-learning-message";
    msg.textContent = "No learnings found";

    msg.style.textAlign = "center";
    msg.style.padding = "2rem";
    msg.style.gridColumn = "1 / -1";

    grid.appendChild(msg);
  }

  msg.style.display =
    filteredCards.length === 0
      ? "block"
      : "none";
}

searchInput.addEventListener(
  "input",
  applyFilters
);

sortDropdown.addEventListener(
  "change",
  applyFilters
);

filtersToggle.addEventListener(
  "click",
  e => {
    e.stopPropagation();

    filtersPopover.style.display =
      filtersPopover.style.display === "block"
        ? "none"
        : "block";
  }
);

window.addEventListener("resize", () => {
  currentPage = 1;

  renderPage();
  renderPagination();
});

renderCategoryButtons();
applyFilters();