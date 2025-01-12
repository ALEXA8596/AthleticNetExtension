// Request the current tab URL from the background script
async function simulateMeet(teamsData) {
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
        Object.keys(teamData).forEach(distance => {
            if (!courses[distance]) {
                courses[distance] = 0;
            }
            courses[distance] += 1;
        });
    }

    const course = selectedCourse ? selectedCourse : Object.keys(courses).reduce((a, b) => courses[a] > courses[b] ? a : b);

    const scores = {};
    const results = {};
    const genders = ["boys", "girls"];
    genders.forEach(gender => {
        const allAthletes = [];
        for (const key in teamsData) {
            const teamData = teamsData[key];
            const allTeamMembers = [];
            if (teamData.hasOwnProperty(course) && teamData[course].hasOwnProperty(gender)) {
                teamData[course][gender].forEach(athlete => {
                    athlete.time = MMSSMSToSeconds(athlete.time);
                    athlete.team = key;
                    allTeamMembers.push(athlete);
                });
                const firstSeven = allTeamMembers.slice(0, 7);
                if (firstSeven.length >= 5) {
                    firstSeven.forEach(athlete => {
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
        courses
    }
}

var teamsData = {};

document.getElementById('teamsInput').addEventListener('submit', async function (event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const teamIds = formData.getAll('teamId');
    teamsData = {};
    await Promise.all(teamIds.map(async teamId => {
        teamsData[teamId] = await athleticWrapper.crosscountry.team.records.seasonBests(teamId);
    }));
    const results = await simulateMeet(teamsData);

    const distanceSelect = document.getElementById('distance');
    distanceSelect.innerHTML = "";
    Object.keys(results.courses).forEach(course => {
        const option = document.createElement('option');
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
    const resultsDiv = document.getElementById('resultsDiv');
    ["boys", "girls"].forEach(async (gender) => {
        const genderResults = placementResults[gender];
        const table = resultsDiv.querySelector(`#${gender} .placementTable`);
        table.innerHTML = "";
        genderResults.forEach((athlete, i) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${i + 1}</td>
                <td>${athlete.grade}</td>
                <td>${athlete.name}</td>
                <td>${timeInSecondsToMMSSMS(athlete.time)}</td>
                <td>${athlete.team}</td>
            `;
            table.appendChild(row);
        });
    });

    ["boys", "girls"].forEach(async (gender) => {
        results.scores[gender] = Object.fromEntries(Object.entries(results.scores[gender]).sort((a, b) => a[1] - b[1]));
        const scoreTable = document.querySelector(`#${gender} > .scoreTable`);
        scoreTable.innerHTML = "";
        for (var teamId in results.scores[gender]) {
            const teamScore = results.scores[gender][teamId] !== 0 ? results.scores[gender][teamId] : "DNP";
            const teamName = (await athleticWrapper.crosscountry.team.GetTeamCore(teamId))['team']['Name'];
            const teamRow = document.createElement('tr');
            teamRow.innerHTML = `
                <td>${teamName}</td>
                <td>${teamScore}</td>
            `;
            scoreTable.appendChild(teamRow);
        }
    });
}

function timeInSecondsToMMSSMS(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time - Math.floor(time)) * 1000);
    return `${minutes}:${seconds}.${milliseconds}`;
}

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
            </div>
        </div>`;
    $('#listOfIDs').append(newRowAdd);
});

$("body").on("click", "#DeleteRow", function () {
    $(this).closest(".column").remove();
});

window.onload = function () {
    chrome.runtime.sendMessage({
        action: "getCurrentTabUrl"
    }, async (response) => {
        const url = new URL(response.tab.url);
        const [empty, type, teamId, sport, level] = url.pathname.split("/");
        if (type !== "team" || sport !== "cross-country") return;
        document.getElementById('firstTeam').value = teamId;
    });
};

document.getElementById('distance').addEventListener('change', async function () {
    const selectedCourse = this.value;
    const formData = new FormData(document.getElementById('teamsInput'));
    const teamIds = formData.getAll('teamId');
    teamsData = {};
    await Promise.all(teamIds.map(async teamId => {
        teamsData[teamId] = await athleticWrapper.crosscountry.team.records.seasonBests(teamId);
    }));
    const results = await simulateMeet(teamsData, selectedCourse);
    updateResults(results);
});


document.getElementById('listOfIDs').addEventListener('paste', function(event) {
    event.preventDefault();

    const paste = event.clipboardData.getData('text');

    const lines = paste.split('\n');

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
            $(input).closest('.column').after(newRowAdd);
        }
    });
});