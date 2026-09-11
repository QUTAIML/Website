// src/scripts/events/events-script.js

document.addEventListener("DOMContentLoaded", () => {

  const noEventsState = document.getElementById('no-events-state');

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
  const archiveViewButton = document.getElementById('event-archive-view');
  const calendarViewButton = document.getElementById('event-calendar-view');
  const eventsPanel = document.querySelector('.events-panel');
  const eventsCalendar = document.getElementById('events-calendar');
  const calendarGrid = document.getElementById('calendar-grid');
  const calendarMonthTitle = document.getElementById('calendar-month-title');
  const calendarEmpty = document.getElementById('calendar-empty');
  const calendarPrevious = document.getElementById('calendar-previous');
  const calendarNext = document.getElementById('calendar-next');

  const EVENTS_PER_PAGE = 6;

  let currentPage = 1;
  let currentSemester = 'all';
  const eventsPage = document.querySelector('.events-page');
  let currentSort = eventsPage?.dataset.defaultView === 'past' ? 'past' : 'upcoming';
  let currentTitleSort = 'none';
  let currentType = 'All';
  let currentView = 'archive';
  const calendarStart = eventsPage?.dataset.calendarStart;
  let calendarDate = calendarStart ? new Date(`${calendarStart}T12:00:00`) : new Date();

  let filteredCards = [];
  let typeButtons = [];

  const latestSemesterId =
    semesterSelectPop.options[1]?.value ?? null;

  sortSelectPop.value = currentSort;

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
    renderCalendar();

    if (window.innerWidth > 768) {
      renderTypeButtons(getTypesForFilteredCards());
    }
  }

  function localDate(dateString) {
    return new Date(`${dateString}T12:00:00`);
  }

  function renderCalendar() {
    if (!calendarGrid || !calendarMonthTitle || !calendarEmpty) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthName = calendarDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    calendarMonthTitle.textContent = monthName;
    calendarGrid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPreviousMonth = new Date(year, month, 0).getDate();
    const eventsByDay = new Map();

    filteredCards.forEach((card) => {
      const date = localDate(card.dataset.date);
      if (date.getFullYear() !== year || date.getMonth() !== month) return;
      const day = date.getDate();
      const events = eventsByDay.get(day) ?? [];
      events.push({
        title: card.querySelector('.card-title')?.textContent.trim() ?? 'AIML event',
        type: card.dataset.type ?? 'Event',
      });
      eventsByDay.set(day, events);
    });

    for (let index = 0; index < 42; index += 1) {
      const dayOffset = index - firstDay + 1;
      const day = document.createElement('div');
      day.className = 'calendar-day';
      let label;

      if (dayOffset < 1) {
        label = daysInPreviousMonth + dayOffset;
        day.classList.add('outside-month');
      } else if (dayOffset > daysInMonth) {
        label = dayOffset - daysInMonth;
        day.classList.add('outside-month');
      } else {
        label = dayOffset;
        const events = eventsByDay.get(dayOffset) ?? [];
        if (events.length) day.classList.add('has-event');
        events.slice(0, 3).forEach((event) => {
          const item = document.createElement('span');
          item.className = 'calendar-event';
          item.dataset.type = event.type;
          item.textContent = event.title;
          item.title = event.title;
          day.appendChild(item);
        });
        if (events.length > 3) {
          const more = document.createElement('span');
          more.className = 'calendar-more';
          more.textContent = `+${events.length - 3} more`;
          day.appendChild(more);
        }
      }

      const dateNumber = document.createElement('span');
      dateNumber.className = 'calendar-date';
      dateNumber.textContent = label;
      day.prepend(dateNumber);
      calendarGrid.appendChild(day);
    }

    calendarEmpty.hidden = eventsByDay.size !== 0;
  }

  function setView(view) {
    currentView = view;
    const showCalendar = view === 'calendar';
    eventsPanel.hidden = showCalendar;
    eventsCalendar.hidden = !showCalendar;
    paginationContainer.hidden = showCalendar;
    archiveViewButton.classList.toggle('active', !showCalendar);
    calendarViewButton.classList.toggle('active', showCalendar);
    archiveViewButton.setAttribute('aria-pressed', String(!showCalendar));
    calendarViewButton.setAttribute('aria-pressed', String(showCalendar));
    if (showCalendar) renderCalendar();
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

  archiveViewButton?.addEventListener('click', () => setView('archive'));
  calendarViewButton?.addEventListener('click', () => setView('calendar'));
  calendarPrevious?.addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    renderCalendar();
  });
  calendarNext?.addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    renderCalendar();
  });

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
