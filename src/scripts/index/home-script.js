document.addEventListener("DOMContentLoaded", () => {
  const eventsGrid = document.getElementById("upcoming-events-grid");

  if (!eventsGrid) return;

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.id = "events-search";
  searchInput.placeholder = "Search events";
  searchInput.setAttribute("aria-label", "Search events");

  eventsGrid.parentElement.insertBefore(searchInput, eventsGrid);

  const paginationContainer = document.createElement("div");
  paginationContainer.id = "events-pagination";
  eventsGrid.parentElement.appendChild(paginationContainer);

  const typeSelect = document.createElement("select");
  typeSelect.id = "type-select-pop";
  typeSelect.innerHTML =
    `<option value="All" selected>All Types</option>`;

  eventsGrid.parentElement.insertBefore(typeSelect, eventsGrid);

  const semesterSet = new Set();

  getCards().forEach(card => {
    semesterSet.add(card.dataset.semester);
  });

  const semesterSelect = document.createElement("select");
  semesterSelect.id = "semester-select-pop";

  semesterSelect.innerHTML =
    `<option value="all" selected>All Semesters</option>` +
    Array.from(semesterSet)
      .map(s => `<option value="${s}">${s}</option>`)
      .join("");

  eventsGrid.parentElement.insertBefore(
    semesterSelect,
    eventsGrid
  );

  let currentPage = 1;
  let EVENTS_PER_PAGE = window.innerWidth < 768 ? 3 : 6;
  let currentType = "All";
  let currentSemester = "all";
  let filteredCards = [];

  function getCards() {
    return Array.from(
      eventsGrid.querySelectorAll(".event-card")
    );
  }

  function getSelectedType() {
    return window.innerWidth < 768
      ? typeSelect?.value || "All"
      : currentType;
  }

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedType = getSelectedType();

    filteredCards = getCards().filter(card => {
      const title = card.dataset.title || "";
      const excerpt =
        card.querySelector(".card-description")
          ?.textContent
          .toLowerCase() || "";

      const cardType = card.dataset.type || "";
      const cardSemester = card.dataset.semester || "";

      return (
        (!query ||
          title.includes(query) ||
          excerpt.includes(query)) &&
        (selectedType === "All" ||
          cardType === selectedType) &&
        (currentSemester === "all" ||
          cardSemester === currentSemester)
      );
    });

    filteredCards.sort((a, b) => {
      const aDate = new Date(a.dataset.date);
      const bDate = new Date(b.dataset.date);

      return aDate - bDate;
    });

    currentPage = 1;

    renderPage();
    renderPagination();
  }

  function renderPage(scrollToTop = false) {
    const start = (currentPage - 1) * EVENTS_PER_PAGE;
    const end = start + EVENTS_PER_PAGE;

    getCards().forEach(card => {
      card.style.display = "none";
    });

    filteredCards
      .slice(start, end)
      .forEach(card => {
        card.style.display = "";
      });

    if (scrollToTop && filteredCards[start]) {
      const offset = 200;

      const top =
        filteredCards[start].getBoundingClientRect().top +
        window.scrollY -
        offset;

      window.scrollTo({
        top,
        behavior: "smooth",
      });
    }
  }

  function renderPagination() {
    const totalPages = Math.ceil(
      filteredCards.length / EVENTS_PER_PAGE
    );

    paginationContainer.innerHTML = "";

    if (totalPages <= 1) return;

    const createBtn = (
      label,
      page,
      disabled = false,
      active = false
    ) => {
      const btn = document.createElement("button");

      btn.textContent = label;
      btn.className =
        `pagination-btn${active ? " active" : ""}`;

      btn.disabled = disabled;

      btn.onclick = () => {
        currentPage = page;
        renderPage(true);
        renderPagination();
      };

      return btn;
    };

    paginationContainer.appendChild(
      createBtn(
        "Prev",
        currentPage - 1,
        currentPage === 1
      )
    );

    for (let i = 1; i <= totalPages; i++) {
      paginationContainer.appendChild(
        createBtn(
          i,
          i,
          false,
          i === currentPage
        )
      );
    }

    paginationContainer.appendChild(
      createBtn(
        "Next",
        currentPage + 1,
        currentPage === totalPages
      )
    );
  }

  searchInput.addEventListener(
    "input",
    applyFilters
  );

  semesterSelect.addEventListener(
    "change",
    () => {
      currentSemester = semesterSelect.value;
      currentPage = 1;
      applyFilters();
    }
  );

  typeSelect.addEventListener(
    "change",
    () => {
      currentType = typeSelect.value;
      currentPage = 1;
      applyFilters();
    }
  );

  window.addEventListener("resize", () => {
    EVENTS_PER_PAGE =
      window.innerWidth < 768 ? 3 : 6;

    renderPage();
    renderPagination();
  });

  applyFilters();
});