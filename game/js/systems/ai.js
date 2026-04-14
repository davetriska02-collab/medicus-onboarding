window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // AI System
    // Drives enemy and civilian behavior each frame.
    // Call S.AI.update(entities, map, world) every frame.
    // -------------------------------------------------------------------------

    S.AI = {

        // ------------------------------------------------------------------
        // Main update
        // ------------------------------------------------------------------
        update: function(entities, map, world) {
            var self = this;

            entities.forEach(function(entity) {
                if (!entity.alive || entity.removed) return;

                if (entity.type === S.ENTITY_TYPE.ENEMY) {
                    self._updateEnemy(entity, entities, map, world);
                } else if (entity.type === S.ENTITY_TYPE.CIVILIAN) {
                    self._updateCivilian(entity, entities, map, world);
                }
            });
        },

        // ------------------------------------------------------------------
        // Enemy state machine
        // ------------------------------------------------------------------
        _updateEnemy: function(enemy, entities, map, world) {
            // Gather player agents for detection
            var playerAgents = [];
            entities.forEach(function(e) {
                if (e.alive && !e.removed && e.type === S.ENTITY_TYPE.AGENT) {
                    playerAgents.push(e);
                }
            });

            switch (enemy.state) {
                case S.AI_STATE.PATROL:
                    this._enemyPatrol(enemy, playerAgents, map, world);
                    break;
                case S.AI_STATE.ALERT:
                    this._enemyAlert(enemy, playerAgents, map, world);
                    break;
                case S.AI_STATE.CHASE:
                    this._enemyChase(enemy, playerAgents, map, world);
                    break;
                case S.AI_STATE.ENGAGE:
                    this._enemyEngage(enemy, playerAgents, map, world);
                    break;
                case S.AI_STATE.FLEE:
                    this._enemyFlee(enemy, playerAgents, map, world);
                    break;
            }
        },

        _enemyPatrol: function(enemy, playerAgents, map, world) {
            // Patrol movement is handled by enemy.js _updatePatrol; here we only
            // check for detection and trigger the ALERT transition.
            var detected = this.detectPlayer(enemy, playerAgents, map);
            if (detected) {
                enemy.target          = detected;
                enemy.state           = S.AI_STATE.ALERT;
                enemy.alertTimer      = 1.0;   // 1 second alert before CHASE
                enemy.lostTargetTimer = 0;
                // Face toward detected agent
                var dx = detected.x - enemy.x;
                var dy = detected.y - enemy.y;
                enemy.facing = Math.atan2(dy, dx);
            }
            // Actual patrol movement delegated to enemy.js
        },

        _enemyAlert: function(enemy, playerAgents, map, world) {
            // Face toward target
            if (enemy.target && enemy.target.alive) {
                var dx = enemy.target.x - enemy.x;
                var dy = enemy.target.y - enemy.y;
                enemy.facing = Math.atan2(dy, dx);
            }

            // alertTimer counts down; once zero, transition to CHASE
            // (enemy.js already decrements alertTimer each frame)
            if (enemy.alertTimer <= 0) {
                // Check target still in range
                if (enemy.target && enemy.target.alive) {
                    var dist = enemy.distanceTo(enemy.target);
                    if (dist <= enemy.detectionRadius) {
                        enemy.state           = S.AI_STATE.CHASE;
                        enemy.lostTargetTimer = 5.0;
                        enemy.path            = [];
                        enemy.pathIndex       = 0;
                    } else {
                        // Target walked away during alert
                        enemy.target = null;
                        enemy.state  = S.AI_STATE.PATROL;
                    }
                } else {
                    enemy.target = null;
                    enemy.state  = S.AI_STATE.PATROL;
                }
            } else {
                // Still in alert — also check if target walked way out of range already
                if (!enemy.target || !enemy.target.alive) {
                    enemy.target = null;
                    enemy.state  = S.AI_STATE.PATROL;
                } else {
                    var alertDist = enemy.distanceTo(enemy.target);
                    if (alertDist > enemy.detectionRadius * 1.5) {
                        enemy.target = null;
                        enemy.state  = S.AI_STATE.PATROL;
                    }
                }
            }
        },

        _enemyChase: function(enemy, playerAgents, map, world) {
            if (!enemy.target || !enemy.target.alive) {
                // Use lostTargetTimer to linger before going back to patrol
                if (enemy.lostTargetTimer <= 0) {
                    enemy.target = null;
                    enemy.state  = S.AI_STATE.PATROL;
                    enemy.path   = [];
                }
                return;
            }

            var dist = enemy.distanceTo(enemy.target);

            // Re-check detection: if target well out of range and timer expired
            if (dist > enemy.detectionRadius * 2 && enemy.lostTargetTimer <= 0) {
                enemy.target = null;
                enemy.state  = S.AI_STATE.PATROL;
                enemy.path   = [];
                return;
            }

            // Check if in weapon range with LOS → engage
            var weapon = enemy.weapon;
            if (weapon) {
                var hasLOS = map
                    ? S.Movement.hasLineOfSight(map, enemy.x, enemy.y,
                                                enemy.target.x, enemy.target.y)
                    : true;
                if (dist <= weapon.range && hasLOS) {
                    enemy.state = S.AI_STATE.ENGAGE;
                    return;
                }
            }

            // Flee if health is critically low
            if (enemy.health < enemy.maxHealth * 0.20) {
                enemy.state = S.AI_STATE.FLEE;
                enemy.path  = [];
                return;
            }

            // Re-path toward target every 0.5 seconds (not every frame)
            if (!enemy._rechaseTimer) enemy._rechaseTimer = 0;
            enemy._rechaseTimer -= (1 / 60);   // approximate; gets reset below
            if (!enemy.path || enemy.pathIndex >= enemy.path.length ||
                enemy._rechaseTimer <= 0) {
                enemy._rechaseTimer = 0.5;
                if (map && S.Movement) {
                    enemy.path      = S.Movement.findPath(map, enemy.x, enemy.y,
                                                           enemy.target.x, enemy.target.y);
                    enemy.pathIndex = 0;
                }
            }

            // enemy.js handles followPath in _updateChase; we just keep state consistent
            // Reset lostTargetTimer when we can see the target
            if (enemy.target && enemy.target.alive) {
                enemy.lostTargetTimer = 5.0;
                enemy.lastKnownTargetX = enemy.target.x;
                enemy.lastKnownTargetY = enemy.target.y;
            }
        },

        _enemyEngage: function(enemy, playerAgents, map, world) {
            if (!enemy.target || !enemy.target.alive) {
                enemy.target = null;
                enemy.state  = S.AI_STATE.PATROL;
                return;
            }

            // Flee if health critically low
            if (enemy.health < enemy.maxHealth * 0.20) {
                enemy.state = S.AI_STATE.FLEE;
                enemy.path  = [];
                return;
            }

            var dist   = enemy.distanceTo(enemy.target);
            var weapon = enemy.weapon;

            if (!weapon) {
                enemy.state = S.AI_STATE.CHASE;
                return;
            }

            // Target out of range → chase
            if (dist > weapon.range * 1.1) {
                enemy.state = S.AI_STATE.CHASE;
                enemy.path  = [];
                return;
            }

            // Face target (combat system handles firing while in ENGAGE)
            var dx = enemy.target.x - enemy.x;
            var dy = enemy.target.y - enemy.y;
            enemy.facing              = Math.atan2(dy, dx);
            enemy.lastKnownTargetX    = enemy.target.x;
            enemy.lastKnownTargetY    = enemy.target.y;

            // Slight strafe: shift along perpendicular every 2 seconds
            if (!enemy._strafeTimer) enemy._strafeTimer = S.randomRange(1.5, 3.0);
            enemy._strafeTimer -= (1 / 60);
            if (enemy._strafeTimer <= 0) {
                enemy._strafeTimer = S.randomRange(1.5, 3.0);
                var perpX = -Math.sin(enemy.facing) * S.randomRange(0.5, 1.5);
                var perpY =  Math.cos(enemy.facing) * S.randomRange(0.5, 1.5);
                var strafeX = S.clamp(enemy.x + perpX, 0, S.MAP_SIZE - 1);
                var strafeY = S.clamp(enemy.y + perpY, 0, S.MAP_SIZE - 1);
                if (map && S.isWalkable && S.isWalkable(map, strafeX, strafeY)) {
                    if (S.Movement) {
                        enemy.path      = S.Movement.findPath(map, enemy.x, enemy.y,
                                                               strafeX, strafeY);
                        enemy.pathIndex = 0;
                    }
                }
            }
        },

        _enemyFlee: function(enemy, playerAgents, map, world) {
            // Find nearest player agent as the threat
            var threat      = null;
            var nearestDist = Infinity;
            playerAgents.forEach(function(a) {
                if (!a.alive) return;
                var d = enemy.distanceTo(a);
                if (d < nearestDist) {
                    nearestDist = d;
                    threat      = a;
                }
            });

            if (!threat) {
                // No threat — calm down
                enemy.state = S.AI_STATE.PATROL;
                return;
            }

            // If health somewhat recovered (edge case) or cornered, engage again
            if (enemy.health > enemy.maxHealth * 0.35) {
                enemy.state = S.AI_STATE.CHASE;
                return;
            }

            // Pick a flee destination only when path is exhausted
            if (!enemy.path || enemy.pathIndex >= enemy.path.length) {
                var fleePos = this.findFleePosition(enemy, threat.x, threat.y, map);
                if (fleePos && map && S.Movement) {
                    var fleePath = S.Movement.findPath(map, enemy.x, enemy.y,
                                                       fleePos.x, fleePos.y);
                    if (fleePath.length > 0) {
                        enemy.path      = fleePath;
                        enemy.pathIndex = 0;
                    } else {
                        // Cornered — stand and fight
                        enemy.state = S.AI_STATE.ENGAGE;
                    }
                } else {
                    enemy.state = S.AI_STATE.ENGAGE;
                }
            }
            // Actual movement handled by enemy.js _updateFlee / followPath
        },

        // ------------------------------------------------------------------
        // Civilian state machine
        // ------------------------------------------------------------------
        _updateCivilian: function(civilian, entities, map, world) {
            switch (civilian.state) {
                case S.CIVILIAN_STATE.WANDER:
                    this._civilianWander(civilian, entities, map, world);
                    break;
                case S.CIVILIAN_STATE.FLEE:
                    // Handled by civilian.js _updateFlee; check if calm again
                    // (civilian.js resets state to WANDER when fleeTimer expires)
                    break;
                case S.CIVILIAN_STATE.PERSUADED:
                    // Handled fully by civilian.js _updatePersuaded
                    break;
            }
        },

        _civilianWander: function(civilian, entities, map, world) {
            // Check for nearby combat / danger within panicRadius
            var panicRadius = civilian.panicRadius || 5.0;
            var dangerPos   = null;

            entities.forEach(function(e) {
                if (dangerPos) return;
                if (!e.alive || e.removed) return;
                // Enemies in CHASE or ENGAGE state are "combat"
                if (e.type === S.ENTITY_TYPE.ENEMY) {
                    if (e.state === S.AI_STATE.CHASE || e.state === S.AI_STATE.ENGAGE) {
                        var dx = civilian.x - e.x;
                        var dy = civilian.y - e.y;
                        if (Math.sqrt(dx * dx + dy * dy) < panicRadius) {
                            dangerPos = { x: e.x, y: e.y };
                        }
                    }
                }
                // Projectiles flying nearby
                if (e.type === S.ENTITY_TYPE.PROJECTILE) {
                    var dx2 = civilian.x - e.x;
                    var dy2 = civilian.y - e.y;
                    if (Math.sqrt(dx2 * dx2 + dy2 * dy2) < panicRadius * 0.5) {
                        dangerPos = { x: e.x, y: e.y };
                    }
                }
            });

            if (dangerPos) {
                civilian.triggerFlee(dangerPos);
            }
            // Wander movement handled by civilian.js _updateWander
        },

        // ------------------------------------------------------------------
        // detectPlayer
        // Check for player agents within detection radius with LOS.
        // Returns first detected agent, or null.
        // ------------------------------------------------------------------
        detectPlayer: function(enemy, playerAgents, map) {
            for (var i = 0; i < playerAgents.length; i++) {
                var agent = playerAgents[i];
                if (!agent.alive) continue;

                var dx   = agent.x - enemy.x;
                var dy   = agent.y - enemy.y;
                var dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > enemy.detectionRadius) continue;

                // Check LOS
                var hasLOS = map
                    ? S.Movement.hasLineOfSight(map, enemy.x, enemy.y, agent.x, agent.y)
                    : true;

                if (hasLOS) return agent;
            }
            return null;
        },

        // ------------------------------------------------------------------
        // findFleePosition
        // Pick a position ~8 tiles away from threat in the opposite direction.
        // Returns {x, y} of a walkable tile, or null if none found.
        // ------------------------------------------------------------------
        findFleePosition: function(entity, threatX, threatY, map) {
            var dx  = entity.x - threatX;
        var dy  = entity.y - threatY;
            var len = Math.sqrt(dx * dx + dy * dy) || 1;
            var nx  = dx / len;
            var ny  = dy / len;

            // Try the ideal direction first, then fan out
            var FLEE_DIST = 8;
            var angles    = [0, 0.4, -0.4, 0.8, -0.8, Math.PI];

            for (var ai = 0; ai < angles.length; ai++) {
                var angle = Math.atan2(ny, nx) + angles[ai];
                var tx    = entity.x + Math.cos(angle) * FLEE_DIST;
                var ty    = entity.y + Math.sin(angle) * FLEE_DIST;

                tx = S.clamp(tx, 1, S.MAP_SIZE - 2);
                ty = S.clamp(ty, 1, S.MAP_SIZE - 2);

                // Find nearest walkable tile to this position
                var best      = null;
                var bestDist  = Infinity;
                var searchR   = 2;

                for (var ox = -searchR; ox <= searchR; ox++) {
                    for (var oy = -searchR; oy <= searchR; oy++) {
                        var cx = Math.floor(tx + ox);
                        var cy = Math.floor(ty + oy);
                        if (cx < 0 || cy < 0 || cx >= S.MAP_SIZE || cy >= S.MAP_SIZE) continue;
                        if (map && S.isWalkable && !S.isWalkable(map, cx, cy)) continue;
                        var d = Math.sqrt(ox * ox + oy * oy);
                        if (d < bestDist) {
                            bestDist = d;
                            best     = { x: cx + 0.5, y: cy + 0.5 };
                        }
                    }
                }

                if (best) return best;
            }

            return null;
        }
    };

}(window.Syndicate));
