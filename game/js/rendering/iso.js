window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Isometric projection
    //
    // World coords   (wx, wy) : integer grid cells, (0,0) = top of map diamond
    // Iso coords     (ix, iy) : pixel offset in the "flat iso plane"
    // Screen coords  (sx, sy) : final canvas pixels after camera transform
    //
    // Standard 2:1 iso projection:
    //   ix =  (wx - wy) * (TILE_WIDTH  / 2)
    //   iy =  (wx + wy) * (TILE_HEIGHT / 2)
    // -------------------------------------------------------------------------

    var TW2 = S.TILE_WIDTH  / 2;   // 32
    var TH2 = S.TILE_HEIGHT / 2;   // 16

    /**
     * World grid → isometric pixel offset.
     * Returns { x, y } in iso-space (no camera applied).
     */
    S.worldToIso = function(wx, wy) {
        return {
            x: (wx - wy) * TW2,
            y: (wx + wy) * TH2
        };
    };

    /**
     * Isometric pixel offset → world grid (fractional).
     * Returns { x, y } in world-space.
     */
    S.isoToWorld = function(ix, iy) {
        return {
            x: (ix / TW2 + iy / TH2) / 2,
            y: (iy / TH2 - ix / TW2) / 2
        };
    };

    /**
     * World grid → final screen pixel.
     * camera must have { x, y, zoom } where x/y are the iso-space coords of
     * the screen centre, and zoom is the scale factor.
     * canvasWidth / canvasHeight default to the Renderer canvas if omitted.
     */
    S.worldToScreen = function(wx, wy, camera, canvasWidth, canvasHeight) {
        var iso = S.worldToIso(wx, wy);
        var cw  = canvasWidth  || (S.Renderer ? S.Renderer.getCanvas().width  : 800);
        var ch  = canvasHeight || (S.Renderer ? S.Renderer.getCanvas().height : 600);
        return {
            x: (iso.x - camera.x) * camera.zoom + cw / 2,
            y: (iso.y - camera.y) * camera.zoom + ch / 2
        };
    };

    /**
     * Screen pixel → world grid (fractional).
     */
    S.screenToWorld = function(sx, sy, camera, canvasWidth, canvasHeight) {
        var cw  = canvasWidth  || (S.Renderer ? S.Renderer.getCanvas().width  : 800);
        var ch  = canvasHeight || (S.Renderer ? S.Renderer.getCanvas().height : 600);
        var ix  = (sx - cw / 2) / camera.zoom + camera.x;
        var iy  = (sy - ch / 2) / camera.zoom + camera.y;
        return S.isoToWorld(ix, iy);
    };

    /**
     * Returns the integer tile { col, row } under a screen position.
     */
    S.getTileAtScreen = function(sx, sy, camera, canvasWidth, canvasHeight) {
        var w = S.screenToWorld(sx, sy, camera, canvasWidth, canvasHeight);
        return {
            col: Math.floor(w.x),
            row: Math.floor(w.y)
        };
    };

    /**
     * Depth / painter's-algorithm sort key.
     * Tiles with smaller keys are drawn first (further from camera in iso view).
     */
    S.getDepthKey = function(wx, wy) {
        return wx + wy;
    };

}(window.Syndicate));
