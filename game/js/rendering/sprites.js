window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Procedural Sprite Generator
    // Pre-renders entity sprites to offscreen canvases for performance.
    // -------------------------------------------------------------------------

    // Sprite cache: _cache[type][variant] = { canvas, offX, offY }
    // offX/offY = pixel offset from draw-origin to top-left of canvas
    var _cache = {};

    // Sprite sheet frames for animated elements
    var SEL_FRAMES = 8;   // selection circle animation frames

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function makeOC(w, h) {
        var c   = document.createElement('canvas');
        c.width  = w;
        c.height = h;
        return c;
    }

    /**
     * Draw a glowing shape.
     * Temporarily sets shadowColor/shadowBlur on ctx, then clears afterward.
     */
    function withGlow(ctx, color, blur, fn) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur  = blur;
        fn();
        ctx.restore();
    }

    // -------------------------------------------------------------------------
    // Humanoid sprite drawing
    // Draws a small isometric-friendly top-down humanoid at (cx, cy).
    //
    //   cx, cy   = centre bottom of the sprite (feet position)
    //   color    = primary body / glow colour
    //   facing   = 0-7 (0=E, clockwise)
    //   size     = 'normal' | 'small'
    // -------------------------------------------------------------------------

    var FACING_DX = [ 1, 1, 0,-1,-1,-1, 0, 1];
    var FACING_DY = [ 0, 1, 1, 1, 0,-1,-1,-1];

    function drawHumanoid(ctx, cx, cy, color, glowColor, facing, selected, bodyH) {
        bodyH = bodyH || 16;
        var headR = bodyH * 0.28;
        var bodyW = bodyH * 0.38;

        // Leg/arm lines radiate toward the facing direction
        var dx = FACING_DX[facing || 0];
        var dy = FACING_DY[facing || 0];

        // Body rectangle
        ctx.fillStyle   = color;
        ctx.fillRect(cx - bodyW / 2, cy - bodyH, bodyW, bodyH * 0.6);

        // Legs (two short lines below body)
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - bodyH * 0.4);
        ctx.lineTo(cx - 2 + dx, cy + 2 + dy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 2, cy - bodyH * 0.4);
        ctx.lineTo(cx + 2 + dx, cy + 2 + dy);
        ctx.stroke();

        // Arms
        ctx.beginPath();
        ctx.moveTo(cx - bodyW / 2, cy - bodyH * 0.55);
        ctx.lineTo(cx - bodyW / 2 - dx * 3, cy - bodyH * 0.55 + dy * 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + bodyW / 2, cy - bodyH * 0.55);
        ctx.lineTo(cx + bodyW / 2 + dx * 3, cy - bodyH * 0.55 + dy * 3);
        ctx.stroke();

        // Head circle
        ctx.beginPath();
        ctx.arc(cx + dx * headR * 0.3, cy - bodyH + headR * 0.5, headR, 0, Math.PI * 2);
        ctx.fillStyle = glowColor || color;
        ctx.fill();

        // Selection ring
        if (selected) {
            withGlow(ctx, S.COLORS.NEON_CYAN, 10, function() {
                ctx.strokeStyle = S.COLORS.NEON_CYAN;
                ctx.lineWidth   = 1.5;
                ctx.beginPath();
                ctx.ellipse(cx, cy - 1, bodyW + 4, 4, 0, 0, Math.PI * 2);
                ctx.stroke();
            });
        }
    }

    // -------------------------------------------------------------------------
    // Generate agent sprites (8 directions × 2 states: normal + selected)
    // -------------------------------------------------------------------------

    function genAgentSprites(key, bodyColor, headColor) {
        _cache[key] = [];
        for (var f = 0; f < 8; f++) {
            var oc  = makeOC(28, 32);
            var ctx = oc.getContext('2d');
            var cx  = 14, cy = 28;

            withGlow(ctx, bodyColor, 8, function() {
                drawHumanoid(ctx, cx, cy, bodyColor, headColor, f, false, 16);
            });

            _cache[key][f] = { canvas: oc, offX: -cx, offY: -cy };
        }

        // Selected variant (with ring)
        var selKey = key + '_sel';
        _cache[selKey] = [];
        for (var f2 = 0; f2 < 8; f2++) {
            var oc2  = makeOC(36, 36);
            var ctx2 = oc2.getContext('2d');
            var cx2  = 18, cy2 = 30;

            withGlow(ctx2, bodyColor, 10, function() {
                drawHumanoid(ctx2, cx2, cy2, bodyColor, headColor, f2, true, 16);
            });

            _cache[selKey][f2] = { canvas: oc2, offX: -cx2, offY: -cy2 };
        }
    }

    // -------------------------------------------------------------------------
    // Generate selection circle (animated pulsing ring)
    // -------------------------------------------------------------------------

    function genSelectionCircle() {
        _cache['selection'] = [];
        for (var i = 0; i < SEL_FRAMES; i++) {
            var phase = i / SEL_FRAMES;
            var r     = 10 + Math.sin(phase * Math.PI * 2) * 2;
            var alpha = 0.5 + Math.sin(phase * Math.PI * 2) * 0.4;
            var oc    = makeOC(30, 14);
            var ctx   = oc.getContext('2d');

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = S.COLORS.NEON_CYAN;
            ctx.lineWidth   = 1.5;
            ctx.shadowColor = S.COLORS.NEON_CYAN;
            ctx.shadowBlur  = 6;
            ctx.beginPath();
            ctx.ellipse(15, 7, r, 5, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            _cache['selection'][i] = { canvas: oc, offX: -15, offY: -7 };
        }
    }

    // -------------------------------------------------------------------------
    // Generate vehicle sprite
    // -------------------------------------------------------------------------

    function genVehicleSprites() {
        _cache['vehicle'] = [];
        var colors = ['#334466', '#443322', '#223344'];
        for (var c = 0; c < colors.length; c++) {
            var oc  = makeOC(40, 28);
            var ctx = oc.getContext('2d');

            // Body
            ctx.fillStyle = colors[c];
            ctx.fillRect(6, 4, 28, 16);

            // Windshield
            ctx.fillStyle = '#334488';
            ctx.fillRect(8, 5, 10, 5);

            // Headlights
            withGlow(ctx, S.COLORS.NEON_AMBER, 6, function() {
                ctx.fillStyle = S.COLORS.NEON_AMBER;
                ctx.fillRect(32, 6,  3, 3);
                ctx.fillRect(32, 14, 3, 3);
            });

            // Tail lights
            withGlow(ctx, '#ff2020', 4, function() {
                ctx.fillStyle = '#cc1010';
                ctx.fillRect(6, 6,  3, 3);
                ctx.fillRect(6, 14, 3, 3);
            });

            _cache['vehicle'][c] = { canvas: oc, offX: -20, offY: -14 };
        }
    }

    // -------------------------------------------------------------------------
    // Generate weapon icons (small HUD icons, 20x20px each)
    // -------------------------------------------------------------------------

    function genWeaponIcons() {
        _cache['weapon_icons'] = {};
        var weapons = Object.keys(S.WEAPON_TYPES || {});

        weapons.forEach(function(type, idx) {
            var oc  = makeOC(20, 20);
            var ctx = oc.getContext('2d');
            var color = S.COLORS.NEON_CYAN;

            // Each weapon gets a simple distinctive icon
            ctx.strokeStyle = color;
            ctx.lineWidth   = 1;
            ctx.shadowColor = color;
            ctx.shadowBlur  = 3;

            switch (type) {
                case 'PISTOL':
                    ctx.beginPath();
                    ctx.rect(3, 7, 12, 5);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.rect(13, 4, 4, 3);
                    ctx.stroke();
                    break;
                case 'SHOTGUN':
                    ctx.beginPath();
                    ctx.rect(2, 8, 16, 4);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.rect(14, 5, 4, 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.rect(15, 13, 3, 2);
                    ctx.stroke();
                    break;
                case 'MINIGUN':
                    for (var i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.rect(2, 5 + i * 4, 16, 2);
                        ctx.stroke();
                    }
                    break;
                case 'LASER':
                    ctx.strokeStyle = S.COLORS.NEON_MAGENTA;
                    ctx.shadowColor = S.COLORS.NEON_MAGENTA;
                    ctx.beginPath();
                    ctx.moveTo(2, 10);
                    ctx.lineTo(18, 10);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(17, 10, 3, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                case 'FLAMETHROWER':
                    ctx.strokeStyle = S.COLORS.NEON_AMBER;
                    ctx.shadowColor = S.COLORS.NEON_AMBER;
                    ctx.beginPath();
                    ctx.rect(2, 8, 10, 4);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(16, 10, 4, -0.8, 0.8);
                    ctx.stroke();
                    break;
                case 'PERSUADERTRON':
                    ctx.strokeStyle = S.COLORS.NEON_GREEN;
                    ctx.shadowColor = S.COLORS.NEON_GREEN;
                    ctx.beginPath();
                    ctx.arc(10, 10, 6, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(10, 10, 3, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                default:
                    // Generic gun shape
                    ctx.beginPath();
                    ctx.rect(3, 8, 14, 4);
                    ctx.stroke();
                    break;
            }

            _cache['weapon_icons'][type] = { canvas: oc };
        });
    }

    // -------------------------------------------------------------------------
    // Public API – initSpriteCache
    // -------------------------------------------------------------------------

    S.initSpriteCache = function() {
        // Player agents (cyan)
        genAgentSprites('agent_player', S.COLORS.PLAYER_COLOR, '#88ffff');

        // Enemy agents (red)
        genAgentSprites('agent_enemy', S.COLORS.ENEMY_COLOR, '#ff8888');

        // Civilian (muted gray/blue)
        genAgentSprites('agent_civilian', S.COLORS.CIVILIAN_COLOR, '#8888aa');

        // Selection circle animation
        genSelectionCircle();

        // Vehicle sprites
        genVehicleSprites();

        // Weapon HUD icons
        genWeaponIcons();
    };

    // -------------------------------------------------------------------------
    // Draw helpers used by entity rendering
    // -------------------------------------------------------------------------

    /**
     * Draw an agent sprite at world position (wx, wy) on ctx.
     * sx, sy = screen-space foot position (from worldToScreen)
     */
    S.drawAgent = function(ctx, sx, sy, color, facing, selected) {
        var key = 'agent_player';
        if (color === S.COLORS.ENEMY_COLOR)   key = 'agent_enemy';
        if (color === S.COLORS.CIVILIAN_COLOR) key = 'agent_civilian';

        if (selected) {
            var selSprites = _cache[key + '_sel'];
            if (selSprites) {
                var sp = selSprites[facing || 0];
                ctx.drawImage(sp.canvas, sx + sp.offX, sy + sp.offY);
                return;
            }
        }

        var sprites = _cache[key];
        if (!sprites) return;
        var s = sprites[facing || 0];
        ctx.drawImage(s.canvas, sx + s.offX, sy + s.offY);
    };

    S.drawCivilian = function(ctx, sx, sy, facing) {
        var sprites = _cache['agent_civilian'];
        if (!sprites) return;
        var s = sprites[facing || 0];
        ctx.drawImage(s.canvas, sx + s.offX, sy + s.offY);
    };

    S.drawEnemy = function(ctx, sx, sy, facing, selected) {
        S.drawAgent(ctx, sx, sy, S.COLORS.ENEMY_COLOR, facing, selected);
    };

    /**
     * Draw the weapon icon for a weapon type into the HUD.
     */
    S.drawWeaponIcon = function(ctx, type, x, y) {
        var icons = _cache['weapon_icons'];
        if (!icons || !icons[type]) return;
        ctx.drawImage(icons[type].canvas, x, y);
    };

    /**
     * Draw a selection circle (animated).
     * frame = integer tick % SEL_FRAMES
     */
    S.drawSelectionCircle = function(ctx, sx, sy, frame) {
        var frames = _cache['selection'];
        if (!frames) return;
        var f = (frame || 0) % SEL_FRAMES;
        var s = frames[f];
        ctx.drawImage(s.canvas, sx + s.offX, sy + s.offY);
    };

    /**
     * Draw a vehicle sprite.
     * colorIndex = 0-2
     */
    S.drawVehicle = function(ctx, sx, sy, colorIndex) {
        var vehicles = _cache['vehicle'];
        if (!vehicles) return;
        var v = vehicles[(colorIndex || 0) % vehicles.length];
        ctx.drawImage(v.canvas, sx + v.offX, sy + v.offY);
    };

}(window.Syndicate));
