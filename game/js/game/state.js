window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Global Game State with localStorage persistence
    // -------------------------------------------------------------------------

    var SAVE_KEY = 'syndicate_save';

    var DEFAULT_AGENTS = [
        { name: 'Reaper',  weaponType: 'pistol', cybernetics: { legs: 0, arms: 0, chest: 0, brain: 0 }, intelligence: 0.5, perception: 0.5, adrenaline: 0.3, health: 100, maxHealth: 100 },
        { name: 'Ghost',   weaponType: 'pistol', cybernetics: { legs: 0, arms: 0, chest: 0, brain: 0 }, intelligence: 0.5, perception: 0.5, adrenaline: 0.3, health: 100, maxHealth: 100 },
        { name: 'Spectre', weaponType: 'pistol', cybernetics: { legs: 0, arms: 0, chest: 0, brain: 0 }, intelligence: 0.5, perception: 0.5, adrenaline: 0.3, health: 100, maxHealth: 100 },
        { name: 'Chrome',  weaponType: 'pistol', cybernetics: { legs: 0, arms: 0, chest: 0, brain: 0 }, intelligence: 0.5, perception: 0.5, adrenaline: 0.3, health: 100, maxHealth: 100 }
    ];

    S.GameState = {

        money            : 500000,
        agents           : [],          // array of 4 serialisable agent data objects
        completedMissions: [],          // mission ID strings
        conqueredRegions : [],          // region ID strings
        researchCompleted: [],          // research item ID strings
        currentMission   : null,

        // ------------------------------------------------------------------
        // init – load from localStorage or create fresh state
        // ------------------------------------------------------------------
        init: function() {
            if (!this.load()) {
                this.reset();
            }
        },

        // ------------------------------------------------------------------
        // save – serialise to localStorage
        // ------------------------------------------------------------------
        save: function() {
            try {
                var data = {
                    money            : this.money,
                    agents           : this.agents,
                    completedMissions: this.completedMissions,
                    conqueredRegions : this.conqueredRegions,
                    researchCompleted: this.researchCompleted,
                    currentMission   : this.currentMission
                };
                localStorage.setItem(SAVE_KEY, JSON.stringify(data));
                return true;
            } catch (e) {
                console.warn('[GameState] save failed:', e);
                return false;
            }
        },

        // ------------------------------------------------------------------
        // load – deserialise from localStorage; returns false if no save found
        // ------------------------------------------------------------------
        load: function() {
            try {
                var raw = localStorage.getItem(SAVE_KEY);
                if (!raw) return false;
                var data = JSON.parse(raw);
                this.money             = data.money             || 500000;
                this.agents            = data.agents            || this.createDefaultAgents();
                this.completedMissions = data.completedMissions || [];
                this.conqueredRegions  = data.conqueredRegions  || [];
                this.researchCompleted = data.researchCompleted || [];
                this.currentMission    = data.currentMission    || null;
                return true;
            } catch (e) {
                console.warn('[GameState] load failed:', e);
                return false;
            }
        },

        // ------------------------------------------------------------------
        // reset – wipe save data and create a fresh state
        // ------------------------------------------------------------------
        reset: function() {
            try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
            this.money             = 500000;
            this.agents            = this.createDefaultAgents();
            this.completedMissions = [];
            this.conqueredRegions  = [];
            this.researchCompleted = [];
            this.currentMission    = null;
        },

        // ------------------------------------------------------------------
        // Money management
        // ------------------------------------------------------------------
        addMoney: function(amount) {
            if (typeof amount !== 'number' || amount < 0) return false;
            this.money += Math.floor(amount);
            return true;
        },

        spendMoney: function(amount) {
            if (typeof amount !== 'number' || amount < 0) return false;
            var cost = Math.floor(amount);
            if (this.money < cost) return false;
            this.money -= cost;
            return true;
        },

        // ------------------------------------------------------------------
        // Research
        // ------------------------------------------------------------------
        isResearched: function(id) {
            return this.researchCompleted.indexOf(id) !== -1;
        },

        completeResearch: function(id) {
            if (!this.isResearched(id)) {
                this.researchCompleted.push(id);
            }
        },

        // ------------------------------------------------------------------
        // Missions
        // ------------------------------------------------------------------
        isMissionComplete: function(id) {
            return this.completedMissions.indexOf(id) !== -1;
        },

        completeMission: function(id, reward) {
            if (!this.isMissionComplete(id)) {
                this.completedMissions.push(id);
            }
            if (typeof reward === 'number' && reward > 0) {
                this.addMoney(reward);
            }
        },

        // ------------------------------------------------------------------
        // Regions
        // ------------------------------------------------------------------
        isRegionConquered: function(id) {
            return this.conqueredRegions.indexOf(id) !== -1;
        },

        conquerRegion: function(id) {
            if (!this.isRegionConquered(id)) {
                this.conqueredRegions.push(id);
            }
        },

        // ------------------------------------------------------------------
        // Agent data
        // ------------------------------------------------------------------
        getAgentData: function(index) {
            return this.agents[index] || null;
        },

        updateAgentData: function(index, data) {
            if (index < 0 || index > 3) return;
            this.agents[index] = Object.assign(this.agents[index] || {}, data);
        },

        // ------------------------------------------------------------------
        // createDefaultAgents – returns 4 fresh agent data objects
        // ------------------------------------------------------------------
        createDefaultAgents: function() {
            return DEFAULT_AGENTS.map(function(a) {
                return S.deepCopy(a);
            });
        }
    };

}(window.Syndicate));
