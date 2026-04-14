window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Camera
    // Operates in iso-space (pixels before canvas transform).
    // x, y = the iso-space coordinate that maps to the screen centre.
    // -------------------------------------------------------------------------

    S.Camera = {
        x         : 0,
        y         : 0,
        zoom      : 1.0,
        targetX   : 0,
        targetY   : 0,
        targetZoom: 1.0,
        _cw       : 800,   // canvas width  (updated in init / resize)
        _ch       : 600,   // canvas height

        /** Call once with canvas dimensions. */
        init: function(canvasWidth, canvasHeight) {
            this._cw = canvasWidth  || 800;
            this._ch = canvasHeight || 600;

            // Start centred on the middle of the map
            var mid = S.worldToIso(S.MAP_SIZE / 2, S.MAP_SIZE / 2);
            this.x = this.targetX = mid.x;
            this.y = this.targetY = mid.y;
            this.zoom = this.targetZoom = 1.0;
        },

        /** Called every frame. Smoothly moves toward targetX/Y/zoom. */
        update: function(dt) {
            var speed = S.clamp(dt * (S.CAMERA_LERP || 12), 0, 1);
            this.x    = S.lerp(this.x,    this.targetX,    speed);
            this.y    = S.lerp(this.y,    this.targetY,    speed);
            this.zoom = S.lerp(this.zoom, this.targetZoom, speed);
        },

        /**
         * Move the camera target by (dx, dy) in screen pixels.
         * Divides by current zoom so the camera moves the same apparent distance
         * regardless of zoom level.
         */
        pan: function(dx, dy) {
            this.targetX += dx / this.zoom;
            this.targetY += dy / this.zoom;
        },

        /** Increase zoom by one step. */
        zoomIn: function() {
            this.setZoom(this.targetZoom + S.ZOOM_STEP);
        },

        /** Decrease zoom by one step. */
        zoomOut: function() {
            this.setZoom(this.targetZoom - S.ZOOM_STEP);
        },

        /** Set zoom level, clamped to [ZOOM_MIN, ZOOM_MAX]. */
        setZoom: function(level) {
            this.targetZoom = S.clamp(level, S.ZOOM_MIN, S.ZOOM_MAX);
        },

        /**
         * Smoothly centre the camera on a world-grid position.
         */
        centerOn: function(wx, wy) {
            var iso      = S.worldToIso(wx, wy);
            this.targetX = iso.x;
            this.targetY = iso.y;
        },

        /**
         * Returns the visible world-space axis-aligned rectangle for culling.
         * { minX, minY, maxX, maxY } in world (grid) coordinates (fractional).
         * Adds a 2-tile margin to avoid pop-in at the edges.
         */
        getViewBounds: function() {
            var margin = 2;
            var hw = (this._cw / 2) / this.zoom;
            var hh = (this._ch / 2) / this.zoom;

            // Convert the four screen corners to world coords
            var corners = [
                S.isoToWorld(this.x - hw, this.y - hh),
                S.isoToWorld(this.x + hw, this.y - hh),
                S.isoToWorld(this.x - hw, this.y + hh),
                S.isoToWorld(this.x + hw, this.y + hh)
            ];

            var minX =  Infinity, minY =  Infinity;
            var maxX = -Infinity, maxY = -Infinity;
            for (var i = 0; i < corners.length; i++) {
                if (corners[i].x < minX) minX = corners[i].x;
                if (corners[i].y < minY) minY = corners[i].y;
                if (corners[i].x > maxX) maxX = corners[i].x;
                if (corners[i].y > maxY) maxY = corners[i].y;
            }

            return {
                minX: Math.floor(minX) - margin,
                minY: Math.floor(minY) - margin,
                maxX: Math.ceil(maxX)  + margin,
                maxY: Math.ceil(maxY)  + margin
            };
        },

        /** Update stored canvas size (call on resize). */
        resize: function(canvasWidth, canvasHeight) {
            this._cw = canvasWidth;
            this._ch = canvasHeight;
        }
    };

}(window.Syndicate));
