window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Mission Screen – ties every system together for in-mission gameplay
    // -------------------------------------------------------------------------

    // Camera pan speed in screen pixels per second when using keyboard
    var CAM_PAN_SPEED = 300;

    // Seconds to show the result banner before switching to DEBRIEF
    var RESULT_DISPLAY_TIME = 2.5;

    // Default mission data used when none is supplied
    var DEFAULT_MISSION = {
        id          : 'default',
        name        : 'Recon',
        seed        : 42,
        reward      : 100000,
        enemyCount  : 6,
        enemyWeapon : 'pistol',
        civilianCount: 10,
        objectives  : [
            { type: 'KILL_ALL', text: 'Eliminate all hostiles' }
        ],
        bonusObjectives: [
            { type: 'PERSUADE_COUNT', count: 3, text: 'Persuade 3 civilians', reward: 25000 }
        ]
    };

    S.Screens = S.Screens || {};

    S.Screens.Mission = {

        world          : null,
        missionData    : null,
        isPaused       : false,
        missionStarted : false,
        showingResults : false,
        resultTimer    : 0,
        _missionResult : null,

        // ------------------------------------------------------------------
        // enter – called by the engine when switching to MISSION screen
        //
        // Can be called with missionData passed via S.Screens.Mission._pendingMission
        // or through a direct argument (caller sets _pendingMission before switchScreen).
        // ------------------------------------------------------------------
        enter: function() {
            var missionData = this._pendingMission || DEFAULT_MISSION;
            this._pendingMission = null;

            this.missionData   = missionData;
            this.isPaused      = false;
            this.showingResults = false;
            this.resultTimer   = 0;
            this._missionResult = null;
            this.missionStarted = false;

            // Generate map
            var seed = missionData.seed || Math.floor(Math.random() * 99999);
            var map  = S.generateMap(seed, missionData.mapParams || {});

            // Initialise world
            var gameState = S.GameState;
            S.World.init(map, missionData, gameState);

            // Initialise mission manager
            S.MissionManager.startMission(missionData);

            // Initialise tile cache (safe to call repeatedly)
            if (S.initTileCache) S.initTileCache();

            // Initialise minimap
            if (S.Minimap) S.Minimap.init(map);

            // Reset selection
            if (S.Selection) {
                S.Selection.selectedAgents = [];
                S.Selection.boxSelecting   = false;
            }

            // Centre camera on the first living agent, else map centre
            var agents = S.World.getPlayerAgents();
            if (agents.length > 0) {
                S.Camera.centerOn(agents[0].x, agents[0].y);
                // Snap immediately (no smooth pan on first enter)
                var iso = S.worldToIso(agents[0].x, agents[0].y);
                S.Camera.x      = iso.x;
                S.Camera.y      = iso.y;
                S.Camera.targetX = iso.x;
                S.Camera.targetY = iso.y;
            } else {
                S.Camera.centerOn(S.MAP_SIZE / 2, S.MAP_SIZE / 2);
            }

            // Show mission start alert
            if (S.HUD) {
                S.HUD.alerts = [];
                S.HUD.showAlert('MISSION: ' + (missionData.name || 'UNKNOWN').toUpperCase(),
                    S.COLORS.NEON_CYAN, 3.0);
            }

            this.missionStarted = true;
        },

        // ------------------------------------------------------------------
        // update – called every frame by the engine
        // ------------------------------------------------------------------
        update: function(dt) {
            if (this.showingResults) {
                this.resultTimer -= dt;
                if (this.resultTimer <= 0) {
                    // Switch to DEBRIEF screen
                    if (S.Screens.Debrief) {
                        S.Screens.Debrief._pendingResult = this._missionResult;
                    }
                    S.switchScreen(S.SCREEN.DEBRIEF);
                }
                return;
            }

            if (this.isPaused) return;

            // ---- HUD input (consume input before selection/camera) ------
            var hudConsumed = false;
            if (S.HUD) {
                S.HUD.updateAlerts(dt);
                hudConsumed = S.HUD.handleInput(S.Input, S.World.agents);
            }

            // ---- Minimap click -----------------------------------------
            if (!hudConsumed && S.Input.leftClick && S.Minimap) {
                var cw = S.Renderer.getWidth();
                var miniClick = S.Minimap.handleClick(
                    S.Input.leftClick.x, S.Input.leftClick.y,
                    S.Camera, cw
                );
                if (miniClick) hudConsumed = true;
            }

            // ---- Selection / agent commands ----------------------------
            if (!hudConsumed && S.Selection) {
                S.Selection.update(
                    S.World.agents,
                    S.World.enemies.concat(S.World.civilians),
                    S.Input,
                    S.Camera,
                    S.World.map,
                    S.World
                );
            }

            // ---- Camera pan (WASD / Arrow keys) ------------------------
            this._handleCameraInput(dt);

            // ---- Escape → deselect or pause ----------------------------
            if (S.Input.wasKeyPressed('Escape')) {
                if (S.Selection && S.Selection.selectedAgents.length > 0) {
                    S.Selection._deselectAll(S.World.agents);
                } else {
                    this.isPaused = !this.isPaused;
                    if (S.HUD) {
                        S.HUD.showAlert(this.isPaused ? 'PAUSED' : 'RESUMED',
                            S.COLORS.NEON_AMBER, 1.2);
                    }
                }
            }

            // ---- World update ------------------------------------------
            S.World.update(dt);

            // ---- Mission manager update --------------------------------
            S.MissionManager.update(dt, S.World);

            // ---- Check for mission complete / failed -------------------
            this._checkMissionEnd();
        },

        // ------------------------------------------------------------------
        // render – draw everything each frame
        // ------------------------------------------------------------------
        render: function() {
            var renderer = S.Renderer;
            var ctx      = renderer.getContext();
            var canvas   = renderer.getCanvas();
            var cw       = renderer.getWidth();
            var ch       = renderer.getHeight();

            // Clear
            renderer.clear();

            // ---- World rendering (with camera transform) ---------------
            renderer.applyCameraTransform(S.Camera);

            // Map tiles
            if (S.renderMap && S.World.map) {
                S.renderMap(ctx, S.World.map, S.Camera);
            }

            // Entities sorted by depth
            this._renderEntities(ctx);

            // Effects (particles) — rendered in world space
            if (S.Effects) {
                S.Effects.render(ctx, S.Camera);
            }

            renderer.resetTransform();

            // ---- HUD overlay (no camera transform) ---------------------

            // Minimap
            if (S.Minimap) {
                S.Minimap.render(ctx, S.World.map, S.World.entities, S.Camera, cw);
            }

            // Selection box
            if (S.Selection) {
                S.Selection.render(ctx, S.World.agents, S.Camera);
            }

            // HUD bottom panel + objectives + alerts
            if (S.HUD) {
                S.HUD.render(
                    ctx, canvas,
                    S.World,
                    S.MissionManager,
                    S.Selection ? S.Selection.selectedAgents : []
                );
            }

            // Pause overlay
            if (this.isPaused) {
                this._renderPauseOverlay(ctx, cw, ch);
            }

            // Mission result banner
            if (this.showingResults && this._missionResult) {
                this._renderResultBanner(ctx, cw, ch);
            }
        },

        // ------------------------------------------------------------------
        // exit – clean up when leaving the mission screen
        // ------------------------------------------------------------------
        exit: function() {
            // Save agent state back to GameState
            if (S.GameState && S.World && S.World.agents) {
                S.World.agents.forEach(function(agent, i) {
                    S.GameState.updateAgentData(i, {
                        health      : Math.max(0, agent.health),
                        intelligence: agent.intelligence,
                        perception  : agent.perception,
                        adrenaline  : agent.adrenaline,
                        cybernetics : S.deepCopy(agent.cybernetics),
                        weaponType  : agent.weapon ? agent.weapon.type : 'pistol'
                    });
                });
                S.GameState.save();
            }

            // Clear selection
            if (S.Selection) {
                S.Selection.selectedAgents = [];
                S.Selection.boxSelecting   = false;
            }

            this.missionStarted = false;
        },

        // ------------------------------------------------------------------
        // _handleCameraInput – WASD / Arrow key panning, scroll zoom
        // ------------------------------------------------------------------
        _handleCameraInput: function(dt) {
            var input = S.Input;
            var speed = CAM_PAN_SPEED * dt;

            if (input.isKeyDown('ArrowLeft')  || input.isKeyDown('a') || input.isKeyDown('A')) {
                S.Camera.pan(-speed, 0);
            }
            if (input.isKeyDown('ArrowRight') || input.isKeyDown('d') || input.isKeyDown('D')) {
                S.Camera.pan(speed, 0);
            }
            if (input.isKeyDown('ArrowUp')    || input.isKeyDown('w') || input.isKeyDown('W')) {
                S.Camera.pan(0, -speed);
            }
            if (input.isKeyDown('ArrowDown')  || input.isKeyDown('s') || input.isKeyDown('S')) {
                S.Camera.pan(0, speed);
            }

            // Zoom with +/-
            if (input.wasKeyPressed('+') || input.wasKeyPressed('=')) {
                S.Camera.zoomIn();
            }
            if (input.wasKeyPressed('-') || input.wasKeyPressed('_')) {
                S.Camera.zoomOut();
            }

            // Press F to follow first selected agent
            if (input.wasKeyPressed('f') || input.wasKeyPressed('F')) {
                var sel = S.Selection && S.Selection.selectedAgents;
                if (sel && sel.length > 0 && sel[0].alive) {
                    S.Camera.centerOn(sel[0].x, sel[0].y);
                }
            }
        },

        // ------------------------------------------------------------------
        // _renderEntities – sorted painter's-algorithm pass
        // ------------------------------------------------------------------
        _renderEntities: function(ctx) {
            // Collect non-removed, non-projectile entities and sort by depth
            var toRender = S.World.entities.filter(function(e) {
                return !e.removed;
            });

            // Sort ascending by depth key (lower depth = drawn first)
            toRender.sort(function(a, b) {
                return S.getDepthKey(a.x, a.y) - S.getDepthKey(b.x, b.y);
            });

            var camera = S.Camera;
            for (var i = 0; i < toRender.length; i++) {
                var e = toRender[i];
                if (e.render) {
                    e.render(ctx, camera);
                }
            }
        },

        // ------------------------------------------------------------------
        // _checkMissionEnd – detect win/loss and trigger result display
        // ------------------------------------------------------------------
        _checkMissionEnd: function() {
            if (this.showingResults) return;

            if (S.MissionManager.missionComplete || S.MissionManager.missionFailed) {
                var result = S.MissionManager.getMissionResult(S.World);
                this._missionResult = result;
                this.showingResults = true;
                this.resultTimer    = RESULT_DISPLAY_TIME;

                // Record mission in GameState if successful
                if (result.success && S.GameState) {
                    var mId = this.missionData && this.missionData.id;
                    if (mId) {
                        S.GameState.completeMission(mId, result.reward);
                        S.GameState.save();
                    }
                }

                // Show HUD alert
                if (S.HUD) {
                    if (result.success) {
                        S.HUD.showAlert('MISSION COMPLETE', S.COLORS.NEON_GREEN, RESULT_DISPLAY_TIME);
                    } else {
                        S.HUD.showAlert('MISSION FAILED', '#ff2040', RESULT_DISPLAY_TIME);
                    }
                }
            }

            // Also show tactical alerts for notable events
            this._checkTacticalAlerts();
        },

        // ------------------------------------------------------------------
        // _checkTacticalAlerts – "AGENT DOWN", "ENEMY DETECTED" etc.
        // ------------------------------------------------------------------
        _checkTacticalAlerts: function() {
            if (!S.HUD) return;

            // Track which agents were alive last frame
            if (!this._prevAgentAlive) {
                this._prevAgentAlive = {};
                S.World.agents.forEach(function(a) {
                    this._prevAgentAlive[a.id] = a.alive;
                }, this);
                return;
            }

            S.World.agents.forEach(function(agent) {
                var wasAlive = this._prevAgentAlive[agent.id];
                if (wasAlive && !agent.alive) {
                    S.HUD.showAlert('AGENT ' + (agent.name || 'DOWN').toUpperCase() + ' KIA',
                        '#ff2040', 3.0);
                }
                this._prevAgentAlive[agent.id] = agent.alive;
            }, this);

            // Enemy detection alerts (first time any enemy enters ALERT/CHASE)
            if (!this._enemyAlertedIds) this._enemyAlertedIds = {};
            S.World.enemies.forEach(function(enemy) {
                if (!this._enemyAlertedIds[enemy.id] &&
                    (enemy.state === S.AI_STATE.ALERT || enemy.state === S.AI_STATE.CHASE)) {
                    this._enemyAlertedIds[enemy.id] = true;
                    S.HUD.showAlert('ENEMY DETECTED', S.COLORS.NEON_AMBER, 1.8);
                }
            }, this);
        },

        // ------------------------------------------------------------------
        // _renderPauseOverlay
        // ------------------------------------------------------------------
        _renderPauseOverlay: function(ctx, cw, ch) {
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,10,0.55)';
            ctx.fillRect(0, 0, cw, ch);

            ctx.font         = '32px monospace';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle    = S.COLORS.NEON_AMBER;
            ctx.shadowColor  = S.COLORS.NEON_AMBER;
            ctx.shadowBlur   = 18;
            ctx.fillText('PAUSED', cw / 2, ch / 2);

            ctx.font        = '14px monospace';
            ctx.fillStyle   = '#888899';
            ctx.shadowBlur  = 0;
            ctx.fillText('PRESS ESC TO RESUME', cw / 2, ch / 2 + 38);

            ctx.restore();
        },

        // ------------------------------------------------------------------
        // _renderResultBanner – mission complete / failed overlay
        // ------------------------------------------------------------------
        _renderResultBanner: function(ctx, cw, ch) {
            var result = this._missionResult;
            var success = result && result.success;

            // Fade in
            var elapsed = RESULT_DISPLAY_TIME - this.resultTimer;
            var alpha   = Math.min(1, elapsed * 1.5);

            ctx.save();
            ctx.globalAlpha = alpha;

            // Dark overlay
            ctx.fillStyle = 'rgba(0,0,10,0.7)';
            ctx.fillRect(0, 0, cw, ch);

            // Banner box
            var bx = cw / 2 - 240;
            var by = ch / 2 - 80;
            var bw = 480;
            var bh = 160;

            var bannerColor = success ? S.COLORS.NEON_GREEN : '#ff2040';
            ctx.fillStyle   = 'rgba(5,5,20,0.92)';
            ctx.fillRect(bx, by, bw, bh);
            ctx.strokeStyle = bannerColor;
            ctx.lineWidth   = 2;
            ctx.shadowColor = bannerColor;
            ctx.shadowBlur  = 16;
            ctx.strokeRect(bx, by, bw, bh);
            ctx.shadowBlur  = 0;

            // Title
            ctx.font         = '28px monospace';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle    = bannerColor;
            ctx.shadowColor  = bannerColor;
            ctx.shadowBlur   = 12;
            ctx.fillText(success ? 'MISSION COMPLETE' : 'MISSION FAILED', cw / 2, by + 16);
            ctx.shadowBlur   = 0;

            if (result) {
                ctx.font      = '13px monospace';
                ctx.fillStyle = '#aaaacc';
                ctx.textBaseline = 'top';

                var lineY = by + 58;
                var lineH = 18;

                ctx.fillText('REWARD: ' + S.formatMoney(result.reward),
                    cw / 2, lineY);
                ctx.fillText('TIME: ' + this._formatTime(result.time),
                    cw / 2, lineY + lineH);
                ctx.fillText('OBJECTIVES: ' + result.objectivesCompleted + '/' + result.objectivesTotal,
                    cw / 2, lineY + lineH * 2);
                ctx.fillText('AGENTS LOST: ' + result.agentsLost,
                    cw / 2, lineY + lineH * 3);
            }

            ctx.restore();
        },

        // ------------------------------------------------------------------
        // _formatTime – convert seconds to "M:SS" string
        // ------------------------------------------------------------------
        _formatTime: function(seconds) {
            var t = Math.floor(seconds || 0);
            var m = Math.floor(t / 60);
            var s = t % 60;
            return m + ':' + (s < 10 ? '0' : '') + s;
        }
    };

    // Register the mission screen with the engine
    S.registerScreen(S.SCREEN.MISSION, S.Screens.Mission);

}(window.Syndicate));
