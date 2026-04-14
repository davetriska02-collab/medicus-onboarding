window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Mission Manager – objective tracking and win/loss detection
    // -------------------------------------------------------------------------

    // Objective types
    var OBJ = {
        KILL_TARGET     : 'KILL_TARGET',
        KILL_ALL        : 'KILL_ALL',
        PERSUADE_COUNT  : 'PERSUADE_COUNT',
        REACH_EXTRACTION: 'REACH_EXTRACTION',
        SURVIVE_TIME    : 'SURVIVE_TIME'
    };

    S.MissionManager = {

        currentMission  : null,
        objectives      : [],      // primary objectives with { ...def, completed: false }
        bonusObjectives : [],      // bonus objectives
        missionTime     : 0,
        missionComplete : false,
        missionFailed   : false,

        // ------------------------------------------------------------------
        // startMission – initialise the manager with mission data
        // ------------------------------------------------------------------
        startMission: function(missionData) {
            this.currentMission  = missionData;
            this.missionTime     = 0;
            this.missionComplete = false;
            this.missionFailed   = false;

            // Deep-copy objectives and attach completion flag
            this.objectives = (missionData && missionData.objectives)
                ? missionData.objectives.map(function(obj) {
                    return Object.assign(S.deepCopy(obj), { completed: false });
                })
                : [];

            this.bonusObjectives = (missionData && missionData.bonusObjectives)
                ? missionData.bonusObjectives.map(function(obj) {
                    return Object.assign(S.deepCopy(obj), { completed: false });
                })
                : [];
        },

        // ------------------------------------------------------------------
        // update – check all objectives each frame
        // ------------------------------------------------------------------
        update: function(dt, world) {
            if (this.missionComplete || this.missionFailed) return;

            this.missionTime += dt;

            // Check primary objectives
            this._checkObjectives(this.objectives, world);

            // Check bonus objectives
            this._checkObjectives(this.bonusObjectives, world);

            // Win condition: all primary objectives complete
            var allDone = this.objectives.length > 0 &&
                this.objectives.every(function(o) { return o.completed; });
            if (allDone) {
                this.missionComplete = true;
                return;
            }

            // Fail condition: all player agents dead
            if (world) {
                var aliveAgents = world.getPlayerAgents ? world.getPlayerAgents() : [];
                if (aliveAgents.length === 0 && world.agents && world.agents.length > 0) {
                    this.missionFailed = true;
                }
            }
        },

        // ------------------------------------------------------------------
        // _checkObjectives – evaluate a list of objectives against world state
        // ------------------------------------------------------------------
        _checkObjectives: function(objectives, world) {
            var self = this;
            objectives.forEach(function(obj) {
                if (obj.completed) return;
                obj.completed = self._isObjectiveComplete(obj, world);
            });
        },

        _isObjectiveComplete: function(obj, world) {
            if (!world) return false;

            switch (obj.type) {

                case OBJ.KILL_TARGET: {
                    // Check if a specific target (identified by _missionTargetId) is dead
                    var targetId = obj.targetId;
                    var enemies  = world.enemies || [];
                    for (var i = 0; i < enemies.length; i++) {
                        var e = enemies[i];
                        if (e._missionTargetId === targetId && !e.alive) return true;
                    }
                    return false;
                }

                case OBJ.KILL_ALL: {
                    var liveEnemies = world.getEnemies ? world.getEnemies() : [];
                    return liveEnemies.length === 0;
                }

                case OBJ.PERSUADE_COUNT: {
                    var required = obj.count || 1;
                    var total    = 0;
                    (world.agents || []).forEach(function(agent) {
                        if (agent.alive && agent.persuadedFollowers) {
                            total += agent.persuadedFollowers.length;
                        }
                    });
                    return total >= required;
                }

                case OBJ.REACH_EXTRACTION: {
                    // Check if any agent is within the extraction zone (radius 2 of target pos)
                    var zone  = obj.zone || obj.position;
                    if (!zone) return false;
                    var radius = obj.radius || 2.0;
                    var agents = world.getPlayerAgents ? world.getPlayerAgents() : [];
                    for (var j = 0; j < agents.length; j++) {
                        var a  = agents[j];
                        var dx = a.x - zone.x;
                        var dy = a.y - zone.y;
                        if (Math.sqrt(dx * dx + dy * dy) <= radius) return true;
                    }
                    return false;
                }

                case OBJ.SURVIVE_TIME: {
                    return this.missionTime >= (obj.time || 60);
                }

                default:
                    return false;
            }
        },

        // ------------------------------------------------------------------
        // getReward – total credit reward including completed bonus objectives
        // ------------------------------------------------------------------
        getReward: function() {
            var base  = (this.currentMission && this.currentMission.reward) || 0;
            var bonus = 0;
            this.bonusObjectives.forEach(function(obj) {
                if (obj.completed && obj.reward) {
                    bonus += obj.reward;
                }
            });
            return base + bonus;
        },

        // ------------------------------------------------------------------
        // getObjectiveStatus – returns array of { text, completed } for HUD
        // ------------------------------------------------------------------
        getObjectiveStatus: function() {
            return this.objectives.map(function(obj) {
                return {
                    text     : obj.text || obj.type,
                    completed: obj.completed
                };
            });
        },

        getBonusObjectiveStatus: function() {
            return this.bonusObjectives.map(function(obj) {
                return {
                    text     : obj.text || obj.type,
                    completed: obj.completed
                };
            });
        },

        // ------------------------------------------------------------------
        // getMissionResult – summary object passed to the debrief screen
        // ------------------------------------------------------------------
        getMissionResult: function(world) {
            var agentsLost    = 0;
            var persuadedCount = 0;

            if (world) {
                (world.agents || []).forEach(function(agent) {
                    if (!agent.alive) agentsLost++;
                    if (agent.persuadedFollowers) {
                        persuadedCount += agent.persuadedFollowers.length;
                    }
                });
            }

            var bonusCompleted = this.bonusObjectives.filter(function(o) {
                return o.completed;
            }).length;

            return {
                success           : this.missionComplete,
                reward            : this.getReward(),
                time              : this.missionTime,
                objectivesCompleted: this.objectives.filter(function(o) { return o.completed; }).length,
                objectivesTotal   : this.objectives.length,
                bonusCompleted    : bonusCompleted,
                persuadedCount    : persuadedCount,
                agentsLost        : agentsLost
            };
        },

        // ------------------------------------------------------------------
        // getFormattedTime – MM:SS string from missionTime
        // ------------------------------------------------------------------
        getFormattedTime: function() {
            var total   = Math.floor(this.missionTime);
            var minutes = Math.floor(total / 60);
            var seconds = total % 60;
            return (minutes < 10 ? '0' : '') + minutes + ':' +
                   (seconds < 10 ? '0' : '') + seconds;
        }
    };

}(window.Syndicate));
