window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Canvas Renderer
    // -------------------------------------------------------------------------

    S.Renderer = {
        _canvas : null,
        _ctx    : null,
        _width  : 0,
        _height : 0,

        /**
         * Create (or find) the game canvas, size it to the window, get the 2d
         * context, and register a resize listener.
         */
        init: function() {
            var canvas = document.getElementById('gameCanvas');
            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.id = 'gameCanvas';
                document.body.appendChild(canvas);
            }
            this._canvas = canvas;
            this._ctx    = canvas.getContext('2d');

            this._resize();
            var self = this;
            window.addEventListener('resize', function() { self._resize(); });
        },

        _resize: function() {
            var dpr = window.devicePixelRatio || 1;
            var w   = window.innerWidth;
            var h   = window.innerHeight;
            this._canvas.width  = w * dpr;
            this._canvas.height = h * dpr;
            this._canvas.style.width  = w + 'px';
            this._canvas.style.height = h + 'px';
            this._width  = this._canvas.width;
            this._height = this._canvas.height;

            // Inform camera and input of new dimensions
            if (S.Camera && S.Camera.resize) {
                S.Camera.resize(this._width, this._height);
            }
        },

        getCanvas : function() { return this._canvas; },
        getContext: function() { return this._ctx;    },
        getWidth  : function() { return this._width;  },
        getHeight : function() { return this._height; },

        /** Fill the canvas with the background colour. */
        clear: function() {
            var ctx = this._ctx;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = S.COLORS.BACKGROUND;
            ctx.fillRect(0, 0, this._width, this._height);
        },

        /**
         * Translate + scale the context so that world → screen rendering uses
         * camera coordinates.  Call resetTransform() when done.
         */
        applyCameraTransform: function(camera) {
            var ctx = this._ctx;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.translate(this._width / 2, this._height / 2);
            ctx.scale(camera.zoom, camera.zoom);
            ctx.translate(-camera.x, -camera.y);
        },

        /** Restore the context saved by applyCameraTransform(). */
        resetTransform: function() {
            this._ctx.restore();
        },

        // ----------------------------------------------------------------
        // HUD text (drawn WITHOUT camera transform — call after resetTransform)
        // ----------------------------------------------------------------

        /**
         * Draw text with a neon glow.
         * @param {string} text
         * @param {number} x
         * @param {number} y
         * @param {string} color   CSS colour string
         * @param {number} size    Font size in px
         * @param {string} align   'left' | 'center' | 'right'
         */
        drawText: function(text, x, y, color, size, align) {
            var ctx       = this._ctx;
            size          = size  || 14;
            align         = align || 'left';
            color         = color || S.COLORS.NEON_CYAN;

            ctx.save();
            ctx.font         = size + 'px "Courier New", Courier, monospace';
            ctx.textAlign    = align;
            ctx.textBaseline = 'top';

            // Glow pass
            ctx.shadowColor  = color;
            ctx.shadowBlur   = 8;
            ctx.fillStyle    = color;
            ctx.fillText(text, x, y);

            // Crisp inner text
            ctx.shadowBlur   = 0;
            ctx.fillText(text, x, y);
            ctx.restore();
        },

        // ----------------------------------------------------------------
        // Neon drawing primitives (drawn in whichever transform is active)
        // ----------------------------------------------------------------

        /**
         * Draw a glowing line.
         */
        drawNeonLine: function(x1, y1, x2, y2, color, width) {
            var ctx  = this._ctx;
            width    = width || 1;
            color    = color || S.COLORS.NEON_CYAN;

            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth   = width;
            ctx.shadowColor = color;
            ctx.shadowBlur  = 6;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.restore();
        },

        /**
         * Draw a glowing rectangle.
         * @param {boolean} fill  true = filled, false = outline only
         */
        drawNeonRect: function(x, y, w, h, color, fill) {
            var ctx = this._ctx;
            color   = color || S.COLORS.NEON_CYAN;

            ctx.save();
            ctx.strokeStyle = color;
            ctx.fillStyle   = color;
            ctx.lineWidth   = 1;
            ctx.shadowColor = color;
            ctx.shadowBlur  = 8;

            if (fill) {
                ctx.fillRect(x, y, w, h);
            } else {
                ctx.strokeRect(x, y, w, h);
            }
            ctx.restore();
        }
    };

}(window.Syndicate));
