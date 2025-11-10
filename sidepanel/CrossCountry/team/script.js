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
        const firstSeven = allTeamMembers.slice(0, 7);
        if (firstSeven.length >= 5) {
          // Track which athletes are top 7 for their team
          if (!teamTop7[gender][key]) {
            teamTop7[gender][key] = new Set();
          }
          firstSeven.forEach((athlete) => {
            teamTop7[gender][key].add(`${athlete.name}-${athlete.team}`);
            allAthletes.push(athlete);
          });
        }
      }
    }
    const allAthletesSorted = allAthletes.sort((a, b) => a.time - b.time);
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

document
  .getElementById("teamsInput")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const teamIds = formData.getAll("teamId");
    const teamNames = formData.getAll("teamName");
    teamsData = {};
    
    // Store team names
    const teamNameMap = {};
    teamIds.forEach((id, index) => {
      if (id) {
        teamNameMap[id] = teamNames[index] || id;
      }
    });
    
    await Promise.all(
      teamIds.map(async (teamId) => {
        if (teamId) {
          teamsData[teamId] = await makeApiCall("seasonBests", teamId);
        }
      })
    );
    console.log(teamsData);
    const results = await simulateMeet(teamsData);
    results.teamNames = teamNameMap;

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
  const course = results.course;
  const scores = results.scores;
  const placementResults = results.results;
  const resultsDiv = document.getElementById("resultsDiv");

  // Store the full results for frosh-soph filtering
  window.fullResults = results;
  window.fullResultsWithoutTopSeven = JSON.parse(JSON.stringify(results));

  ["boys", "girls"].forEach(async (gender) => {
    const genderResults = placementResults[gender];
    const table = resultsDiv.querySelector(`#${gender} .placementTable`);
    table.innerHTML = "";
    genderResults.forEach((athlete, i) => {
      const row = document.createElement("tr");
      row.innerHTML = `
                <td>${i + 1}</td>
                <td>${athlete.grade}</td>
                <td>${athlete.name}</td>
                <td>${timeInSecondsToMMSSMS(athlete.time)}</td>
                <td>${athlete.team}</td>
            `;
      table.appendChild(row);
    });

    // Update frosh-soph table with all frosh-soph athletes
    updateFroshSophTable(gender, genderResults, false);
  });

  ["boys", "girls"].forEach(async (gender) => {
    results.scores[gender] = Object.fromEntries(
      Object.entries(results.scores[gender]).sort((a, b) => a[1] - b[1])
    );
    const scoreTable = document.querySelector(`#${gender} > .scoreTable`);
    scoreTable.innerHTML = "";
    for (var teamId in results.scores[gender]) {
      const teamScore =
        results.scores[gender][teamId] !== 0
          ? results.scores[gender][teamId]
          : "DNP";
      // Use stored team name if available, otherwise fetch it
      const teamName = results.teamNames && results.teamNames[teamId] 
        ? results.teamNames[teamId]
        : null;
      
      if (teamName) {
        const teamRow = document.createElement("tr");
        teamRow.innerHTML = `
                    <td>${teamName}</td>
                    <td>${teamScore}</td>
                `;
        scoreTable.appendChild(teamRow);
      } else {
        try {
          const name = (
            await athleticWrapper.crosscountry.team.GetTeamCore(teamId)
          )["team"]["Name"];
          const teamRow = document.createElement("tr");
          teamRow.innerHTML = `
                      <td>${name}</td>
                      <td>${teamScore}</td>
                  `;
          scoreTable.appendChild(teamRow);
        } catch (error) {
          console.error("Error getting team name for", teamId, error);
          const teamRow = document.createElement("tr");
          teamRow.innerHTML = `
                      <td>Team ${teamId}</td>
                      <td>${teamScore}</td>
                  `;
          scoreTable.appendChild(teamRow);
        }
      }
    }
  });
}

function updateFroshSophTable(gender, allAthletes, excludeTeamTop7 = false) {
  const resultsDiv = document.getElementById("resultsDiv");
  
  // Always use unfiltered athletes if available
  const athletesToUse = window.fullResults && window.fullResults.allAthletesUnfiltered
    ? window.fullResults.allAthletesUnfiltered[gender]
    : allAthletes;
  
  let froshSophAthletes = athletesToUse.filter((athlete) => {
    const grade = parseInt(athlete.grade);
    return grade === 9 || grade === 10;
  });

  // If excludeTeamTop7 is true, remove frosh-soph athletes who are in their team's top 7
  if (excludeTeamTop7 && window.fullResults.teamTop7) {
    const teamTop7Set = window.fullResults.teamTop7[gender];
    froshSophAthletes = froshSophAthletes.filter((athlete) => {
      const athleteKey = `${athlete.name}-${athlete.team}`;
      const teamTopSevenForThisTeam = teamTop7Set[athlete.team];
      return (
        !teamTopSevenForThisTeam || !teamTopSevenForThisTeam.has(athleteKey)
      );
    });
  }
  
  // Sort by time
  froshSophAthletes.sort((a, b) => a.time - b.time);

  // Update the placement table
  const placementTable = resultsDiv.querySelector(
    `#${gender} .placementTableFroshSoph`
  );
  placementTable.innerHTML = "";
  froshSophAthletes.forEach((athlete, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${i + 1}</td>
            <td>${athlete.grade}</td>
            <td>${athlete.name}</td>
            <td>${timeInSecondsToMMSSMS(athlete.time)}</td>
            <td>${athlete.team}</td>
        `;
    placementTable.appendChild(row);
  });

  // Calculate scores for frosh-soph athletes
  const teamScores = {};
  for (var key in window.fullResults.scores[gender]) {
    teamScores[key] = 0;
  }

  const scoringStuff = {};
  for (var i = 0; i < froshSophAthletes.length; i++) {
    const team = froshSophAthletes[i].team;
    if (!scoringStuff[team]) scoringStuff[team] = [];
    scoringStuff[team].push(froshSophAthletes[i]);
    if (scoringStuff[team].length <= 5) {
      teamScores[team] += i + 1;
    }
  }

  // Update the score table
  const scoreTable = resultsDiv.querySelector(
    `#${gender} > .scoreTableFroshSoph`
  );
  scoreTable.innerHTML = "";

  const sortedScores = Object.entries(teamScores).sort((a, b) => {
    if (a[1] === 0) return 1;
    if (b[1] === 0) return -1;
    return a[1] - b[1];
  });

  sortedScores.forEach(async ([teamId, teamScore]) => {
    const score = teamScore !== 0 ? teamScore : "DNP";
    // Use stored team name if available, otherwise fetch it
    const teamName = window.fullResults.teamNames && window.fullResults.teamNames[teamId]
      ? window.fullResults.teamNames[teamId]
      : null;
    
    if (teamName) {
      const teamRow = document.createElement("tr");
      teamRow.innerHTML = `
                <td>${teamName}</td>
                <td>${score}</td>
            `;
      scoreTable.appendChild(teamRow);
    } else {
      try {
        const name = (
          await athleticWrapper.crosscountry.team.GetTeamCore(teamId)
        )["team"]["Name"];
        const teamRow = document.createElement("tr");
        teamRow.innerHTML = `
                  <td>${name}</td>
                  <td>${score}</td>
              `;
        scoreTable.appendChild(teamRow);
      } catch (error) {
        console.error("Error getting team name for", teamId, error);
        const teamRow = document.createElement("tr");
        teamRow.innerHTML = `
                  <td>Team ${teamId}</td>
                  <td>${score}</td>
              `;
        scoreTable.appendChild(teamRow);
      }
    }
  });
}

function timeInSecondsToMMSSMS(time) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.floor((time - Math.floor(time)) * 1000);
  return `${minutes}:${seconds}.${milliseconds}`;
}

function addAutocomplete(inputElement) {
  inputElement.addEventListener("input", async function () {
    const query = this.value;
    // Find the dropdown container
    const control = inputElement.closest(".control");
    const suggestionsContainer = control ? control.querySelector(".dropdown-content") : null;
    
    if (query.length < 3) {
      if (suggestionsContainer) {
        suggestionsContainer.innerHTML = "";
      }
      return;
    }
    const suggestions = await fetchTeamSuggestions(query);
    displaySuggestions(suggestions, inputElement);
  });
}

function displaySuggestions(suggestions, inputElement) {
  // Find the dropdown container (next sibling of the control div containing the input)
  let suggestionsContainer = inputElement.nextElementSibling;
  
  // If no direct sibling, look for it in the same control or parent
  if (!suggestionsContainer || !suggestionsContainer.classList.contains("dropdown-content")) {
    const control = inputElement.closest(".control");
    suggestionsContainer = control ? control.querySelector(".dropdown-content") : null;
  }
  
  if (!suggestionsContainer) {
    return; // Fallback if container not found
  }
  
  suggestionsContainer.innerHTML = "";
  suggestions.forEach((team) => {
    const suggestionItem = document.createElement("div");
    suggestionItem.classList.add("dropdown-item");

    suggestionItem.innerHTML =
      team.textsuggest + " <small>" + team.subtext + "</small>";

    suggestionItem.addEventListener("click", () => {
      // Set the consolidated input field value
      inputElement.value = team.textsuggest + " " + team.subtext;

      // Find the teamId input in the same field/has-addons container
      const fieldContainer =
        inputElement.closest(".field.has-addons") ||
        inputElement.closest(".column");
      const teamIdInput = fieldContainer.querySelector('input[name="teamId"]');
      if (teamIdInput) {
        teamIdInput.value = team.id_db;
      }
      suggestionsContainer.innerHTML = "";
    });
    suggestionsContainer.appendChild(suggestionItem);
  });
}

// Initialize autocomplete for the initial input field
addAutocomplete(document.getElementById("autocompleteInput"));

$("#rowAdder").click(function () {
  const newRowAdd = `
        <div class="column px-0">
            <div class="field has-addons">
                <div class="control">
                    <button class="button is-danger" id="DeleteRow" type="button">
                        <i class="bi bi-trash"></i>
                        Delete
                    </button>
                </div>
                <div class="control is-expanded">
                    <input type="text" class="input autocompleteInput" placeholder="Search for a team" name="teamName">
                    <div class="dropdown-content"></div>
                </div>
                <div class="control">
                    <input type="text" class="input" name="teamId" placeholder="Team ID" hidden>
                </div>
            </div>
        </div>`;
  $("#listOfIDs").append(newRowAdd);

  // Add autocomplete to the new input field
  const newInput = $("#listOfIDs .column:last-child .autocompleteInput")[0];
  addAutocomplete(newInput);
});

$("body").on("click", "#DeleteRow", function () {
  $(this).closest(".column").remove();
});

window.onload = function () {
  chrome.runtime.sendMessage(
    {
      action: "getCurrentTabUrl",
    },
    async (response) => {
      const url = new URL(response.tab.url);
      const [empty, type, teamId, sport, level] = url.pathname.split("/");
      if (type !== "team" || sport !== "cross-country") return;
      document.getElementById("firstTeam").value = teamId;
    }
  );
};

document
  .getElementById("distance")
  .addEventListener("change", async function () {
    const selectedCourse = this.value;
    const formData = new FormData(document.getElementById("teamsInput"));
    const teamIds = formData.getAll("teamId");
    teamsData = {};
    await Promise.all(
      teamIds.map(async (teamId) => {
        teamsData[teamId] = await makeApiCall("seasonBests", teamId);
      })
    );
    const results = await simulateMeet(teamsData, selectedCourse);
    updateResults(results);
  });

document
  .getElementById("autocompleteInput")
  .addEventListener("input", async function () {
    const query = this.value;
    const control = this.closest(".control");
    const suggestionsContainer = control ? control.querySelector(".dropdown-content") : null;
    
    if (query.length < 3) {
      if (suggestionsContainer) {
        suggestionsContainer.innerHTML = "";
      }
      return;
    }
    const suggestions = await fetchTeamSuggestions(query);
    displaySuggestions(suggestions, this);
  });

async function fetchTeamSuggestions(query) {
  try {
    // Replace with actual API call to fetch team suggestions
    const response = await window.athleticWrapper.search.AutoComplete(query);
    return response.response.docs.filter((doc) => doc.type === "Team");
  } catch (error) {
    console.error("Error fetching team suggestions:", error);
    return [];
  }
}

document
  .getElementById("listOfIDs")
  .addEventListener("paste", function (event) {
    event.preventDefault();

    const paste = event.clipboardData.getData("text");

    const lines = paste.split("\n");

    const input = event.target;

    // get the input element's position in its parent
    const index = Array.from(input.parentNode.children).indexOf(input);

    lines.forEach((line, i) => {
      const newRowAdd = `
            <div class="column">
                <div class="field has-addons">
                    <div class="control">
                        <button class="button is-danger" id="DeleteRow" type="button">
                            <i class="bi bi-trash"></i>
                            Delete
                        </button>
                    </div>
                    <div class="control">
                        <input type="text" class="input" name="teamId" value="${line}">
                    </div>
                </div>
            </div>`;
      if (i === 0 && input.value === "") {
        $(input).val(line);
      } else {
        $(input).closest(".column").after(newRowAdd);
      }
    });
  });

// Event listeners for Remove Team Top 7 buttons
document
  .getElementById("boysRemoveTopSeven")
  .addEventListener("click", function () {
    if (window.fullResults) {
      updateFroshSophTable("boys", window.fullResults.results.boys, true);
    }
  });

document
  .getElementById("girlsRemoveTopSeven")
  .addEventListener("click", function () {
    if (window.fullResults) {
      updateFroshSophTable("girls", window.fullResults.results.girls, true);
    }
  });

// Event listeners for Refresh buttons
document
  .getElementById("boysRefreshFroshSoph")
  .addEventListener("click", function () {
    if (window.fullResults) {
      updateFroshSophTable("boys", window.fullResults.results.boys, false);
    }
  });

document
  .getElementById("girlsRefreshFroshSoph")
  .addEventListener("click", function () {
    if (window.fullResults) {
      updateFroshSophTable("girls", window.fullResults.results.girls, false);
    }
  });
