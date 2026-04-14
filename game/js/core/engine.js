window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Engine – main loop and screen state machine
    // -------------------------------------------------------------------------

    var _currentScreen = null;
    var _currentName   = null;
    var _screens       = {};

    // Loop timing
    var _lastTime  = 0;
    var _paused    = false;
    var _rafHandle = null;

    // FPS counter
    var _showFPS    = false;
    var _fpsFrames  = 0;
    var _fpsElapsed = 0;
    var _fpsDisplay = 0;

    // ------------------------------------------------------------------
    // Screen registry
    // ------------------------------------------------------------------

    /**
     * Register a screen object.  It must expose: enter(), exit(), update(dt), render().
     */
    S.registerScreen = function(name, screenObj) {
        _screens[name] = screenObj;
    };

    /**
     * Switch to a named screen.  Calls exit() on the current screen (if any)
     * and enter() on the new one.
     */
    S.switchScreen = function(name) {
        if (_currentScreen && typeof _currentScreen.exit === 'function') {
            _currentScreen.exit();
        }
        var next = _screens[name];
        if (!next) {
            console.warn('[Engine] Unknown screen:', name);
            _currentScreen = null;
            _currentName   = null;
            return;
        }
        _currentScreen = next;
        _currentName   = name;
        if (typeof _currentScreen.enter === 'function') {
            _currentScreen.enter();
        }
    };

    /** Returns the name of the currently active screen. */
    S.getCurrentScreen = function() { return _currentName; };

    // ------------------------------------------------------------------
    // Pause support
    // ------------------------------------------------------------------
    S.setPaused = function(val) { _paused = val; };
    S.isPaused  = function()    { return _paused; };
    S.togglePause = function()  { _paused = !_paused; };

    // ------------------------------------------------------------------
    // Main loop
    // ------------------------------------------------------------------

    function _loop(timestamp) {
        _rafHandle = requestAnimationFrame(_loop);

        // Compute dt (seconds), cap to avoid spiral-of-death
        var dt = (timestamp - _lastTime) / 1000;
        if (dt > S.MAX_DT) dt = S.MAX_DT;
        _lastTime = timestamp;

        // FPS accounting
        _fpsFrames++;
        _fpsElapsed += dt;
        if (_fpsElapsed >= 0.5) {
            _fpsDisplay = Math.round(_fpsFrames / _fpsElapsed);
            _fpsFrames  = 0;
            _fpsElapsed = 0;
        }

        // Camera always updates (smooth pan continues even when paused in menus)
        if (S.Camera) { S.Camera.update(dt); }

        // Update current screen (skip if paused — except render so we see freeze frame)
        if (_currentScreen) {
            if (!_paused && typeof _currentScreen.update === 'function') {
                _currentScreen.update(dt);
            }
            if (typeof _currentScreen.render === 'function') {
                _currentScreen.render();
            }
        } else {
            // No screen – just clear to black
            if (S.Renderer) { S.Renderer.clear(); }
        }

        // Draw paused overlay
        if (_paused && S.Renderer) {
            S.Renderer.drawText('PAUSED', S.Renderer.getWidth() / 2,
                                S.Renderer.getHeight() / 2 - 10,
                                S.COLORS.NEON_AMBER, 32, 'center');
        }

        // FPS overlay (toggle with backtick)
        if (_showFPS && S.Renderer) {
            S.Renderer.drawText('FPS: ' + _fpsDisplay, 8, 8,
                                S.COLORS.NEON_GREEN, 12, 'left');
        }

        // Flush single-frame input state
        if (S.Input) { S.Input.update(); }
    }

    // ------------------------------------------------------------------
    // Keyboard global shortcuts
    // ------------------------------------------------------------------
    window.addEventListener('keydown', function(e) {
        // Backtick toggles FPS display
        if (e.key === '`') { _showFPS = !_showFPS; }

        // Space toggles pause (only in mission)
        if (e.key === ' ' && _currentName === S.SCREEN.MISSION) {
            S.togglePause();
        }
    });

    // ------------------------------------------------------------------
    // Initialisation (called by window.onload)
    // ------------------------------------------------------------------
    S.init = function() {
        // Bootstrap renderer
        S.Renderer.init();

        var canvas = S.Renderer.getCanvas();
        var w      = S.Renderer.getWidth();
        var h      = S.Renderer.getHeight();

        // Bootstrap input
        S.Input.init(canvas);

        // Bootstrap camera
        S.Camera.init(w, h);

        // Pre-render tile cache (tiles.js)
        if (S.initTileCache)    { S.initTileCache();   }

        // Pre-render sprite cache (sprites.js)
        if (S.initSpriteCache)  { S.initSpriteCache(); }

        // Minimap init will happen when a map is loaded
        // (called from mission screen with the generated map)

        // Switch to title screen (or just sit on black canvas if not registered)
        if (_screens[S.SCREEN.TITLE]) {
            S.switchScreen(S.SCREEN.TITLE);
        }

        // Start the loop
        _lastTime = performance.now();
        _rafHandle = requestAnimationFrame(_loop);
    };

    // Kick off when the DOM is ready
    window.addEventListener('load', function() {
        S.init();
    });

}(window.Syndicate));
