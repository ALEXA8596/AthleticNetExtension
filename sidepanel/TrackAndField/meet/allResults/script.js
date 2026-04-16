var resultsOrganized = {};
let myChartInstance = null;
var rawResults = {};
let nonDualTeamSelector = null;
let dualTeamSelector = null;
let nonDualListManager = null;
let dualListManager = null;
const RELAY_SPLIT_EVENT_TYPE_ID = 98;
const DEFAULT_NON_DUAL_ATHLETES_PER_EVENT = 8;
const DEFAULT_DUAL_ATHLETES_PER_EVENT = 5;

function isRelaySplitPerformance(performance) {
  const eventTypeId = performance?.EventTypeID ?? performance?.IDEventType;
  return Number(eventTypeId) === RELAY_SPLIT_EVENT_TYPE_ID;
}

function getAthletesPerEventLimit(dual) {
  const inputId = dual ? "dualAthletesPerEvent" : "nonDualAthletesPerEvent";
  const fallback = dual
    ? DEFAULT_DUAL_ATHLETES_PER_EVENT
    : DEFAULT_NON_DUAL_ATHLETES_PER_EVENT;
  const parsedValue = Number.parseInt(
    document.getElementById(inputId)?.value,
    10
  );

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
}

/**
 * Tab functionality
 */
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

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("defaultOpen").click();

  if (!window.TeamSelection) {
    console.warn("TeamSelection module not available on meet page");
    return;
  }

  const nonDualContainer = document.getElementById("meetNonDualTeamSelector");
  if (nonDualContainer) {
    nonDualTeamSelector = TeamSelection.createSelector({
      container: nonDualContainer,
    });

    nonDualListManager = TeamSelection.createListManager({
      selector: nonDualTeamSelector,
      storageKey: "track-meet-nonDual",
      selectElement: document.getElementById("teamListSelectMeetNonDual"),
      nameInput: document.getElementById("teamListNameMeetNonDual"),
      saveButton: document.getElementById("saveTeamListMeetNonDual"),
      updateButton: document.getElementById("updateTeamListMeetNonDual"),
      deleteButton: document.getElementById("deleteTeamListMeetNonDual"),
      loadButton: document.getElementById("loadTeamListMeetNonDual"),
      emptyMessage: "Select at least one team before saving.",
    });
  }

  const dualContainer = document.getElementById("meetDualTeamSelector");
  if (dualContainer) {
    dualTeamSelector = TeamSelection.createSelector({
      container: dualContainer,
    });

    dualListManager = TeamSelection.createListManager({
      selector: dualTeamSelector,
      storageKey: "track-meet-dual",
      selectElement: document.getElementById("teamListSelectMeetDual"),
      nameInput: document.getElementById("teamListNameMeetDual"),
      saveButton: document.getElementById("saveTeamListMeetDual"),
      updateButton: document.getElementById("updateTeamListMeetDual"),
      deleteButton: document.getElementById("deleteTeamListMeetDual"),
      loadButton: document.getElementById("loadTeamListMeetDual"),
      emptyMessage: "Select two teams before saving.",
    });
  }
});

window.onload = function () {
  chrome.runtime.sendMessage(
    {
      action: "getCurrentTabUrl",
    },
    async (response) => {
      const url = new URL(response.tab.url);
      const [empty, sport, type, meetId] = url.pathname.split("/");
      if (type !== "meet" || sport !== "TrackAndField") return;
      athleticWrapper.track.meet.GetAllResultsData(meetId).then((data) => {
        rawResults = data;
        rawResults.teams.forEach((team) => {
          const teamId =
            team.IDSchool != null ? String(team.IDSchool) : String(team.id);
          const teamName = team.SchoolName || team.name || `Team ${teamId}`;

          if (nonDualTeamSelector && nonDualTeamSelector.getTeams().length === 0) {
            nonDualTeamSelector.addTeam({
              id: teamId,
              name: teamName,
              label: teamName,
            });
          }

          if (dualTeamSelector && dualTeamSelector.getTeams().length === 0) {
            dualTeamSelector.addTeam({
              id: teamId,
              name: teamName,
              label: teamName,
            });
          }
        });

        const nonDualContainer = document.getElementById("teamsInputNonDualMeet");
        const dualContainer = document.getElementById("teamsInput");

        if (nonDualContainer) {
          const nonDualMeetInput = nonDualContainer.querySelector("#meetIdInput");
          if (nonDualMeetInput) {
            nonDualMeetInput.value = meetId;
          }
        }

        if (dualContainer) {
          const dualMeetInput = dualContainer.querySelector("#meetIdInput");
          if (dualMeetInput) {
            dualMeetInput.value = meetId;
          }
        }
      });
    }
  );
};

// TODO Fix the paste functionality to work with the new structure
// document
//   .getElementById("listOfIDs")
//   .addEventListener("paste", function (event) {
//     event.preventDefault();

//     const paste = event.clipboardData.getData("text");

//     const lines = paste.split("\n");

//     const input = event.target;

//     // get the input element's position in its parent
//     const index = Array.from(input.parentNode.children).indexOf(input);

//     lines.forEach((line, i) => {
//       const newRowAdd = `
//             <div class="column px-0">
//                 <div class="field has-addons">
//                     <div class="control">
//                         <button class="button is-danger" id="DeleteRow" type="button">
//                             <i class="bi bi-trash"></i>
//                             Delete
//                         </button>
//                     </div>
//                     <div class="control">
//                         <input type="text" class="input" name="teamId" value="${line}">
//                     </div>
//                 </div>
//             </div>`;
//       if (i === 0 && input.value === "") {
//         $(input).val(line);
//       } else {
//         $(input).closest(".column").after(newRowAdd);
//       }
//     });
//   });

var teamsData = {};

document
  .getElementById("teamsInputNonDualMeet")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!nonDualTeamSelector) {
      alert("Team selector is not available. Please reload the side panel.");
      return;
    }
    const selectedTeams = nonDualTeamSelector.getTeams();
    if (selectedTeams.length === 0) {
      alert("Add at least one team to simulate this meet.");
      return;
    }
    const formData = new FormData(event.target);
    const teamIds = selectedTeams.map((team) => team.id);
    const meetId = formData.get("meetIdInput");

    console.log("Meet ID: " + meetId);

    const res = await athleticWrapper.track.meet.GetAllResultsData(meetId);

    const results = await simulateMeet(teamIds, res, false);

    await updateResults(results, false);
  });

//Dual Meet
document
  .getElementById("teamsInput")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!dualTeamSelector) {
      alert("Team selector is not available. Please reload the side panel.");
      return;
    }
    const selectedTeams = dualTeamSelector.getTeams();
    if (selectedTeams.length < 2) {
      alert("Select at least two teams to simulate a dual meet.");
      return;
    }
    const formData = new FormData(event.target);
    const teamIds = selectedTeams.map((team) => team.id);
    const meetId = formData.get("meetIdInput");

    console.log("Meet ID: " + meetId);
    const res = await athleticWrapper.track.meet.GetAllResultsData(meetId);

    const results = await simulateMeet(teamIds, res, true);

    await updateResults(results, true);
  });

/**
 *
 * @param {Object} teamsData
 * @param {Boolean} dual
 * @returns
 */
async function simulateMeet(teamIds, fullMeetResponse, dual) {
  // Get the school names from the fullMeetResponse

  var teamsObject = [];

  for (const teamId of teamIds) {
    const team = fullMeetResponse.teams.find((t) => t.id === teamId);
    if (team) {
      teamsObject.push({
        id: team.id,
        name: team.name,
      });
    }
  }

  // Get selected grades
  const selectedGrades = Array.from(
    document.querySelectorAll(".grade-filter:checked")
  ).map((cb) => cb.value);

  // Helper function to filter athlete by grade
  const isAthleteGradeSelected = (athlete) => {
    // If no grades are selected, include all athletes
    if (selectedGrades.length === 0) return true;
    // Include athlete if their grade is selected
    return selectedGrades.includes(athlete.Grade?.toString());
  };

  // filter out athletes that aren't in the selected teamIds
  if (teamIds.length > 0) {
    const flatEvents = fullMeetResponse.flatEvents;
    for (i = 0; i < flatEvents.length; i++) {
      const event = flatEvents[i];
      const results = event.results;
      for (j = 0; j < results.length; j++) {
        const athlete = results[j];
        if (
          !teamIds.includes(String(athlete.TeamID)) ||
          isRelaySplitPerformance(athlete)
        ) {
          results.splice(j, 1);
          j--;
        }
      }
      //   Save the filtered events back to the fullMeetResponse
      fullMeetResponse.flatEvents[i] = {
        ...event,
        results: event.results.filter((athlete) =>
          teamIds.includes(String(athlete.TeamID)) &&
          !isRelaySplitPerformance(athlete)
        ),
      };
    }
  }

  if (dual == true) {
    const homeTeamId = teamIds[0];
    const opposingTeamId = teamIds[1];

    const events = {
      M: {},
      F: {},
    };

    fullMeetResponse.flatEvents.forEach((event) => {
      const gender = event.Gender;

      const resultsToPush = [];

      for (const athlete of event.results) {
        if (isRelaySplitPerformance(athlete)) {
          continue;
        }
        if (isAthleteGradeSelected(athlete)) {
          athlete.SchoolID = athlete.TeamID;
          resultsToPush.push(athlete);
        }
      }

      events[gender][event.Event] = resultsToPush;
    });

    // Get selected grades
    const selectedGrades = Array.from(
      document.querySelectorAll(".grade-filter:checked")
    ).map((cb) => cb.value);
    const onlyFreshmenSophomores =
      selectedGrades.length > 0 &&
      selectedGrades.every((grade) => ["9", "10"].includes(grade));
    console.log(onlyFreshmenSophomores);
    const maleCountedEvents = [
      "100 Meters",
      "200 Meters",
      "400 Meters",
      "800 Meters",
      "1600 Meters",
      "3200 Meters",
      onlyFreshmenSophomores ? "65m Hurdles" : "110m Hurdles",
      "300m Hurdles",
      "4x100 Relay",
      "4x400 Relay",
      "4x800 Relay",
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
      "4x800 Relay",
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
        console.log(event);
        // 1st place gets 5 points, 2nd place gets 3 points, 3rd place gets 1 point
        // If the event is a relay, give the winner 5 and the loser 0
        console.log(event.includes("Relay"));
        if (event.includes("Relay")) {
          if (events.M[event][0]) {
            if (!points.M[events.M[event][0].SchoolID]) {
              points.M[events.M[event][0].SchoolID] = 0;
            }
            points.M[events.M[event][0].SchoolID] += 5;
            console.log("awarded 5 points to " + events.M[event][0].SchoolID);
          }
        } else {
          if (events.M[event][0]) {
            if (!points.M[events.M[event][0].SchoolID]) {
              points.M[events.M[event][0].SchoolID] = 0;
            }
            points.M[events.M[event][0].SchoolID] += 5;
            console.log("awarded 5 points to " + events.M[event][0].SchoolID);
          }
          if (events.M[event][1]) {
            if (!points.M[events.M[event][1].SchoolID]) {
              points.M[events.M[event][1].SchoolID] = 0;
            }
            points.M[events.M[event][1].SchoolID] += 3;
            console.log("awarded 3 points to " + events.M[event][1].SchoolID);
          }
          if (events.M[event][2]) {
            if (!points.M[events.M[event][2].SchoolID]) {
              points.M[events.M[event][2].SchoolID] = 0;
            }
            points.M[events.M[event][2].SchoolID] += 1;
            console.log("awarded 1 point to " + events.M[event][2].SchoolID);
          }
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
        } else {
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

    console.log({
      teamNames: {
        homeTeamId: homeTeamName,
        opposingTeamId: opposingTeamName,
      },
      points,
      results: events,
    });

    return {
      teamNames: {
        [homeTeamId]: homeTeamName,
        [opposingTeamId]: opposingTeamName,
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

    fullMeetResponse.flatEvents.forEach((event) => {
      const gender = event.Gender;

      const resultsToPush = [];

      for (const athlete of event.results) {
        if (isRelaySplitPerformance(athlete)) {
          continue;
        }
        if (isAthleteGradeSelected(athlete)) {
          athlete.SchoolID = athlete.TeamID;
          resultsToPush.push(athlete);
        }
      }

      events[gender][event.Event] = resultsToPush;
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
      "4x800 Relay",
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
      "4x800 Relay",
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

async function analyzeResults(results) {
  const placementResults = results.results;

  // const boysRecords = {
  //   //https://en.wikipedia.org/wiki/List_of_United_States_high_school_national_records_in_track_and_field
  //   // High school meet only records
  //   "100 Meters": 10.05,
  //   "200 Meters": 19.97,
  //   "400 Meters":	45.19,
  //   "800 Meters": 106.45,
  //   "1600 Meters": 237.08,
  //   "3200 Meters": 454.10,
  //   "110m Hurdles": 13.30,
  //   "300m Hurdles": 34.83,
  //   // in meters
  //   "High Jump": 2.28,
  //   "Pole Vault": 5.93,
  //   "Long Jump": 8.04,
  //   "Triple Jump": 16.11,
  //   "Shot Put": 23.46,
  //   "Discus": 61.38"
  //   "4x100 Relay": 39.76,
  //   "4x400 Relay": 3:07.40,
  // };

  // }

  // analyze the results of each event by going through each and comparing the 2nd, 3rd, 4th, and 5th runners to the first runner
  // formula: (1st place time - 2nd place time) / 1st place time * 100
}

async function updateResults(results, dual) {
  const placementResults = results.results;
  const resultsDiv = dual
    ? document.getElementById("resultsDiv")
    : document.getElementById("nonDualMeetResultsDiv");
  const maxAthletesToShow = getAthletesPerEventLimit(dual);
  ["boys", "girls"].forEach(async (gender) => {
    let genderAbbr;
    if (gender == "boys") genderAbbr = "M";
    if (gender == "girls") genderAbbr = "F";
    const genderResults = placementResults[genderAbbr];
    const table = resultsDiv.querySelector(
      `[data-gender="${gender}"] .placementTable`
    );

    // Clear table contents
    table.innerHTML = `
      <thead>
        <tr>
          <th colspan="6" class="has-background-info has-text-white py-3 is-size-4">${
            gender.charAt(0).toUpperCase() + gender.slice(1)
          }</th>
        </tr>
        <tr>
          <th class="py-2 px-3">Place</th>
          <th class="py-2 px-3">Grade</th>
          <th class="py-2 px-3">Name</th>
          <th class="py-2 px-3">Time</th>
          <th class="py-2 px-3">Team</th>
          <th class="py-2 px-3 print-hide">Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");

    Object.values(genderResults).forEach((event, i) => {
        // event name
        const eventName = Object.keys(genderResults)[i];
      // Add event header row
      // Skip if event is empty
      if (event[0]) {
        const headerRow = document.createElement("tr");
        headerRow.className = "event-header";
        headerRow.innerHTML = `
        <td colspan="6" class="has-text-weight-bold py-2">
          ${eventName}
        </td>
      `;
        tbody.appendChild(headerRow);

        const fieldEvents = [ "High Jump", "Pole Vault", "Long Jump", "Triple Jump", "Shot Put", "Discus"];

        // Add event results
        event.slice(0, maxAthletesToShow).forEach((record, j) => {
          const row = document.createElement("tr");
          row.dataset.eventName = eventName;
          row.dataset.gender = genderAbbr;
          row.dataset.athleteId = `${record.SchoolID}-${record.FirstName}-${record.LastName}-${record.Event}`;
          row.innerHTML = `
          <td class="py-1 px-1" style="font-size: 10px;">${j + 1}</td>
          <td class="py-1 px-1" style="font-size: 10px;">${
            record.GradeID ? record.GradeID : ""
          }</td>
          <td class="py-1 px-1" style="font-size: 10px;">${
            record.FirstName + " " + (record.LastName ? record.LastName : "")
          }</td>
          <td class="py-1 px-1" style="font-size: 10px;">${
            !fieldEvents.map(el => el.trim()).includes(eventName.trim())
              ? timeInMillisecondsToSecondsOrMMSS(record.SortInt)
              : fieldEventDistanceToFTIN(record.SortInt)
          }</td>
          <td class="py-1 px-1" style="font-size: 10px;">${
            results.teamNames[record.SchoolID]
              ? results.teamNames[record.SchoolID]
              : record.SchoolID
          }</td>
          <td class="print-hide"><button class="button is-danger is-small delete-performance">×</button></td>
        `;
          tbody.appendChild(row);
        });
      }
    });
  });

  await Promise.all(
    ["boys", "girls"].map(async (gender) => {
      let genderAbbr = gender === "boys" ? "M" : "F";
      results.points[genderAbbr] = Object.fromEntries(
        Object.entries(results.points[genderAbbr]).sort((a, b) => b[1] - a[1])
      );
      const scoreTable = resultsDiv.querySelector(
        `[data-gender="${gender}"] > .scoreTable`
      );
      scoreTable.innerHTML = "";

      const teamEntries = await Promise.all(
        Object.entries(results.points[genderAbbr]).map(
          async ([teamId, points]) => {
            const teamScore = points !== 0 ? points : "DNP";
            const teamData = await athleticWrapper.track.team.GetTeamCore(
              teamId
            );
            return { teamName: teamData.team.Name, teamScore };
          }
        )
      );

      teamEntries.forEach(({ teamName, teamScore }) => {
        const teamRow = document.createElement("tr");
        teamRow.innerHTML = `
                <td>${teamName}</td>
                <td>${teamScore}</td>
            `;
        scoreTable.appendChild(teamRow);
      });
    })
  );
}

// Add event listener for delete buttons
document.addEventListener("click", async function (e) {
  if (e.target.classList.contains("delete-performance")) {
    const row = e.target.closest("tr");
    const eventName = row.dataset.eventName;
    const gender = row.dataset.gender;
    const athleteId = row.dataset.athleteId;

    // Remove the performance from the data structure
    const genderResults = results.results[gender];
    const event = genderResults[eventName];
    const athleteIndex = event.findIndex(
      (record) =>
        `${record.SchoolID}-${record.FirstName}-${record.LastName}-${record.Event}` ===
        athleteId
    );

    if (athleteIndex > -1) {
      event.splice(athleteIndex, 1);

      // Recalculate scores
      if (event.length > 0) {
        const isDual = Object.keys(results.teamNames).length === 2;
        results = await simulateMeet(Object.keys(teamsData), teamsData, isDual);
        await updateResults(results, isDual);
      }
    }
  }
});

function timeInMillisecondsToSecondsOrMMSS(time) {
  time = time / 1000;
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = (
    Math.floor((time - Math.floor(time)) * 1000) + ""
  ).padStart(3, "0");
  if (minutes == 0) return `${seconds}.${milliseconds}`;
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds}`;
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
    openPage("nonDualMeet", this, "lightcoral");
  });

document
  .getElementsByName("dualMeetButton")[0]
  .addEventListener("click", async function () {
    openPage("dualMeet", this, "lightgreen");
  });


function printResults(isDual) {
  console.log(
    "Printing results for " + (isDual ? "Dual Meet" : "Non-Dual Meet")
  );
  const resultsDiv = document.getElementById(
    isDual ? "resultsDiv" : "nonDualMeetResultsDiv"
  );
  if (!resultsDiv) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow pop-ups for printing");
    return;
  }

  // Deep clone the results div
  const contentClone = resultsDiv.cloneNode(true);

  // Remove all delete buttons and extra columns
  contentClone.querySelectorAll(".delete-performance").forEach((el) => {
    el.closest("td").remove();
  });

  const styles = `
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
            th, td { 
                border: 1px solid black; 
                padding: 4px 6px;
                text-align: left; 
                font-size: 10px;
                line-height: 1.2;
            }
            h4 { 
                margin: 0.5em 0; 
                font-size: 16px; 
                font-weight: bold; 
            }
            .event-header td { 
                background-color: #f5f5f5 !important; 
                font-weight: bold;
                font-size: 12px !important;
                padding: 4px 6px;
            }
            .print-hide { display: none; }
            @media print {
                body { padding: 0; margin: 0; }
                table { page-break-inside: avoid; }
                h4 { page-break-before: always; margin-top: 1em; }
                tr { page-break-inside: avoid; }
                .event-header { background-color: #f5f5f5 !important; -webkit-print-color-adjust: exact; }
            }
        </style>
    `;

  printWindow.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Track Meet Results</title>
                ${styles}
            </head>
            <body>
                ${contentClone.innerHTML}
            </body>
        </html>
    `);

  printWindow.document.close();

  // Wait for content to load before printing
  printWindow.onload = () => {
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      // Don't close the window immediately to allow for print dialog
    }, 500);
  };
}

// Add event listeners for print buttons
document.addEventListener("DOMContentLoaded", function () {
  document
    .getElementById("printDualMeet")
    .addEventListener("click", () => printResults(true));
  document
    .getElementById("printNonDualMeet")
    .addEventListener("click", () => printResults(false));
});
