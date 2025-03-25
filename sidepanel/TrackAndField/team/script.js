var resultsOrganized = {};
let myChartInstance = null;

function openPage(pageName, elmnt, color) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].classList.remove("active");
  }
  tablinks = document.getElementsByClassName("tablink");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].style.backgroundColor = "";
  }
  document.getElementById(pageName).classList.add("active");
  elmnt.style.backgroundColor = color;
}

document.getElementById("defaultOpen").click();

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
      document.getElementById("dualMeetFirstTeam").value = teamId;
    }
  );
};

$("body").on("click", "#DeleteRow", function () {
  $(this).closest(".column").remove();
});

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

var teamsData = {};

document
  .getElementById("teamsInputNonDualMeet")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const teamIds = formData.getAll("teamId");
    const year = formData.get('nonDualMeetYear');
    const currentYear = new Date().getFullYear();
    if (year > currentYear) {
      return alert('Pick a valid year!')
    }
    teamsData = {};
    await Promise.all(
      teamIds.map(async (teamId) => {
        teamsData[teamId] =
          await athleticWrapper.track.team.records.GetTeamEventRecords(
            teamId,
            year
          );
      })
    );
    const results = await simulateMeet(teamIds, teamsData, false);

    updateResults(results, false);
  });

  //Dual Meet
document
.getElementById('teamsInput')
.addEventListener('submit', async function (event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const teamIds = formData.getAll('teamId');
    const year = formData.get('dualMeetYear');
    // get today's year and check if its greater than or equal to the submitted year
    const currentYear = new Date().getFullYear();
    if (year > currentYear) {
      return alert('Pick a valid year!')
    }
    teamsData = {};
    await Promise.all(
        teamIds.map(async (teamId) => {
            teamsData[teamId] = await athleticWrapper.track.team.records.GetTeamEventRecords(teamId, year);
        })
    );
    const results = await simulateMeet(teamIds, teamsData, true);
    updateResults(results, true);
});

/**
 *
 * @param {Object} teamsData
 * @param {Boolean} dual
 * @returns
 */
async function simulateMeet(teamIds, teamsData, dual) {
  if (dual == true) {
    const homeTeamId = teamIds[0];
    const opposingTeamId = teamIds[1];
    // fetch the meet data
    const homeTeamResponse = teamsData[homeTeamId];
    // console.log(homeTeamResponse);
    const { eventRecords: homeTeamEventRecords } = homeTeamResponse;

    const opposingTeamResponse = teamsData[opposingTeamId];
    const { eventRecords: opposingTeamEventRecords } = opposingTeamResponse;

    const events = {
      M: {},
      F: {},
    };
    homeTeamEventRecords.forEach((record) => {
      if (!events[record.Gender][record.Event]) {
        events[record.Gender][record.Event] = [];
      }
      // add school id to the record
      record.SchoolID = homeTeamId;
      events[record.Gender][record.Event].push(record);
    });

    opposingTeamEventRecords.forEach((record) => {
      if (!events[record.Gender][record.Event]) {
        events[record.Gender][record.Event] = [];
      }
      record.SchoolID = opposingTeamId;
      events[record.Gender][record.Event].push(record);
    });

    for (const gender in events) {
      for (const event in events[gender]) {
        events[gender][event].sort((a, b) => a.SortInt - b.SortInt);
      }
    }

    const maleCountedEvents = [
      "100 Meters",
      "200 Meters",
      "400 Meters",
      "800 Meters",
      "1600 Meters",
      "3200 Meters",
      "110m Hurdles",
      "300m Hurdles",
      "4x100 Relay",
      "4x400 Relay",
      "High Jump",
      "Pole Vault",
      "Long Jump",
      "Triple Jump",
      "Shot Put",
      "Discus",
    ];

    const femaleCountedEvents = [
      "100 Meters",
      "200 Meters",
      "400 Meters",
      "800 Meters",
      "1600 Meters",
      "3200 Meters",
      "100m Hurdles",
      "300m Hurdles",
      "4x100 Relay",
      "4x400 Relay",
      "High Jump",
      "Pole Vault",
      "Long Jump",
      "Triple Jump",
      "Shot Put",
      "Discus",
    ];

    // count up the points
    const points = {
      F: {},
      M: {},
    };
    // Tally up the male points
    for (const event of maleCountedEvents) {
      if (events.M[event]) {
        // 1st place gets 5 points, 2nd place gets 3 points, 3rd place gets 1 point
        // If the event is a relay, give the winner 5 and the loser 0
        if (event.includes("Relay")) {
          if (events.M[event][0]) {
            if (!points.M[events.M[event][0].SchoolID]) {
              points.M[events.M[event][0].SchoolID] = 0;
            }
            points.M[events.M[event][0].SchoolID] += 5;
          }
          if (events.M[event][1]) {
            if (!points.M[events.M[event][1].SchoolID]) {
              points.M[events.M[event][1].SchoolID] = 0;
            }
            points.M[events.M[event][1].SchoolID] += 0;
          }
          continue;
        }
        if (events.M[event][0]) {
          if (!points.M[events.M[event][0].SchoolID]) {
            points.M[events.M[event][0].SchoolID] = 0;
          }
          points.M[events.M[event][0].SchoolID] += 5;
        }
        if (events.M[event][1]) {
          if (!points.M[events.M[event][1].SchoolID]) {
            points.M[events.M[event][1].SchoolID] = 0;
          }
          points.M[events.M[event][1].SchoolID] += 3;
        }
        if (events.M[event][2]) {
          if (!points.M[events.M[event][2].SchoolID]) {
            points.M[events.M[event][2].SchoolID] = 0;
          }
          points.M[events.M[event][2].SchoolID] += 1;
        }
      }
    }
    // Tally up the female points
    for (const event of femaleCountedEvents) {
      if (events.F[event]) {
        // 1st place gets 5 points, 2nd place gets 3 points, 3rd place gets 1 point
        // If the event is a relay, give the winner 5 and the loser 0
        if (event.includes("Relay")) {
          if (events.F[event][0]) {
            if (!points.F[events.F[event][0].SchoolID]) {
              points.F[events.F[event][0].SchoolID] = 0;
            }
            points.F[events.F[event][0].SchoolID] += 5;
          }
          if (events.F[event][1]) {
            if (!points.F[events.F[event][1].SchoolID]) {
              points.F[events.F[event][1].SchoolID] = 0;
            }
            points.F[events.F[event][1].SchoolID] += 0;
          }
          continue;
        }

        if (events.F[event][0]) {
          if (!points.F[events.F[event][0].SchoolID]) {
            points.F[events.F[event][0].SchoolID] = 0;
          }
          points.F[events.F[event][0].SchoolID] += 5;
        }
        if (events.F[event][1]) {
          if (!points.F[events.F[event][1].SchoolID]) {
            points.F[events.F[event][1].SchoolID] = 0;
          }
          points.F[events.F[event][1].SchoolID] += 3;
        }
        if (events.F[event][2]) {
          if (!points.F[events.F[event][2].SchoolID]) {
            points.F[events.F[event][2].SchoolID] = 0;
          }
          points.F[events.F[event][2].SchoolID] += 1;
        }
      }
    }

    // Get the team names
    const homeTeamInfo = await athleticWrapper.track.team.Team(
      homeTeamId,
      new Date().getFullYear()
    );
    // console.log(homeTeamInfo);
    const homeTeamName = homeTeamInfo.team.Name;
    const opposingTeamInfo = await athleticWrapper.track.team.Team(
      opposingTeamId,
      new Date().getFullYear()
    );
    const opposingTeamName = opposingTeamInfo.team.Name;
    // reformat results, so that the results

    return {
      teamNames: {
        homeTeamId: homeTeamName,
        opposingTeamId: opposingTeamName,
      },
      points,
      results: events,
    };
  } else {
    console.log(teamsData);

    const events = {
      M: {},
      F: {},
    };

    Object.values(teamsData).forEach((teamData) => {
      const school = teamData.preferences.IDSchool;
      teamData.eventRecords.forEach((record) => {
        if (!events[record.Gender][record.Event]) {
          events[record.Gender][record.Event] = [];
        }
        // add school id to the record
        record.SchoolID = school;

        events[record.Gender][record.Event].push(record);
      });
    });

    for (const gender in events) {
      for (const event in events[gender]) {
        events[gender][event].sort((a, b) => a.SortInt - b.SortInt);
      }
    }

    const maleCountedEvents = [
      "100 Meters",
      "200 Meters",
      "400 Meters",
      "800 Meters",
      "1600 Meters",
      "3200 Meters",
      "110m Hurdles",
      "300m Hurdles",
      "4x100 Relay",
      "4x400 Relay",
      "High Jump",
      "Pole Vault",
      "Long Jump",
      "Triple Jump",
      "Shot Put",
      "Discus",
    ];

    const femaleCountedEvents = [
      "100 Meters",
      "200 Meters",
      "400 Meters",
      "800 Meters",
      "1600 Meters",
      "3200 Meters",
      "100m Hurdles",
      "300m Hurdles",
      "4x100 Relay",
      "4x400 Relay",
      "High Jump",
      "Pole Vault",
      "Long Jump",
      "Triple Jump",
      "Shot Put",
      "Discus",
    ];

    // Remove events not in the counted events lists
    for (const gender in events) {
      for (const event in events[gender]) {
        if (
          (gender === "M" && !maleCountedEvents.includes(event)) ||
          (gender === "F" && !femaleCountedEvents.includes(event))
        ) {
          delete events[gender][event];
        }
      }
    }

    // count up the points
    const points = {
      F: {},
      M: {},
    };
    // Tally up the male points
    for (const event of maleCountedEvents) {
      if (events.M[event]) {
        const pointsFormat = {
          1: 10,
          2: 8,
          3: 6,
          4: 5,
          5: 4,
          6: 3,
          7: 2,
          8: 1,
        };
        // 1st place gets 10 points, 2nd place gets 8 points, 3rd place gets 6 points, 4th place gets 5 points, 5th place gets 4 points, 6th place gets 3 points, 7th place gets 2 points, 8th place gets 1 point
        for (let i = 0; i < events.M[event].length && i <= 7; i++) {
          if (!points.M[events.M[event][i].SchoolID]) {
            points.M[events.M[event][i].SchoolID] = 0;
          }
          points.M[events.M[event][i].SchoolID] += pointsFormat[i + 1];
        }
      }
    }
    // Tally up the female points
    for (const event of femaleCountedEvents) {
      if (events.F[event]) {
        const pointsFormat = {
          1: 10,
          2: 8,
          3: 6,
          4: 5,
          5: 4,
          6: 3,
          7: 2,
          8: 1,
        };
        // 1st place gets 10 points, 2nd place gets 8 points, 3rd place gets 6 points, 4th place gets 5 points, 5th place gets 4 points, 6th place gets 3 points, 7th place gets 2 points, 8th place gets 1 point
        for (let i = 0; i < events.F[event].length && i <= 7; i++) {
          if (!points.F[events.F[event][i].SchoolID]) {
            points.F[events.F[event][i].SchoolID] = 0;
          }
          points.F[events.F[event][i].SchoolID] += pointsFormat[i + 1];
        }
      }
    }
    console.log({ points, results: events });
    const teamNames = await Promise.all(
      teamIds.map(async (teamId) => {
        const teamInfo = await athleticWrapper.track.team.Team(
          teamId,
          new Date().getFullYear()
        );
        return teamInfo.team.Name;
      })
    );

    return {
      teamNames,
      points,
      results: events,
    };
  }
}

function updateResults(results, dual) {
  const placementResults = results.results;
  const resultsDiv = dual ? document.getElementById("resultsDiv") : document.getElementById("nonDualMeetResultsDiv");
  ["boys", "girls"].forEach(async (gender) => {
    let genderAbbr;
    if (gender == "boys") genderAbbr = "M";
    if (gender == "girls") genderAbbr = "F";
    const genderResults = placementResults[genderAbbr];
    const table = resultsDiv.querySelector(`#${gender} .placementTable`);
    table.innerHTML = "";
    Object.values(genderResults).forEach((event, i) => {
      const eventTitle = document.createElement("h1");
      eventTitle.textContent = event[0].Event;
      table.appendChild(eventTitle);

      event.forEach((record, j) => {
        const row = document.createElement("tr");
        row.innerHTML = `
                <td>${j + 1}</td>
                <td>${record.GradeID ? record.GradeID : ""}</td>
                <td>${record.FirstName + " " + (record.LastName ? record.LastName : "")}</td>
                <td>${
                  record.Type == "T"
                    ? timeInMillisecondsToSecondsOrMMSS(record.SortInt)
                    : fieldEventDistanceToFTIN(record.SortInt)
                }</td>
                <td>${record.SchoolID}</td>
            `;
        table.appendChild(row);
      });
    });
  });

  
  ["boys", "girls"].forEach(async (gender) => {
    if (gender == "boys") genderAbbr = "M";
    if (gender == "girls") genderAbbr = "F";
    results.points[genderAbbr] = Object.fromEntries(
      Object.entries(results.points[genderAbbr]).sort((a, b) => a[1] - b[1])
    );
    const scoreTable = resultsDiv.querySelector(`#${gender} > .scoreTable`);
    scoreTable.innerHTML = "";
    for (var teamId in results.points[genderAbbr]) {
      const teamScore =
        results.points[genderAbbr][teamId] !== 0
          ? results.points[genderAbbr][teamId]
          : "DNP";
      const teamName = (await athleticWrapper.track.team.GetTeamCore(teamId))[
        "team"
      ]["Name"];
      const teamRow = document.createElement("tr");
      teamRow.innerHTML = `
                <td>${teamName}</td>
                <td>${teamScore}</td>
            `;
      scoreTable.appendChild(teamRow);
    }
  });
}

function timeInMillisecondsToSecondsOrMMSS(time) {
  time = time / 1000;
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.floor((time - Math.floor(time)) * 1000);
  if (minutes == 0) return `${seconds}.${milliseconds}`;
  return `${minutes}:${seconds}.${milliseconds}`;
}

function fieldEventDistanceToFTIN(distance) {
    const inches = (20000000 - distance) / 1000;
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'${remainingInches}"`;
}

document
  .getElementsByName("nonDualMeetButton")[0]
  .addEventListener("click", async function () {
    openPage("nonDualMeet", this, "lightblue");
  });

document
  .getElementsByName("dualMeetButton")[0]
  .addEventListener("click", async function () {
    openPage("dualMeet", this, "lightgreen");
  });

$("#rowAdder").click(function () {
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
                    <input type="text" class="input" name="teamId">
                </div>
                <div class="control">
                    <input type="text" class="input autocompleteInput" placeholder="Search for a team">
                    <div class="dropdown-content"></div>
                </div>
            </div>
        </div>`;
  $("#listOfIDs").append(newRowAdd);

  // Add autocomplete to the new input field
  const newInput = $('#listOfIDs .column:last-child .autocompleteInput')[0];
  addAutocomplete(newInput);
});

function addAutocomplete(inputElement) {
    inputElement.addEventListener('input', async function () {
        const query = this.value;
        if (query.length < 3) {
            inputElement.nextElementSibling.innerHTML = '';
            return;
        }
        const suggestions = await fetchTeamSuggestions(query);
        displaySuggestions(suggestions, inputElement);
    });
}

function displaySuggestions(suggestions, inputElement) {
    const suggestionsContainer = inputElement.nextElementSibling;
    suggestionsContainer.innerHTML = '';
    suggestions.forEach(team => {
        const suggestionItem = document.createElement('div');
        suggestionItem.classList.add('dropdown-item');
        suggestionItem.textContent = team.textsuggest;
        suggestionItem.addEventListener('click', () => {
            inputElement.value = team.textsuggest;
            inputElement.closest('.field').querySelector('input[name="teamId"]').value = team.id_db;
            suggestionsContainer.innerHTML = '';
        });
        suggestionsContainer.appendChild(suggestionItem);
    });
}

async function fetchTeamSuggestions(query) {
    // Replace with actual API call to fetch team suggestions
    const response = await window.athleticWrapper.search.AutoComplete(query);
    return response.response.docs.filter(doc => doc.type === "Team");
}

// Initialize autocomplete for the initial input fields
addAutocomplete(document.getElementById('autocompleteInput'));
addAutocomplete(document.getElementById('dualMeetFirstTeamAutocomplete'));
addAutocomplete(document.getElementById('dualMeetSecondTeamAutocomplete'));
