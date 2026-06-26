// src/scripts/events/events-script.js

document.addEventListener("DOMContentLoaded", () => {

  const noEventsState = document.getElementById('no-events-state'); // ADD THIS
  console.log('noEventsState:', noEventsState); // ADD THIS

  const searchInput = document.getElementById('events-search');
  const grid = document.getElementById('events-grid');
  let paginationContainer = document.getElementById('events-pagination');

  if (!paginationContainer) {
    paginationContainer = document.createElement('div');
    paginationContainer.id = 'events-pagination';
    grid.parentNode.appendChild(paginationContainer);
  }

  const filtersToggle = document.getElementById('filters-toggle');
  const filtersPopover = document.getElementById('filters-popover');
  const semesterSelectPop = document.getElementById('semester-select-pop');
  const sortSelectPop = document.getElementById('sort-select-pop'); // Upcoming / Past
  const typeSelectPop = document.getElementById('type-select-pop'); // Mobile type
  const sortGroup = document.getElementById('sort-filter-group');

  const EVENTS_PER_PAGE = 6;

  let currentPage = 1;
  let currentSemester = 'all';
  let currentSort = 'upcoming';
  let currentTitleSort = 'none';
  let currentType = 'All';

  let filteredCards = [];
  let typeButtons = [];

  const latestSemesterId =
    semesterSelectPop.options[1]?.value ?? null;

  function getCards() {
    return Array.from(grid.querySelectorAll('.event-card'));
  }

  function getTypesForFilteredCards() {
    const query = searchInput.value.trim().toLowerCase();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const cards = getCards().filter(card => {
      const semester = card.dataset.semester;
      const title = card.dataset.title;
      const excerpt = card.querySelector('p')?.textContent.toLowerCase() || '';
      const date = new Date(card.dataset.date); date.setHours(0,0,0,0);

      const matchesSemester =
        currentSemester === 'all' || semester === currentSemester;

      let matchesSort = true;
      if (currentSort === 'upcoming') matchesSort = date >= today;
      if (currentSort === 'past') matchesSort = date < today;

      const matchesQuery =
        !query || title.includes(query) || excerpt.includes(query);

      return matchesSemester && matchesSort && matchesQuery;
    });

    const typeSet = new Set(cards.map(c => c.dataset.type || 'Other'));

    if (typeSet.size <= 1) {
      return ['All'];
    }

    const preferred = ["Social", "Industry", "Projects", "Major"];
    const preferredExisting = preferred.filter(p => typeSet.has(p));
    const remaining = [...typeSet]
      .filter(t => !preferredExisting.includes(t))
      .sort((a, b) => a.localeCompare(b));

    return ['All', ...preferredExisting, ...remaining];
  }


  function renderTypeButtons(types) {
    const container = document.getElementById('type-filters');
    container.innerHTML = '';

    types.forEach(type => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.type = type;
      btn.textContent = type;
      btn.className = `type-btn ${type === currentType ? 'active' : ''}`;

      btn.addEventListener('click', () => {
        currentType = type;
        typeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilters();
      });

      container.appendChild(btn);
    });

    typeButtons = Array.from(container.querySelectorAll('.type-btn'));
  }

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const today = new Date(); today.setHours(0,0,0,0);

    const selectedType =
      window.innerWidth <= 768 && typeSelectPop
        ? typeSelectPop.value
        : currentType;

    filteredCards = getCards().filter(card => {
      const title = card.dataset.title;
      const excerpt = card.querySelector('p')?.textContent.toLowerCase() || '';
      const type = card.dataset.type;
      const semester = card.dataset.semester;
      const date = new Date(card.dataset.date); date.setHours(0,0,0,0);

      const matchesQuery =
        !query || title.includes(query) || excerpt.includes(query);

      const matchesType =
        selectedType === 'All' || type === selectedType;

      const matchesSemester =
        currentSemester === 'all' || semester === currentSemester;

      let matchesSort = true;
      if (currentSort === 'upcoming') matchesSort = date >= today;
      if (currentSort === 'past') matchesSort = date < today;

      return (
        matchesQuery &&
        matchesType &&
        matchesSemester &&
        matchesSort
      );
    });

    currentPage = 1;
    applySort();
    renderPage();
    renderPagination();

    if (window.innerWidth > 768) {
      renderTypeButtons(getTypesForFilteredCards());
    }
  }

  function applySort() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filteredCards.sort((a, b) => {
      const titleA = a.dataset.title.trim();
      const titleB = b.dataset.title.trim();

      // Only fall back to date sorting if title sort is "none"
      const dateA = new Date(a.dataset.date);
      const dateB = new Date(b.dataset.date);
      dateA.setHours(0, 0, 0, 0);
      dateB.setHours(0, 0, 0, 0);

      if (currentSort === 'upcoming') return dateA - dateB;
      if (currentSort === 'past') return dateB - dateA;

      return 0;
    });
  }


  function renderPage(scrollToTop = false) {
    const isMobile = window.innerWidth < 768;
    const EVENTS_PER_PAGE_MOBILE = 3;
    const perPage = isMobile ? EVENTS_PER_PAGE_MOBILE : EVENTS_PER_PAGE;

    const start = (currentPage - 1) * perPage;
    const end = start + perPage;

    getCards().forEach(card => (card.style.display = 'none'));
    filteredCards.slice(start, end).forEach(card => (card.style.display = ''));

    // Toggle the dark panel and empty state
    noEventsState.style.display = filteredCards.length === 0 ? 'block' : 'none';

    if (scrollToTop && filteredCards[start]) {
      const offset = 400;
      const topPosition =
        filteredCards[start].getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: topPosition, behavior: 'smooth' });
    }
  }


  function renderPagination() {
    const totalPages = Math.ceil(filteredCards.length / EVENTS_PER_PAGE);
    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    const isMobile = window.innerWidth < 768;

    const createBtn = (label, page, disabled = false, active = false) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className = `pagination-btn${active ? ' active' : ''}`;
      btn.disabled = disabled;
      btn.onclick = () => {
        currentPage = page;
        renderPage(true);
        renderPagination();
      };
      return btn;
    };

    paginationContainer.appendChild(
      createBtn('Prev', currentPage - 1, currentPage === 1)
    );

    if (isMobile) {
      [currentPage - 1, currentPage, currentPage + 1]
        .filter(p => p >= 1 && p <= totalPages)
        .forEach(p => {
          paginationContainer.appendChild(
            createBtn(p, p, false, p === currentPage)
          );
        });
    } else {
      for (let i = 1; i <= totalPages; i++) {
        paginationContainer.appendChild(
          createBtn(i, i, false, i === currentPage)
        );
      }
    }

    paginationContainer.appendChild(
      createBtn('Next', currentPage + 1, currentPage === totalPages)
    );
  }

  // === Event listeners ===

  searchInput.addEventListener('input', applyFilters);

  semesterSelectPop.addEventListener('change', () => {
    currentSemester = semesterSelectPop.value;

    if (currentSemester === latestSemesterId || currentSemester === 'all') {
      sortGroup.style.display = 'block';
      currentSort = sortSelectPop.value;
    } else {
      sortGroup.style.display = 'none';
      currentSort = 'past';
    }

    applyFilters();
  });

  sortSelectPop.addEventListener('change', () => {
    currentSort = sortSelectPop.value;
    applyFilters();
  });

  if (typeSelectPop) {
    typeSelectPop.addEventListener('change', applyFilters);
  }

  filtersToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = filtersPopover.style.display === 'block';
    filtersPopover.style.display = open ? 'none' : 'block';
    filtersToggle.setAttribute('aria-expanded', String(!open));
  });

  document.addEventListener('click', (e) => {
    if (!filtersPopover.contains(e.target) && e.target !== filtersToggle) {
      filtersPopover.style.display = 'none';
      filtersToggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      filtersPopover.style.display = 'none';
      filtersToggle.setAttribute('aria-expanded', 'false');
    }
  });

  applyFilters();
  window.addEventListener('resize', applyFilters);

});