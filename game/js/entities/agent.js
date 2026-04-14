window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    var AGENT_NAMES = [
        'Reaper', 'Ghost', 'Spectre', 'Chrome',
        'Nyx', 'Ash', 'Cipher', 'Raven',
        'Wraith', 'Vex', 'Phantom', 'Blade'
    ];

    // Selection ring pulse phase offset per-agent so they don't all pulse in sync
    var PULSE_OFFSETS = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];

    /**
     * Player-controlled cyborg agent.
     * Extends S.Entity.
     */
    class Agent extends S.Entity {
        constructor(x, y, index) {
            super(x, y, S.ENTITY_TYPE.AGENT);

            this.index = index;  // 0-3, for hotkey selection
            this.name  = AGENT_NAMES[index % AGENT_NAMES.length];
            this.team  = 'player';

            // -----------------------------------------------------------------
            // Base stats
            // -----------------------------------------------------------------
            this.maxHealth   = 100;
            this.health      = 100;
            this.baseSpeed   = S.AGENT_SPEED;    // 3.0
            this.baseAccuracy    = 0.7;
            this.basePerception  = 8.0;          // tile radius

            // -----------------------------------------------------------------
            // Equipment
            // -----------------------------------------------------------------
            this.weapon           = null;
            this.hasPersuadertron = false;

            // -----------------------------------------------------------------
            // Cybernetics: 0–3 levels each
            // -----------------------------------------------------------------
            this.cybernetics = { legs: 0, arms: 0, chest: 0, brain: 0 };

            // -----------------------------------------------------------------
            // IPA sliders  0.0 – 1.0
            // -----------------------------------------------------------------
            this.intelligence = 0.5;
            this.perception   = 0.5;
            this.adrenaline   = 0.3;

            // -----------------------------------------------------------------
            // FSM state
            // -----------------------------------------------------------------
            this.state         = S.AGENT_STATE.IDLE;
            this.path          = [];    // waypoints from A*
            this.pathIndex     = 0;
            this.target        = null;  // entity to attack
            this.selected      = false;
            this.weaponCooldown = 0;

            // -----------------------------------------------------------------
            // Persuasion
            // -----------------------------------------------------------------
            this.persuadedFollowers = [];

            // Internal animation clock
            this._pulsePhase = PULSE_OFFSETS[index] || 0;
        }

        // -----------------------------------------------------------------
        // Computed stats
        // -----------------------------------------------------------------

        getSpeed() {
            return this.baseSpeed
                * (1 + this.cybernetics.legs * 0.15)
                * (0.7 + this.adrenaline * 0.6);
        }

        getAccuracy() {
            return this.baseAccuracy
                * (1 + this.cybernetics.arms * 0.12)
                * (0.5 + this.intelligence * 1.0);
        }

        getPerceptionRadius() {
            return this.basePerception
                * (1 + this.cybernetics.brain * 0.15)
                * (0.5 + this.perception * 1.0);
        }

        getMaxHealth() {
            return this.maxHealth * (1 + this.cybernetics.chest * 0.25);
        }

        // -----------------------------------------------------------------
        // Update
        // -----------------------------------------------------------------

        update(dt, world) {
            if (!this.alive) return;

            this._pulsePhase += dt * 3.0;

            // Decrement weapon cooldown
            if (this.weaponCooldown > 0) {
                this.weaponCooldown -= dt;
                if (this.weaponCooldown < 0) this.weaponCooldown = 0;
            }

            switch (this.state) {
                case S.AGENT_STATE.MOVING:
                    this._updateMoving(dt, world);
                    break;
                case S.AGENT_STATE.ATTACKING:
                    this._updateAttacking(dt, world);
                    break;
                case S.AGENT_STATE.IDLE:
                default:
                    break;
            }
        }

        _updateMoving(dt, world) {
            if (!this.path || this.pathIndex >= this.path.length) {
                this.state = S.AGENT_STATE.IDLE;
                this.path  = [];
                return;
            }

            var wp    = this.path[this.pathIndex];
            var dx    = wp.x - this.x;
            var dy    = wp.y - this.y;
            var dist  = Math.sqrt(dx * dx + dy * dy);
            var speed = this.getSpeed();

            if (dist < 0.2) {
                // Snap to waypoint, advance
                this.x = wp.x;
                this.y = wp.y;
                this.pathIndex++;

                if (this.pathIndex >= this.path.length) {
                    this.state = S.AGENT_STATE.IDLE;
                    this.path  = [];
                }
                return;
            }

            // Move toward waypoint
            var step = Math.min(speed * dt, dist);
            var nx   = dx / dist;
            var ny   = dy / dist;

            this.x      += nx * step;
            this.y      += ny * step;
            this.facing  = Math.atan2(ny, nx);
        }

        _updateAttacking(dt, world) {
            if (!this.target || !this.target.alive) {
                this.target = null;
                this.state  = S.AGENT_STATE.IDLE;
                return;
            }

            // Face target
            var dx      = this.target.x - this.x;
            var dy      = this.target.y - this.y;
            this.facing = Math.atan2(dy, dx);

            // Combat system handles the actual firing; nothing more needed here
            // except ensuring we're in range — that's handled by S.Combat.update()
        }

        // -----------------------------------------------------------------
        // Render
        // -----------------------------------------------------------------

        render(ctx, camera) {
            var sp = this.getScreenPos(camera);
            var sx = sp.sx;
            var sy = sp.sy;
            var zoom = camera.zoom;

            // Selection ring (drawn below the sprite)
            if (this.selected) {
                var pulse = 0.55 + 0.45 * Math.sin(this._pulsePhase);
                var ringR = 14 * zoom;

                ctx.save();
                ctx.strokeStyle = 'rgba(0,255,255,' + pulse.toFixed(2) + ')';
                ctx.lineWidth   = 2 * zoom;
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur  = 8 * zoom;
                ctx.beginPath();
                ctx.ellipse(sx, sy + 4 * zoom, ringR, ringR * 0.5, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // Draw agent sprite via Sprites helper if available, else fallback
            if (S.Sprites && S.Sprites.drawAgent) {
                S.Sprites.drawAgent(ctx, sx, sy, this, zoom);
            } else {
                this._renderFallback(ctx, sx, sy, zoom);
            }

            // Health bar
            if (this.health < this.getMaxHealth()) {
                this._renderHealthBar(ctx, sx, sy, zoom);
            }

            // Agent index label when selected
            if (this.selected) {
                ctx.save();
                ctx.font      = (9 * zoom) + 'px monospace';
                ctx.fillStyle = '#00ffff';
                ctx.textAlign = 'center';
                ctx.fillText(this.index + 1, sx, sy - 18 * zoom);
                ctx.restore();
            }
        }

        _renderFallback(ctx, sx, sy, zoom) {
            var r = 8 * zoom;
            ctx.save();
            ctx.fillStyle   = this.alive ? S.COLORS.PLAYER_COLOR : '#334444';
            ctx.shadowColor = S.COLORS.PLAYER_COLOR;
            ctx.shadowBlur  = this.selected ? 12 * zoom : 4 * zoom;
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fill();

            // Facing indicator
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth   = 1.5 * zoom;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(
                sx + Math.cos(this.facing) * r * 1.4,
                sy + Math.sin(this.facing) * r * 1.4
            );
            ctx.stroke();
            ctx.restore();
        }

        _renderHealthBar(ctx, sx, sy, zoom) {
            var barW  = 20 * zoom;
            var barH  = 3  * zoom;
            var yOff  = -14 * zoom;
            var ratio = Math.max(0, this.health / this.getMaxHealth());

            ctx.save();
            ctx.fillStyle = '#222';
            ctx.fillRect(sx - barW / 2, sy + yOff, barW, barH);

            var color = ratio > 0.5 ? '#00ff88'
                      : ratio > 0.25 ? '#ffaa00'
                      : '#ff2040';
            ctx.fillStyle = color;
            ctx.fillRect(sx - barW / 2, sy + yOff, barW * ratio, barH);
            ctx.restore();
        }
    }

    S.Agent = Agent;

}(window.Syndicate));
