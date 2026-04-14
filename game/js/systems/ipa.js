window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // IPA (Intelligence, Perception, Adrenaline) Slider System
    //
    // Applies per-frame effects from the three IPA sliders to each alive agent.
    // Call S.IPA.update(agents, dt) every frame.
    // -------------------------------------------------------------------------

    S.IPA = {

        // ------------------------------------------------------------------
        // Main update
        // ------------------------------------------------------------------
        update: function(agents, dt) {
            var self = this;
            agents.forEach(function(agent) {
                if (!agent.alive) return;
                self._applyAdrenalineEffects(agent, dt);
                self._applyIntelligenceAutoTarget(agent);
            });
        },

        // ------------------------------------------------------------------
        // Adrenaline health effects
        //   > 0.7 adrenaline: drain health slowly
        //   < 0.2 adrenaline: regenerate health slowly
        // ------------------------------------------------------------------
        _applyAdrenalineEffects: function(agent, dt) {
            var adr = agent.adrenaline || 0;

            if (adr > 0.7) {
                // High adrenaline drains health
                var drainRate = 1.0 * (adr - 0.7);   // up to 0.3 hp/s at adr=1.0
                agent.health -= drainRate * dt;
                if (agent.health < 1) agent.health = 1;  // don't kill by adrenaline alone
            } else if (adr < 0.2) {
                // Low adrenaline regenerates health slowly
                var regenRate = 0.5 * (0.2 - adr);    // up to 0.1 hp/s at adr=0
                var maxHp     = typeof agent.getMaxHealth === 'function'
                    ? agent.getMaxHealth()
                    : agent.maxHealth;
                agent.health = Math.min(agent.health + regenRate * dt, maxHp);
            }
        },

        // ------------------------------------------------------------------
        // Intelligence auto-targeting
        //   > 0.5 intelligence: agent in IDLE will auto-acquire nearest enemy
        //   < 0.3 intelligence: 30% chance per second to "forget" the target
        // ------------------------------------------------------------------
        _applyIntelligenceAutoTarget: function(agent) {
            var intel = agent.intelligence || 0;

            if (agent.state === S.AGENT_STATE.IDLE && intel > 0.5 && !agent.target) {
                // Auto-scan for enemies within perception radius
                this._autoAcquireTarget(agent);
            }

            if (intel < 0.3 && agent.target && agent.target.alive) {
                // 30% chance per second to forget the target
                // Approximate: run against a 60Hz frame by squaring (0.7^(1/60) ≈ 0.9941 per frame)
                // Simple approach: use raw probability proportional to dt if called each frame
                // We spread the 30%/s across frames using 1-(1-0.3)^dt
                var forgetChance = 1 - Math.pow(0.70, 1 / 60);
                if (Math.random() < forgetChance) {
                    agent.target = null;
                    agent.state  = S.AGENT_STATE.IDLE;
                }
            }
        },

        // ------------------------------------------------------------------
        // Scan world entities for the nearest enemy within the agent's
        // perception radius and auto-assign it as a target.
        // Requires agent._worldRef to be set each frame by the world system,
        // or falls back to S.World if available.
        // ------------------------------------------------------------------
        _autoAcquireTarget: function(agent) {
            var world = agent._worldRef || S.World;
            if (!world || !world.enemies) return;

            var perceptionRadius = typeof agent.getPerceptionRadius === 'function'
                ? agent.getPerceptionRadius()
                : agent.basePerception || 8.0;

            var best     = null;
            var bestDist = Infinity;

            world.enemies.forEach(function(e) {
                if (!e.alive || e.removed) return;
                var dx = e.x - agent.x;
                var dy = e.y - agent.y;
                var d  = Math.sqrt(dx * dx + dy * dy);
                if (d < perceptionRadius && d < bestDist) {
                    bestDist = d;
                    best     = e;
                }
            });

            if (best) {
                agent.target = best;
                agent.state  = S.AGENT_STATE.ATTACKING;
            }
        },

        // ------------------------------------------------------------------
        // getStatModifiers
        // Returns multiplier values driven by IPA + cybernetics.
        // ------------------------------------------------------------------
        getStatModifiers: function(agent) {
            var intel = agent.intelligence || 0.5;
            var perc  = agent.perception   || 0.5;
            var adr   = agent.adrenaline   || 0.3;
            var cy    = agent.cybernetics  || { legs: 0, arms: 0, chest: 0, brain: 0 };

            return {
                speed:     (0.7 + adr   * 0.6)  * (1 + (cy.legs  || 0) * 0.15),
                accuracy:  (0.5 + intel * 1.0)  * (1 + (cy.arms  || 0) * 0.12),
                perception:(0.5 + perc  * 1.0)  * (1 + (cy.brain || 0) * 0.15),
                maxHealth: 1 + (cy.chest || 0) * 0.25
            };
        }
    };

}(window.Syndicate));
