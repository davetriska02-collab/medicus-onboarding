window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    var VEHICLE_COLORS = ['#ff4444', '#4444ff', '#ffff44', '#ffffff', '#44ff44'];

    /**
     * Ambient road vehicle.
     * Drives in a straight line along a road until it exits the map.
     */
    class Vehicle extends S.Entity {
        constructor(x, y, direction) {
            super(x, y, S.ENTITY_TYPE.VEHICLE);

            this.speed     = 4.0;
            this.length    = 1.2;   // tile-lengths for rendering

            // direction: {dx, dy} unit vector along the road
            if (direction) {
                var len = Math.sqrt(direction.dx * direction.dx + direction.dy * direction.dy) || 1;
                this._dx = direction.dx / len;
                this._dy = direction.dy / len;
            } else {
                // Default: moving east
                this._dx = 1;
                this._dy = 0;
            }

            this.facing = Math.atan2(this._dy, this._dx);

            this.color = VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)];

            // Visual flicker for headlights
            this._flickerPhase = Math.random() * Math.PI * 2;
        }

        // -----------------------------------------------------------------
        // Update
        // -----------------------------------------------------------------

        update(dt /*, world */) {
            this._flickerPhase += dt * 8.0;

            this.x += this._dx * this.speed * dt;
            this.y += this._dy * this.speed * dt;

            // Remove once completely off the map
            var margin = 4;
            if (this.x < -margin || this.x > S.MAP_SIZE + margin ||
                this.y < -margin || this.y > S.MAP_SIZE + margin) {
                this.removed = true;
            }
        }

        // -----------------------------------------------------------------
        // Render – isometric rectangle with headlight dots
        // -----------------------------------------------------------------

        render(ctx, camera) {
            var sp   = this.getScreenPos(camera);
            var sx   = sp.sx;
            var sy   = sp.sy;
            var zoom = camera.zoom;

            ctx.save();

            // --- Body -------------------------------------------------
            // Compute screen-space half-extents for the car body.
            // The car is `this.length` tiles long and 0.55 tiles wide.
            var halfLen  = this.length * 0.5;
            var halfWide = 0.28;

            // Four corners in world space relative to centre
            var cos = Math.cos(this.facing);
            var sin = Math.sin(this.facing);
            // Perpendicular direction (world space)
            var px  = -sin;
            var py  =  cos;

            var corners = [
                { wx: this.x + cos * halfLen  + px * halfWide,
                  wy: this.y + sin * halfLen  + py * halfWide },
                { wx: this.x + cos * halfLen  - px * halfWide,
                  wy: this.y + sin * halfLen  - py * halfWide },
                { wx: this.x - cos * halfLen  - px * halfWide,
                  wy: this.y - sin * halfLen  - py * halfWide },
                { wx: this.x - cos * halfLen  + px * halfWide,
                  wy: this.y - sin * halfLen  + py * halfWide }
            ];

            // Convert each corner to screen
            var pts = corners.map(function(c) {
                return S.worldToScreen(c.wx, c.wy, camera);
            });

            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (var i = 1; i < pts.length; i++) {
                ctx.lineTo(pts[i].x, pts[i].y);
            }
            ctx.closePath();

            ctx.fillStyle   = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur  = 6 * zoom;
            ctx.fill();

            // Darker roof panel
            var roofScale = 0.55;
            var roofPts = corners.map(function(c) {
                var rwx = this.x + (c.wx - this.x) * roofScale;
                var rwy = this.y + (c.wy - this.y) * roofScale;
                return S.worldToScreen(rwx, rwy, camera);
            }, this);

            ctx.beginPath();
            ctx.moveTo(roofPts[0].x, roofPts[0].y);
            for (var j = 1; j < roofPts.length; j++) {
                ctx.lineTo(roofPts[j].x, roofPts[j].y);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fill();

            // --- Headlights (front two corners) -----------------------
            var flicker = 0.85 + 0.15 * Math.sin(this._flickerPhase);
            var hlR = 2.5 * zoom;

            [0, 1].forEach(function(k) {
                var hx = pts[k].x;
                var hy = pts[k].y;
                ctx.save();
                ctx.fillStyle   = 'rgba(255,255,200,' + flicker.toFixed(2) + ')';
                ctx.shadowColor = '#ffffaa';
                ctx.shadowBlur  = 10 * zoom;
                ctx.beginPath();
                ctx.arc(hx, hy, hlR, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            // --- Tail lights (rear two corners) -----------------------
            [2, 3].forEach(function(k) {
                var tx = pts[k].x;
                var ty = pts[k].y;
                ctx.save();
                ctx.fillStyle   = 'rgba(255,50,50,0.9)';
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur  = 6 * zoom;
                ctx.beginPath();
                ctx.arc(tx, ty, hlR * 0.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            ctx.restore();
        }
    }

    S.Vehicle = Vehicle;

}(window.Syndicate));
