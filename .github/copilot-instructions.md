# AthleticNetExtension Copilot Instructions

## Project Snapshot
- Chrome extension (Manifest v3) that injects a side panel for athletic.net pages; see manifest.json for granted origins & routing.
- Core logic lives in service-worker.js and the static sidepanel/ directory split by sport (CrossCountry vs TrackAndField) and context (team, athlete, meet).
- Third-party data access is handled by the bundled athletichelper SDK exposed as window.athleticWrapper (build/bundle.js).
- Styling leans on Bulma plus local CSS; UI behaviour is mostly vanilla JS with pockets of jQuery and Chart.js.

## Runtime Architecture
- service-worker.js listens to chrome.tabs.onUpdated, inspects URL path segments, and selects the appropriate sidepanel/**/index.html via chrome.sidePanel.setOptions.
- Side panel pages are plain HTML files that load their companion script.js and then build the DOM on the fly; navbar.js inserts the shared navigation bar.
- Scripts talk to the service worker through chrome.runtime.sendMessage for tab info or CORS-bypassed fetches (see makeApiCall in CrossCountry/team/script.js).
- Each page is responsible for binding DOMContentLoaded/window.onload handlers—no central state manager, everything is page-scoped.
- Keep bundle.js loaded anywhere you call window.athleticWrapper; failing to include it leads to undefined method errors at runtime.

## Data Access Patterns
- Prefer window.athleticWrapper.* helpers (e.g. athleticWrapper.crosscountry.team.records.seasonBests) and expect JSON or HTML strings depending on the endpoint.
- When endpoints return HTML (seasonBests, TeamRecords) parse with DOMParser in-page; service worker proxy just relays raw text.
- Some pages reconstruct meet data entirely client-side (TrackAndField/meet/allResults) and run scoring logic locally—mirror existing helper functions when expanding features.
- Autocomplete and search rely on athleticWrapper.search.AutoComplete, filtering for doc.type === "Team" before updating the UI.

## UI & State Patterns
- Forms use Bulma classes; dynamic rows often injected with template strings and jQuery (see the rowAdder button logic in CrossCountry/team/script.js).
- Global variables like window.fullResults or myChartInstance are common; reset them before re-rendering to avoid stale state.
- Chart-driven views include luxon, chart.min.js, and chartjs-adapter-luxon from public/; ensure scripts load after bundle.js.
- Printing/export flows clone DOM nodes and open a new window (printResults) instead of regenerating markup—extend those helpers if new printable sections are added.

## Build & Debug Workflow
- Install deps with npm install; rebuild the SDK wrapper via npm run browserify (uses Babel+Browserify) to refresh build/bundle.js after touching src/.
- npm run build transpiles src/ to build/, copying files alongside ES5 output used by the bundler.
- No automated tests—verify changes by loading the unpacked extension at chrome://extensions and exercising the relevant athletic.net pages.
- Watch for CORS issues: if athleticWrapper calls fail, ensure the service worker proxy is returning success and that connect-src in manifest.json covers the target host.

## Feature Work Checklist
- Serve new side panel pages from sidepanel/<sport>/<context>/, register them in navbar.js, and add routing logic to service-worker.js.
- Reuse existing helper utilities (simulateMeet, updateResults, etc.) when possible; these functions expect specific data shapes documented inline.
- Keep instructions, selectors, and button IDs consistent—scripts depend heavily on querySelector strings defined in the HTML templates.
- After structural changes, reload the extension and the target tab to re-trigger chrome.sidePanel.setOptions.
