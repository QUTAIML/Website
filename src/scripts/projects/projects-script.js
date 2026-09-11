document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("projects-search");
  const pastGrid = document.querySelector("#projects-grid");
  const paginationContainer =
    document.getElementById("projects-pagination");

  const sortSelectPop =
    document.getElementById("sort-select-pop");
  const typeSelectPop =
    document.getElementById("type-select-pop");

  const filtersToggle =
    document.getElementById("filters-toggle");
  const filtersPopover =
    document.getElementById("filters-popover");

  const typePillContainer =
    document.getElementById("type-filters");

  const scrollLeftBtn =
    document.querySelector(".type-scroll-btn.left");
  const scrollRightBtn =
    document.querySelector(".type-scroll-btn.right");

  if (!pastGrid || !paginationContainer) return;

  let PROJECTS_PER_PAGE =
    window.innerWidth < 768 ? 3 : 6;

  let currentPage = 1;
  let currentSort = "";
  let currentType = "All";

  let filteredCards = [];
  let typeButtons = [];

  function getCards() {  
    return Array.from(
      pastGrid.querySelectorAll(".project-card")
    );
  }

  function getSelectedType() {
    return window.innerWidth < 768
      ? typeSelectPop?.value || "All"
      : currentType;
  }

  function initTypePills() {
    if (!typePillContainer) return;

    typeButtons = Array.from(
      typePillContainer.querySelectorAll(".type-btn")
    );

    typeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        currentType = btn.dataset.type;

        typeButtons.forEach((b) =>
          b.classList.remove("active")
        );

        btn.classList.add("active");

        if (typeSelectPop) {
          typeSelectPop.value = currentType;
        }

        currentPage = 1;
        applyFilters();
      });
    });
  }

  function applyFilters() {
    const query =
      searchInput.value.trim().toLowerCase();

    const selectedType = getSelectedType();

    filteredCards = getCards().filter((card) => {
      const title = card.dataset.title || "";

      const excerpt =
        card
          .querySelector(".card-description")
          ?.textContent.toLowerCase() || "";

      const cardType = card.dataset.type || "";
      return (
        (!query ||
          title.includes(query) ||
          excerpt.includes(query)) &&
        (selectedType === "All" ||
          cardType === selectedType)
      );
    });

    applySort();

    currentPage = 1;

    renderPage();
    renderPagination();
  }

  function applySort() {
    if (!currentSort) return;

    filteredCards.sort((a, b) => {
      const aTitle =
        a.querySelector(".card-title")
          ?.textContent || "";

      const bTitle =
        b.querySelector(".card-title")
          ?.textContent || "";

      if (currentSort === "title-asc") {
        return aTitle.localeCompare(
          bTitle,
          undefined,
          { sensitivity: "base" }
        );
      }

      if (currentSort === "title-desc") {
        return bTitle.localeCompare(
          aTitle,
          undefined,
          { sensitivity: "base" }
        );
      }

      return 0;
    });
  }

  function renderPage(scrollToTop = false) {
    const start =
      (currentPage - 1) * PROJECTS_PER_PAGE;

    const end = start + PROJECTS_PER_PAGE;

    getCards().forEach((card) => {
      card.style.display = "none";
      card.style.gridColumn = "";
      card.style.gridRow = "";
      card.classList.remove("atlas-visible-hero");
    });

    filteredCards
      .slice(start, end)
      .forEach((card, index) => {
        card.style.display = "";
        const position = index % 6;
        if (position === 0) {
          card.style.gridColumn = "span 2";
          card.style.gridRow = "span 2";
          card.classList.add("atlas-visible-hero");
        } else if (position === 1 || position === 4 || position === 5) {
          card.style.gridColumn = "span 2";
        }
      });

    if (scrollToTop && filteredCards[start]) {
      const offset = 300;

      const top =
        filteredCards[start].getBoundingClientRect()
          .top +
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
      filteredCards.length / PROJECTS_PER_PAGE
    );

    paginationContainer.innerHTML = "";

    if (totalPages <= 1) return;

    const createBtn = (
      label,
      page,
      disabled = false,
      active = false
    ) => {
      const btn =
        document.createElement("button");

      btn.textContent = label;

      btn.className = `pagination-btn${
        active ? " active" : ""
      }`;

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

  searchInput?.addEventListener(
    "input",
    applyFilters
  );

  sortSelectPop?.addEventListener(
    "change",
    () => {
      currentSort = sortSelectPop.value;

      currentPage = 1;
      applyFilters();
    }
  );

  typeSelectPop?.addEventListener(
    "change",
    () => {
      currentType = typeSelectPop.value;

      typeButtons.forEach((b) =>
        b.classList.toggle(
          "active",
          b.dataset.type === currentType
        )
      );

      currentPage = 1;
      applyFilters();
    }
  );

  filtersToggle?.addEventListener(
    "click",
    (e) => {
      e.stopPropagation();

      filtersPopover.style.display =
        filtersPopover.style.display ===
        "block"
          ? "none"
          : "block";

      filtersToggle.setAttribute(
        "aria-expanded",
        filtersPopover.style.display ===
          "block"
      );
    }
  );

  document.addEventListener(
    "click",
    (e) => {
      if (
        filtersPopover &&
        !filtersPopover.contains(e.target) &&
        e.target !== filtersToggle
      ) {
        filtersPopover.style.display = "none";

        filtersToggle.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    }
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (
        e.key === "Escape" &&
        filtersPopover
      ) {
        filtersPopover.style.display = "none";

        filtersToggle.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    }
  );

  scrollLeftBtn?.addEventListener(
    "click",
    () => {
      typePillContainer.scrollBy({
        left: -200,
        behavior: "smooth",
      });
    }
  );

  scrollRightBtn?.addEventListener(
    "click",
    () => {
      typePillContainer.scrollBy({
        left: 200,
        behavior: "smooth",
      });
    }
  );

  window.addEventListener(
    "resize",
    () => {
      PROJECTS_PER_PAGE =
        window.innerWidth < 768
          ? 3
          : 6;

      renderPage();
      renderPagination();
    }
  );

  initTypePills();
  applyFilters();
});
