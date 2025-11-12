// Translate raw grade strings (e.g. "FR", "SR") into numeric grade levels.
function normalizeGradeValue(rawGrade) {
  if (rawGrade == null) {
    return null;
  }
  const parsed = parseInt(rawGrade, 10);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  const normalized = String(rawGrade).trim().toUpperCase();
  switch (normalized) {
    case "FR":
    case "F":
      return 9;
    case "SO":
    case "SOPH":
      return 10;
    case "JR":
      return 11;
    case "SR":
      return 12;
    default:
      return null;
  }
}

// Request the current tab URL from the background script
async function simulateMeet(teamsData, selectedCourse = null) {
  function MMSSMSToSeconds(time) {
    const timeArray = time.split(":");
    const minutes = parseInt(timeArray[0]);
    const secondsArray = timeArray[1].split(".");
    const seconds = parseInt(secondsArray[0]);
    const milliseconds = parseInt(secondsArray[1]);
    return minutes * 60 + seconds + milliseconds / 1000;
  }

  const courses = {};
  for (const key in teamsData) {
    const teamData = teamsData[key];
    Object.keys(teamData).forEach((distance) => {
      if (!courses[distance]) {
        courses[distance] = 0;
      }
      courses[distance] += 1;
    });
  }

  const course = selectedCourse
    ? selectedCourse
    : Object.keys(courses).reduce((a, b) => (courses[a] > courses[b] ? a : b));

  const scores = {};
  const results = {};
  const allAthletesUnfiltered = {}; // Store ALL athletes before filtering
  const teamTop7 = {}; // Track top 7 athletes per team per gender
  const teamNames = {}; // Store team names
  const genders = ["boys", "girls"];
  genders.forEach((gender) => {
    const allAthletes = [];
    allAthletesUnfiltered[gender] = []; // Keep all athletes for filtering later
    teamTop7[gender] = {};
    for (const key in teamsData) {
      const teamData = teamsData[key];
      const allTeamMembers = [];
      if (
        teamData.hasOwnProperty(course) &&
        teamData[course].hasOwnProperty(gender)
      ) {
        teamData[course][gender].forEach((athlete) => {
          athlete.time = MMSSMSToSeconds(athlete.time);
          athlete.team = key;
          allTeamMembers.push(athlete);
          allAthletesUnfiltered[gender].push({ ...athlete }); // Save copy of all athletes
        });

        allTeamMembers.sort((a, b) => a.time - b.time);

        const firstSeven = allTeamMembers.slice(0, 7);
        if (!teamTop7[gender][key]) {
          teamTop7[gender][key] = new Set();
        }
        firstSeven.forEach((athlete) => {
          teamTop7[gender][key].add(`${athlete.name}-${athlete.team}`);
        });

        allTeamMembers.forEach((athlete) => {
          allAthletes.push(athlete);
        });
      }
    }
    const allAthletesSorted = allAthletes.sort((a, b) => a.time - b.time);

    const teamRankCounters = {};
    const nonSeniorCounters = {};

    allAthletesSorted.forEach((athlete) => {
      const teamId = athlete.team;
      const gradeInt = normalizeGradeValue(athlete.grade);
      athlete.gradeInt = gradeInt;
      athlete.isSenior = gradeInt === 12;

      const updatedTeamRank = (teamRankCounters[teamId] || 0) + 1;
      teamRankCounters[teamId] = updatedTeamRank;
      athlete.teamRank = updatedTeamRank;

      const priorNonSeniorCount = nonSeniorCounters[teamId] || 0;
      athlete.nonSeniorCountBefore = priorNonSeniorCount;

      if (athlete.isSenior) {
        athlete.nonSeniorRank = null;
      } else {
        const newCount = priorNonSeniorCount + 1;
        nonSeniorCounters[teamId] = newCount;
        athlete.nonSeniorRank = newCount;
      }

      const topSevenSet = teamTop7[gender]?.[teamId];
      if (topSevenSet) {
        athlete.isTop7 = topSevenSet.has(`${athlete.name}-${athlete.team}`);
      } else {
        athlete.isTop7 = athlete.teamRank <= 7;
      }
    });
    results[gender] = allAthletesSorted;
    const teamScores = {};
    for (var key in teamsData) {
      teamScores[key] = 0;
    }
    const scoringStuff = {};
    for (var i = 0; i < allAthletesSorted.length; i++) {
      const team = allAthletesSorted[i].team;
      if (!scoringStuff[team]) scoringStuff[team] = [];
      scoringStuff[team].push(allAthletesSorted[i]);
      if (scoringStuff[team].length <= 5) {
        teamScores[team] += i + 1;
      }
    }
    scores[gender] = teamScores;
  });
  return {
    scores,
    course,
    results,
    courses,
    teamTop7,
    allAthletesUnfiltered,
    teamNames,
  };
}

// CORS Wrapper
async function makeApiCall(method, ...args) {
  try {
    return await athleticWrapper.crosscountry.team.records[method](...args);
  } catch (error) {
    console.warn("Direct API call failed, trying service worker proxy:", error);
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "makeApiRequest",
          url: buildApiUrl(method, ...args),
          options: buildApiOptions(method, ...args),
          responseType:
            method.includes("seasonBests") || method.includes("TeamRecords")
              ? "text"
              : "json",
        },
        (response) => {
          if (response.success) {
            if (response.isHTML) {
              resolve(parseHTMLResponse(method, response.data));
            } else {
              resolve(response.data);
            }
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  }
}

function parseHTMLResponse(method, htmlText) {
  const parser = new DOMParser();
  const document = parser.parseFromString(htmlText, "text/html");

  if (method === "seasonBests") {
    const data = {};
    const divs = document.getElementsByClassName("distance");
    for (let i = 0; i < divs.length; i++) {
      const distanceText = divs[i].textContent.trim();
      data[distanceText] = { boys: [], girls: [] };
    }
    return data;
  }

  if (method === "TeamRecords") {
    const data = {};
    const divs = document.getElementsByClassName("distance");
    for (let i = 0; i < divs.length; i++) {
      const distanceText = divs[i].textContent.trim();
      data[distanceText] = { boys: [], girls: [] };
    }
    return data;
  }

  return {};
}

function buildApiUrl(method, ...args) {
  if (method === "seasonBests") {
    const [teamId, year] = args;
    return `https://www.athletic.net/CrossCountry/seasonbest?SchoolID=${teamId}&S=${
      year || ""
    }`;
  }
  if (method === "TeamRecords") {
    const [teamId] = args;
    return `https://www.athletic.net/CrossCountry/TeamRecords.aspx?SchoolID=${teamId}`;
  }
  if (method === "GetTeamCore") {
    const [teamId, year] = args;
    const currentYear = new Date().getFullYear();
    const seasonYear = year || currentYear;
    return `https://www.athletic.net/api/v1/TeamNav/Team?team=${teamId}&sport=xc&season=${seasonYear}`;
  }
  if (method === "AutoComplete") {
    const [query] = args;
    return `https://www.athletic.net/api/v1/AutoComplete/search?q=${encodeURIComponent(
      query
    )}&fq=`;
  }
  throw new Error(`Unknown method: ${method}`);
}

function buildApiOptions(method, ...args) {
  if (method === "seasonBests") {
    return {
      headers: {},
      body: null,
      method: "GET",
    };
  }
  if (method === "TeamRecords") {
    return {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      },
      body: null,
      method: "GET",
    };
  }
  if (method === "GetTeamCore") {
    return {
      headers: {},
      body: null,
      method: "GET",
    };
  }
  if (method === "AutoComplete") {
    return {
      headers: {},
      body: null,
      method: "GET",
    };
  }
  return {
    headers: {},
    body: null,
    method: "GET",
  };
}

var teamsData = {};
var teamNameMapGlobal = {};
var teamSelector = null;
var teamListManager = null;

const DEFAULT_RESULT_FILTER = "overall";
const RESULT_FILTERS = {
  overall: {
    label: "Overall",
    predicate: () => true,
  },
  froshSoph: {
    label: "Frosh/Soph",
    predicate: (athlete) => {
      if (!athlete || athlete.isTop7) {
        return false;
      }
      return athlete.gradeInt === 9 || athlete.gradeInt === 10;
    },
  },
  jv: {
    label: "JV",
    predicate: (athlete) => {
      if (!athlete || athlete.isTop7) {
        return false;
      }
      return athlete.gradeInt !== 12;
    },
  },
  reserve: {
    label: "Reserve",
    predicate: (athlete) => {
      if (!athlete || athlete.isTop7) {
        return false;
      }
      // Include athletes once fourteen non-senior teammates have already finished.
      const nonSeniorThresholdMet = (!athlete.isSenior && athlete.nonSeniorRank != null && athlete.nonSeniorRank > 14) ||
        (athlete.isSenior && athlete.nonSeniorCountBefore > 14);
      return Boolean(nonSeniorThresholdMet);
    },
  },
};

let filterButtonsInitialized = false;

document.addEventListener("DOMContentLoaded", () => {
  const selectorContainer = document.getElementById("teamSelectorContainer");
  if (!selectorContainer || !window.TeamSelection) {
    return;
  }

  teamSelector = TeamSelection.createSelector({
    container: selectorContainer,
    normalizeSuggestion: (doc) => {
      const normalized = TeamSelection.normalizeSuggestion(doc);
      if (!normalized) return null;
      return {
        id: normalized.id,
        name: normalized.name,
        label: normalized.label,
        subtext: normalized.subtext,
      };
    },
  });

  teamListManager = TeamSelection.createListManager({
    selector: teamSelector,
    storageKey: "crosscountry-meet-teamLists",
    selectElement: document.getElementById("teamListSelectCrossCountry"),
    nameInput: document.getElementById("teamListNameCrossCountry"),
    saveButton: document.getElementById("saveTeamListCrossCountry"),
    updateButton: document.getElementById("updateTeamListCrossCountry"),
    deleteButton: document.getElementById("deleteTeamListCrossCountry"),
    loadButton: document.getElementById("loadTeamListCrossCountry"),
    emptyMessage: "Select at least one team before saving.",
  });

  initializeResultFilterButtons();
});

document
  .getElementById("teamsInput")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!teamSelector) {
      alert("Team selector is not ready yet. Please reload the side panel.");
      return;
    }

    const selectedTeams = teamSelector.getTeams();
    if (selectedTeams.length === 0) {
      alert("Add at least one team to simulate a meet.");
      return;
    }

    const teamNameMap = {};
    const teamIds = selectedTeams.map((team) => {
      teamNameMap[team.id] = team.name;
      return team.id;
    });

    teamsData = {};
    await Promise.all(
      teamIds.map(async (teamId) => {
        if (teamId) {
          teamsData[teamId] = await makeApiCall("seasonBests", teamId);
        }
      })
    );

    teamNameMapGlobal = teamNameMap;

    const results = await simulateMeet(teamsData);
    results.teamNames = { ...teamNameMap };

    const distanceSelect = document.getElementById("distance");
    distanceSelect.innerHTML = "";
    Object.keys(results.courses).forEach((course) => {
      const option = document.createElement("option");
      option.value = course;
      option.textContent = course;
      distanceSelect.appendChild(option);
    });

    updateResults(results);
  });

function updateResults(results) {
  if (!results.teamNames || Object.keys(results.teamNames).length === 0) {
    results.teamNames = { ...teamNameMapGlobal };
  }

  const previousFilters = window.fullResults?.activeFilters || {};
  const teamNames = results.teamNames || {};

  window.fullResults = {
    ...results,
    teamNames,
    activeFilters: { ...previousFilters },
    teamIds: Object.keys(teamNames),
  };

  initializeResultFilterButtons();

  ["boys", "girls"].forEach((gender) => {
    const desiredFilter = window.fullResults.activeFilters[gender] || DEFAULT_RESULT_FILTER;
    setActiveResultFilter(gender, desiredFilter);
  });
}

function initializeResultFilterButtons() {
  if (filterButtonsInitialized) {
    return;
  }

  const containers = document.querySelectorAll(".result-filter-buttons");
  containers.forEach((container) => {
    const gender = container.dataset.gender;
    const buttons = container.querySelectorAll(".result-filter-button");
    buttons.forEach((button) => {
      button.setAttribute("type", "button");
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        const filterKey = button.dataset.filter;
        setActiveResultFilter(gender, filterKey);
      });
    });
  });

  filterButtonsInitialized = true;
}

function setActiveResultFilter(gender, filterKey) {
  if (!window.fullResults || !window.fullResults.results) {
    return;
  }

  const normalizedKey = RESULT_FILTERS[filterKey] ? filterKey : DEFAULT_RESULT_FILTER;
  window.fullResults.activeFilters = window.fullResults.activeFilters || {};
  window.fullResults.activeFilters[gender] = normalizedKey;

  renderFilteredResults(gender, normalizedKey);
  updateFilterButtonStates(gender, normalizedKey);
  updateFilterLabel(gender, normalizedKey);
}

function renderFilteredResults(gender, filterKey) {
  if (!window.fullResults || !window.fullResults.results) {
    return;
  }

  const teamNames = window.fullResults.teamNames || {};
  const athletes = getFilteredAthletes(gender, filterKey);

  renderPlacementTable(gender, athletes, teamNames);
  renderScoreTable(gender, athletes, teamNames);
}

function getFilteredAthletes(gender, filterKey) {
  const baseResults = window.fullResults?.results?.[gender] || [];
  const filterDefinition = RESULT_FILTERS[filterKey] || RESULT_FILTERS[DEFAULT_RESULT_FILTER];
  return baseResults.filter(filterDefinition.predicate);
}

function renderPlacementTable(gender, athletes, teamNames) {
  const table = document.querySelector(`#${gender} .placementTable`);
  if (!table) {
    return;
  }
  const body = table.querySelector("tbody");
  if (!body) {
    return;
  }

  body.innerHTML = "";

  if (!athletes.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No athletes match this filter.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  athletes.forEach((athlete, index) => {
    const row = document.createElement("tr");
    const teamName = teamNames[athlete.team] || athlete.team;
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${athlete.grade || ""}</td>
      <td>${athlete.name}</td>
      <td>${timeInSecondsToMMSSMS(athlete.time)}</td>
      <td>${teamName}</td>
    `;
    body.appendChild(row);
  });
}

function renderScoreTable(gender, athletes, teamNames) {
  const table = document.querySelector(`#${gender} .scoreTable`);
  if (!table) {
    return;
  }
  const body = table.querySelector("tbody");
  if (!body) {
    return;
  }

  body.innerHTML = "";

  const initialTeamIds = window.fullResults?.teamIds || [];
  const { teamScores, finishCounts } = calculateTeamScores(athletes, initialTeamIds);
  const entries = Object.entries(teamScores);

  if (!entries.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "No team scores available for this filter.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  const sorted = entries.sort((a, b) => {
    const scoreA = a[1] === 0 ? Number.POSITIVE_INFINITY : a[1];
    const scoreB = b[1] === 0 ? Number.POSITIVE_INFINITY : b[1];
    if (scoreA === scoreB) {
      const nameA = teamNames[a[0]] || a[0];
      const nameB = teamNames[b[0]] || b[0];
      return nameA.localeCompare(nameB);
    }
    return scoreA - scoreB;
  });

  sorted.forEach(([teamId, rawScore], index) => {
    const finishCount = finishCounts[teamId] || 0;
    const isDnp = finishCount < 5;
    const teamScoreDisplay = isDnp ? "DNP" : rawScore;
    const rankDisplay = isDnp ? "\u2014" : index + 1;
    const teamName = teamNames[teamId] || `Team ${teamId}`;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${rankDisplay}</td>
      <td>${teamName}</td>
      <td>${teamScoreDisplay}</td>
    `;
    body.appendChild(row);
  });
}

function calculateTeamScores(athletes, initialTeamIds) {
  const finishCounts = {};
  const teamScores = {};
  const teamIds = new Set(initialTeamIds || []);

  athletes.forEach((athlete) => {
    if (athlete?.team) {
      teamIds.add(athlete.team);
    }
  });

  teamIds.forEach((teamId) => {
    finishCounts[teamId] = 0;
    teamScores[teamId] = 0;
  });

  athletes.forEach((athlete, index) => {
    const teamId = athlete.team;
    if (!teamId) {
      return;
    }
    finishCounts[teamId] = (finishCounts[teamId] || 0) + 1;
    if (finishCounts[teamId] <= 5) {
      teamScores[teamId] = (teamScores[teamId] || 0) + (index + 1);
    }
  });

  Object.keys(finishCounts).forEach((teamId) => {
    if ((finishCounts[teamId] || 0) < 5) {
      teamScores[teamId] = 0;
    }
  });

  return { teamScores, finishCounts };
}

function updateFilterButtonStates(gender, activeFilter) {
  const container = document.querySelector(`.result-filter-buttons[data-gender="${gender}"]`);
  if (!container) {
    return;
  }

  container.querySelectorAll(".result-filter-button").forEach((button) => {
    const isActive = button.dataset.filter === activeFilter;
    if (isActive) {
      button.classList.remove("is-light");
      button.setAttribute("aria-pressed", "true");
    } else {
      button.classList.add("is-light");
      button.setAttribute("aria-pressed", "false");
    }
  });
}

function updateFilterLabel(gender, filterKey) {
  const label = document.querySelector(`.current-filter-label[data-gender="${gender}"]`);
  if (!label) {
    return;
  }
  label.textContent = `Showing: ${getFilterLabel(filterKey)}`;
}

function getFilterLabel(filterKey) {
  return RESULT_FILTERS[filterKey]?.label || RESULT_FILTERS[DEFAULT_RESULT_FILTER].label;
}

function timeInSecondsToMMSSMS(time) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.floor((time - Math.floor(time)) * 1000);
  return `${minutes}:${seconds}.${milliseconds}`;
}

window.onload = function () {
  chrome.runtime.sendMessage(
    {
      action: "getCurrentTabUrl",
    },
    async (response) => {
      const url = new URL(response.tab.url);
      const [empty, type, teamId, sport, level] = url.pathname.split("/");
      if (type !== "team" || sport !== "cross-country") return;
      try {
        const teamCore = await makeApiCall("GetTeamCore", teamId);
        const teamName = teamCore?.team?.Name || `Team ${teamId}`;
        if (teamSelector && teamSelector.getTeams().length === 0) {
          teamSelector.addTeam({ id: teamId, name: teamName, label: teamName });
        }
      } catch (error) {
        console.warn("Unable to preload current team", error);
        if (teamSelector && teamSelector.getTeams().length === 0) {
          const fallbackName = `Team ${teamId}`;
          teamSelector.addTeam({ id: teamId, name: fallbackName, label: fallbackName });
        }
      }
    }
  );
};

document
  .getElementById("distance")
  .addEventListener("change", async function () {
    if (!teamSelector) {
      return;
    }
    const selectedTeams = teamSelector.getTeams();
    if (selectedTeams.length === 0) {
      return;
    }

    const selectedCourse = this.value;
    const teamIds = selectedTeams.map((team) => team.id);
    teamsData = {};
    await Promise.all(
      teamIds.map(async (teamId) => {
        teamsData[teamId] = await makeApiCall("seasonBests", teamId);
      })
    );
    const results = await simulateMeet(teamsData, selectedCourse);
    results.teamNames = { ...teamNameMapGlobal };
    updateResults(results);
  });

function printResults() {
  console.log("Printing meet results");
  const resultsDiv = document.getElementById("resultsDiv");
  if (!resultsDiv) {
    alert("No results to print. Please simulate a meet first.");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow pop-ups for printing");
    return;
  }

  // Deep clone the results div
  const contentClone = resultsDiv.cloneNode(true);

  // Wrap content in two-column layout
  const wrapper = document.createElement('div');
  wrapper.className = 'results-columns';
  wrapper.appendChild(contentClone);

  const styles = `
    <style>
      body { 
        font-family: Arial, sans-serif; 
        padding: 20px; 
        background-color: white;
      }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin-bottom: 1.5em; 
        page-break-inside: avoid;
      }
      th, td { 
        border: 1px solid #333; 
        padding: 8px;
        text-align: left; 
        font-size: 11px;
      }
      th {
        background-color: #f0f0f0;
        font-weight: bold;
      }
      h2 { 
        margin-top: 1.5em;
        margin-bottom: 0.5em;
        font-size: 18px;
        page-break-after: avoid;
        break-inside: avoid;
      }
      h3 { 
        margin-top: 1em;
        margin-bottom: 0.5em;
        font-size: 14px;
        page-break-after: avoid;
        break-inside: avoid;
      }
      .subtitle {
        page-break-after: avoid;
        break-inside: avoid;
      }
      .mb-3 {
        display: none;
      }
      .results-columns {
        column-count: 2;
        column-gap: 20px;
        width: 100%;
      }
      .results-columns > * {
        break-inside: avoid;
        page-break-inside: avoid;
        margin-bottom: 1.25rem;
        display: block;
      }
      .results-columns table {
        width: 100%;
      }
      h1 {
        text-align: center;
        margin-bottom: 1em;
        break-after: avoid;
      }
      .result-filter-buttons {
        display: none !important;
      }
      @media print {
        body { 
          padding: 0; 
          margin: 0; 
        }
        table { 
          page-break-inside: avoid; 
        }
        tr { 
          page-break-inside: avoid; 
        }
      }
    </style>
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Cross Country Meet Results</title>
        ${styles}
      </head>
      <body>
        <h1>Cross Country Meet Results</h1>
        ${wrapper.outerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();

  // Wait for content to load before printing
  printWindow.onload = () => {
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}

// Add event listener for print button
document
  .getElementById("printResults")
  .addEventListener("click", printResults);
