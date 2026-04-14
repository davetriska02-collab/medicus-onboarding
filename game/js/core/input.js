window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Input Manager
    // -------------------------------------------------------------------------

    S.Input = {
        // Mouse screen coords (canvas pixels)
        screenX: 0,
        screenY: 0,

        // Mouse world coords (updated each mousemove via camera)
        worldX: 0,
        worldY: 0,

        // Button states
        leftDown  : false,
        rightDown : false,
        middleDown: false,

        // Click events populated during the frame, cleared in update()
        leftClick : null,   // { x, y } or null
        rightClick: null,

        // Drag state (for box-select with left button)
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragEndX  : 0,
        dragEndY  : 0,

        // Middle-mouse panning internals
        _midDrag : false,
        _midLastX: 0,
        _midLastY: 0,

        // Keyboard state
        _keys       : {},   // keys currently held  key→true
        _keysPressed: {},   // keys pressed this frame (single-fire, cleared in update)

        // Reference to canvas (set in init)
        _canvas: null,

        // ----------------------------------------------------------------
        // Initialisation
        // ----------------------------------------------------------------
        init: function(canvas) {
            this._canvas = canvas;
            var self = this;

            canvas.addEventListener('mousedown', function(e) {
                self._onMouseDown(e);
            });
            canvas.addEventListener('mouseup', function(e) {
                self._onMouseUp(e);
            });
            canvas.addEventListener('mousemove', function(e) {
                self._onMouseMove(e);
            });
            canvas.addEventListener('wheel', function(e) {
                self._onWheel(e);
            }, { passive: false });
            canvas.addEventListener('contextmenu', function(e) {
                e.preventDefault();
            });

            window.addEventListener('keydown', function(e) {
                self._onKeyDown(e);
            });
            window.addEventListener('keyup', function(e) {
                self._onKeyUp(e);
            });
        },

        // ----------------------------------------------------------------
        // Internal event handlers
        // ----------------------------------------------------------------
        _onMouseDown: function(e) {
            e.preventDefault();
            var pos = this._canvasPos(e);
            this.screenX = pos.x;
            this.screenY = pos.y;

            if (e.button === 0) {
                this.leftDown   = true;
                this.isDragging = false;
                this.dragStartX = pos.x;
                this.dragStartY = pos.y;
                this.dragEndX   = pos.x;
                this.dragEndY   = pos.y;
            }
            if (e.button === 1) {
                this.middleDown = true;
                this._midDrag   = true;
                this._midLastX  = pos.x;
                this._midLastY  = pos.y;
            }
            if (e.button === 2) {
                this.rightDown = true;
            }
        },

        _onMouseUp: function(e) {
            var pos = this._canvasPos(e);
            this.screenX = pos.x;
            this.screenY = pos.y;

            if (e.button === 0) {
                if (!this.isDragging) {
                    this.leftClick = { x: pos.x, y: pos.y };
                }
                this.leftDown   = false;
                this.isDragging = false;
            }
            if (e.button === 1) {
                this.middleDown = false;
                this._midDrag   = false;
            }
            if (e.button === 2) {
                this.rightDown  = false;
                this.rightClick = { x: pos.x, y: pos.y };
            }
        },

        _onMouseMove: function(e) {
            var pos = this._canvasPos(e);
            this.screenX = pos.x;
            this.screenY = pos.y;

            // Middle-mouse camera pan
            if (this._midDrag && this.middleDown) {
                var dx = pos.x - this._midLastX;
                var dy = pos.y - this._midLastY;
                if (S.Camera) { S.Camera.pan(-dx, -dy); }
                this._midLastX = pos.x;
                this._midLastY = pos.y;
            }

            // Box-select drag detection (left button, move > 4px)
            if (this.leftDown) {
                var d = Math.abs(pos.x - this.dragStartX) + Math.abs(pos.y - this.dragStartY);
                if (d > 4) {
                    this.isDragging = true;
                }
                this.dragEndX = pos.x;
                this.dragEndY = pos.y;
            }

            // Update world coords if camera is available
            if (S.Camera && S.screenToWorld) {
                var canvas = this._canvas;
                var w = S.screenToWorld(pos.x, pos.y, S.Camera,
                                        canvas.width, canvas.height);
                this.worldX = w.x;
                this.worldY = w.y;
            }
        },

        _onWheel: function(e) {
            e.preventDefault();
            if (!S.Camera) return;
            if (e.deltaY < 0) {
                S.Camera.zoomIn();
            } else {
                S.Camera.zoomOut();
            }
        },

        _onKeyDown: function(e) {
            var k = e.key;
            if (!this._keys[k]) {
                this._keysPressed[k] = true;
            }
            this._keys[k] = true;
        },

        _onKeyUp: function(e) {
            this._keys[e.key] = false;
        },

        // ----------------------------------------------------------------
        // Public API
        // ----------------------------------------------------------------

        /** Is a key currently held? (use e.key string, e.g. 'ArrowLeft') */
        isKeyDown: function(key) {
            return !!this._keys[key];
        },

        /** Was a key pressed this frame (single-fire)? */
        wasKeyPressed: function(key) {
            return !!this._keysPressed[key];
        },

        /** Returns { x, y } world coords under the mouse. */
        getMouseWorld: function() {
            return { x: this.worldX, y: this.worldY };
        },

        /**
         * Returns the box-select rectangle in screen coords.
         * { x, y, w, h } with positive width/height regardless of drag direction.
         */
        getDragRect: function() {
            var x = Math.min(this.dragStartX, this.dragEndX);
            var y = Math.min(this.dragStartY, this.dragEndY);
            var w = Math.abs(this.dragEndX - this.dragStartX);
            var h = Math.abs(this.dragEndY - this.dragStartY);
            return { x: x, y: y, w: w, h: h };
        },

        /**
         * Called at the end of every frame to flush single-frame state.
         */
        update: function() {
            this.leftClick    = null;
            this.rightClick   = null;
            this._keysPressed = {};
        },

        // ----------------------------------------------------------------
        // Helpers
        // ----------------------------------------------------------------
        _canvasPos: function(e) {
            var rect   = this._canvas.getBoundingClientRect();
            // Scale for CSS size vs actual pixel size
            var scaleX = this._canvas.width  / rect.width;
            var scaleY = this._canvas.height / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top)  * scaleY
            };
        }
    };

}(window.Syndicate));
