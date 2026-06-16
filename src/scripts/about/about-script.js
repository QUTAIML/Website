import "@/scripts/about/about-script";

document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     TEAM CAROUSEL
  ========================= */
  const teamGrid = document.getElementById("team-grid");
  const teamTitle = document.getElementById("team-title");
  const teamDots = document.getElementById("team-dots");

  const teamLeftArrow = document.querySelector(".team-section .carousel-arrow.left");
  const teamRightArrow = document.querySelector(".team-section .carousel-arrow.right");

  const teamMobileLeft = document.querySelector(".team-arrows-mobile-panel .carousel-arrow.left");
  const teamMobileRight = document.querySelector(".team-arrows-mobile-panel .carousel-arrow.right");

  const teams = JSON.parse(teamGrid.dataset.teams);
  const TEAM_AUTO_DELAY = 7000;

  let teamPageSize = window.innerWidth <= 768 ? 2 : 4;
  let teamPages = [];
  let teamIndex = 0;
  let teamAutoTimer;

  function buildTeamPages() {
    teamPages = [];
    teams.forEach(team => {
      for (let i = 0; i < team.items.length; i += teamPageSize) {
        teamPages.push({
          teamTitle: team.title,
          items: team.items.slice(i, i + teamPageSize),
          pageIndex: i / teamPageSize,
        });
      }
    });
  }

  function renderTeamPage(index) {
    const page = teamPages[index];

    teamTitle.textContent =
      page.pageIndex > 0
        ? `${page.teamTitle} – Continued`
        : page.teamTitle;

    teamGrid.innerHTML = "";

    page.items.forEach(member => {
      const card = document.createElement("div");

      card.className = "team-card";

      card.innerHTML = `
        <div class="team-photo">
          <img src="${member.image || '/people/Anonymous.png'}"
               alt="${member.name}"
               onerror="this.src='/people/Anonymous.png';" />
        </div>
        <div class="team-info">
          <span class="role">${member.role}</span>
          <h3>${member.name}</h3>
        </div>
      `;

      teamGrid.appendChild(card);
    });

    const emptySlots = teamPageSize - page.items.length;

    for (let i = 0; i < emptySlots; i++) {
      const emptyCard = document.createElement("div");

      emptyCard.className = "team-card empty-card";

      emptyCard.innerHTML =
        `<div class="team-photo"></div><div class="team-info"></div>`;

      teamGrid.appendChild(emptyCard);
    }

    teamLeftArrow.style.visibility =
      index === 0 ? "hidden" : "visible";

    teamRightArrow.style.visibility =
      index === teamPages.length - 1
        ? "hidden"
        : "visible";

    teamDots.innerHTML = "";

    teamPages.forEach((_, i) => {
      const dot = document.createElement("span");

      dot.className =
        i === index
          ? "team-dot active"
          : "team-dot";

      dot.onclick = () => {
        teamIndex = i;
        resetTeamAuto();
        renderTeamPage(i);
      };

      teamDots.appendChild(dot);
    });
  }

  function nextTeamPage() {
    teamIndex = (teamIndex + 1) % teamPages.length;
    renderTeamPage(teamIndex);
  }

  function prevTeamPage() {
    teamIndex =
      (teamIndex - 1 + teamPages.length) %
      teamPages.length;

    renderTeamPage(teamIndex);
  }

  function resetTeamAuto() {
    clearInterval(teamAutoTimer);

    teamAutoTimer = setInterval(
      nextTeamPage,
      TEAM_AUTO_DELAY
    );
  }

  teamLeftArrow.onclick = () => {
    prevTeamPage();
    resetTeamAuto();
  };

  teamRightArrow.onclick = () => {
    nextTeamPage();
    resetTeamAuto();
  };

  teamMobileLeft?.addEventListener("click", () => {
    prevTeamPage();
    resetTeamAuto();
  });

  teamMobileRight?.addEventListener("click", () => {
    nextTeamPage();
    resetTeamAuto();
  });

  window.addEventListener("resize", () => {
    const newSize =
      window.innerWidth <= 768 ? 2 : 4;

    if (newSize !== teamPageSize) {
      teamPageSize = newSize;
      teamIndex = 0;

      buildTeamPages();
      renderTeamPage(0);
    }
  });

  buildTeamPages();
  resetTeamAuto();
  renderTeamPage(0);

  /* =========================
     DEGREES CAROUSEL
  ========================= */

  const degreesGrid =
    document.getElementById("degrees-grid");

  const degreesDots =
    document.getElementById("degrees-dots");

  const degreeTitleElem =
    document.getElementById("degree-title");

  const degreesData =
    JSON.parse(degreesGrid.dataset.teams);

  let degreesPages = [];
  let degreesIndex = 0;
  let degreePageSize =
    window.innerWidth <= 768 ? 2 : 4;

  function buildDegreePages() {
    degreesPages = [];

    degreesData.forEach(section => {
      for (
        let i = 0;
        i < section.items.length;
        i += degreePageSize
      ) {
        degreesPages.push({
          title: section.title,
          items: section.items.slice(
            i,
            i + degreePageSize
          ),
          pageIndex: i / degreePageSize,
        });
      }
    });
  }

  function renderDegreePage(index) {
    const page = degreesPages[index];

    degreeTitleElem.textContent =
      page.pageIndex > 0
        ? `${page.title} – Continued`
        : page.title;

    degreesGrid.innerHTML = "";

    page.items.forEach(item => {
      const card = document.createElement("div");

      card.className = "degree-card";

      card.innerHTML = `<h3>${item.name}</h3>`;

      degreesGrid.appendChild(card);
    });

    const emptySlots =
      degreePageSize - page.items.length;

    for (let i = 0; i < emptySlots; i++) {
      const emptyCard =
        document.createElement("div");

      emptyCard.className =
        "degree-card empty-card";

      degreesGrid.appendChild(emptyCard);
    }

    degreesDots.innerHTML = "";

    degreesPages.forEach((_, i) => {
      const dot = document.createElement("span");

      dot.className =
        i === index
          ? "degree-dot active"
          : "degree-dot";

      dot.onclick = () => {
        degreesIndex = i;
        renderDegreePage(i);
      };

      degreesDots.appendChild(dot);
    });
  }

  const degreeLeft =
    document.querySelector(
      ".carousel-arrow-degree.left-degree"
    );

  const degreeRight =
    document.querySelector(
      ".carousel-arrow-degree.right-degree"
    );

  degreeLeft?.addEventListener("click", () => {
    degreesIndex =
      (degreesIndex - 1 + degreesPages.length) %
      degreesPages.length;

    renderDegreePage(degreesIndex);
  });

  degreeRight?.addEventListener("click", () => {
    degreesIndex =
      (degreesIndex + 1) %
      degreesPages.length;

    renderDegreePage(degreesIndex);
  });

  document
    .querySelectorAll(
      ".degree-arrows-mobile-panel .left"
    )
    .forEach(btn => {
      btn.addEventListener("click", () => {
        degreesIndex =
          (degreesIndex - 1 + degreesPages.length) %
          degreesPages.length;

        renderDegreePage(degreesIndex);
      });
    });

  document
    .querySelectorAll(
      ".degree-arrows-mobile-panel .right"
    )
    .forEach(btn => {
      btn.addEventListener("click", () => {
        degreesIndex =
          (degreesIndex + 1) %
          degreesPages.length;

        renderDegreePage(degreesIndex);
      });
    });

  window.addEventListener("resize", () => {
    const newSize =
      window.innerWidth <= 768 ? 2 : 4;

    if (newSize !== degreePageSize) {
      degreePageSize = newSize;
      degreesIndex = 0;

      buildDegreePages();
      renderDegreePage(0);
    }
  });

  buildDegreePages();
  renderDegreePage(0);
});