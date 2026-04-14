window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Persuasion System — Persuadertron mechanic
    //
    // Call S.Persuasion.update(agents, civilians, enemies, dt) every frame.
    // Agents with hasPersuadertron=true slowly convert nearby civilians/enemies.
    // -------------------------------------------------------------------------

    S.Persuasion = {

        update: function(agents, civilians, enemies, dt) {
            var self = this;

            agents.forEach(function(agent) {
                if (!agent.alive || !agent.hasPersuadertron) return;

                // Persuasion radius scales with brain cybernetic
                var brain  = (agent.cybernetics && agent.cybernetics.brain) || 0;
                var radius = 2.0 + brain * 0.5;

                // --- Civilians ---
                self._processCivilians(agent, civilians, dt, radius);

                // --- Enemies (weakened only) ---
                self._processEnemies(agent, enemies, dt, radius);
            });
        },

        // ------------------------------------------------------------------
        // Attempt to persuade nearby civilians
        // ------------------------------------------------------------------
        _processCivilians: function(agent, civilians, dt, radius) {
            civilians.forEach(function(civ) {
                if (!civ.alive || civ.removed) return;
                if (civ.state === S.CIVILIAN_STATE.PERSUADED) return;

                var dx   = civ.x - agent.x;
                var dy   = civ.y - agent.y;
                var dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > radius) return;

                // Initialise resistance if not set
                if (typeof civ.persuasionResistance !== 'number') {
                    civ.persuasionResistance = 3.0;   // 3 seconds to convert
                }

                civ.persuasionResistance -= dt;

                if (civ.persuasionResistance <= 0) {
                    // Convert!
                    civ.state              = S.CIVILIAN_STATE.PERSUADED;
                    civ.leader             = agent;
                    civ.path               = [];
                    civ.pathIndex          = 0;
                    civ.persuasionResistance = 0;

                    if (!agent.persuadedFollowers) {
                        agent.persuadedFollowers = [];
                    }
                    if (agent.persuadedFollowers.indexOf(civ) === -1) {
                        agent.persuadedFollowers.push(civ);
                    }

                    // Neon spark effect at the newly persuaded civilian
                    if (S.Effects && S.Effects.spawnNeonSpark) {
                        S.Effects.spawnNeonSpark(civ.x, civ.y, S.COLORS.NEON_GREEN);
                    }
                }
            });
        },

        // ------------------------------------------------------------------
        // Attempt to persuade nearby weakened enemies
        // Requires enemy health < 30% of max; takes longer (5 seconds).
        // ------------------------------------------------------------------
        _processEnemies: function(agent, enemies, dt, radius) {
            enemies.forEach(function(enemy) {
                if (!enemy.alive || enemy.removed) return;

                // Only works on severely weakened enemies
                if (enemy.health >= enemy.maxHealth * 0.30) return;

                var dx   = enemy.x - agent.x;
                var dy   = enemy.y - agent.y;
                var dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > radius) return;

                // Initialise resistance if not set
                if (typeof enemy.persuasionResistance !== 'number') {
                    enemy.persuasionResistance = 5.0;   // 5 seconds for enemies
                }

                enemy.persuasionResistance -= dt;

                if (enemy.persuasionResistance <= 0) {
                    // Convert enemy into a follower:
                    // Switch to civilian-like PERSUADED behaviour
                    enemy.state              = S.AI_STATE.FLEE;   // stops attacking
                    enemy.target             = null;
                    enemy._persuaded         = true;
                    enemy._persuadedLeader   = agent;
                    enemy.persuasionResistance = 0;

                    if (!agent.persuadedFollowers) {
                        agent.persuadedFollowers = [];
                    }
                    if (agent.persuadedFollowers.indexOf(enemy) === -1) {
                        agent.persuadedFollowers.push(enemy);
                    }

                    // Visual feedback
                    if (S.Effects && S.Effects.spawnNeonSpark) {
                        S.Effects.spawnNeonSpark(enemy.x, enemy.y, S.COLORS.NEON_MAGENTA);
                    }
                }
            });
        }
    };

}(window.Syndicate));
