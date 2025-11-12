(function () {
    "use strict";

    const STORAGE_ROOT_KEY = "teamListConfigs";

    function storageAvailable() {
        return typeof chrome !== "undefined" && chrome?.storage?.local;
    }

    function storageGet(key) {
        return new Promise((resolve) => {
            if (!storageAvailable()) {
                resolve(undefined);
                return;
            }
            chrome.storage.local.get([key], (result) => {
                if (chrome.runtime?.lastError) {
                    console.warn("TeamSelection storage get error", chrome.runtime.lastError);
                    resolve(undefined);
                    return;
                }
                resolve(result[key]);
            });
        });
    }

    function storageSet(key, value) {
        return new Promise((resolve, reject) => {
            if (!storageAvailable()) {
                resolve();
                return;
            }
            chrome.storage.local.set({ [key]: value }, () => {
                if (chrome.runtime?.lastError) {
                    console.warn("TeamSelection storage set error", chrome.runtime.lastError);
                    resolve();
                    return;
                }
                resolve();
            });
        });
    }

    function generateListId() {
        return `list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    async function defaultFetchSuggestions(query) {
        try {
            if (!window.athleticWrapper?.search?.AutoComplete) {
                return [];
            }
            const response = await window.athleticWrapper.search.AutoComplete(query);
            const docs = response?.response?.docs || [];
            return docs.filter((doc) => doc.type === "Team");
        } catch (error) {
            console.warn("TeamSelection suggestion fetch failed", error);
            return [];
        }
    }

    function defaultNormalizeSuggestion(doc) {
        if (!doc) return null;
        const id = doc.id_db != null ? String(doc.id_db) : doc.IDSchool != null ? String(doc.IDSchool) : null;
        if (!id) return null;
        const baseName = doc.textsuggest || doc.SchoolName || doc.name || "Unnamed Team";
        const subtext = doc.subtext || "";
        const context = subtext ? ` (${subtext})` : "";
        return {
            id,
            name: baseName,
            label: `${baseName}${context}`,
            subtext,
        };
    }

    function formatTeamDisplay(team) {
        if (!team) return "";
        let display = team.label || team.name || team.id || "";
        const subtext = team.subtext || "";
        if (subtext) {
            const normalizedDisplay = display.trim().toLowerCase();
            const normalizedSubtext = subtext.trim().toLowerCase();
            if (!normalizedDisplay.includes(normalizedSubtext)) {
                display = `${display} (${subtext})`;
            }
        }
        if (team.id) {
            display = `${display} [ID ${team.id}]`;
        }
        return display.trim();
    }

    class TeamSelector {
        constructor(options) {
            if (!options?.container) {
                throw new Error("TeamSelector requires a container element");
            }
            this.container = options.container;
            this.teamContainer = options.tagContainer || this.container.querySelector(".team-tag-container");
            this.searchInput = options.searchInput || this.container.querySelector(".team-search");
            this.suggestionsBox = options.suggestionsBox || this.container.querySelector(".suggestions-box");
            this.includeNameInput = options.includeNameInput !== false;
            this.teamIdFieldName = options.teamIdFieldName || "teamId";
            this.teamNameFieldName = options.teamNameFieldName || "teamName";
            this.fetchSuggestions = options.fetchSuggestions || defaultFetchSuggestions;
            this.normalizeSuggestion = options.normalizeSuggestion || defaultNormalizeSuggestion;
            this.minQueryLength = options.minQueryLength || 3;

            if (!this.teamContainer) {
                throw new Error("TeamSelector container must include an element with class 'team-tag-container'");
            }

            if (!this.searchInput) {
                throw new Error("TeamSelector container must include an element with class 'team-search'");
            }

            if (!this.suggestionsBox) {
                this.suggestionsBox = document.createElement("div");
                this.suggestionsBox.className = "suggestions-box";
                this.searchInput.insertAdjacentElement("afterend", this.suggestionsBox);
            }

            this.selectedTeams = new Map();
            this.onChangeCallbacks = [];
            this.currentFetchToken = 0;

            this._bindEvents();
        }

        _bindEvents() {
            this.searchInput.addEventListener("input", () => {
                this._handleInput();
            });

            this.searchInput.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    this._clearSuggestions();
                    this.searchInput.blur();
                }
                if (event.key === "Enter") {
                    event.preventDefault();
                    const firstSuggestion = this.suggestionsBox.querySelector(".suggestion-item");
                    if (firstSuggestion) {
                        firstSuggestion.click();
                    }
                }
            });

            document.addEventListener("click", (event) => {
                if (!this.container.contains(event.target)) {
                    this._clearSuggestions();
                }
            });
        }

        async _handleInput() {
            const query = this.searchInput.value.trim();
            if (query.length < this.minQueryLength) {
                this._clearSuggestions();
                return;
            }
            const fetchToken = ++this.currentFetchToken;
            try {
                const results = await this.fetchSuggestions(query);
                if (fetchToken !== this.currentFetchToken) {
                    return;
                }
                const normalized = results
                    .map((item) => this.normalizeSuggestion(item))
                    .filter((item) => item && !this.selectedTeams.has(String(item.id)));
                this._renderSuggestions(normalized);
            } catch (error) {
                console.warn("TeamSelector suggestion handling failed", error);
                if (fetchToken === this.currentFetchToken) {
                    this._clearSuggestions();
                }
            }
        }

        _renderSuggestions(items) {
            this.suggestionsBox.innerHTML = "";
            if (!items || items.length === 0) {
                return;
            }
            items.forEach((item) => {
                const div = document.createElement("div");
                div.className = "suggestion-item";
                div.textContent = formatTeamDisplay(item);
                div.dataset.teamId = item.id;
                div.addEventListener("click", () => {
                    this.addTeam(item);
                    this._clearSuggestions();
                    this.searchInput.focus();
                });
                this.suggestionsBox.appendChild(div);
            });
        }

        _clearSuggestions() {
            this.currentFetchToken++;
            this.suggestionsBox.innerHTML = "";
        }

        addTeam(team, options = {}) {
            if (!team) return;
            const id = team.id != null ? String(team.id) : null;
            if (!id) return;
            if (!options.allowDuplicate && this.selectedTeams.has(id)) {
                return;
            }

            const name = team.name || team.label || id;
            const label = team.label || name;
            const subtext = team.subtext || "";
            const displayText = formatTeamDisplay({ id, name, label, subtext });

            const tag = document.createElement("div");
            tag.className = "team-tag";
            tag.dataset.teamId = id;

            const labelSpan = document.createElement("span");
            labelSpan.className = "team-label";
            labelSpan.textContent = displayText;
            tag.appendChild(labelSpan);

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-tag";
            deleteButton.setAttribute("aria-label", "Remove team");
            deleteButton.innerHTML = "&times;";
            deleteButton.addEventListener("click", () => {
                this.removeTeam(id);
            });

            const idInput = document.createElement("input");
            idInput.type = "hidden";
            idInput.name = this.teamIdFieldName;
            idInput.value = id;
            tag.appendChild(idInput);

            if (this.includeNameInput) {
                const nameInput = document.createElement("input");
                nameInput.type = "hidden";
                nameInput.name = this.teamNameFieldName;
                nameInput.value = name;
                tag.appendChild(nameInput);
            }

            tag.appendChild(deleteButton);

            this.teamContainer.appendChild(tag);
            this.selectedTeams.set(id, { id, name, label, subtext });
            this.searchInput.value = "";
            this._clearSuggestions();
            this._notifyChange();
        }

        removeTeam(teamId) {
            const id = String(teamId);
            if (!this.selectedTeams.has(id)) return;
            this.selectedTeams.delete(id);
            const tag = this.teamContainer.querySelector(`.team-tag[data-team-id="${CSS.escape(id)}"]`);
            if (tag) {
                tag.remove();
            }
            this._notifyChange();
        }

        clear() {
            this.selectedTeams.clear();
            this.teamContainer.innerHTML = "";
            this._notifyChange();
        }

        setTeams(teams) {
            this.clear();
            if (!Array.isArray(teams)) return;
            teams.forEach((team) => {
                this.addTeam(team, { allowDuplicate: true });
            });
        }

        getTeams() {
            return Array.from(this.selectedTeams.values()).map((team) => ({
                id: team.id,
                name: team.name,
                label: team.label,
                subtext: team.subtext || "",
            }));
        }

        onChange(callback) {
            if (typeof callback === "function") {
                this.onChangeCallbacks.push(callback);
            }
        }

        _notifyChange() {
            const snapshot = this.getTeams();
            this.onChangeCallbacks.forEach((callback) => {
                try {
                    callback(snapshot);
                } catch (error) {
                    console.warn("TeamSelector onChange callback failed", error);
                }
            });
        }
    }

    class TeamListManager {
        constructor(options) {
            if (!options?.selector) {
                throw new Error("TeamListManager requires a TeamSelector instance");
            }
            if (!options?.storageKey) {
                throw new Error("TeamListManager requires a storageKey");
            }
            this.selector = options.selector;
            this.storageKey = options.storageKey;
            this.selectElement = options.selectElement || null;
            this.nameInput = options.nameInput || null;
            this.saveButton = options.saveButton || null;
            this.updateButton = options.updateButton || null;
            this.deleteButton = options.deleteButton || null;
            this.loadButton = options.loadButton || null;
            this.emptyMessage = options.emptyMessage || "No teams selected";
            this.lists = [];
            this.currentListId = "";
            this.initialized = false;
            this.init();
        }

        async init() {
            await this._loadFromStorage();
            this._bindEvents();
            this._renderOptions();
            this.initialized = true;
        }

        async _loadFromStorage() {
            const root = (await storageGet(STORAGE_ROOT_KEY)) || {};
            const context = root[this.storageKey];
            if (context && Array.isArray(context.lists)) {
                this.lists = context.lists.map((entry) => ({
                    id: entry.id,
                    name: entry.name,
                    teams: Array.isArray(entry.teams) ? entry.teams : [],
                    updatedAt: entry.updatedAt || 0,
                }));
            } else {
                this.lists = [];
            }
        }

        async _persist() {
            const root = (await storageGet(STORAGE_ROOT_KEY)) || {};
            root[this.storageKey] = {
                lists: this.lists.map((entry) => ({
                    id: entry.id,
                    name: entry.name,
                    teams: entry.teams,
                    updatedAt: entry.updatedAt,
                })),
            };
            await storageSet(STORAGE_ROOT_KEY, root);
        }

        _bindEvents() {
            if (this.selectElement) {
                this.selectElement.addEventListener("change", () => {
                    this.currentListId = this.selectElement.value;
                    const list = this._getCurrentList();
                    if (list && this.nameInput) {
                        this.nameInput.value = list.name;
                    }
                });
            }
            if (this.saveButton) {
                this.saveButton.addEventListener("click", async () => {
                    await this._saveNewList();
                });
            }
            if (this.updateButton) {
                this.updateButton.addEventListener("click", async () => {
                    await this._updateCurrentList();
                });
            }
            if (this.deleteButton) {
                this.deleteButton.addEventListener("click", async () => {
                    await this._deleteCurrentList();
                });
            }
            if (this.loadButton) {
                this.loadButton.addEventListener("click", async () => {
                    await this._loadSelectedList();
                });
            }
        }

        async _saveNewList() {
            const teams = this.selector.getTeams();
            if (!teams.length) {
                alert(this.emptyMessage);
                return;
            }
            const name = (this.nameInput?.value || "").trim();
            if (!name) {
                alert("Enter a name for this team list.");
                return;
            }
            const existingName = this.lists.find((list) => list.name.toLowerCase() === name.toLowerCase());
            if (existingName) {
                alert("A list with that name already exists. Choose a different name or update the existing list.");
                return;
            }
            const newList = {
                id: generateListId(),
                name,
                teams,
                updatedAt: Date.now(),
            };
            this.lists.push(newList);
            this.currentListId = newList.id;
            await this._persist();
            this._renderOptions();
            if (this.selectElement) {
                this.selectElement.value = this.currentListId;
            }
            alert("Team list saved.");
        }

        async _updateCurrentList() {
            const list = this._getCurrentList();
            if (!list) {
                alert("Select a saved list to update.");
                return;
            }
            const teams = this.selector.getTeams();
            if (!teams.length) {
                alert(this.emptyMessage);
                return;
            }
            const name = (this.nameInput?.value || "").trim();
            if (!name) {
                alert("Enter a name for this team list.");
                return;
            }
            const duplicateName = this.lists.find(
                (entry) => entry.id !== list.id && entry.name.toLowerCase() === name.toLowerCase()
            );
            if (duplicateName) {
                alert("Another list already uses that name. Choose a different name.");
                return;
            }
            list.name = name;
            list.teams = teams;
            list.updatedAt = Date.now();
            await this._persist();
            this._renderOptions();
            if (this.selectElement) {
                this.selectElement.value = list.id;
            }
            alert("Team list updated.");
        }

        async _deleteCurrentList() {
            const list = this._getCurrentList();
            if (!list) {
                alert("Select a saved list to delete.");
                return;
            }
            if (!confirm(`Delete the list "${list.name}"?`)) {
                return;
            }
            this.lists = this.lists.filter((entry) => entry.id !== list.id);
            this.currentListId = "";
            await this._persist();
            this._renderOptions();
            if (this.selectElement) {
                this.selectElement.value = "";
            }
            if (this.nameInput) {
                this.nameInput.value = "";
            }
            alert("Team list deleted.");
        }

        async _loadSelectedList() {
            const list = this._getCurrentList();
            if (!list) {
                alert("Select a saved list to load.");
                return;
            }
            this.selector.setTeams(list.teams || []);
            if (this.nameInput) {
                this.nameInput.value = list.name;
            }
            alert("Team list loaded.");
        }

        _getCurrentList() {
            if (!this.currentListId) return null;
            return this.lists.find((entry) => entry.id === this.currentListId) || null;
        }

        _renderOptions() {
            if (!this.selectElement) return;
            const previousValue = this.selectElement.value;
            this.selectElement.innerHTML = "";
            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "Select saved list...";
            this.selectElement.appendChild(placeholder);

            const sorted = [...this.lists].sort((a, b) => a.name.localeCompare(b.name));
            sorted.forEach((list) => {
                const option = document.createElement("option");
                option.value = list.id;
                option.textContent = list.name;
                this.selectElement.appendChild(option);
            });

            const valueToUse = this.currentListId || previousValue;
            if (valueToUse) {
                this.selectElement.value = valueToUse;
                if (this.selectElement.value !== valueToUse) {
                    this.selectElement.value = "";
                }
            }
        }
    }

    const TeamSelection = {
        createSelector(options) {
            return new TeamSelector(options);
        },
        createListManager(options) {
            return new TeamListManager(options);
        },
        fetchTeamSuggestions: defaultFetchSuggestions,
        normalizeSuggestion: defaultNormalizeSuggestion,
    };

    window.TeamSelection = TeamSelection;
})();