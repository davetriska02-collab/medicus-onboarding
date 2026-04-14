window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Particle pool cap
    // -------------------------------------------------------------------------
    var MAX_PARTICLES = 500;

    // -------------------------------------------------------------------------
    // Particle class (internal, not exported)
    // -------------------------------------------------------------------------
    function Particle() {
        this.active  = false;
        this.x       = 0;
        this.y       = 0;
        this.vx      = 0;
        this.vy      = 0;
        this.life    = 0;
        this.maxLife = 1;
        this.size    = 3;
        this.decay   = 0.92;    // size multiplied by this each frame
        this.color   = '#ffffff';
        this.glow    = false;   // whether to apply shadowBlur
        this.alpha   = 1;
    }

    // -------------------------------------------------------------------------
    // Particle pool
    // -------------------------------------------------------------------------
    var _pool = (function() {
        var pool = [];
        for (var i = 0; i < MAX_PARTICLES; i++) {
            pool.push(new Particle());
        }
        return pool;
    }());

    var _active = [];   // currently live particles (references into pool)

    function _acquire() {
        // Reuse a dead particle from the pool
        for (var i = 0; i < _pool.length; i++) {
            if (!_pool[i].active) return _pool[i];
        }
        // Pool exhausted: steal the oldest active particle
        var oldest = _active.shift();
        return oldest || _pool[0];
    }

    function _spawn(x, y, vx, vy, life, size, color, glow, decay) {
        if (_active.length >= MAX_PARTICLES) {
            // Force-retire oldest
            if (_active.length > 0) {
                _active[0].active = false;
                _active.shift();
            }
        }
        var p   = _acquire();
        p.active  = true;
        p.x       = x;
        p.y       = y;
        p.vx      = vx;
        p.vy      = vy;
        p.life    = life;
        p.maxLife = life;
        p.size    = size;
        p.decay   = (decay !== undefined) ? decay : 0.92;
        p.color   = color || '#ffffff';
        p.glow    = !!glow;
        p.alpha   = 1;
        _active.push(p);
        return p;
    }

    // Helpers for random values
    function rand(a, b) { return a + Math.random() * (b - a); }
    function randAngle() { return Math.random() * Math.PI * 2; }

    // -------------------------------------------------------------------------
    // Effects namespace
    // -------------------------------------------------------------------------
    S.Effects = {

        // ------------------------------------------------------------------
        // update – advance all particles
        // ------------------------------------------------------------------
        update: function(dt) {
            var i = 0;
            while (i < _active.length) {
                var p = _active[i];

                p.x    += p.vx * dt;
                p.y    += p.vy * dt;
                p.life -= dt;
                p.size *= Math.pow(p.decay, dt * 60);   // frame-rate independent
                p.alpha = Math.max(0, p.life / p.maxLife);

                if (p.life <= 0 || p.size < 0.2) {
                    p.active = false;
                    _active.splice(i, 1);
                } else {
                    i++;
                }
            }
        },

        // ------------------------------------------------------------------
        // render – draw all live particles onto the canvas
        // ------------------------------------------------------------------
        render: function(ctx, camera) {
            ctx.save();

            for (var i = 0; i < _active.length; i++) {
                var p  = _active[i];
                var sp = S.worldToScreen(p.x, p.y, camera);
                var r  = p.size * camera.zoom;

                if (r < 0.3) continue;

                ctx.globalAlpha = p.alpha;

                if (p.glow) {
                    ctx.shadowColor = p.color;
                    ctx.shadowBlur  = r * 3;
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.shadowBlur  = 0;
            ctx.globalAlpha = 1;
            ctx.restore();
        },

        // ------------------------------------------------------------------
        // Muzzle flash – radial burst of yellow/white sparks
        // ------------------------------------------------------------------
        spawnMuzzleFlash: function(x, y) {
            var count = S.randomInt(5, 8);
            for (var i = 0; i < count; i++) {
                var angle  = randAngle();
                var speed  = rand(4, 10);
                var color  = Math.random() < 0.5 ? '#ffffaa' : '#ffffff';
                _spawn(x, y,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    rand(0.06, 0.12),
                    rand(1.5, 3.0),
                    color, true, 0.80);
            }
        },

        // ------------------------------------------------------------------
        // Blood splatter – small red particles
        // ------------------------------------------------------------------
        spawnBlood: function(x, y) {
            var count = S.randomInt(3, 5);
            for (var i = 0; i < count; i++) {
                var angle = randAngle();
                var speed = rand(0.5, 2.5);
                _spawn(x, y,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    rand(0.2, 0.4),
                    rand(1.0, 2.0),
                    '#cc0011', false, 0.88);
            }
        },

        // ------------------------------------------------------------------
        // Explosion – expanding ring of orange/red + smoke
        // ------------------------------------------------------------------
        spawnExplosion: function(x, y) {
            // Hot core sparks
            var coreCount = S.randomInt(20, 30);
            for (var i = 0; i < coreCount; i++) {
                var angle  = randAngle();
                var speed  = rand(2, 8);
                var colors = ['#ff6600', '#ff4400', '#ffaa00', '#ff2200', '#ffdd44'];
                var color  = colors[Math.floor(Math.random() * colors.length)];
                _spawn(x, y,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    rand(0.3, 0.7),
                    rand(2.0, 5.0),
                    color, true, 0.85);
            }

            // Smoke particles – slow upward drift, grey
            var smokeCount = S.randomInt(8, 14);
            for (var j = 0; j < smokeCount; j++) {
                var sAngle = randAngle();
                var sSpeed = rand(0.3, 1.5);
                var gray   = Math.floor(rand(80, 150));
                var gcolor = 'rgb(' + gray + ',' + gray + ',' + gray + ')';
                _spawn(x, y,
                    Math.cos(sAngle) * sSpeed,
                    Math.sin(sAngle) * sSpeed - rand(0.5, 1.5),  // upward drift
                    rand(0.5, 1.2),
                    rand(3.0, 6.0),
                    gcolor, false, 0.95);
            }
        },

        // ------------------------------------------------------------------
        // Flame stream – stream of fire particles toward a target
        // ------------------------------------------------------------------
        spawnFlame: function(x, y, targetX, targetY) {
            var dx    = (targetX - x) || 0.01;
            var dy    = (targetY - y) || 0;
            var dist  = Math.sqrt(dx * dx + dy * dy) || 1;
            var nx    = dx / dist;
            var ny    = dy / dist;

            var count = S.randomInt(3, 6);
            for (var i = 0; i < count; i++) {
                var t       = rand(0.1, 0.9);          // position along the stream
                var px      = x + nx * dist * t;
                var py      = y + ny * dist * t;
                var spread  = rand(-1.5, 1.5);
                var perpX   = -ny * spread;
                var perpY   =  nx * spread;
                var speed   = rand(1.5, 3.5);
                var colors  = ['#ff8800', '#ffaa00', '#ff5500', '#ffcc00'];
                var color   = colors[Math.floor(Math.random() * colors.length)];

                _spawn(px + perpX, py + perpY,
                    nx * speed + (Math.random() - 0.5),
                    ny * speed - rand(0.3, 1.0),       // slight upward drift
                    rand(0.1, 0.25),
                    rand(1.5, 4.0),
                    color, true, 0.82);
            }
        },

        // ------------------------------------------------------------------
        // Bullet impact – bright sparks, very short life
        // ------------------------------------------------------------------
        spawnBulletImpact: function(x, y) {
            var count = S.randomInt(3, 5);
            for (var i = 0; i < count; i++) {
                var angle = randAngle();
                var speed = rand(1.5, 5.0);
                _spawn(x, y,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    rand(0.04, 0.08),
                    rand(1.0, 2.5),
                    '#ffff88', true, 0.75);
            }
        },

        // ------------------------------------------------------------------
        // Laser hit – radial burst of coloured sparks
        // ------------------------------------------------------------------
        spawnLaserHit: function(x, y) {
            var count  = S.randomInt(8, 12);
            var colors = ['#ff0044', '#ff66aa', '#ffffff', '#ff4488'];
            for (var i = 0; i < count; i++) {
                var angle = randAngle();
                var speed = rand(2, 7);
                var color = colors[Math.floor(Math.random() * colors.length)];
                _spawn(x, y,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    rand(0.08, 0.20),
                    rand(1.0, 3.0),
                    color, true, 0.78);
            }
        },

        // ------------------------------------------------------------------
        // Neon spark – generic coloured sparkle effect
        // ------------------------------------------------------------------
        spawnNeonSpark: function(x, y, color) {
            var count = S.randomInt(5, 8);
            for (var i = 0; i < count; i++) {
                var angle = randAngle();
                var speed = rand(1.0, 4.0);
                _spawn(x, y,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    rand(0.12, 0.30),
                    rand(1.0, 2.5),
                    color || '#00ffff', true, 0.80);
            }
        },

        // ------------------------------------------------------------------
        // Debug / info
        // ------------------------------------------------------------------
        getActiveCount: function() {
            return _active.length;
        }
    };

}(window.Syndicate));
