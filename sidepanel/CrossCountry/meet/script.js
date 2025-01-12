const { GetMeetData, GetAllResultsData } = window.athleticWrapper.crosscountry.meet;

var savedMeetData = {

};

async function getMeetInfo(meetId) {
    const meetData = await GetMeetData(meetId);
    const results = await GetAllResultsData(meetId);

    return { meetData, results };
}



window.onload = function () {
    chrome.runtime.sendMessage({
        action: "getCurrentTabUrl"
    }, async (response) => {
        const url = new URL(response.tab.url);
        // '/CrossCountry/meet/ID/info'
        //(5) ['', 'CrossCountry', 'meet', 'ID', 'info']
        const [empty, sport, type, meetId, filler] = url.pathname.split("/");
        if (type !== "meet" && sport !== "CrossCountry" && !athleteId) return;
        savedMeetData = await getMeetInfo(meetId);
        const { meetData, results } = savedMeetData;
        console.log(JSON.stringify(meetData, null, 2), JSON.stringify(results, null, 2));
        [...document.getElementsByTagName('select')[0].children].forEach(option => option.remove());
        savedMeetData.meetData.xcDivisions.forEach(division => {
            const option = document.createElement('option');
            option.value = division.IDMeetDiv;
            option.textContent = (division.Gender === "M" ? "Boys" : (division.Gender === "F" ? "Girls" : division.Gender) ) + " " +division.DivName;
            document.getElementsByTagName('select')[0].appendChild(option);
        });
        function formatTime(seconds) {
            console.log(seconds)
            return new Date(seconds * 1000).toISOString().substr(12, 7)
        }
        document.getElementsByTagName('select')[0].disabled = false;

        document.getElementsByTagName('select')[0].addEventListener('change', async (event) => {
            // get selected division
            const divisionId = document.getElementsByTagName('select')[0].value;

            const filteredResults = savedMeetData.results[divisionId].resultsXC.filter(result => result.SortValue !== 0 && result.SortValue !== 999999);
            const data = {
                datasets: [{
                    label: "Runners",
                    data: filteredResults.map(result => {
                        return {
                            x: result.Place,
                            y: result.SortValue
                        }
                    })
                }]
            };

            // check if the chart is being used

            if(Chart.getChart("raceDistribution")) {
                Chart.getChart("raceDistribution").destroy();
            }

            const ctx = document.getElementById('raceDistribution').getContext('2d');
            new Chart(ctx, {
                type: 'scatter',
                data: data,
                options: {
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom'

                        },
                        y: {
                            beginAtZero: false,
                            ticks: {
                                callback: function (value, index, values) {
                                    return formatTime(value);
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function (tooltipItem) {
                                    return formatTime(tooltipItem.parsed.y);
                                }
                            }
                        },
                    },
                }
            });

        });
        document.getElementsByTagName('select')[0].children[0].selected = true;




    });
};