window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // World – entity manager for in-mission gameplay
    // -------------------------------------------------------------------------

    // How often to attempt spawning a new ambient vehicle (seconds)
    var VEHICLE_SPAWN_INTERVAL = 8.0;

    // Number of civilians to spawn in a mission
    var DEFAULT_CIVILIAN_COUNT = 12;

    S.World = {

        entities   : [],   // all entities
        agents     : [],   // player agents
        enemies    : [],   // enemy entities
        civilians  : [],   // civilian entities
        vehicles   : [],   // vehicle entities
        projectiles: [],   // projectile entities
        map        : null, // tile map (2D array)

        _vehicleSpawnTimer: 0,

        // ------------------------------------------------------------------
        // init – set up a fresh world for a mission
        // ------------------------------------------------------------------
        init: function(map, missionData, gameState) {
            // Clear all lists
            this.entities    = [];
            this.agents      = [];
            this.enemies     = [];
            this.civilians   = [];
            this.vehicles    = [];
            this.projectiles = [];
            this.map         = map;
            this._vehicleSpawnTimer = VEHICLE_SPAWN_INTERVAL;

            var spawnPoints = S.getSpawnPoints ? S.getSpawnPoints(map) : [];

            // Spawn player agents
            this.spawnAgents(gameState, spawnPoints);

            // Spawn enemies from mission data
            if (missionData) {
                this.spawnEnemies(missionData, map);
            }

            // Spawn ambient civilians
            var civCount = (missionData && missionData.civilianCount) || DEFAULT_CIVILIAN_COUNT;
            this.spawnCivilians(civCount, map);

            // Spawn a couple of ambient vehicles
            for (var v = 0; v < 3; v++) {
                this.spawnVehicle(map);
            }
        },

        // ------------------------------------------------------------------
        // update – advance all systems each frame
        // ------------------------------------------------------------------
        update: function(dt) {
            var self = this;

            // Attach world reference to agents for IPA auto-targeting
            this.agents.forEach(function(a) { a._worldRef = self; });

            // Update all entities (each entity's own FSM + movement)
            this.entities.forEach(function(e) {
                if (!e.removed) {
                    e.update(dt, self);
                }
            });

            // Systems
            if (S.AI)        S.AI.update(this.entities, this.map, this);
            if (S.Combat)    S.Combat.update(this.entities, this.map, this);
            if (S.Persuasion) {
                S.Persuasion.update(this.agents, this.civilians, this.enemies, dt);
            }
            if (S.IPA)       S.IPA.update(this.agents, dt);
            if (S.Effects)   S.Effects.update(dt);

            // Occasional ambient vehicle spawn
            this._vehicleSpawnTimer -= dt;
            if (this._vehicleSpawnTimer <= 0) {
                this._vehicleSpawnTimer = VEHICLE_SPAWN_INTERVAL + S.randomRange(-2, 2);
                this.spawnVehicle(this.map);
            }

            // Prune removed / dead entities
            this._pruneEntities();
        },

        // ------------------------------------------------------------------
        // addEntity – add to master list and the appropriate sub-list
        // ------------------------------------------------------------------
        addEntity: function(entity) {
            if (!entity) return;
            this.entities.push(entity);

            switch (entity.type) {
                case S.ENTITY_TYPE.AGENT:      this.agents.push(entity);      break;
                case S.ENTITY_TYPE.ENEMY:      this.enemies.push(entity);     break;
                case S.ENTITY_TYPE.CIVILIAN:   this.civilians.push(entity);   break;
                case S.ENTITY_TYPE.VEHICLE:    this.vehicles.push(entity);    break;
                case S.ENTITY_TYPE.PROJECTILE: this.projectiles.push(entity); break;
            }
        },

        // ------------------------------------------------------------------
        // removeEntity – flag for removal at end of frame
        // ------------------------------------------------------------------
        removeEntity: function(entity) {
            if (entity) entity.removed = true;
        },

        // ------------------------------------------------------------------
        // _pruneEntities – sweep removed entities from all lists
        // ------------------------------------------------------------------
        _pruneEntities: function() {
            function keepAlive(arr) {
                for (var i = arr.length - 1; i >= 0; i--) {
                    if (arr[i].removed) arr.splice(i, 1);
                }
            }
            keepAlive(this.entities);
            keepAlive(this.agents);
            keepAlive(this.enemies);
            keepAlive(this.civilians);
            keepAlive(this.vehicles);
            keepAlive(this.projectiles);
        },

        // ------------------------------------------------------------------
        // Spatial queries
        // ------------------------------------------------------------------
        getEntitiesInRadius: function(x, y, radius, type) {
            var results = [];
            this.entities.forEach(function(e) {
                if (e.removed) return;
                if (type && e.type !== type) return;
                var dx = e.x - x;
                var dy = e.y - y;
                if (Math.sqrt(dx * dx + dy * dy) <= radius) {
                    results.push(e);
                }
            });
            return results;
        },

        getPlayerAgents: function() {
            return this.agents.filter(function(a) { return a.alive && !a.removed; });
        },

        getEnemies: function() {
            return this.enemies.filter(function(e) { return e.alive && !e.removed; });
        },

        // ------------------------------------------------------------------
        // spawnAgents – create Agent instances from GameState data
        // ------------------------------------------------------------------
        spawnAgents: function(gameState, spawnPoints) {
            if (!gameState) return;

            // Use the first few spawn points for agents, spread them out
            var usedPoints = spawnPoints.slice(0, 4);

            for (var i = 0; i < 4; i++) {
                var agentData = gameState.getAgentData ? gameState.getAgentData(i) : null;
                if (!agentData) continue;

                // Pick a spawn position
                var sp;
                if (usedPoints[i]) {
                    sp = usedPoints[i];
                } else {
                    // Fallback: scatter near centre
                    sp = { x: S.MAP_SIZE / 2 + (i - 1.5) * 2, y: S.MAP_SIZE / 2 };
                }

                var agent = new S.Agent(sp.x + 0.5, sp.y + 0.5, i);

                // Apply saved stats
                agent.name         = agentData.name || agent.name;
                agent.intelligence = typeof agentData.intelligence === 'number' ? agentData.intelligence : 0.5;
                agent.perception   = typeof agentData.perception   === 'number' ? agentData.perception   : 0.5;
                agent.adrenaline   = typeof agentData.adrenaline   === 'number' ? agentData.adrenaline   : 0.3;
                agent.maxHealth    = agentData.maxHealth || 100;
                agent.health       = agentData.health    || agent.maxHealth;

                // Apply cybernetics
                if (agentData.cybernetics) {
                    agent.cybernetics = S.deepCopy(agentData.cybernetics);
                }

                // Apply weapon
                var weaponType = (agentData.weaponType || 'pistol').toLowerCase();
                if (S.createWeapon) {
                    agent.weapon = S.createWeapon(weaponType);
                }

                // Persuadertron flag
                agent.hasPersuadertron = (weaponType === 'persuadertron');

                this.addEntity(agent);
            }
        },

        // ------------------------------------------------------------------
        // spawnEnemies – create enemies based on mission data
        // ------------------------------------------------------------------
        spawnEnemies: function(missionData, map) {
            var spawnPoints = S.getSpawnPoints ? S.getSpawnPoints(map) : [];
            var enemyCount  = (missionData && missionData.enemyCount) || 6;
            var weaponType  = (missionData && missionData.enemyWeapon) || 'pistol';

            // Build patrol paths by grouping spawn points into clusters
            var stride = Math.max(1, Math.floor(spawnPoints.length / (enemyCount + 1)));

            // Spread enemies across the map's spawn points, skipping the first
            // few which are used by agents.
            var availablePoints = spawnPoints.slice(4);

            for (var i = 0; i < enemyCount; i++) {
                var baseIdx = ((i * stride) + stride) % Math.max(1, availablePoints.length);
                var sp = availablePoints[baseIdx] ||
                         { x: S.randomRange(8, S.MAP_SIZE - 8), y: S.randomRange(8, S.MAP_SIZE - 8) };

                // Build a simple circular patrol path of 3-4 points around spawn
                var patrolPath = this._buildPatrolPath(sp.x + 0.5, sp.y + 0.5, map);

                var enemy = new S.Enemy(sp.x + 0.5, sp.y + 0.5, weaponType, patrolPath);
                enemy.weapon = S.createWeapon ? S.createWeapon(weaponType) : null;

                // Check for named/boss targets in mission data
                if (missionData && missionData.targets) {
                    var targetDef = missionData.targets[i];
                    if (targetDef) {
                        enemy._missionTargetId = targetDef.id || ('target_' + i);
                        if (targetDef.health) {
                            enemy.health    = targetDef.health;
                            enemy.maxHealth = targetDef.health;
                        }
                        if (targetDef.weapon) {
                            enemy.weapon = S.createWeapon ? S.createWeapon(targetDef.weapon) : null;
                        }
                    }
                }

                this.addEntity(enemy);
            }
        },

        // ------------------------------------------------------------------
        // _buildPatrolPath – 3-4 waypoints in a loose loop around startX/Y
        // ------------------------------------------------------------------
        _buildPatrolPath: function(startX, startY, map) {
            var points = [];
            var angles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
            var dist   = S.randomRange(3, 6);

            angles.forEach(function(angle) {
                var tx = Math.floor(startX + Math.cos(angle) * dist);
                var ty = Math.floor(startY + Math.sin(angle) * dist);
                tx = S.clamp(tx, 1, S.MAP_SIZE - 2);
                ty = S.clamp(ty, 1, S.MAP_SIZE - 2);

                // Find nearest walkable tile
                if (map && S.isWalkable) {
                    for (var r = 0; r <= 3; r++) {
                        for (var ox = -r; ox <= r; ox++) {
                            for (var oy = -r; oy <= r; oy++) {
                                var cx = S.clamp(tx + ox, 0, S.MAP_SIZE - 1);
                                var cy = S.clamp(ty + oy, 0, S.MAP_SIZE - 1);
                                if (S.isWalkable(map, cx, cy)) {
                                    points.push({ x: cx + 0.5, y: cy + 0.5 });
                                    return;
                                }
                            }
                        }
                    }
                } else {
                    points.push({ x: tx + 0.5, y: ty + 0.5 });
                }
            });

            return points.length > 0 ? points : [{ x: startX, y: startY }];
        },

        // ------------------------------------------------------------------
        // spawnCivilians – scatter civilians on walkable tiles near roads
        // ------------------------------------------------------------------
        spawnCivilians: function(count, map) {
            if (!map) return;
            var spawnPoints = S.getSpawnPoints ? S.getSpawnPoints(map) : [];
            if (spawnPoints.length === 0) return;

            // Shuffle and pick 'count' spawn points
            var shuffled = spawnPoints.slice();
            for (var i = shuffled.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var tmp = shuffled[i];
                shuffled[i] = shuffled[j];
                shuffled[j] = tmp;
            }

            var placed = 0;
            for (var k = 0; k < shuffled.length && placed < count; k++) {
                var sp = shuffled[k];
                var civ = new S.Civilian(sp.x + 0.5, sp.y + 0.5);
                this.addEntity(civ);
                placed++;
            }
        },

        // ------------------------------------------------------------------
        // spawnVehicle – pick a road tile on the map edge, head inward
        // ------------------------------------------------------------------
        spawnVehicle: function(map) {
            if (!map) return;

            // Pick a random edge: 0=top, 1=right, 2=bottom, 3=left
            var edge      = Math.floor(Math.random() * 4);
            var MS        = S.MAP_SIZE;
            var vx, vy, dx, dy;

            switch (edge) {
                case 0:  // top row, moving south
                    vx = Math.floor(Math.random() * MS);
                    vy = 0;
                    dx = 0; dy = 1;
                    break;
                case 1:  // right col, moving west
                    vx = MS - 1;
                    vy = Math.floor(Math.random() * MS);
                    dx = -1; dy = 0;
                    break;
                case 2:  // bottom row, moving north
                    vx = Math.floor(Math.random() * MS);
                    vy = MS - 1;
                    dx = 0; dy = -1;
                    break;
                default:  // left col, moving east
                    vx = 0;
                    vy = Math.floor(Math.random() * MS);
                    dx = 1; dy = 0;
                    break;
            }

            // Snap to nearest road tile along the chosen edge
            var tile = map[S.clamp(vx, 0, MS - 1)][S.clamp(vy, 0, MS - 1)];
            if (!tile || tile.terrain !== S.TERRAIN.ROAD) return;

            var vehicle = new S.Vehicle(vx + 0.5, vy + 0.5, { dx: dx, dy: dy });
            this.addEntity(vehicle);
        }
    };

}(window.Syndicate));
