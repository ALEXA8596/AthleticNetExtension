// Request the current tab URL from the background script

var resultsOrganized = {};
let myChartInstance = null;

function buttonClick() {
    chrome.runtime.sendMessage({
        action: "getCurrentTabUrl"
    }, async (response) => {
        // document.getElementById('current-tab-url').textContent = `Current Tab URL: ${response.tab.url}`;
        const url = new URL(response.tab.url);
        const [empty, type, athleteId, sport, level] = url.pathname.split("/");
        if (type === "athlete" && sport === "track-and-field" && athleteId) {
            athleticWrapper.track.athlete.GetAthleteBioData(athleteId, "tf").then(async (data) => {
                console.log(data);
                resultsOrganized = {};
                await data.resultsTF.map(result => {
                    // If the event isn't shot, disc, hurdles, or any event that includes a descriptor
                    if (result.EventTypeID === 0 || !(data.eventsTF.filter(event => event.IDEvent === event.EventID).map(event => event.IDEventType).length > 1)) {
                        if (!resultsOrganized[result.EventID]) {
                            resultsOrganized[result.EventID] = [];
                        }
                        console.log("not shot, disc, or hurdles: " + result.EventID)
                        console.log(result)
                        console.log(result.EventTypeID + " " + result.EventID)
                        return resultsOrganized[result.EventID].push(result);
                    }
                    // If the event is shot, disc, hurdles, or any event that includes a descriptor
                    if (
                        result.EventTypeID !== 0 ||
                        // check if there are multiple event types
                        data.eventsTF.filter(event => event.IDEvent === event.EventID).map(event => event.IDEventType).length > 1
                    ) {
                        console.log("shot, disc, or hurdles: " + result.EventID)
                        console.log(result)
                        if (!resultsOrganized.hasOwnProperty(result.EventID)) {
                            resultsOrganized[result.EventID] = {};
                        }
                        if (!resultsOrganized[result.EventID].hasOwnProperty([String(result.EventTypeID)])) {
                            resultsOrganized[result.EventID][String(result.EventTypeID)] = [];
                        }
                        if (result !== null) resultsOrganized[result.EventID][String(result.EventTypeID)].push(result);

                    }
                });

                for (const eventId in resultsOrganized) {
                    // console.log(resultsOrganized)
                    // console.log(eventId)
                    // check if the event has a descriptor
                    // This one doesn't have a descriptor
                    if (resultsOrganized[eventId] instanceof Array) {
                        console.log("not hurdles, disc, or shot: " + eventId)
                        var event = await data.eventsTF.find(eventObj => Number(eventObj.IDEvent) === Number(eventId));
                        // console.log(event)
                        const eventName = event.Event;
                        await resultsOrganized[eventId].sort((a, b) => a.SortInt - b.SortInt);

                        resultsOrganized[eventName] = resultsOrganized[eventId];
                        delete resultsOrganized[eventId];
                    }

                    // This one does have a descriptor
                    if (resultsOrganized[eventId] instanceof Object && !Array.isArray(resultsOrganized[eventId])) {
                        console.log("hurdles, disc, or shot: " + eventId)
                        for (const descriptor in resultsOrganized[eventId]) {
                            console.log(descriptor)
                            var event = await data.eventsTF.find(eventObj => Number(eventObj.IDEvent) === Number(eventId) && eventObj.IDEventType === descriptor);
                            const eventName = event.Event + " " + event.Description;
                            console.log(eventName)
                            await resultsOrganized[eventId][descriptor].sort((a, b) => a.SortInt - b.SortInt);
                            resultsOrganized[eventName] = resultsOrganized[eventId][descriptor];
                            delete resultsOrganized[eventId];
                        }
                    }
                };

                const dropDown = document.getElementById('eventDropDown');

                const dropDownOptions = await data.eventsTF.map(event => {
                    const label = event.Description ? `${event.Event} - ${event.Description}` : event.Event;
                    const option = document.createElement('option');
                    option.text = label;
                    option.value = String(event.IDEvent) + "_" + String(event.IDEventType);
                    dropDown.appendChild(option);
                });

                // set dropDown to enabled
                dropDown.disabled = false;

                dropDown.addEventListener('change', async (e) => {
                    const value = e.target.value;
                    var DateTime = luxon.DateTime;
                    const eventResults = resultsOrganized[data.eventsTF.find(eventObj => Number(eventObj.IDEvent) === Number(value.split("_")[0])).Event].sort((a, b) => DateTime.fromISO(data.meets[a.MeetID].EndDate) - DateTime.fromISO(data.meets[b.MeetID].EndDate)).filter(result => result.SortInt !== 20000001);
                    // if the SortInt = 20000001, then the result is a DNF, remove from the array
                    const labels = eventResults.map(result => DateTime.fromISO(data.meets[result.MeetID].EndDate).toLocaleString({ month: "short", day: "numeric", year: "numeric" }));
                    let marksData;
                    let event;
                    if (data.eventsTF.some(eventObj => Number(eventObj.IDEvent) === Number(value.split("_")[0])) > 1) {
                        event = data.eventsTF.find(eventObj => Number(eventObj.IDEvent) === Number(value.split("_")[0]) && eventObj.IDEventType === value.split("_")[1]);
                    }else {
                        event = data.eventsTF.find(eventObj => Number(eventObj.IDEvent) === Number(value.split("_")[0]));
                    }             
                    
                    if (event.Type === "T") {
                        marksData = eventResults.map(result => result.SortInt);
                    } else {
                        //subtract the Sort Int from 20000000, then divide by 100 to get the distance in inches
                        marksData = eventResults.map(result => (20000000 - result.SortInt) / 1000);
                    }

                    const backgroundColor = 'rgb(60, 182, 207)';
                    const chartCanvasElement = document.getElementById('myChart');

                    if (myChartInstance) {
                        myChartInstance.destroy();
                    }
                    const configuration = {
                        type: 'line',
                        format: 'png',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Performance Progression',
                                data: marksData,
                                fill: true,
                                borderColor: 'rgb(75, 192, 192)',
                                tension: 0.1,
                                backgroundColor: backgroundColor,
                            }],
                        },
                        options: {
                            scales: {
                                y: {
                                    beginAtZero: false,
                                    ticks: {
                                        callback: function (value, index, values) {
                                            if (event.Type === "F") {
                                                // convert the value (in inches) to feet and inches
                                                let feet = Math.floor(value / 12);
                                                let inches = value % 12;
                                                return feet + "'" + inches + '"';
                                            }
                                            let totalSeconds = value / 1000;
                                            let minutes = Math.floor(totalSeconds / 60);
                                            let seconds = Math.floor(totalSeconds % 60);
                                            let milliseconds = Math.floor((totalSeconds % 1) * 1000);
                                            return minutes + ":" + (seconds < 10 ? '0' : '') + seconds + "." + milliseconds;
                                        }
                                    }
                                }
                            },
                            plugins: {
                                tooltip: {
                                    callbacks: {
                                        label: function (tooltipItem) {
                                            if (event.Type === "F") {
                                                // convert the value (in inches) to feet and inches
                                                let feet = Math.floor(tooltipItem.parsed.y / 12);
                                                let inches = tooltipItem.parsed.y % 12;
                                                return feet + "'" + inches + '"';
                                            }
                                            let totalSeconds = tooltipItem.parsed.y / 1000;
                                            let minutes = Math.floor(totalSeconds / 60);
                                            let seconds = Math.floor(totalSeconds % 60);
                                            let milliseconds = Math.floor((totalSeconds % 1) * 1000);
                                            return minutes + ":" + (seconds < 10 ? '0' : '') + seconds + "." + milliseconds;
                                        }
                                    }
                                }
                            },
                            backgroundColor: 'white'
                        },
                        plugins: [{
                            beforeDraw: (chart) => {
                                const ctx = chart.canvas.getContext('2d');
                                ctx.save();
                                ctx.globalCompositeOperation = 'destination-over';
                                ctx.fillStyle = 'white';
                                ctx.fillRect(0, 0, chart.width, chart.height);
                                ctx.restore();
                            }
                        }],
                    };
                    // check if the canvas is already being used by Chartjs
                    if (Chart.instances.length > 0) {
                        Chart.instances.forEach(chart => {
                            chart.destroy();
                        });
                    }
                    myChartInstance = new Chart(chartCanvasElement, configuration);
                });
            });
        }
    });
}


document.addEventListener('DOMContentLoaded', (event) => {
    buttonClick();
});