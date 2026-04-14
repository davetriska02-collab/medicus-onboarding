window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    var TRAIL_MAX = 5;   // max trail positions kept

    /**
     * Visual projectile tracer.
     *
     * Bullets are hitscan (damage is applied instantly by the Combat system),
     * but this entity provides the satisfying visual of a round travelling
     * toward its target with a glowing trail.
     */
    class Projectile extends S.Entity {
        constructor(x, y, targetX, targetY, type, color) {
            super(x, y, S.ENTITY_TYPE.PROJECTILE);

            this.startX  = x;
            this.startY  = y;
            this.targetX = targetX;
            this.targetY = targetY;

            this.speed   = 15.0;   // world units / second (fast, mainly visual)
            this.life    = 0.3;
            this.maxLife = 0.3;

            this.projectileType = type  || 'bullet';  // 'bullet' | 'laser' | 'flame'
            this.color          = color || '#ffff44';

            this.trail = [];   // array of {x, y} – previous world positions

            // Pre-compute normalised direction vector
            var dx   = targetX - x;
            var dy   = targetY - y;
            var dist = Math.sqrt(dx * dx + dy * dy) || 1;
            this._nx = dx / dist;
            this._ny = dy / dist;
            this._totalDist = dist;
            this._travelledDist = 0;

            // Adjust lifetime so it reaches the target in time
            // life = dist / speed but clamped to a readable min
            this.life    = Math.max(0.08, dist / this.speed);
            this.maxLife = this.life;
        }

        // -----------------------------------------------------------------
        // Update
        // -----------------------------------------------------------------

        update(dt) {
            // Record trail position (world space)
            this.trail.push({ x: this.x, y: this.y });
            if (this.trail.length > TRAIL_MAX) {
                this.trail.shift();
            }

            var step = this.speed * dt;
            this._travelledDist += step;

            this.x += this._nx * step;
            this.y += this._ny * step;

            // Update facing to travel direction
            this.facing = Math.atan2(this._ny, this._nx);

            this.life -= dt;

            if (this.life <= 0 || this._travelledDist >= this._totalDist) {
                this.removed = true;
            }
        }

        // -----------------------------------------------------------------
        // Render
        // -----------------------------------------------------------------

        render(ctx, camera) {
            switch (this.projectileType) {
                case 'laser': this._renderLaser(ctx, camera); break;
                case 'flame': this._renderFlame(ctx, camera); break;
                default:      this._renderBullet(ctx, camera); break;
            }
        }

        _renderBullet(ctx, camera) {
            var sp   = this.getScreenPos(camera);
            var zoom = camera.zoom;
            var alpha = Math.min(1, this.life / this.maxLife * 2);

            ctx.save();
            ctx.globalAlpha = alpha;

            // Trail line
            if (this.trail.length >= 2) {
                var tailSP = S.worldToScreen(
                    this.trail[0].x, this.trail[0].y, camera
                );
                ctx.strokeStyle = this.color;
                ctx.lineWidth   = 1.5 * zoom;
                ctx.shadowColor = this.color;
                ctx.shadowBlur  = 4 * zoom;
                ctx.globalAlpha = alpha * 0.5;
                ctx.beginPath();
                ctx.moveTo(tailSP.x, tailSP.y);
                ctx.lineTo(sp.sx, sp.sy);
                ctx.stroke();
            }

            // Bright dot at tip
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = '#ffffff';
            ctx.shadowColor = this.color;
            ctx.shadowBlur  = 8 * zoom;
            ctx.beginPath();
            ctx.arc(sp.sx, sp.sy, 2.5 * zoom, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        _renderLaser(ctx, camera) {
            var sp     = this.getScreenPos(camera);
            var startS = S.worldToScreen(this.startX, this.startY, camera);
            var zoom   = camera.zoom;
            var alpha  = Math.min(1, this.life / this.maxLife * 3);

            ctx.save();
            ctx.globalAlpha = alpha;

            // Wide glow beam
            ctx.strokeStyle = this.color;
            ctx.lineWidth   = 4 * zoom;
            ctx.shadowColor = this.color;
            ctx.shadowBlur  = 16 * zoom;
            ctx.globalAlpha = alpha * 0.35;
            ctx.beginPath();
            ctx.moveTo(startS.x, startS.y);
            ctx.lineTo(sp.sx, sp.sy);
            ctx.stroke();

            // Bright core beam
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth   = 1.5 * zoom;
            ctx.shadowColor = this.color;
            ctx.shadowBlur  = 6 * zoom;
            ctx.beginPath();
            ctx.moveTo(startS.x, startS.y);
            ctx.lineTo(sp.sx, sp.sy);
            ctx.stroke();

            ctx.restore();
        }

        _renderFlame(ctx, camera) {
            var sp   = this.getScreenPos(camera);
            var zoom = camera.zoom;
            var t    = 1 - (this.life / this.maxLife);
            var r    = (3 + t * 5) * zoom;

            ctx.save();
            // Expanding orange blob that fades out
            var gradient = ctx.createRadialGradient(sp.sx, sp.sy, 0, sp.sx, sp.sy, r);
            gradient.addColorStop(0,   'rgba(255,255,150,0.9)');
            gradient.addColorStop(0.4, 'rgba(255,120,0,0.7)');
            gradient.addColorStop(1,   'rgba(200,30,0,0)');

            ctx.fillStyle = gradient;
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur  = 12 * zoom;
            ctx.beginPath();
            ctx.arc(sp.sx, sp.sy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    S.Projectile = Projectile;

}(window.Syndicate));
