async function makeApiCall(method, ...args) {
  let url;
  let responseType = "json";

  const sport = window.athletic.sport;
  const divisionId = window.athletic.divisionId;

  switch (method) {
    case "GetTree":
      url = `https://www.athletic.net/api/v1/DivisionHome/GetTree?sport=${sport}&divisionId=${divisionId}&depth=5&includeTeams=true`;
      break;
    case "seasonBests":
      const [teamId, year] = args;
      const sportPath = {
        xc: "CrossCountry",
        tfo: "TrackAndField",
        tfi: "TrackAndField",
      }[sport];
      url = `https://www.athletic.net/${sportPath}/seasonbest?SchoolID=${teamId}&S=${
        year || ""
      }`;
      responseType = "text/html";
      break;
    case "AutoComplete":
      const [query] = args;
      url = `https://www.athletic.net/api/v1/AutoComplete/search?q=${encodeURIComponent(
        query
      )}&fq=`;
      break;
    default:
      throw new Error(`Unknown method: ${method}`);
  }

  try {
    // This is a simplified assumption. In a real scenario, you might have a more robust
    // way to decide whether to call a wrapper or use the service worker.
    // For this case, we'll just use the service worker proxy for all calls.
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "makeApiRequest",
          url: url,
          responseType: responseType,
        },
        (response) => {
          console.log(response.data);
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
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
}

function buildApiUrl(method, ...args) {
    const sport = window.athletic.sport;
    const divisionId = window.athletic.divisionId;

    switch (method) {
        case 'GetTree':
            return `https://www.athletic.net/api/v1/DivisionHome/GetTree?sport=${sport}&divisionId=${divisionId}&depth=5&includeTeams=true`;
        case 'seasonBests':
            const [teamId, year] = args;
            const sportPath = {
                'xc': 'CrossCountry',
                'tfo': 'TrackAndField',
                'tfi': 'TrackAndField'
            }[sport];
            return `https://www.athletic.net/${sportPath}/seasonbest?SchoolID=${teamId}&S=${year || ''}`;
        case 'AutoComplete':
            const [query] = args;
            return `https://www.athletic.net/api/v1/AutoComplete/search?q=${encodeURIComponent(query)}&fq=`;
        default:
            throw new Error(`Unknown method: ${method}`);
    }
}

function buildApiOptions(method, ...args) {
    // For now, all proxied requests are simple GETs with no special options.
    // This can be expanded if needed.
    return {
        headers: {},
        body: null,
        method: 'GET',
    };
}

function parseHTMLResponse(method, htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
  
    if (method === "seasonBests") {
        const data = {};
        const divs = doc.getElementsByClassName("distance");

        for (let i = 0; i < divs.length; i++) {
            const element = divs[i];
            const distanceLabel = element.querySelector("h3");
            if (!distanceLabel) continue;

            const distanceSpan = distanceLabel.querySelector("span");
            if (distanceSpan) distanceSpan.remove();
            const distance = distanceLabel.textContent.trim();

            if (!data[distance]) {
                data[distance] = {};
            }

            const maleContainer = element.querySelector(".M");
            const femaleContainer = element.querySelector(".F");

            if (maleContainer) {
                const maleTable = maleContainer.querySelector("table");
                if (maleTable) {
                    const maleTableRows = maleTable.querySelectorAll("tr");
                    const maleRecords = [];
                    maleTableRows.forEach(row => {
                        [...row.querySelectorAll("span, small")].forEach(el => el.remove());
                        const cells = row.querySelectorAll("td");
                        if (cells.length >= 4) {
                            maleRecords.push({
                                grade: cells[1].textContent.trim(),
                                name: cells[2].textContent.trim(),
                                time: cells[3].textContent.trim(),
                            });
                        }
                    });
                    data[distance]["boys"] = maleRecords;
                }
            }

            if (femaleContainer) {
                const femaleTable = femaleContainer.querySelector("table");
                if (femaleTable) {
                    const femaleTableRows = femaleTable.querySelectorAll("tr");
                    const femaleRecords = [];
                    femaleTableRows.forEach(row => {
                        [...row.querySelectorAll("span, small")].forEach(el => el.remove());
                        const cells = row.querySelectorAll("td");
                        if (cells.length >= 4) {
                            femaleRecords.push({
                                grade: cells[1].textContent.trim(),
                                name: cells[2].textContent.trim(),
                                time: cells[3].textContent.trim(),
                            });
                        }
                    });
                    data[distance]["girls"] = femaleRecords;
                }
            }
        }
        return data;
    }
    return {};
}

var teamsData = {};
var teamNameMapGlobal = {};
var teamSelector = null;
var teamListManager = null;
var divisionData = null;
var availableCourses = {};

document.addEventListener("DOMContentLoaded", async () => {
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
    storageKey: "division-meet-teamLists",
    selectElement: document.getElementById("teamListSelectDivision"),
    nameInput: document.getElementById("teamListNameDivision"),
    saveButton: document.getElementById("saveTeamListDivision"),
    updateButton: document.getElementById("updateTeamListDivision"),
    deleteButton: document.getElementById("deleteTeamListDivision"),
    loadButton: document.getElementById("loadTeamListDivision"),
    emptyMessage: "Select at least one team before saving.",
  });

  const divisionSelect = document.getElementById("divisionSelect");

  chrome.runtime.sendMessage(
    { action: "getCurrentTabUrl" },
    async (response) => {
      if (response && response.tab) {
        const url = new URL(response.tab.url);
        const pathSegments = url.pathname.split("/");

        let sport, divisionId;

        if (pathSegments.includes("division")) {
          const divisionIndex = pathSegments.indexOf("division");
          divisionId = pathSegments[divisionIndex + 1];

          if (pathSegments.includes("cross-country")) {
            sport = "xc";
          } else if (pathSegments.includes("track-and-field-outdoor")) {
            sport = "tfo";
          } else if (pathSegments.includes("track-and-field-indoor")) {
            sport = "tfi";
          }
        }

        if (sport && divisionId) {
          window.athletic = { sport, divisionId };
          try {
            divisionData = await makeApiCall("GetTree");
            populateDivisionDropdown(divisionData.tree, divisionSelect);
            divisionSelect.disabled = false;
            divisionSelect.firstChild.textContent = "Select a division...";
          } catch (error) {
            console.error("Failed to load division data:", error);
            divisionSelect.firstChild.textContent = "Error loading divisions";
          }
        }
      }
    }
  );

  divisionSelect.addEventListener("change", (event) => {
    const selectedDivisionId = parseInt(event.target.value, 10);
    if (!selectedDivisionId || !divisionData) return;

    const allTeams = divisionData.alignedTeams;
    const allDivisions = flattenDivisions(divisionData.tree);

    const selectedDivision = allDivisions.find(
      (d) => d.IDDivision === selectedDivisionId
    );
    if (!selectedDivision) return;

    const childDivisionIds = new Set(
      flattenDivisions(selectedDivision).map((d) => d.IDDivision)
    );
    childDivisionIds.add(selectedDivisionId);

    const teamsInDivision = allTeams.filter((team) =>
      childDivisionIds.has(team.DivisionID)
    );

    teamSelector.clear();
    teamsInDivision.forEach((team) => {
      teamSelector.addTeam({
        id: team.SchoolID,
        name: team.SchoolName,
        subtext: "",
      });
    });
  });

  document
    .getElementById("distance")
    .addEventListener("change", async (event) => {
      const selectedCourse = event.target.value;
      if (selectedCourse) {
        const results = await simulateMeet(teamsData, selectedCourse);
        results.teamNames = { ...teamNameMapGlobal };
        updateResults(results);
      }
    });
});

function populateDivisionDropdown(rootDivision, selectElement, level = 0) {
  if (!rootDivision) return;

  const option = document.createElement("option");
  option.value = rootDivision.IDDivision;
  option.textContent = `${"--".repeat(level)} ${rootDivision.DivName}`;
  selectElement.appendChild(option);

  for (let i = 2; i <= 4; i++) {
    const subLevelKey = `L${i}`;
    if (rootDivision[subLevelKey] && Array.isArray(rootDivision[subLevelKey])) {
      rootDivision[subLevelKey].forEach((subDivision) => {
        populateDivisionDropdown(subDivision, selectElement, level + 1);
      });
    }
  }
}

function flattenDivisions(root) {
  const divisions = [];
  function recurse(division) {
    if (!division) return;
    divisions.push(division);
    for (let i = 2; i <= 4; i++) {
      const subLevelKey = `L${i}`;
      if (division[subLevelKey] && Array.isArray(division[subLevelKey])) {
        division[subLevelKey].forEach(recurse);
      }
    }
  }
  recurse(root);
  return divisions;
}

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
    console.log(results);
    results.teamNames = { ...teamNameMap };

    availableCourses = results.courses;

    const distanceSelect = document.getElementById("distance");
    distanceSelect.innerHTML = "";
    Object.keys(availableCourses).forEach((course) => {
      const option = document.createElement("option");
      option.value = course;
      option.textContent = course;
      if (course === results.course) {
        option.selected = true;
      }
      distanceSelect.appendChild(option);
    });

    updateResults(results);
  });

function updateResults(results) {
  if (!results.teamNames || Object.keys(results.teamNames).length === 0) {
    results.teamNames = { ...teamNameMapGlobal };
  }

  const teamNames = results.teamNames || {};

  window.fullResults = {
    ...results,
    teamNames,
    teamIds: Object.keys(teamNames),
  };

  ["boys", "girls"].forEach((gender) => {
    renderPlacementTable(gender, results.results[gender], teamNames);
    renderScoreTable(gender, results.results[gender], teamNames);
  });
}

function renderPlacementTable(gender, athletes, teamNames) {
  const table = document.querySelector(`#${gender} .placementTable`);
  if (!table) return;
  const body = table.querySelector("tbody");
  if (!body) return;

  body.innerHTML = "";

  if (!athletes || !athletes.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No athletes found for this gender.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  athletes.forEach((athlete, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${index + 1}</td>
        <td>${athlete.grade || "N/A"}</td>
        <td>${athlete.name}</td>
        <td>${((time) => {
          const minutes = Math.floor(time / 60);
          const seconds = Math.floor(time % 60);
          const milliseconds = Math.round((time - Math.floor(time)) * 100);
          return `${minutes}:${seconds
            .toString()
            .padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
        })(athlete.time)}</td>
        <td>${teamNames[athlete.team] || "Unknown"}</td>
      `;
    body.appendChild(row);
  });
}

function renderScoreTable(gender, athletes, teamNames) {
  const table = document.querySelector(`#${gender} .scoreTable`);
  if (!table) return;
  const body = table.querySelector("tbody");
  if (!body) return;

  body.innerHTML = "";

  const teamScores = calculateTeamScores(athletes);
  const sortedTeams = Object.entries(teamScores).sort(([, a], [, b]) => a - b);

  if (sortedTeams.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "No teams to score.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  sortedTeams.forEach(([teamId, score], index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${index + 1}</td>
        <td>${teamNames[teamId] || "Unknown"}</td>
        <td>${score}</td>
      `;
    body.appendChild(row);
  });
}

function calculateTeamScores(athletes) {
  const teamScores = {};
  const scoringAthletes = {};

  if (!athletes) return teamScores;

  athletes.forEach((athlete, index) => {
    const teamId = athlete.team;
    if (!teamScores[teamId]) {
      teamScores[teamId] = 0;
      scoringAthletes[teamId] = 0;
    }
    if (scoringAthletes[teamId] < 5) {
      teamScores[teamId] += index + 1;
      scoringAthletes[teamId]++;
    }
  });

  return teamScores;
}

async function simulateMeet(teamsData, selectedCourse = null) {
  console.log("Team Data");
  console.log(teamsData);
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

  const results = {};
  const genders = ["boys", "girls"];
  genders.forEach((gender) => {
    const allAthletes = [];
    for (const key in teamsData) {
      const teamData = teamsData[key];
      if (
        teamData.hasOwnProperty(course) &&
        teamData[course].hasOwnProperty(gender)
      ) {
        teamData[course][gender].forEach((athlete) => {
          athlete.time = MMSSMSToSeconds(athlete.time);
          athlete.team = key;
          allAthletes.push(athlete);
        });
      }
    }
    results[gender] = allAthletes.sort((a, b) => a.time - b.time);
  });
  return {
    course,
    results,
    courses,
  };
}

document.getElementById("printResults").addEventListener("click", () => {
  const printWindow = window.open("", "_blank");
  printWindow.document.write("<html><head><title>Print Results</title>");
  printWindow.document.write(
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@1.0.2/css/bulma.min.css">'
  );
  printWindow.document.write(
    "<style>body { padding: 20px; } .table { margin-bottom: 20px; } </style>"
  );
  printWindow.document.write("</head><body>");

  const resultsDiv = document.getElementById("resultsDiv").cloneNode(true);
  // Remove filter bars from print view
  resultsDiv
    .querySelectorAll(".results-filter-bar")
    .forEach((el) => el.remove());

  printWindow.document.write(resultsDiv.innerHTML);
  printWindow.document.write("</body></html>");
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
});
