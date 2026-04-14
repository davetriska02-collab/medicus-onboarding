window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    /**
     * Combat system.
     *
     * Call S.Combat.update(entities, map, world) every frame.
     * The system iterates over entities in ATTACKING state (agents & enemies)
     * and handles: range-checking, LOS, hit-chance rolling, damage, death,
     * projectile spawning, and civilian panic.
     */
    S.Combat = {

        // ------------------------------------------------------------------
        // Main update
        // ------------------------------------------------------------------
        update: function(entities, map, world) {
            var self = this;

            entities.forEach(function(entity) {
                if (!entity.alive) return;

                var isAgent  = entity.type === S.ENTITY_TYPE.AGENT;
                var isEnemy  = entity.type === S.ENTITY_TYPE.ENEMY;

                if (!isAgent && !isEnemy) return;

                // Determine if this entity is in an attacking posture
                var attacking = false;
                if (isAgent  && entity.state === S.AGENT_STATE.ATTACKING) attacking = true;
                if (isEnemy  && entity.state === S.AI_STATE.ENGAGE)        attacking = true;

                if (!attacking) return;
                if (!entity.target || !entity.target.alive) {
                    // Target gone – return to idle / patrol
                    entity.target = null;
                    entity.state  = isAgent ? S.AGENT_STATE.IDLE : S.AI_STATE.PATROL;
                    return;
                }

                var target = entity.target;
                var weapon = entity.weapon;
                if (!weapon) return;

                var dist = entity.distanceTo(target);

                // ---- Out of range: move toward target ----------------
                if (dist > weapon.range) {
                    if (isAgent) {
                        entity.state = S.AGENT_STATE.MOVING;
                        if (map && S.Movement) {
                            var path = S.Movement.findPath(map, entity.x, entity.y,
                                                            target.x, target.y);
                            entity.path      = path;
                            entity.pathIndex = 0;
                        }
                    } else {
                        entity.state = S.AI_STATE.CHASE;
                    }
                    return;
                }

                // ---- Check LOS ---------------------------------------
                var hasLOS = map
                    ? self.checkLineOfSight(map, entity.x, entity.y, target.x, target.y)
                    : true;

                if (!hasLOS) {
                    // Try to manoeuvre closer to re-establish LOS
                    if (isAgent) {
                        entity.state = S.AGENT_STATE.MOVING;
                        if (map && S.Movement) {
                            var losPath = S.Movement.findPath(map, entity.x, entity.y,
                                                               target.x, target.y);
                            entity.path      = losPath;
                            entity.pathIndex = 0;
                        }
                    } else {
                        entity.state = S.AI_STATE.CHASE;
                    }
                    return;
                }

                // ---- Weapon cooldown ---------------------------------
                if (entity.weaponCooldown > 0) return;

                // ---- Fire! ------------------------------------------
                self._fireWeapon(entity, target, weapon, dist, map, world, entities);
                entity.weaponCooldown = weapon.cooldown;
            });
        },

        // ------------------------------------------------------------------
        // Fire a weapon from shooter at target
        // ------------------------------------------------------------------
        _fireWeapon: function(shooter, target, weapon, dist, map, world, entities) {
            var self      = this;
            var pellets   = weapon.pellets || 1;
            var hitChance = self._calculateHitChance(shooter, target, weapon, dist, map);

            // Muzzle flash
            if (S.Effects) {
                S.Effects.spawnMuzzleFlash(shooter.x, shooter.y);
            }

            // Trigger civilian panic in the area
            if (world && world.entities) {
                self._triggerCivilianPanic(shooter, world.entities);
            }

            var totalHit = false;

            for (var p = 0; p < pellets; p++) {
                // Apply angular spread
                var angle  = shooter.facing;
                if (weapon.spread > 0) {
                    angle += (Math.random() - 0.5) * weapon.spread * 2;
                }

                // Spawn visual projectile
                if (S.Projectile) {
                    // Spread affects landing position
                    var range    = weapon.range;
                    var projX    = shooter.x + Math.cos(angle) * range;
                    var projY    = shooter.y + Math.sin(angle) * range;
                    var actualTX = Math.random() < hitChance ? target.x : projX;
                    var actualTY = Math.random() < hitChance ? target.y : projY;

                    var proj = new S.Projectile(
                        shooter.x, shooter.y,
                        actualTX, actualTY,
                        weapon.projectileType,
                        weapon.color
                    );
                    if (world && world.addEntity) {
                        world.addEntity(proj);
                    }
                }

                // Roll for hit
                if (Math.random() < hitChance) {
                    self._applyDamage(target, weapon.damage, shooter, world);
                    totalHit = true;

                    // Penetrating weapons (gauss gun) can hit entities behind the target
                    if (weapon.penetrates && entities) {
                        self._applyPenetratingHit(shooter, target, weapon, entities, world);
                    }
                } else {
                    // Miss: bullet impact effect at a point near the target
                    if (S.Effects) {
                        var missAngle = Math.random() * Math.PI * 2;
                        var missDist  = Math.random() * 0.5;
                        S.Effects.spawnBulletImpact(
                            target.x + Math.cos(missAngle) * missDist,
                            target.y + Math.sin(missAngle) * missDist
                        );
                    }
                }
            }
        },

        // ------------------------------------------------------------------
        // Calculate hit probability
        // ------------------------------------------------------------------
        _calculateHitChance: function(shooter, target, weapon, dist, map) {
            // Base accuracy from weapon + shooter stat
            var shooterAccuracy = typeof shooter.getAccuracy === 'function'
                ? shooter.getAccuracy()
                : (shooter.accuracy || 0.5);

            var base     = weapon.accuracy * shooterAccuracy;
            var falloff  = this.getDistanceFalloff(dist, weapon.range);
            var cover    = map ? this.getCoverValue(map, target.x, target.y) : 0;

            var chance   = base * falloff * (1.0 - cover);
            return S.clamp(chance, 0.02, 0.99);   // always tiny chance to hit / miss
        },

        // ------------------------------------------------------------------
        // Apply damage to a target entity
        // ------------------------------------------------------------------
        _applyDamage: function(target, damage, shooter, world) {
            target.health -= damage;

            // Spawn hit effect
            if (S.Effects) {
                if (target.type === S.ENTITY_TYPE.CIVILIAN) {
                    S.Effects.spawnBlood(target.x, target.y);
                } else if (shooter.weapon && shooter.weapon.projectileType === 'laser') {
                    S.Effects.spawnLaserHit(target.x, target.y);
                } else {
                    S.Effects.spawnBulletImpact(target.x, target.y);
                    if (damage > 20) S.Effects.spawnBlood(target.x, target.y);
                }
            }

            if (target.health <= 0) {
                target.health = 0;
                target.alive  = false;
                target.state  = target.state !== undefined
                    ? (S.AGENT_STATE ? S.AGENT_STATE.DEAD : 'DEAD')
                    : target.state;

                if (S.Effects) {
                    S.Effects.spawnExplosion(target.x, target.y);
                }

                // Drop persuaded civilians when the agent dies
                if (target.persuadedFollowers && target.persuadedFollowers.length > 0) {
                    target.persuadedFollowers.forEach(function(follower) {
                        if (follower.alive) {
                            follower.leader = null;
                            follower.state  = S.CIVILIAN_STATE
                                ? S.CIVILIAN_STATE.FLEE
                                : 'FLEE';
                        }
                    });
                    target.persuadedFollowers = [];
                }
            }

            // Trigger flee for nearby civilians
            if (world && world.entities) {
                this._triggerCivilianPanic(shooter, world.entities);
            }
        },

        // ------------------------------------------------------------------
        // Penetrating hit: check entities behind the target along the bullet axis
        // ------------------------------------------------------------------
        _applyPenetratingHit: function(shooter, primaryTarget, weapon, entities, world) {
            var self  = this;
            var angle = Math.atan2(primaryTarget.y - shooter.y,
                                   primaryTarget.x - shooter.x);

            entities.forEach(function(e) {
                if (!e.alive || e === shooter || e === primaryTarget) return;
                if (e.type === S.ENTITY_TYPE.PROJECTILE) return;

                // Is e roughly behind the primary target relative to shooter?
                var dx = e.x - primaryTarget.x;
                var dy = e.y - primaryTarget.y;
                // Project onto firing axis
                var along = dx * Math.cos(angle) + dy * Math.sin(angle);
                var perp  = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));

                if (along > 0 && along < weapon.range * 0.5 && perp < 0.6) {
                    // Reduced damage for penetrated hits
                    self._applyDamage(e, Math.floor(weapon.damage * 0.65), shooter, world);
                }
            });
        },

        // ------------------------------------------------------------------
        // Trigger fleeing for nearby civilians when shooting happens
        // ------------------------------------------------------------------
        _triggerCivilianPanic: function(shooter, entities) {
            var PANIC_RADIUS = 6.0;
            entities.forEach(function(e) {
                if (!e.alive || e.type !== S.ENTITY_TYPE.CIVILIAN) return;
                var dx = e.x - shooter.x;
                var dy = e.y - shooter.y;
                if (Math.sqrt(dx * dx + dy * dy) < PANIC_RADIUS) {
                    if (e.triggerFlee) {
                        e.triggerFlee({ x: shooter.x, y: shooter.y });
                    }
                }
            });
        },

        // ------------------------------------------------------------------
        // LOS proxy – delegates to Movement system
        // ------------------------------------------------------------------
        checkLineOfSight: function(map, x1, y1, x2, y2) {
            if (S.Movement && S.Movement.hasLineOfSight) {
                return S.Movement.hasLineOfSight(map, x1, y1, x2, y2);
            }
            return true;   // fallback: assume clear
        },

        // ------------------------------------------------------------------
        // Distance falloff: 1.0 at point-blank, ~0.7 at max range
        // ------------------------------------------------------------------
        getDistanceFalloff: function(dist, range) {
            return Math.max(0.1, 1.0 - (dist / range) * 0.3);
        },

        // ------------------------------------------------------------------
        // Cover: read the tile cover value the target is standing on.
        // Supports: object with getTile/tileAt method, or raw 2D array map[col][row].
        // Tile.cover may be a boolean (true → 0.4) or a float (0–1).
        // ------------------------------------------------------------------
        getCoverValue: function(map, targetX, targetY) {
            if (!map) return 0;
            var tx = Math.floor(targetX);
            var ty = Math.floor(targetY);
            var mapSize = map.size || S.MAP_SIZE;

            if (tx < 0 || ty < 0 || tx >= mapSize || ty >= mapSize) return 0;

            var tile = null;
            if (map.getTile)  tile = map.getTile(tx, ty);
            else if (map.tileAt) tile = map.tileAt(tx, ty);
            else if (Array.isArray(map) && map[tx]) tile = map[tx][ty] || null;

            if (!tile) return 0;

            // Boolean cover (maps.js schema) → treat as 0.4
            if (typeof tile.cover === 'boolean') {
                return tile.cover ? 0.4 : 0;
            }
            return S.clamp(tile.cover || 0, 0, 0.5);
        }
    };

}(window.Syndicate));
