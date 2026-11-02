// src/scripts/events/events-script.js

document.addEventListener("DOMContentLoaded", () => {

  const noEventsState = document.getElementById('no-events-state');

  const searchInput = document.getElementById('events-search');
  const eventsList = document.getElementById('events-list');
  const eventRows = Array.from(eventsList.querySelectorAll('.event-row'));
  let paginationContainer = document.getElementById('events-pagination');

  if (!paginationContainer) {
    paginationContainer = document.createElement('div');
    paginationContainer.id = 'events-pagination';
    eventsList.parentNode.appendChild(paginationContainer);
  }

  const typeFilter = document.getElementById('event-type-filter');
  const whenFilter = document.getElementById('event-when-filter');
  const listViewButton = document.getElementById('event-list-view');
  const calendarViewButton = document.getElementById('event-calendar-view');
  const eventsPanel = document.querySelector('.events-panel');
  const eventsCalendar = document.getElementById('events-calendar');
  const calendarGrid = document.getElementById('calendar-grid');
  const calendarMonthTitle = document.getElementById('calendar-month-title');
  const calendarDetails = document.getElementById('calendar-details');
  const calendarPrevious = document.getElementById('calendar-previous');
  const calendarNext = document.getElementById('calendar-next');
  const calendarToday = document.getElementById('calendar-today');
  const calendarPosition = document.getElementById('calendar-position');
  const calendarLegend = document.querySelector('.calendar-legend');

  const EVENTS_PER_PAGE = 5;
  const CALENDAR_FIRST_MONTH = '2025-07';

  let currentPage = 1;
  let currentSort = 'all';
  let currentTitleSort = 'none';
  let currentView = 'calendar';
  let calendarDate = new Date();
  let selectedDate = null;

  let filteredCards = [];

  function getCards() {
    return eventRows;
  }

  // The calendar shows past and upcoming events together, so "Show" only applies to the list.
  function matchesSortFilter(date) {
    if (currentView === 'calendar') return true;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (currentSort === 'upcoming') return date >= today;
    if (currentSort === 'past') return date < today;
    return true;
  }

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();

    const selectedType = typeFilter.value;

    filteredCards = getCards().filter(card => {
      const title = card.dataset.title;
      const excerpt = card.querySelector('p')?.textContent.toLowerCase() || '';
      const type = card.dataset.type;
      const date = new Date(card.dataset.date); date.setHours(0,0,0,0);

      const matchesQuery =
        !query || title.includes(query) || excerpt.includes(query);

      const matchesType =
        selectedType === 'All' || type === selectedType;

      return (
        matchesQuery &&
        matchesType &&
        matchesSortFilter(date)
      );
    });

    currentPage = 1;
    applySort();
    renderPage();
    renderPagination();

    // Filtering from the calendar should land on a month and day that have a match.
    if (currentView === 'calendar' && filteredCards.length && !monthHasEvents(calendarDate)) {
      calendarDate = nearestEventMonth(filteredCards);
    }
    if (!eventsByDate().has(selectedDate)) selectedDate = null;
    renderCalendar();
  }

  function localDate(dateString) {
    return new Date(`${dateString}T12:00:00`);
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  // Calendar entries come from the same rows as the list, so both views always agree.
  function readEvent(card) {
    return {
      start: card.dataset.date,
      end: card.dataset.endDate || card.dataset.date,
      title: card.querySelector('.event-row-title')?.textContent.trim() ?? 'AIML event',
      type: card.dataset.type ?? 'Event',
      time: card.dataset.time ?? '',
      location: card.dataset.location ?? '',
      excerpt: card.querySelector('p')?.textContent.trim() ?? '',
      link: card.querySelector('a.event-row-title')?.getAttribute('href') ?? '',
    };
  }

  // Maps each day to its events. Multi-day events appear on every day they run.
  function eventsByDate() {
    const days = new Map();
    filteredCards.map(readEvent).forEach((event) => {
      const last = localDate(event.end);
      for (let date = localDate(event.start); date <= last; date.setDate(date.getDate() + 1)) {
        const key = isoDate(date);
        days.set(key, [...(days.get(key) ?? []), event]);
      }
    });
    return days;
  }

  function monthKey(date) {
    return isoDate(date).slice(0, 7);
  }

  function monthHasEvents(date) {
    return [...eventsByDate().keys()].some((key) => key.startsWith(monthKey(date)));
  }

  // The month of the next upcoming event, or of the latest event once they have all passed.
  function nearestEventMonth(cards) {
    const today = isoDate(new Date());
    const dates = cards.map((card) => card.dataset.date).sort();
    const target = dates.find((date) => date >= today) ?? dates.at(-1);
    return target ? localDate(target) : new Date();
  }

  function formatRange(event) {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const start = localDate(event.start).toLocaleDateString('en-AU', options);
    if (event.start === event.end) return start;
    return `${start} to ${localDate(event.end).toLocaleDateString('en-AU', options)}`;
  }

  function renderEventDetails(event) {
    const today = isoDate(new Date());
    const isPast = event.end < today;
    const article = createElement('article', 'calendar-detail-event');
    const tags = createElement('p', 'calendar-detail-tags');
    tags.append(
      createElement('span', isPast ? 'is-past' : 'is-upcoming', isPast ? 'Past event' : 'Coming up'),
      createElement('span', '', event.type),
    );
    article.append(tags, createElement('h4', '', event.title));

    const facts = createElement('dl', 'calendar-detail-facts');
    [['When', formatRange(event)], ['Time', event.time], ['Where', event.location]].forEach(([label, value]) => {
      if (value) facts.append(createElement('dt', '', label), createElement('dd', '', value));
    });
    article.appendChild(facts);

    if (event.excerpt) article.appendChild(createElement('p', 'calendar-detail-text', event.excerpt));
    if (event.link) {
      const link = createElement('a', 'calendar-detail-link', 'View more details');
      link.href = event.link;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      article.appendChild(link);
    }
    return article;
  }

  function renderDetails(days) {
    if (!calendarDetails) return;
    calendarDetails.replaceChildren();

    if (!selectedDate) {
      calendarDetails.append(
        createElement('p', 'calendar-detail-day', calendarMonthTitle.textContent),
        createElement('h4', '', 'Nothing planned'),
        createElement('p', 'calendar-detail-text', 'No matching events this month. Try another month or adjust the filters.'),
      );
      return;
    }

    const heading = localDate(selectedDate).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
    calendarDetails.appendChild(createElement('p', 'calendar-detail-day', heading));
    const events = days.get(selectedDate) ?? [];
    if (!events.length) {
      calendarDetails.append(
        createElement('h4', '', 'Nothing planned'),
        createElement('p', 'calendar-detail-text', calendarGrid.querySelector('.has-event') ? 'Pick a highlighted day to see what’s on.' : 'No matching events this month. Try another month or adjust the filters.'),
      );
    }
    events.forEach((event) => calendarDetails.appendChild(renderEventDetails(event)));
  }

  function selectDate(date, days) {
    selectedDate = date;
    calendarGrid.querySelectorAll('.calendar-day[data-date]').forEach((day) => {
      const isSelected = day.dataset.date === date;
      day.classList.toggle('is-selected', isSelected);
      day.setAttribute('aria-pressed', String(isSelected));
    });
    renderDetails(days);
  }

  function isFiltering() {
    return typeFilter.value !== 'All' || searchInput.value.trim() !== '';
  }

  // The matching events in date order, for stepping through them with the arrows.
  function matchingStarts() {
    return filteredCards.map((card) => card.dataset.date).sort();
  }

  function stepToEvent(direction) {
    const starts = matchingStarts();
    const from = selectedDate ?? `${monthKey(calendarDate)}-01`;
    const target = direction > 0 ? starts.find((date) => date > from) : starts.filter((date) => date < from).at(-1);
    if (!target) return;
    selectedDate = target;
    showMonth(localDate(target));
  }

  function updateCalendarNavigation() {
    const filtering = isFiltering();
    const starts = matchingStarts();
    const from = selectedDate ?? `${monthKey(calendarDate)}-01`;
    calendarPrevious.disabled = filtering ? !starts.some((date) => date < from) : monthKey(calendarDate) <= CALENDAR_FIRST_MONTH;
    calendarNext.disabled = filtering && !starts.some((date) => date > from);
    calendarPrevious.setAttribute('aria-label', filtering ? 'Show previous matching event' : 'Show previous month');
    calendarNext.setAttribute('aria-label', filtering ? 'Show next matching event' : 'Show next month');

    const label = typeFilter.value !== 'All' ? typeFilter.value : 'Match';
    const position = starts.indexOf(selectedDate) + 1;
    calendarPosition.hidden = !filtering || starts.length === 0;
    calendarPosition.textContent = position ? `${label} ${position} of ${starts.length}` : `${starts.length} matching`;
    calendarLegend.hidden = filtering && starts.length > 0;
  }

  function renderCalendar() {
    if (!calendarGrid || !calendarMonthTitle) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const shownMonth = monthKey(calendarDate);
    const today = isoDate(new Date());
    calendarMonthTitle.textContent = calendarDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    calendarGrid.replaceChildren();

    const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7; // Weeks start on Monday.
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = eventsByDate();

    for (let index = 0; index < leadingBlanks; index += 1) {
      calendarGrid.appendChild(createElement('span', 'calendar-blank'));
    }

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const date = new Date(year, month, dayNumber, 12);
      const key = isoDate(date);
      const events = days.get(key) ?? [];
      const day = createElement('button', 'calendar-day');
      day.type = 'button';
      day.dataset.date = key;
      day.appendChild(createElement('span', 'calendar-date', String(dayNumber)));
      day.setAttribute('aria-label', `${date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}: ${events.map((event) => event.title).join(', ') || 'no events'}`);

      if (key === today) {
        day.classList.add('is-today');
        day.setAttribute('aria-current', 'date');
      }
      if (events.length) day.classList.add('has-event', events.some((event) => event.end >= today) ? 'is-upcoming' : 'is-past');
      events.slice(0, 2).forEach((event) => {
        day.appendChild(createElement('span', `calendar-event ${event.end < today ? 'is-past' : 'is-upcoming'}`, event.title));
      });
      if (events.length > 2) day.appendChild(createElement('span', 'calendar-more', `+${events.length - 2} more`));

      day.addEventListener('click', () => {
        selectDate(key, days);
        updateCalendarNavigation();
        // On phones the details sit below the calendar, so bring them into view.
        if (events.length && window.matchMedia('(max-width: 900px)').matches) {
          calendarDetails.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
      calendarGrid.appendChild(day);
    }

    // Keep a day picked in this month, otherwise open on its next event, or its first if all have passed.
    if (!selectedDate?.startsWith(shownMonth)) {
      const monthDates = [...days.keys()].filter((key) => key.startsWith(shownMonth)).sort();
      selectedDate = monthDates.find((key) => key >= today) ?? monthDates[0] ?? null;
    }
    selectDate(selectedDate, days);
    updateCalendarNavigation();
  }

  function showMonth(date) {
    calendarDate = date;
    renderCalendar();
  }

  function setView(view) {
    currentView = view;
    const showCalendar = view === 'calendar';
    eventsPanel.hidden = showCalendar;
    eventsCalendar.hidden = !showCalendar;
    paginationContainer.hidden = showCalendar;
    listViewButton.classList.toggle('active', !showCalendar);
    calendarViewButton.classList.toggle('active', showCalendar);
    listViewButton.setAttribute('aria-pressed', String(!showCalendar));
    calendarViewButton.setAttribute('aria-pressed', String(showCalendar));
    whenFilter.hidden = showCalendar;
    applyFilters();
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
      return dateB - dateA;
    });
  }


  function renderPage(scrollToTop = false) {
    const start = (currentPage - 1) * EVENTS_PER_PAGE;
    const today = isoDate(new Date());
    let lastHeading = '';

    // Rows sit under a heading for their date, like an agenda.
    eventsList.classList.add('is-grouped');
    eventsList.replaceChildren();
    const pageRows = filteredCards.slice(start, start + EVENTS_PER_PAGE);
    eventsList.classList.toggle('no-times', !pageRows.some((row) => row.querySelector('.event-row-time').textContent));
    pageRows.forEach((row) => {
      const event = readEvent(row);
      const heading = formatRange(event);
      if (heading !== lastHeading) {
        eventsList.appendChild(createElement('li', 'event-list-date', heading));
        lastHeading = heading;
      }
      row.classList.toggle('is-past', event.end < today);
      eventsList.appendChild(row);
    });

    // Toggle the dark panel and empty state
    noEventsState.style.display = filteredCards.length === 0 ? 'block' : 'none';

    if (scrollToTop) {
      const offset = 130;
      const topPosition = eventsList.getBoundingClientRect().top + window.scrollY - offset;
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

  typeFilter.addEventListener('change', applyFilters);
  whenFilter.addEventListener('change', () => {
    currentSort = whenFilter.value;
    applyFilters();
  });

  listViewButton?.addEventListener('click', () => setView('list'));
  calendarViewButton?.addEventListener('click', () => setView('calendar'));
  // With a filter on, the arrows jump between matching events instead of months.
  calendarPrevious?.addEventListener('click', () => (isFiltering() ? stepToEvent(-1) : showMonth(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))));
  calendarNext?.addEventListener('click', () => (isFiltering() ? stepToEvent(1) : showMonth(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))));
  calendarToday?.addEventListener('click', () => {
    selectedDate = isoDate(new Date());
    showMonth(new Date());
  });

  calendarDate = nearestEventMonth(getCards());
  setView('calendar');

  // Phone address bars resize the page while scrolling, so only react when the width changes.
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    applyFilters();
  });

});
