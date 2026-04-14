window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // Palette of muted civilian clothes colours
    var CIVI_COLORS = ['#667788', '#556677', '#778866', '#887766', '#667766', '#776688'];

    /**
     * Ambient NPC civilian.
     * Wanders randomly, flees from gunfire, can be persuaded to follow agents.
     */
    class Civilian extends S.Entity {
        constructor(x, y) {
            super(x, y, S.ENTITY_TYPE.CIVILIAN);

            this.health    = 20;
            this.maxHealth = 20;
            this.speed     = S.CIVILIAN_SPEED;  // 1.0

            this.state        = S.CIVILIAN_STATE.WANDER;
            this.wanderTarget = null;
            this.wanderTimer  = S.randomRange(2, 5);
            this.panicRadius  = 5.0;             // tiles

            this.leader     = null;             // entity that persuaded this civi
            this.leaderTimer = 0;               // how long since last re-pathfind to leader

            this.fleeTarget   = null;           // position to flee from
            this.fleeTimer    = 0;

            this.path      = [];
            this.pathIndex = 0;

            // Appearance: pick a stable random colour
            this._color = CIVI_COLORS[Math.floor(Math.random() * CIVI_COLORS.length)];
            this._pulsePhase = Math.random() * Math.PI * 2;
        }

        // -----------------------------------------------------------------
        // Update
        // -----------------------------------------------------------------

        update(dt, world) {
            if (!this.alive) return;

            this._pulsePhase += dt * 2.0;

            switch (this.state) {
                case S.CIVILIAN_STATE.WANDER:
                    this._updateWander(dt, world);
                    break;
                case S.CIVILIAN_STATE.FLEE:
                    this._updateFlee(dt, world);
                    break;
                case S.CIVILIAN_STATE.PERSUADED:
                    this._updatePersuaded(dt, world);
                    break;
            }
        }

        _updateWander(dt, world) {
            // Decrement wander timer
            this.wanderTimer -= dt;

            if (this.wanderTimer <= 0) {
                this.wanderTimer = S.randomRange(2, 5);
                this._pickNewWanderTarget(world);
            }

            // Follow existing path
            this._followPath(dt, this.speed);
        }

        _pickNewWanderTarget(world) {
            if (!world || !world.map) return;

            // Try up to 10 times to find a walkable tile within 5 tiles
            for (var i = 0; i < 10; i++) {
                var angle = Math.random() * Math.PI * 2;
                var dist  = S.randomRange(1, 5);
                var tx    = Math.floor(this.x + Math.cos(angle) * dist);
                var ty    = Math.floor(this.y + Math.sin(angle) * dist);

                if (tx < 0 || ty < 0 || tx >= S.MAP_SIZE || ty >= S.MAP_SIZE) continue;

                var tile = world.map.getTile ? world.map.getTile(tx, ty) : null;
                if (tile && tile.walkable) {
                    this.path      = S.Movement.findPath(world.map, this.x, this.y, tx + 0.5, ty + 0.5);
                    this.pathIndex = 0;
                    break;
                }
            }
        }

        _updateFlee(dt, world) {
            this.fleeTimer -= dt;

            if (this.fleeTimer <= 0 || !this.fleeTarget) {
                // Calm down – return to wandering
                this.fleeTarget = null;
                this.state      = S.CIVILIAN_STATE.WANDER;
                this.wanderTimer = S.randomRange(1, 3);
                return;
            }

            // Re-path every 1 second away from danger
            if (!this.path || this.pathIndex >= this.path.length) {
                this._pickFleeTarget(world);
            }

            this._followPath(dt, this.speed * 1.6);
        }

        _pickFleeTarget(world) {
            if (!world || !world.map || !this.fleeTarget) return;

            // Run in the opposite direction from the danger
            var dx   = this.x - this.fleeTarget.x;
            var dy   = this.y - this.fleeTarget.y;
            var len  = Math.sqrt(dx * dx + dy * dy) || 1;
            var tx   = Math.floor(this.x + (dx / len) * 5);
            var ty   = Math.floor(this.y + (dy / len) * 5);

            tx = S.clamp(tx, 0, S.MAP_SIZE - 1);
            ty = S.clamp(ty, 0, S.MAP_SIZE - 1);

            this.path      = S.Movement.findPath(world.map, this.x, this.y, tx + 0.5, ty + 0.5);
            this.pathIndex = 0;
        }

        _updatePersuaded(dt, world) {
            if (!this.leader || !this.leader.alive) {
                // Leader gone – back to wandering
                this.leader = null;
                this.state  = S.CIVILIAN_STATE.WANDER;
                return;
            }

            var distToLeader = this.distanceTo(this.leader);

            // Re-pathfind toward leader when too far away or path exhausted
            this.leaderTimer -= dt;
            var pathDone = !this.path || this.pathIndex >= this.path.length;

            if ((distToLeader > 2.5 && (pathDone || this.leaderTimer <= 0)) || pathDone) {
                this.leaderTimer = 1.0; // re-path at most every 1 second
                if (distToLeader > 1.5) {
                    this.path      = S.Movement && world && world.map
                        ? S.Movement.findPath(world.map, this.x, this.y,
                                              this.leader.x, this.leader.y)
                        : [];
                    this.pathIndex = 0;
                }
            }

            if (distToLeader > 1.5) {
                this._followPath(dt, this.speed * 1.2);
            }
        }

        /**
         * Shared path-following logic.
         * @param {number} dt
         * @param {number} speed
         */
        _followPath(dt, speed) {
            if (!this.path || this.pathIndex >= this.path.length) return;

            var wp   = this.path[this.pathIndex];
            var dx   = wp.x - this.x;
            var dy   = wp.y - this.y;
            var dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.2) {
                this.x = wp.x;
                this.y = wp.y;
                this.pathIndex++;
                return;
            }

            var step = Math.min(speed * dt, dist);
            var nx   = dx / dist;
            var ny   = dy / dist;
            this.x      += nx * step;
            this.y      += ny * step;
            this.facing  = Math.atan2(ny, nx);
        }

        /**
         * Called by the combat / AI system to trigger a flee response.
         * @param {{x:number, y:number}} dangerPos  - world position of the danger
         */
        triggerFlee(dangerPos) {
            if (this.state === S.CIVILIAN_STATE.PERSUADED) return; // persuaded civs don't flee
            this.fleeTarget = dangerPos;
            this.fleeTimer  = 5.0;
            this.state      = S.CIVILIAN_STATE.FLEE;
            this.path       = [];
            this.pathIndex  = 0;
        }

        /**
         * Called by the Persuadertron system.
         * @param {Agent} leader
         */
        persuade(leader) {
            this.leader    = leader;
            this.state     = S.CIVILIAN_STATE.PERSUADED;
            this.path      = [];
            this.pathIndex = 0;
        }

        // -----------------------------------------------------------------
        // Render
        // -----------------------------------------------------------------

        render(ctx, camera) {
            var sp   = this.getScreenPos(camera);
            var sx   = sp.sx;
            var sy   = sp.sy;
            var zoom = camera.zoom;

            if (S.Sprites && S.Sprites.drawCivilian) {
                S.Sprites.drawCivilian(ctx, sx, sy, this, zoom);
            } else {
                this._renderFallback(ctx, sx, sy, zoom);
            }
        }

        _renderFallback(ctx, sx, sy, zoom) {
            var r = 6 * zoom;

            ctx.save();

            // Persuaded civs get a faint cyan tint
            if (this.state === S.CIVILIAN_STATE.PERSUADED) {
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur  = 6 * zoom;
            }

            ctx.fillStyle = this._color;
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fill();

            // Tiny facing dot
            ctx.fillStyle = '#aaaaaa';
            ctx.beginPath();
            ctx.arc(
                sx + Math.cos(this.facing) * r * 1.2,
                sy + Math.sin(this.facing) * r * 1.2,
                1.5 * zoom, 0, Math.PI * 2
            );
            ctx.fill();
            ctx.restore();
        }
    }

    S.Civilian = Civilian;

}(window.Syndicate));
