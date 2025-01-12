(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "crosscountry", {
  enumerable: true,
  get: function () {
    return _crosscountry.default;
  }
});
exports.default = void 0;
Object.defineProperty(exports, "search", {
  enumerable: true,
  get: function () {
    return _search.default;
  }
});
Object.defineProperty(exports, "track", {
  enumerable: true,
  get: function () {
    return _track.default;
  }
});
var _track = _interopRequireDefault(require("./modules/track.js"));
var _crosscountry = _interopRequireDefault(require("./modules/crosscountry.js"));
var _search = _interopRequireDefault(require("./modules/search.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
var _default = exports.default = {
  track: _track.default,
  crosscountry: _crosscountry.default,
  search: _search.default
};
},{"./modules/crosscountry.js":2,"./modules/search.js":3,"./modules/track.js":4}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _nodeFetch = _interopRequireDefault(require("node-fetch"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
const getDocument = function (text) {
  // browser
  return new DOMParser().parseFromString(text, 'text/html');
};

/**
 * @function getYear
 * @param {String} year 
 * @returns {String} year
 */
const getYear = year => {
  if (!year) {
    // get year
    let date = new Date();
    return year = date.getFullYear();
  } else {
    return year;
  }
};
const crosscountry = {
  team: {
    /**
     * @name GetTeam
     * @description Gets basic team information
     * @param {String} teamId 
     * @param {String} year 
     * @returns {Object}
     */
    Team: async function (teamId, year) {
      if (!year) {
        // get year
        let date = new Date();
        year = date.getFullYear();
      }
      const response = await (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/TeamNav/Team?team=${teamId}&sport=xc&season=${year}`, {
        "headers": {},
        "body": null,
        "method": "GET"
      }).then(res => res.json());
      return response;
    },
    /**
     * @name GetTeamCore
     * @description Gets basic team information + JWToken
     * @param {String} teamId The team ID
     * @param {String} year 
     * @returns {Object}
     */
    GetTeamCore: async function (teamId, year = null) {
      if (!teamId) return undefined;
      year = getYear(year);
      try {
        const response = await (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/TeamHome/GetTeamCore?teamId=${teamId}&sport=xc&year=${year}`, {
          "method": "GET"
        }).then(res => res.json());
        return response;
      } catch (e) {
        console.log(e);
        return undefined;
      }
    },
    /**
     * @name GetCalendar
     * @description Gets the team (meet) calendar
     * @param {String} teamId 
     * @param {String} year 
     * @returns {Object}
     */
    GetCalendar: async function (teamId, year = null) {
      if (!teamId) return undefined;
      year = getYear(year);
      const teamCore = await this.GetTeamCore(teamId, year);
      try {
        const response = await (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/TeamHomeCal/GetCalendar?seasonId=${year}`, {
          "headers": {
            "anettokens": await teamCore.jwtTeamHome
          },
          "body": null,
          "method": "GET"
        }).then(res => res.json());
        return response;
      } catch (e) {
        console.log(e);
        return undefined;
      }
    },
    /**
     * @name GetAthletes
     * @description Gets the team athletes
     * @param {String} teamId 
     * @param {String} year 
     * @returns {Object}
     */
    GetAthletes: async function (teamId, year = null) {
      if (!teamId) return undefined;
      year = getYear(year);
      const teamCore = await this.GetTeamCore(teamId, year);
      try {
        return (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/TeamHome/GetAthletes?seasonId=${year}`, {
          "headers": {
            "anettokens": await teamCore.jwtTeamHome
          },
          "body": null,
          "method": "GET"
        }).then(res => res.text());
      } catch (e) {
        console.log(e);
      }
    },
    records: {
      seasonBests: async function (teamId, year = "") {
        const response = await (0, _nodeFetch.default)(`https://www.athletic.net/CrossCountry/seasonbest?SchoolID=${teamId}&S=${year}`, {
          "headers": {},
          "body": null,
          "method": "GET"
        }).then(res => res.text());
        var document = await getDocument(response);
        const data = {};
        const divs = document.getElementsByClassName("distance");
        for (let i = 0; i < divs.length; i++) {
          const element = divs[i];
          const distanceLabel = element.getElementsByTagName("h3")[0];
          if (distanceLabel.getElementsByTagName("span").length > 0) distanceLabel.getElementsByTagName("span")[0].remove();
          const distance = distanceLabel.textContent;
          const maleTable = element.getElementsByClassName("M")[0].getElementsByTagName("table")[0];
          const femaleTable = element.getElementsByClassName("F")[0].getElementsByTagName("table")[0];

          // get maleTable rows
          if (maleTable) {
            const maleTableRows = maleTable.getElementsByTagName("tr");
            if (maleTableRows.length > 0) {
              const maleRecords = [];
              for (let i = 0; i < maleTableRows.length; i++) {
                const row = maleTableRows[i];
                [...row.getElementsByTagName("span")].forEach(element => element.remove());
                [...row.getElementsByTagName("small")].forEach(element => element.remove());
                const cells = row.getElementsByTagName("td");
                const record = {
                  place: cells[0].textContent,
                  grade: cells[1].textContent,
                  name: cells[2].textContent,
                  time: cells[3].textContent,
                  date: cells[4].textContent,
                  meet: cells[5].textContent,
                  athleteUrl: cells[2].getElementsByTagName("a")[0].href,
                  resultUrl: cells[3].getElementsByTagName("a")[0].href,
                  meetUrl: cells[5].getElementsByTagName("a")[0].href
                };
                maleRecords.push(record);
              }
              ;
              if (!data[distance]) {
                data[distance] = {};
              }
              data[distance]["boys"] = maleRecords;
            }
          }
          ;
          if (femaleTable) {
            const femaleTableRows = femaleTable.getElementsByTagName("tr");
            if (femaleTableRows.length > 0) {
              const femaleRecords = [];
              for (let i = 0; i < femaleTableRows.length; i++) {
                const row = femaleTableRows[i];
                [...row.getElementsByTagName("span")].forEach(element => element.remove());
                [...row.getElementsByTagName("small")].forEach(element => element.remove());
                const cells = row.getElementsByTagName("td");
                const record = {
                  place: cells[0].textContent,
                  grade: cells[1].textContent,
                  name: cells[2].textContent,
                  time: cells[3].textContent,
                  date: cells[4].textContent,
                  meet: cells[5].textContent,
                  athleteUrl: cells[2].getElementsByTagName("a")[0].href,
                  resultUrl: cells[3].getElementsByTagName("a")[0].href,
                  meetUrl: cells[5].getElementsByTagName("a")[0].href
                };
                femaleRecords.push(record);
              }
              ;
              if (!data[distance]) {
                data[distance] = {};
              }
              data[distance]["girls"] = femaleRecords;
            }
          }
        }
        return data;
      },
      TeamRecords: async function (teamId) {
        const response = await (0, _nodeFetch.default)(`https://www.athletic.net/CrossCountry/TeamRecords.aspx?SchoolID=${teamId}`, {
          "headers": {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
          }
        }).then(res => res.text());
        var document = await getDocument(response);
        const data = {};
        const divs = document.getElementsByClassName("distance");
        for (let i = 0; i < divs.length; i++) {
          const element = divs[i];
          const distanceLabel = element.getElementsByTagName("h3")[0];
          distanceLabel.getElementsByTagName("span")[0].remove();
          const distance = distanceLabel.textContent;
          const maleTable = element.getElementsByClassName("M")[0].getElementsByTagName("table")[0];
          const femaleTable = element.getElementsByClassName("F")[0].getElementsByTagName("table")[0];

          // get maleTable rows
          if (maleTable) {
            const maleTableRows = maleTable.getElementsByTagName("tr");
            if (maleTableRows.length > 0) {
              const maleRecords = [];
              for (let i = 0; i < maleTableRows.length; i++) {
                const row = maleTableRows[i];
                [...row.getElementsByTagName("span")].forEach(element => element.remove());
                [...row.getElementsByTagName("small")].forEach(element => element.remove());
                const cells = row.getElementsByTagName("td");
                const record = {
                  place: cells[0].textContent,
                  grade: cells[1].textContent,
                  name: cells[2].textContent,
                  time: cells[3].textContent,
                  meet: cells[4].textContent,
                  athleteUrl: cells[2].getElementsByTagName("a")[0].href,
                  resultUrl: cells[3].getElementsByTagName("a")[0].href
                };
                maleRecords.push(record);
              }
              ;
              if (!data[distance]) {
                data[distance] = {};
              }
              data[distance]["boys"] = maleRecords;
            }
          }
          ;
          if (femaleTable) {
            const femaleTableRows = femaleTable.getElementsByTagName("tr");
            if (femaleTableRows.length > 0) {
              const femaleRecords = [];
              for (let i = 0; i < femaleTableRows.length; i++) {
                const row = femaleTableRows[i];
                [...row.getElementsByTagName("span")].forEach(element => element.remove());
                [...row.getElementsByTagName("small")].forEach(element => element.remove());
                const cells = row.getElementsByTagName("td");
                const record = {
                  place: cells[0].textContent,
                  grade: cells[1].textContent,
                  name: cells[2].textContent,
                  time: cells[3].textContent,
                  date: cells[4].textContent,
                  athleteUrl: cells[2].getElementsByTagName("a")[0].href,
                  resultUrl: cells[3].getElementsByTagName("a")[0].href
                };
                femaleRecords.push(record);
              }
              ;
              if (!data[distance]) {
                data[distance] = {};
              }
              data[distance]["girls"] = femaleRecords;
            }
          }
        }
        return data;
      }
    }
  },
  athlete: {
    /**
     * @description Get the bio data for an athlete
     * @param {String} athleteId 
     * @param {Number} level 
     * @returns {Object}
     */
    GetAthleteBioData: async function (athleteId, level = 0) {
      if (!athleteId) return undefined;
      const response = await (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/AthleteBio/GetAthleteBioData?athleteId=${athleteId}&sport=xc&level=${level}`, {
        "headers": {
          "accept": "application/json, text/plain, */*"
        },
        "body": null,
        "method": "GET"
      }).then(res => res.json());
      return response;
    },
    /**
     * @function 
     * @description Get the rankings for an athlete
     * @param {String} athleteId 
     * @param {String} seasonId 
     * @returns {Object} response
     */
    GetRankings: async function (athleteId, seasonId) {
      seasonId = getYear(seasonId);
      if (!athleteId) return undefined;
      const response = (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/General/GetRankings?athleteId=${athleteId}&sport=xc&seasonId=${seasonId}&truncate=false`, {
        "headers": {
          "accept": "application/json, text/plain, */*",
          "Referrer-Policy": "strict-origin-when-cross-origin"
        },
        "body": null,
        "method": "GET"
      }).then(res => res.json());
      return response;
    }
  },
  meet: {
    /**
     * @function GetMeetData
     * @description Obtains basic meet data + JWToken for the meet
     * @param {String} meetId 
     * @returns {Object} response
     */
    GetMeetData: async function (meetId) {
      const response = await (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/Meet/GetMeetData?meetId=${meetId}&sport=xc`, {
        "headers": {
          "accept": "application/json, */*"
        },
        "body": null,
        "method": "GET"
      }).then(res => res.json());
      return response;
    },
    /**
     * @function GetAllResultsData
     * @description Obtains all results data for a meet
     * @param {String} meetId 
     * @returns {Object} response
     */
    GetAllResultsData: async function (meetId) {
      if (!meetId) return undefined;
      // maybe add a delay to prevent rate limiting

      const meetData = await crosscountry.meet.GetMeetData(meetId);
      const data = {};
      const races = meetData.xcDivisions;
      await Promise.all(races.map(async race => {
        const response = await crosscountry.meet.GetResultsData(meetId, race.IDMeetDiv);
        data[race.IDMeetDiv] = response;
      }));
      return data;
    },
    /**
     * @function GetResultsData
     * @description Gets the results of a Cross Country race
     * @description This api changes frequently. Changing the succeeding # to a different number may work
     * @param {String} meetId 
     * @param {String} raceId 
     * @returns {Object}
     */
    GetResultsData: async function (meetId, raceId) {
      if (!meetId || !raceId) return undefined;
      const response = await (0, _nodeFetch.default)("https://www.athletic.net/api/v1/Meet/GetResultsData3", {
        "headers": {
          "accept": "application/json, text/plain, */*",
          "anettokens": await crosscountry.meet.GetMeetData(meetId).then(res => res.jwtMeet),
          "Content-Type": "application/json"
        },
        "body": JSON.stringify({
          "divId": raceId
        }),
        "method": "POST"
      }).then(res => res.json());
      return response;
    },
    /**
     * @function GetIndividualRaceResults
     * @description A shortcut for GetResultsData
     * @param {String} meetId 
     * @param {String} raceId 
     * @returns {Object}
     */
    GetIndividualRaceResults: async (meetId, raceId) => {
      return await crosscountry.meet.GetResultsData(meetId, raceId);
    },
    /**
     * @function GetXCMoreData
     * @description Gets meets that take place at the same location, as well as division rankings.
     * @param {*} meetId 
     * @returns 
     */
    GetXCMoreData: async function (meetId) {
      const response = await (0, _nodeFetch.default)("https://www.athletic.net/api/v1/Meet/GetXCMoreData", {
        "headers": {
          "accept": "application/json, text/plain, */*",
          "anettokens": await crosscountry.meet.GetMeetData(meetId).then(res => res.jwtMeet)
        },
        "body": null,
        "method": "GET"
      }).then(res => res.json());
      return response;
    }
  },
  GetUncategorizedTeams: async function () {
    const response = await (0, _nodeFetch.default)("https://www.athletic.net/api/v1/DivisionHome/GetUncategorizedTeams?sport=xc&divisionId=73596", {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9"
      },
      "body": null,
      "method": "GET"
    });
    if (response.ok) {
      return response.json();
    }
    throw new Error("Request failed");
  },
  GetTree: async function () {
    const response = await (0, _nodeFetch.default)("https://www.athletic.net/api/v1/DivisionHome/GetTree?sport=xc&divisionId=73596&depth=1&includeTeams=false", {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9"
      },
      "body": null,
      "method": "GET"
    });
    if (response.ok) {
      return response.json();
    }
    throw new Error("Request failed");
  },
  GetDivisions: async function () {
    const response = await (0, _nodeFetch.default)("https://www.athletic.net/api/v1/DivisionHome/GetDivisions?sport=xc&L0=&L1=&L2=&L3=&L4=&L5=&year=0&divId=73596", {
      "headers": {
        "accept": "application/json, text/plain, */*"
      },
      "body": null,
      "method": "GET"
    });
    if (response.ok) {
      return response.json();
    }
    throw new Error("Request failed");
  }
};
var _default = exports.default = crosscountry;
},{"node-fetch":5}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _nodeFetch = _interopRequireDefault(require("node-fetch"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function removeTrailingWhitespace(string) {
  return string.replace(/\s+$/, '');
}
const getDocument = function (text) {
  // browser
  return new DOMParser().parseFromString(text, 'text/html');
};
const search = {
  AutoComplete: async function (query) {
    const response = await (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/AutoComplete/search?q=${query}&fq=`).then(res => res.json());
    return response;
  },
  /**
   * 
   * @param {*} query 
   * @param {*} fq 
   * level (l) : high school: 4 middle school: 2, college: 8, club: 16
   * sport (a) : xc || tf
   * type (m): team: t, athlete: a, meet: m
   * @example fq = "l:4 a:xc m:t"
   * @returns 
   */
  runSearch: async function (query, fq) {
    const response = await (0, _nodeFetch.default)("https://www.athletic.net/Search.aspx/runSearch", {
      "headers": {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "content-type": "application/json",
        "mode": "cors"
      },
      "body": JSON.stringify({
        q: query,
        start: 0,
        fq: fq || ""
      }),
      "method": "POST"
    }).then(async res => await res.json());
    var document = await getDocument("<table>" + response.d.results + "</table>");
    [...document.getElementsByTagName('i')].forEach(element => element.remove());
    [...document.getElementsByClassName('sportIcon')].forEach(element => element.remove());
    [...document.getElementsByTagName('span')].forEach(element => element.remove());
    const tableRows = document.getElementsByTagName("tr");
    const info = [];
    for (let i = 0; i < tableRows.length; i++) {
      const row = tableRows[i];
      const firstUrl = row.getElementsByTagName("a")[0];
      if (!firstUrl) {
        continue;
      }
      const url = firstUrl.href;
      if (url.includes("/athlete/")) {
        const athlete = {
          name: firstUrl.textContent,
          url: "https://athletic.net/" + firstUrl.href,
          id: url.split("/")[2],
          school: row.getElementsByClassName("small")[0].children[1].textContent
        };
        info.push(athlete);
      } else if (url.includes("/team/")) {
        const team = {
          name: row.getElementsByClassName("result-title-tf")[0].textContent,
          url: "https://athletic.net/" + row.getElementsByTagName("a")[1].href,
          id: row.getElementsByClassName("result-title-tf")[0].href.split("/")[2]
        };
        info.push(team);
      } else if (url.includes("/meet/")) {
        // console.log(row.outerHTML);
        const meet = {
          name: row.getElementsByTagName("a")[1].textContent.trim(),
          url: "https://athletic.net/" + row.getElementsByTagName("a")[1].href,
          id: row.getElementsByTagName("a")[1].href.split("/").pop()
        };
        info.push(meet);
      }
    }
    return {
      responses: info,
      editedDom: document.body.innerHTML,
      raw: response
    };
  }
};
var _default = exports.default = search;
},{"node-fetch":5}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _nodeFetch = _interopRequireDefault(require("node-fetch"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const getYear = year => {
  if (!year) {
    // get year
    let date = new Date();
    return year = date.getFullYear();
  } else {
    return year;
  }
};
const track = {
  team: {
    /**
     * @name GetAthletes
     * @description Gets the team athletes
     * @param {String} teamId 
     * @param {String} year 
     * @returns {Object}
     */
    GetAthletes: async function (teamId, sport = undefined, year = undefined) {
      if (!teamId) {
        return console.error("No teamId provided");
      }
      const teamCore = await this.GetTeamCore(teamId, sport, year);
      // console.log("jwt", teamCore);
      try {
        return (0, _nodeFetch.default)("https://www.athletic.net/api/v1/TeamHome/GetAthletes?seasonId=2024", {
          "headers": {
            "anettokens": await teamCore.jwtTeamHome
          },
          "body": null,
          "method": "GET"
        }).then(res => res.text());
      } catch (e) {
        console.log(e);
      }
    },
    /**
     * @function GetTeamCore
     * @description Gets basic team information + JWToken
     * @param {String} teamId The team ID
     * @param {String} year 
     * @returns {Object}
     */
    GetTeamCore: async function (teamId, sport, year) {
      if (!sport) {
        // get month
        let date = new Date();
        let month = date.getMonth();
        if (month <= 6 && month >= 3) {
          sport = 'tfo';
        }
        if (month > 6) {
          sport = 'xc';
        }
        if (month < 3) {
          sport = 'tfi';
        }
      }
      if (!year) {
        // get year
        let date = new Date();
        year = date.getFullYear();
      }
      try {
        const response = await (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/TeamHome/GetTeamCore?teamId=${teamId}&sport=${sport}&year=${year}`, {
          "method": "GET"
        }).then(res => res.json());
        return response;
      } catch (e) {
        console.log(e);
        return undefined;
      }
    },
    /**
     * @function GetCalendar
     * @description Gets the meets and the calendar for a team
     * @param {String} teamId 
     * @param {String} sport 
     * @param {String} year 
     * @returns {Object}
     */
    GetCalendar: async function (teamId, sport, year) {
      if (!year) {
        // get year
        let date = new Date();
        year = date.getFullYear();
      }
      const teamCore = await this.GetTeamCore(teamId, sport, year);
      try {
        const response = await (0, _nodeFetch.default)("https://www.athletic.net/api/v1/TeamHomeCal/GetCalendar?seasonId=2024", {
          "headers": {
            "anettokens": await teamCore.jwtTeamHome
          },
          "body": null,
          "method": "GET"
        }).then(res => res.json());
        return response;
      } catch (e) {
        console.log(e);
        return undefined;
      }
    },
    /**
     * @name GetTeam
     * @description Gets basic team information
     * @param {String} teamId 
     * @param {String} year 
     * @returns {Object}
     */
    Team: async function (teamId, year) {
      if (!year) {
        // get year
        let date = new Date();
        year = date.getFullYear();
      }
      const response = await (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/TeamNav/Team?team=${teamId}&sport=tf&season=${year}`, {
        "headers": {},
        "body": null,
        "method": "GET"
      }).then(res => res.json());
      return response;
    },
    GetTeamEventRecords: async function (teamId, year) {
      return await this.records.GetTeamEventRecords(teamId, year);
    },
    records: {
      /**
       * @name GetTeamEventRecords
       * @description Gets the team event records for a specific year
       * @param {String} teamId 
       * @param {String} year 
       * @returns {Object}
       */
      GetTeamEventRecords: async function (teamId, year) {
        if (!year) year = getYear(year);
        const response = await (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/TeamHome/GetTeamEventRecords?teamId=${teamId}&seasonId=${year}`, {
          "headers": {},
          "body": null,
          "method": "GET"
        }).then(res => res.json());
        return response;
      },
      /**
       * @name Seasons_TeamReports
       * @description Gets the valid seasons for team reports
       * @param {String} teamId 
       * @returns {Object}
       */
      Seasons_TeamReports: async function (teamId) {
        const response = await (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/Public/Seasons_TeamReports?team=${teamId}&sport=tfo`, {
          "headers": {
            "accept": "application/json, text/plain, */*"
          },
          "body": null,
          "method": "GET"
        }).then(res => res.json());
        return response;
      },
      /**
       * @name GetTeamRecords
       * @description Gets the team / school records
       * @param {String} teamId 
       * @param {String} gender 
       * @param {String} eventShort 
       * @param {Boolean} indoor 
       * @param {Object} qParams 
       * @returns 
       */
      GetTeamRecords: async function (teamId, gender = "m", eventShort = "", indoor = null, qParams = {}) {
        if (!teamId) return undefined;
        const response = await (0, _nodeFetch.default)("https://www.athletic.net/api/v1/tfRankings/GetRankings", {
          "headers": {
            "accept": "application/json, */*",
            "content-type": "application/json"
          },
          "body": {
            "reportType": "teamRecords",
            "teamId": teamId,
            "indoor": false,
            "eventShort": eventShort,
            "gender": gender,
            "qParams": qParams
          },
          "method": "POST"
        }).then(res => res.json());
        return response;
      }
    }
  },
  athlete: {
    /**
     * 
     * @param {*} athleteId 
     * @param {String} sport xc or tf
     * @param {*} level 0 = all, 2 = middle school, 4 = high school
     */
    GetAthleteBioData: async function (athleteId, sport, level = 0) {
      const response = await (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/AthleteBio/GetAthleteBioData?athleteId=${athleteId}&sport=${sport}&level=${level}`).then(res => res.json());
      return response;
    }
  },
  meet: {
    /**
     * @function
     * @description Get basic meet information
     * @param {String} meetId 
     * @returns {String}
     */
    GetMeetData: async function (meetId) {
      if (!meetId) return undefined;
      const response = await (0, _nodeFetch.default)(`https://www.athletic.net/api/v1/Meet/GetMeetData?meetId=${meetId}&sport=tf`, {
        "headers": {
          "accept": "application/json, text/plain, */*"
        },
        "body": null,
        "method": "GET"
      }).then(res => res.json());
      return response;
    },
    /**
     * @function
     * @description Get all the results from a meet
     * @param {String} meetId 
     * @returns {Object}
     */
    GetAllResultsData: async function (meetId) {
      const jwtMeet = await this.GetMeetData(meetId).then(res => res.jwtMeet);
      const response = (0, _nodeFetch.default)("https://www.athletic.net/api/v1/Meet/GetAllResultsData?rawResults=false&showTips=false", {
        "headers": {
          "accept": "application/json, text/plain, */*",
          "anettokens": await jwtMeet
        },
        "body": null,
        "method": "GET"
      }).then(res => res.json());
      return response;
    }
  }
};
var _default = exports.default = track;
},{"node-fetch":5}],5:[function(require,module,exports){
(function (global){(function (){
"use strict";

// ref: https://github.com/tc39/proposal-global
var getGlobal = function () {
	// the only reliable means to get the global object is
	// `Function('return this')()`
	// However, this causes CSP violations in Chrome apps.
	if (typeof self !== 'undefined') { return self; }
	if (typeof window !== 'undefined') { return window; }
	if (typeof global !== 'undefined') { return global; }
	throw new Error('unable to locate global object');
}

var globalObject = getGlobal();

module.exports = exports = globalObject.fetch;

// Needed for TypeScript and Webpack.
if (globalObject.fetch) {
	exports.default = globalObject.fetch.bind(globalObject);
}

exports.Headers = globalObject.Headers;
exports.Request = globalObject.Request;
exports.Response = globalObject.Response;

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],6:[function(require,module,exports){
(function (global){(function (){
"use strict";

var athleticWrapper = require('athletichelper/browser');
global.window.athleticWrapper = athleticWrapper;

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"athletichelper/browser":1}]},{},[6]);
