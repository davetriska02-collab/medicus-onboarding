window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    /**
     * Enemy agent – hostile NPC with patrol/alert/chase/engage/flee AI.
     * AI state transitions are driven by ai.js; movement logic lives here.
     */
    class Enemy extends S.Entity {
        constructor(x, y, weaponType, patrolPath) {
            super(x, y, S.ENTITY_TYPE.ENEMY);

            this.health    = 80;
            this.maxHealth = 80;
            this.baseSpeed = S.ENEMY_SPEED;   // 2.5
            this.accuracy  = 0.5;

            this.detectionRadius = 7.0;       // tiles

            // Weapon: set externally via S.createWeapon(weaponType)
            this.weapon     = null;
            this._weaponType = weaponType || 'pistol';

            // AI state machine
            this.state      = S.AI_STATE.PATROL;

            // Patrol path: array of {x, y} world positions
            this.patrolPath  = Array.isArray(patrolPath) ? patrolPath : [];
            this.patrolIndex = 0;

            // Current A* path for movement
            this.path      = [];
            this.pathIndex = 0;

            // Combat
            this.target         = null;   // entity being attacked
            this.alertTimer     = 0;      // seconds to stay alerted with no target
            this.lostTargetTimer = 0;     // countdown after losing sight of target
            this.weaponCooldown = 0;

            // Last known position of the target (for chase after losing LOS)
            this.lastKnownTargetX = 0;
            this.lastKnownTargetY = 0;

            // Flee: when health drops below 25% enemy tries to run
            this._fleeThreshold = this.maxHealth * 0.25;

            // Visual: stable random hue offset for the enemy glow
            this._glowPhase = Math.random() * Math.PI * 2;
        }

        // -----------------------------------------------------------------
        // Speed helper (no cybernetics, but keeps a parallel API to Agent)
        // -----------------------------------------------------------------

        getSpeed() {
            var speedMult = (this.state === S.AI_STATE.FLEE) ? 1.3 : 1.0;
            return this.baseSpeed * speedMult;
        }

        // -----------------------------------------------------------------
        // Movement: shared path-following (called by update & ai.js)
        // -----------------------------------------------------------------

        /**
         * Advance along the current A* path.
         * @param {number} dt
         * @returns {boolean} true when the path is fully consumed
         */
        followPath(dt) {
            if (!this.path || this.pathIndex >= this.path.length) return true;

            var wp   = this.path[this.pathIndex];
            var dx   = wp.x - this.x;
            var dy   = wp.y - this.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var speed = this.getSpeed();

            if (dist < 0.2) {
                this.x = wp.x;
                this.y = wp.y;
                this.pathIndex++;
                return (this.pathIndex >= this.path.length);
            }

            var step = Math.min(speed * dt, dist);
            var nx   = dx / dist;
            var ny   = dy / dist;

            this.x      += nx * step;
            this.y      += ny * step;
            this.facing  = Math.atan2(ny, nx);

            return false;
        }

        // -----------------------------------------------------------------
        // Update – high-level FSM; the AI system (ai.js) calls deeper logic
        // -----------------------------------------------------------------

        update(dt, world) {
            if (!this.alive) return;

            this._glowPhase += dt * 2.5;

            // Weapon cooldown always ticks
            if (this.weaponCooldown > 0) {
                this.weaponCooldown -= dt;
                if (this.weaponCooldown < 0) this.weaponCooldown = 0;
            }

            // Timers
            if (this.alertTimer > 0)     this.alertTimer -= dt;
            if (this.lostTargetTimer > 0) this.lostTargetTimer -= dt;

            switch (this.state) {
                case S.AI_STATE.PATROL:
                    this._updatePatrol(dt, world);
                    break;

                case S.AI_STATE.ALERT:
                    // Stand still momentarily and look around
                    // ai.js escalates this to CHASE / ENGAGE
                    break;

                case S.AI_STATE.CHASE:
                    this._updateChase(dt, world);
                    break;

                case S.AI_STATE.ENGAGE:
                    // Face the target; combat handled by Combat system
                    if (this.target && this.target.alive) {
                        var dx = this.target.x - this.x;
                        var dy = this.target.y - this.y;
                        this.facing = Math.atan2(dy, dx);
                        this.lastKnownTargetX = this.target.x;
                        this.lastKnownTargetY = this.target.y;
                    }
                    break;

                case S.AI_STATE.FLEE:
                    this._updateFlee(dt, world);
                    break;
            }
        }

        _updatePatrol(dt, world) {
            if (this.patrolPath.length === 0) return;

            // If path is exhausted, set a new one toward the next patrol waypoint
            if (!this.path || this.pathIndex >= this.path.length) {
                var wp = this.patrolPath[this.patrolIndex];
                if (world && world.map && S.Movement) {
                    this.path      = S.Movement.findPath(world.map, this.x, this.y, wp.x, wp.y);
                    this.pathIndex = 0;
                } else {
                    // Fallback: direct waypoint
                    this.path      = [wp];
                    this.pathIndex = 0;
                }
            }

            var done = this.followPath(dt);
            if (done) {
                // Advance patrol index cyclically
                this.patrolIndex = (this.patrolIndex + 1) % this.patrolPath.length;
                this.path      = [];
                this.pathIndex = 0;
            }
        }

        _updateChase(dt, world) {
            if (!this.target || !this.target.alive) {
                // Target lost – move toward last known position then give up
                if (this.lostTargetTimer <= 0) {
                    this.target = null;
                    this.state  = S.AI_STATE.PATROL;
                    this.path   = [];
                }
                return;
            }

            // Continuously re-path toward moving target
            if (!this.path || this.pathIndex >= this.path.length) {
                if (world && world.map && S.Movement) {
                    this.path      = S.Movement.findPath(world.map, this.x, this.y,
                                                          this.target.x, this.target.y);
                    this.pathIndex = 0;
                }
            }

            this.followPath(dt);
        }

        _updateFlee(dt, world) {
            if (!this.path || this.pathIndex >= this.path.length) {
                // Pick a flee direction – away from all agents
                if (world && world.map && S.Movement) {
                    var fleeX = this.x + (Math.random() - 0.5) * 10;
                    var fleeY = this.y + (Math.random() - 0.5) * 10;
                    fleeX = S.clamp(fleeX, 0, S.MAP_SIZE - 1);
                    fleeY = S.clamp(fleeY, 0, S.MAP_SIZE - 1);
                    this.path      = S.Movement.findPath(world.map, this.x, this.y,
                                                          fleeX + 0.5, fleeY + 0.5);
                    this.pathIndex = 0;
                }
            }
            this.followPath(dt);
        }

        // -----------------------------------------------------------------
        // Render
        // -----------------------------------------------------------------

        render(ctx, camera) {
            if (!this.alive) {
                this._renderDead(ctx, camera);
                return;
            }

            var sp   = this.getScreenPos(camera);
            var sx   = sp.sx;
            var sy   = sp.sy;
            var zoom = camera.zoom;

            if (S.Sprites && S.Sprites.drawEnemy) {
                S.Sprites.drawEnemy(ctx, sx, sy, this, zoom);
            } else {
                this._renderFallback(ctx, sx, sy, zoom);
            }

            // Health bar only when damaged
            if (this.health < this.maxHealth) {
                this._renderHealthBar(ctx, sx, sy, zoom);
            }

            // Alert indicator
            if (this.state === S.AI_STATE.ALERT || this.state === S.AI_STATE.CHASE) {
                this._renderAlertIcon(ctx, sx, sy, zoom);
            }
        }

        _renderFallback(ctx, sx, sy, zoom) {
            var r      = 8 * zoom;
            var glow   = 0.55 + 0.45 * Math.sin(this._glowPhase);
            var alpha  = (0.6 + 0.4 * glow).toFixed(2);

            ctx.save();
            ctx.fillStyle   = S.COLORS.ENEMY_COLOR;
            ctx.shadowColor = S.COLORS.ENEMY_COLOR;
            ctx.shadowBlur  = 10 * zoom * glow;
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fill();

            // Facing indicator
            ctx.strokeStyle = 'rgba(255,200,200,' + alpha + ')';
            ctx.lineWidth   = 1.5 * zoom;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(
                sx + Math.cos(this.facing) * r * 1.5,
                sy + Math.sin(this.facing) * r * 1.5
            );
            ctx.stroke();
            ctx.restore();
        }

        _renderDead(ctx, camera) {
            var sp   = this.getScreenPos(camera);
            var zoom = camera.zoom;
            var r    = 6 * zoom;

            ctx.save();
            ctx.globalAlpha = 0.4;
            ctx.fillStyle   = '#441111';
            ctx.beginPath();
            ctx.arc(sp.sx, sp.sy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        _renderHealthBar(ctx, sx, sy, zoom) {
            var barW  = 20 * zoom;
            var barH  = 3  * zoom;
            var yOff  = -14 * zoom;
            var ratio = Math.max(0, this.health / this.maxHealth);

            ctx.save();
            ctx.fillStyle = '#222';
            ctx.fillRect(sx - barW / 2, sy + yOff, barW, barH);

            var color = ratio > 0.5 ? '#ff4444'
                      : ratio > 0.25 ? '#ff8800'
                      : '#ff0000';
            ctx.fillStyle = color;
            ctx.fillRect(sx - barW / 2, sy + yOff, barW * ratio, barH);
            ctx.restore();
        }

        _renderAlertIcon(ctx, sx, sy, zoom) {
            ctx.save();
            ctx.font      = (10 * zoom) + 'px monospace';
            ctx.fillStyle = this.state === S.AI_STATE.CHASE ? '#ff4444' : '#ffaa00';
            ctx.textAlign = 'center';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur  = 6 * zoom;
            ctx.fillText(this.state === S.AI_STATE.CHASE ? '!' : '?', sx, sy - 18 * zoom);
            ctx.restore();
        }
    }

    S.Enemy = Enemy;

}(window.Syndicate));
