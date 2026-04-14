window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Minimap Overlay
    // A 160x160px overlay in the top-right corner showing the full map.
    // -------------------------------------------------------------------------

    var MM  = S.MINIMAP_SIZE || 160;   // minimap canvas dimension in pixels
    var MS  = S.MAP_SIZE     || 64;    // world map dimension in tiles
    var TPX = MM / MS;                 // pixels per tile on the minimap (~2.5)

    // Offscreen canvas holding the static (pre-rendered) map background
    var _bgCanvas = null;

    // Pulse counter for animated dots
    var _pulse = 0;

    // Minimap margin from screen edge
    var MARGIN = 8;

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function tileToMM(col, row) {
        return {
            x: col * TPX,
            y: row * TPX
        };
    }

    function terrainColor(terrain) {
        switch (terrain) {
            case S.TERRAIN.ROAD:           return '#2a2a44';
            case S.TERRAIN.SIDEWALK:       return '#383858';
            case S.TERRAIN.GRASS:          return '#0d1a0d';
            case S.TERRAIN.WATER:          return '#0a1e30';
            case S.TERRAIN.BUILDING_FLOOR: return '#1a1a30';
            default:                        return '#0a0a12';
        }
    }

    // -------------------------------------------------------------------------
    // init – pre-render the static map background
    // -------------------------------------------------------------------------

    S.Minimap = {

        init: function(map) {
            _bgCanvas        = document.createElement('canvas');
            _bgCanvas.width  = MM;
            _bgCanvas.height = MM;
            var ctx = _bgCanvas.getContext('2d');

            // Dark base
            ctx.fillStyle = '#08080f';
            ctx.fillRect(0, 0, MM, MM);

            if (!map) return;

            for (var col = 0; col < MS; col++) {
                for (var row = 0; row < MS; row++) {
                    var tile = map[col][row];
                    if (!tile) continue;

                    var px = col * TPX;
                    var py = row * TPX;
                    var tw = Math.max(1, TPX);
                    var th = Math.max(1, TPX);

                    ctx.fillStyle = terrainColor(tile.terrain);
                    ctx.fillRect(px, py, tw, th);

                    // Buildings slightly brighter
                    if (tile.building && tile.bldgOriginCol === col && tile.bldgOriginRow === row) {
                        ctx.fillStyle = '#252535';
                        ctx.fillRect(px, py, tile.building.footW * TPX, tile.building.footH * TPX);
                    }
                }
            }
        },

        // -------------------------------------------------------------------------
        // render – draw the minimap overlay onto the main canvas
        // -------------------------------------------------------------------------

        render: function(ctx, map, entities, camera, canvasWidth) {
            _pulse += 0.05;

            var ox = (canvasWidth || S.Renderer.getWidth()) - MM - MARGIN;
            var oy = MARGIN;

            // Background + border
            ctx.save();

            // Semi-transparent dark panel
            ctx.fillStyle   = 'rgba(5,5,15,0.85)';
            ctx.fillRect(ox - 2, oy - 2, MM + 4, MM + 4);

            // Border
            ctx.strokeStyle = S.COLORS.NEON_CYAN;
            ctx.lineWidth   = 1;
            ctx.shadowColor = S.COLORS.NEON_CYAN;
            ctx.shadowBlur  = 4;
            ctx.strokeRect(ox - 2, oy - 2, MM + 4, MM + 4);
            ctx.shadowBlur  = 0;

            // Static map background
            if (_bgCanvas) {
                ctx.drawImage(_bgCanvas, ox, oy);
            }

            // Camera viewport rectangle
            if (camera) {
                var bounds = camera.getViewBounds();
                var vx  = ox + bounds.minX * TPX;
                var vy  = oy + bounds.minY * TPX;
                var vw  = (bounds.maxX - bounds.minX) * TPX;
                var vh  = (bounds.maxY - bounds.minY) * TPX;

                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth   = 1;
                ctx.shadowBlur  = 0;
                ctx.strokeRect(vx, vy, vw, vh);
            }

            // Entity dots
            if (entities && entities.length) {
                for (var i = 0; i < entities.length; i++) {
                    var e = entities[i];
                    if (!e || e.dead) continue;

                    var ex = ox + e.x * TPX;
                    var ey = oy + e.y * TPX;
                    var dotR, dotColor;

                    switch (e.type) {
                        case S.ENTITY_TYPE.AGENT:
                            dotR     = 2;
                            dotColor = S.COLORS.PLAYER_COLOR;
                            break;
                        case S.ENTITY_TYPE.ENEMY:
                            if (!e.detected && !e.visible) continue;
                            dotR     = 2;
                            dotColor = S.COLORS.ENEMY_COLOR;
                            break;
                        case S.ENTITY_TYPE.CIVILIAN:
                            dotR     = 1;
                            dotColor = 'rgba(100,100,128,0.7)';
                            break;
                        default:
                            continue;
                    }

                    ctx.beginPath();
                    ctx.arc(ex, ey, dotR, 0, Math.PI * 2);
                    ctx.fillStyle   = dotColor;
                    ctx.shadowColor = dotColor;
                    ctx.shadowBlur  = 4;
                    ctx.fill();
                    ctx.shadowBlur  = 0;
                }
            }

            // Objective marker (pulsing yellow dot at map centre for now)
            // In a real mission this would use a passed-in objective position
            var objX = ox + (MS / 2) * TPX;
            var objY = oy + (MS / 2) * TPX;
            var objA = 0.5 + Math.sin(_pulse * 3) * 0.5;
            ctx.beginPath();
            ctx.arc(objX, objY, 3, 0, Math.PI * 2);
            ctx.fillStyle   = 'rgba(255,220,0,' + objA + ')';
            ctx.shadowColor = '#ffdd00';
            ctx.shadowBlur  = 8;
            ctx.fill();
            ctx.shadowBlur  = 0;

            ctx.restore();
        },

        // -------------------------------------------------------------------------
        // handleClick – if click is on minimap, return world coords; else null
        // -------------------------------------------------------------------------

        handleClick: function(sx, sy, camera, canvasWidth) {
            var ox = (canvasWidth || S.Renderer.getWidth()) - MM - MARGIN;
            var oy = MARGIN;

            if (sx < ox - 2 || sx > ox + MM + 2) return null;
            if (sy < oy - 2 || sy > oy + MM + 2) return null;

            var relX  = sx - ox;
            var relY  = sy - oy;
            var worldX = relX / TPX;
            var worldY = relY / TPX;

            // Clamp to map bounds
            worldX = Math.max(0, Math.min(MS - 1, worldX));
            worldY = Math.max(0, Math.min(MS - 1, worldY));

            // Move camera to clicked position
            if (camera) { camera.centerOn(worldX, worldY); }

            return { x: worldX, y: worldY };
        }
    };

}(window.Syndicate));
