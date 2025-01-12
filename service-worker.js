// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  const url = new URL(tab.url);
  // Enables the side panel on google.com
  console.log(url.origin);
  console.log(url.pathname.split("/"));
  if (url.origin === "https://www.athletic.net") {

    switch (url.pathname.split("/")[1]) {
      case "TrackAndField":
        switch (url.pathname.split("/")[2]) {
          // /TrackAndField/meet/meetId/results
          case "meet":
            if (url.pathname.split("/")[4] === "results") {
              // /TrackAndField/meet/531421/results/all
              if (url.pathname.split("/")[5] === "all") {
                await chrome.sidePanel.setOptions({
                  tabId,
                  path: 'sidepanel/TrackAndField/meet/allResults.html',
                  enabled: true
                });
              }

              // /TrackAndField/meet/531421/results/gender/divId/eventShortName
              else if (url.pathname.split("/")[5] && url.pathname.split("/")[6] && url.pathname.split("/")[7]) {
                await chrome.sidePanel.setOptions({
                  tabId,
                  path: 'sidepanel/TrackAndField/meet/eventResults.html',
                  enabled: true
                });
              }
            }
        }
        break;
      case "CrossCountry":
        switch (url.pathname.split("/")[2]) {
          // /CrossCountry/meet/meetId/results
          case "meet":
            await chrome.sidePanel.setOptions({
              tabId,
              path: 'sidepanel/CrossCountry/meet/index.html',
              enabled: true
            });
            break;
        }
      case "team":
        // pathname = /team/teamId/cross-country/seasonId
        if (url.pathname.split("/")[3] === "cross-country") {
          await chrome.sidePanel.setOptions({
            tabId,
            path: 'sidepanel/CrossCountry/team/index.html',
            enabled: true
          });
        } else
          // pathname = /team/teamId/track-and-field-outdoor/seasonId
          if (url.pathname.split("/")[3] === "track-and-field-outdoor") {
            await chrome.sidePanel.setOptions({
              tabId,
              path: 'sidepanel/TrackAndField/team/index.html',
              enabled: true
            });
          }
        break;
      case "athlete":
        // pathname = /athlete/athleteId/cross-country/level
        // high-school: 4
        // middle-school: 2
        // unattached: 0
        console.log("athlete");
        if (url.pathname.split("/")[3] === "cross-country") {
          await chrome.sidePanel.setOptions({
            tabId,
            path: 'sidepanel/CrossCountry/athlete/index.html',
            enabled: true
          });
        } else
          // pathname = /athlete/athleteId/track-and-field/level
          if (url.pathname.split("/")[3] === "track-and-field") {
            await chrome.sidePanel.setOptions({
              tabId,
              path: 'sidepanel/TrackAndField/athlete/index.html',
              enabled: true
            });
          }
        break;
    }
  }
  else {
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCurrentTabUrl") {
    chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
      console.log(tabs);
      const activeTab = tabs[0];
      sendResponse({ tab: activeTab });
    });
    return true; 
  }
  if (request.action === "openSidebar") {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      chrome.sidePanel.setOptions({
        tabId: activeTab.id,
        enabled: true
      });
    });
  }
});