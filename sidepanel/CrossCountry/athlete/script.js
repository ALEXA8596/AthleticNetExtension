// Request the current tab URL from the background script

var resultsOrganized = {};
let myChartInstance = null;

function buttonClick() {
    chrome.runtime.sendMessage({
        action: "getCurrentTabUrl"
    }, async (response) => {
        document.getElementById('current-tab-url').textContent = `Current Tab URL: ${response.tab.url}`;
        const url = new URL(response.tab.url);
        const [empty, type, athleteId, sport, level] = url.pathname.split("/");
        if (type === "athlete" && sport === "cross-country" && athleteId) {
            window.athleticWrapper.track.athlete.GetAthleteBioData(athleteId, "xc").then(async (data) => {
                console.log(data);
                function getMiles(meters) {
                    return meters * 0.000621371192;
                }

                resultsOrganized = {};
                await data.resultsXC.map(result => {
                    resultsOrganized[result.Distance] = resultsOrganized[result.Distance] || [];
                    resultsOrganized[result.Distance].push(result);
                });

                const dropDown = document.getElementById('distanceDropDown');

                await data.distancesXC.map(event => {
                    const label = event.Units === "Meters" ? `${event.Meters} Meters` : `${event.Distance} Miles`;
                    const option = document.createElement('option');
                    option.text = label;
                    option.value = `${event.Meters}_${event.Distance}`;
                    dropDown.appendChild(option);
                });

                // set dropDown to enabled
                dropDown.disabled = false;

                dropDown.addEventListener('change', async (event) => {
                    const value = event.target.value;
                    var DateTime = luxon.DateTime;
                    const eventResults = resultsOrganized[value.split("_")[0]].sort((a, b) => DateTime.fromISO(data.meets[a.MeetID].EndDate) - DateTime.fromISO(data.meets[b.MeetID].EndDate)).filter(result => result.SortValue !== 20000001);
                    console.log(eventResults);
                    // if the SortInt = 20000001, then the result is a DNF, remove from the array
                    const labels = eventResults.map(result => DateTime.fromISO(data.meets[result.MeetID].EndDate).toLocaleString({ month: "short", day: "numeric", year: "numeric" }));
                    function formatTime(seconds) {
                        return new Date(seconds * 1000).toISOString().substr(12, 7)
                    }
                    const marksData = eventResults.map(result => result.SortValue);
                    console.log(marksData);
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
                                    // ticks: {
                                    //     callback: function (value, index, values) {
                                    //         return formatTime(value);
                                    //     }
                                    // },
                                    ticks: {
                                        callback: function (value, index, values) {
                                            return formatTime(value);
                                        }
                                    }
                                },

                            },
                            plugins: {
                                tooltip: {
                                    callbacks: {
                                        label: function (tooltipItem) {
                                            return formatTime(tooltipItem.raw);
                                        }
                                    }
                                },
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

                dropDown.children[0].selected = true;
            });
        }
    });
}


document.addEventListener('DOMContentLoaded', (event) => {
    // document.getElementById('getUrlButton').addEventListener('click', buttonClick);
    buttonClick();
});