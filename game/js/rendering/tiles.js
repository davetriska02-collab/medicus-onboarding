window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Tile Renderer
    // Pre-renders terrain tiles to offscreen canvases for performance.
    // -------------------------------------------------------------------------

    var TW = S.TILE_WIDTH;    // 64
    var TH = S.TILE_HEIGHT;   // 32
    var TW2 = TW / 2;         // 32
    var TH2 = TH / 2;         // 16

    // Cache of offscreen canvases, keyed by terrain type
    var _tileCache = {};

    // Extra vertical pixels needed to draw a 1-unit-tall building base
    var BASE_H = TH;   // height of the front/side wall face in pixels per floor

    // -------------------------------------------------------------------------
    // Diamond drawing helper
    // -------------------------------------------------------------------------

    /**
     * Draw an isometric diamond (floor tile) on ctx.
     * The top-left corner of the tile's bounding box is at (0, 0).
     * The diamond's tip points are: top=(TW2,0), right=(TW,TH2), bottom=(TW2,TH), left=(0,TH2)
     */
    function drawDiamond(ctx, fillColor, strokeColor) {
        ctx.beginPath();
        ctx.moveTo(TW2, 0);
        ctx.lineTo(TW,  TH2);
        ctx.lineTo(TW2, TH);
        ctx.lineTo(0,   TH2);
        ctx.closePath();
        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }
        if (strokeColor) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth   = 0.5;
            ctx.stroke();
        }
    }

    // -------------------------------------------------------------------------
    // Tile pre-rendering
    // -------------------------------------------------------------------------

    function makeOffscreen(w, h) {
        var oc  = document.createElement('canvas');
        oc.width  = w;
        oc.height = h;
        return oc;
    }

    function prerenderRoad() {
        var oc  = makeOffscreen(TW, TH);
        var ctx = oc.getContext('2d');
        // Base diamond
        drawDiamond(ctx, '#1a1a2e', '#222238');
        // Subtle lane-marking lines
        ctx.strokeStyle = '#252548';
        ctx.lineWidth   = 0.5;
        // Horizontal centre line (in iso space a short horizontal dash)
        ctx.beginPath();
        ctx.moveTo(TW2 - 8, TH2);
        ctx.lineTo(TW2 + 8, TH2);
        ctx.stroke();
        return oc;
    }

    function prerenderSidewalk() {
        var oc  = makeOffscreen(TW, TH);
        var ctx = oc.getContext('2d');
        drawDiamond(ctx, '#252540', '#2e2e50');
        // Tile-edge lines to suggest paving slabs
        ctx.strokeStyle = '#1e1e38';
        ctx.lineWidth   = 0.5;
        ctx.beginPath();
        ctx.moveTo(TW2, 0);
        ctx.lineTo(TW2, TH);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, TH2);
        ctx.lineTo(TW, TH2);
        ctx.stroke();
        return oc;
    }

    function prerenderGrass() {
        var oc  = makeOffscreen(TW, TH);
        var ctx = oc.getContext('2d');
        drawDiamond(ctx, '#0a1a0a', '#0d200d');
        // Subtle noise dots for texture
        ctx.fillStyle = '#0f220f';
        for (var i = 0; i < 8; i++) {
            var nx = 8 + Math.floor((i * 37 + 13) % (TW - 16));
            var ny = 4 + Math.floor((i * 17 + 7)  % (TH - 8));
            ctx.fillRect(nx, ny, 1, 1);
        }
        return oc;
    }

    function prerenderWater() {
        var oc  = makeOffscreen(TW, TH);
        var ctx = oc.getContext('2d');
        drawDiamond(ctx, '#051525', '#062030');
        ctx.strokeStyle = '#0a3060';
        ctx.lineWidth   = 0.5;
        ctx.beginPath();
        ctx.moveTo(TW2 - 12, TH2 - 3);
        ctx.lineTo(TW2 + 6,  TH2 - 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(TW2 - 6,  TH2 + 3);
        ctx.lineTo(TW2 + 12, TH2 + 3);
        ctx.stroke();
        return oc;
    }

    function prerenderBuildingFloor() {
        // Building-floor tiles are usually hidden under the building sprite,
        // but we still need a tile in case the building isn't drawn.
        var oc  = makeOffscreen(TW, TH);
        var ctx = oc.getContext('2d');
        drawDiamond(ctx, '#0e0e1c', '#16162a');
        return oc;
    }

    // -------------------------------------------------------------------------
    // Public API – initTileCache
    // -------------------------------------------------------------------------

    S.initTileCache = function() {
        _tileCache[S.TERRAIN.ROAD]           = prerenderRoad();
        _tileCache[S.TERRAIN.SIDEWALK]       = prerenderSidewalk();
        _tileCache[S.TERRAIN.GRASS]          = prerenderGrass();
        _tileCache[S.TERRAIN.WATER]          = prerenderWater();
        _tileCache[S.TERRAIN.BUILDING_FLOOR] = prerenderBuildingFloor();
    };

    // -------------------------------------------------------------------------
    // renderTile – draw a cached terrain tile
    // screenX, screenY are the top-left of the tile's bounding box
    // -------------------------------------------------------------------------

    S.renderTile = function(ctx, terrain, screenX, screenY) {
        var cached = _tileCache[terrain];
        if (!cached) return;
        ctx.drawImage(cached, Math.round(screenX), Math.round(screenY));
    };

    // -------------------------------------------------------------------------
    // renderBuilding – draw a 3D isometric building
    // screenX, screenY = screen position of the building-footprint's top corner
    // building = { height, style, color, footW, footH }
    //
    // Geometry in iso space:
    //   "top" face  – a diamond at height * BASE_H above the floor
    //   "left" face – left-side parallelogram
    //   "right" face – right-side parallelogram
    // -------------------------------------------------------------------------

    S.renderBuilding = function(ctx, building, screenX, screenY) {
        var h     = building.height;      // number of floors (1-3)
        var fw    = building.footW  || 1;
        var fh    = building.footH  || 1;
        var color = building.color  || S.COLORS.NEON_CYAN;
        var style = building.style  || 0;

        // Pixel dimensions of the footprint top-face diamond
        var faceW  = (fw + fh) * TW2;     // iso width of footprint
        var faceH  = (fw + fh) * TH2;     // iso height of footprint
        var wallH  = h * BASE_H;           // pixel height of the walls

        // The "top left corner" of the top face in screen space is
        // offset upward by wallH from screenX/screenY.
        var topX = screenX;
        var topY = screenY - wallH;

        // ---- Right face (south-east wall) ----
        ctx.beginPath();
        ctx.moveTo(topX + faceW,        topY + faceH / 2);          // top-right of top face
        ctx.lineTo(topX + faceW,        topY + faceH / 2 + wallH);  // bottom-right
        ctx.lineTo(topX + faceW / 2,    topY + faceH      + wallH); // bottom-centre
        ctx.lineTo(topX + faceW / 2,    topY + faceH);              // top-centre
        ctx.closePath();
        ctx.fillStyle = '#0d0d1a';
        ctx.fill();
        ctx.strokeStyle = '#1a1a30';
        ctx.lineWidth   = 0.5;
        ctx.stroke();

        // ---- Left face (south-west wall) ----
        ctx.beginPath();
        ctx.moveTo(topX,                topY + faceH / 2);
        ctx.lineTo(topX,                topY + faceH / 2 + wallH);
        ctx.lineTo(topX + faceW / 2,    topY + faceH      + wallH);
        ctx.lineTo(topX + faceW / 2,    topY + faceH);
        ctx.closePath();
        ctx.fillStyle = '#0a0a16';
        ctx.fill();
        ctx.strokeStyle = '#14142a';
        ctx.lineWidth   = 0.5;
        ctx.stroke();

        // ---- Top face ----
        ctx.beginPath();
        ctx.moveTo(topX + faceW / 2, topY);                    // north
        ctx.lineTo(topX + faceW,     topY + faceH / 2);        // east
        ctx.lineTo(topX + faceW / 2, topY + faceH);            // south
        ctx.lineTo(topX,             topY + faceH / 2);        // west
        ctx.closePath();
        ctx.fillStyle = '#12121f';
        ctx.fill();
        ctx.strokeStyle = '#1e1e38';
        ctx.lineWidth   = 0.5;
        ctx.stroke();

        // ---- Neon window strips on left and right faces ----
        _drawWindows(ctx, building, topX, topY, faceW, faceH, wallH, color, style);
    };

    /**
     * Draw neon window rectangles on the building faces.
     */
    function _drawWindows(ctx, building, topX, topY, faceW, faceH, wallH, color, style) {
        var h      = building.height;
        var floors = h;

        // Right face windows
        var rwBaseX = topX + faceW;
        var rwBaseY = topY + faceH / 2;

        for (var floor = 0; floor < floors; floor++) {
            var fy      = rwBaseY + wallH - (floor + 1) * BASE_H + 4;
            var wCount  = Math.max(1, Math.floor(faceW / 4 / 12));
            for (var wi = 0; wi < wCount; wi++) {
                // Window in iso-right-face: x goes down-left at 1:2 slope
                var wOffX = -((faceW / 2) * (wi + 0.5) / wCount);
                var wOffY = ((faceH / 2) * (wi + 0.5) / wCount);
                var wx    = rwBaseX + wOffX - 4;
                var wy    = fy + wOffY;

                _drawNeonWindow(ctx, wx, wy, 6, BASE_H - 8, color, style, floor);
            }
        }

        // Left face windows
        var lwBaseX = topX;
        var lwBaseY = topY + faceH / 2;

        for (var floor2 = 0; floor2 < floors; floor2++) {
            var fy2     = lwBaseY + wallH - (floor2 + 1) * BASE_H + 4;
            var wCount2 = Math.max(1, Math.floor(faceW / 4 / 12));
            for (var wi2 = 0; wi2 < wCount2; wi2++) {
                var wOffX2 = ((faceW / 2) * (wi2 + 0.5) / wCount2);
                var wOffY2 = ((faceH / 2) * (wi2 + 0.5) / wCount2);
                var wx2    = lwBaseX + wOffX2 - 3;
                var wy2    = fy2 + wOffY2;

                _drawNeonWindow(ctx, wx2, wy2, 6, BASE_H - 8, color, style, floor2);
            }
        }
    }

    function _drawNeonWindow(ctx, x, y, w, h, color, style, floor) {
        // Some windows are dark (off), some lit
        var lit = ((floor * 3 + Math.round(x + y)) % 4) !== 0;
        if (!lit) return;

        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur  = 4;
        ctx.fillStyle   = color;

        if (style === 0) {
            // Simple rectangle window
            ctx.globalAlpha = 0.7;
            ctx.fillRect(x, y, w, h);
        } else if (style === 1) {
            // Horizontal strip
            ctx.globalAlpha = 0.6;
            ctx.fillRect(x - 1, y + h / 3, w + 2, 3);
        } else if (style === 2) {
            // Vertical slit
            ctx.globalAlpha = 0.65;
            ctx.fillRect(x + w / 3, y, 2, h);
        } else {
            // Cross pattern
            ctx.globalAlpha = 0.5;
            ctx.fillRect(x, y + h / 2 - 1, w, 2);
            ctx.fillRect(x + w / 2 - 1, y, 2, h);
        }

        ctx.restore();
    }

    // -------------------------------------------------------------------------
    // renderMap – iterate visible tiles, draw in painter's algorithm order
    // -------------------------------------------------------------------------

    S.renderMap = function(ctx, map, camera) {
        if (!map) return;

        var bounds = camera.getViewBounds();
        var MS     = S.MAP_SIZE;

        // Clamp bounds to valid tile range
        var minCol = Math.max(0,      bounds.minX);
        var maxCol = Math.min(MS - 1, bounds.maxX);
        var minRow = Math.max(0,      bounds.minY);
        var maxRow = Math.min(MS - 1, bounds.maxY);

        var cw = S.Renderer.getWidth();
        var ch = S.Renderer.getHeight();

        // Collect visible tiles and sort by depth key (painter's algorithm)
        // We iterate in (col+row) order which IS the correct back-to-front order
        // for iso, so we can draw directly without sorting.
        //
        // Correct iso draw order: iterate by depth = col + row, ascending.
        // For each depth d, walk col from max(0, d-maxRow) to min(maxCol, d).

        var maxDepth = maxCol + maxRow;
        var minDepth = minCol + minRow;

        // Track which building origins we've drawn this frame
        var drawnBuildings = {};

        for (var depth = minDepth; depth <= maxDepth; depth++) {
            var colStart = Math.max(minCol, depth - maxRow);
            var colEnd   = Math.min(maxCol, depth - minRow);

            for (var col = colStart; col <= colEnd; col++) {
                var row = depth - col;
                if (row < minRow || row > maxRow) continue;

                var tile    = map[col][row];
                var screen  = S.worldToScreen(col, row, camera, cw, ch);
                var sx      = screen.x;
                var sy      = screen.y;

                // Draw floor tile (always)
                S.renderTile(ctx, tile.terrain, sx, sy);

                // Draw building (once per building, at its origin tile)
                if (tile.building && tile.bldgOriginCol === col && tile.bldgOriginRow === row) {
                    var key = col + '_' + row;
                    if (!drawnBuildings[key]) {
                        drawnBuildings[key] = true;
                        S.renderBuilding(ctx, tile.building, sx, sy);
                    }
                }
            }
        }
    };

}(window.Syndicate));
