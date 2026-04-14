window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // Spread offsets for formation-ish multi-agent moves (tile units)
    var FORMATION_OFFSETS = [
        { x:  0,    y:  0   },
        { x:  0.7,  y:  0   },
        { x: -0.7,  y:  0   },
        { x:  0,    y:  0.7 }
    ];

    // Click radius in world-tile units to hit an entity
    var PICK_RADIUS = 0.65;

    /**
     * Agent selection + order-issuing system.
     *
     * Expected to be called each frame with up-to-date agents / input / camera.
     * Modifies agent.selected and agent.state directly.
     */
    S.Selection = {

        // Public state
        selectedAgents : [],
        boxSelecting   : false,
        boxStartX      : 0,   // screen coords
        boxStartY      : 0,
        boxCurrentX    : 0,
        boxCurrentY    : 0,

        // Internal drag tracking
        _mouseDownX    : 0,
        _mouseDownY    : 0,
        _isDragging    : false,
        _tabIndex      : 0,   // for Tab cycling

        // ------------------------------------------------------------------
        // Main update – call every frame.
        //
        // agents  : array of Syndicate.Agent instances
        // enemies : array of enemy / civilian entities (for attack targeting)
        // input   : Syndicate.Input (or compatible wrapper)
        // camera  : Syndicate.Camera (or compatible object with .zoom)
        // map     : tile map (for pathfinding)
        // world   : world context passed to pathfinding
        // ------------------------------------------------------------------
        update: function(agents, enemies, input, camera, map, world) {
            if (!input) return;

            this._handleKeyboard(agents, input);
            this._handleMouse(agents, enemies, input, camera, map, world);
        },

        // ------------------------------------------------------------------
        // Keyboard shortcuts
        // ------------------------------------------------------------------
        _handleKeyboard: function(agents, input) {
            // 1-4: select individual agent by index
            for (var i = 1; i <= 4; i++) {
                if (input.isKeyJustPressed('Digit' + i) ||
                    input.isKeyJustPressed('Key'   + i) ||
                    input.isKeyJustPressed(String(i))) {

                    var agent = this._agentByIndex(agents, i - 1);
                    if (agent) {
                        if (!input.isShiftHeld()) {
                            this._deselectAll(agents);
                        }
                        this._selectAgent(agent);
                    }
                }
            }

            // Ctrl+A: select all alive agents
            if ((input.isCtrlHeld() || input.isKeyHeld('ControlLeft') ||
                 input.isKeyHeld('ControlRight')) &&
                 input.isKeyJustPressed('KeyA')) {
                this._deselectAll(agents);
                agents.forEach(function(a) {
                    if (a.alive) this._selectAgent(a);
                }, this);
            }

            // Tab: cycle selection through alive agents
            if (input.isKeyJustPressed('Tab')) {
                var alive = agents.filter(function(a) { return a.alive; });
                if (alive.length > 0) {
                    this._tabIndex = (this._tabIndex + 1) % alive.length;
                    if (!input.isShiftHeld()) {
                        this._deselectAll(agents);
                    }
                    this._selectAgent(alive[this._tabIndex]);
                }
            }

            // Escape: deselect all
            if (input.isKeyJustPressed('Escape')) {
                this._deselectAll(agents);
            }
        },

        // ------------------------------------------------------------------
        // Mouse handling
        // ------------------------------------------------------------------
        _handleMouse: function(agents, enemies, input, camera, map, world) {
            var mousePos = input.getMousePosition ? input.getMousePosition() : null;
            if (!mousePos) return;

            var mx = mousePos.x;
            var my = mousePos.y;

            // ---- Mouse button just pressed ------------------------------
            if (input.isMouseJustPressed(0)) {
                this._mouseDownX = mx;
                this._mouseDownY = my;
                this._isDragging = false;
            }

            // ---- Drag detection ----------------------------------------
            if (input.isMouseHeld(0) && !this._isDragging) {
                var ddx = mx - this._mouseDownX;
                var ddy = my - this._mouseDownY;
                if (Math.sqrt(ddx * ddx + ddy * ddy) > 5) {
                    this._isDragging  = true;
                    this.boxSelecting = true;
                    this.boxStartX    = this._mouseDownX;
                    this.boxStartY    = this._mouseDownY;
                }
            }

            if (this._isDragging && this.boxSelecting) {
                this.boxCurrentX = mx;
                this.boxCurrentY = my;
            }

            // ---- Mouse button released ----------------------------------
            if (input.isMouseJustReleased(0)) {
                if (this._isDragging && this.boxSelecting) {
                    // Complete box selection
                    this._completeBoxSelect(agents, camera);
                    this.boxSelecting = false;
                    this._isDragging  = false;
                } else {
                    // Single click
                    var worldPos = S.screenToWorld(mx, my, camera);
                    this._handleClick(agents, enemies, input, camera, map, world,
                                      worldPos.x, worldPos.y, mx, my);
                }
            }

            // ---- Right click: quick move / attack ----------------------
            if (input.isMouseJustPressed ? input.isMouseJustPressed(2)
                                         : false) {
                if (this.selectedAgents.length > 0) {
                    var wp = S.screenToWorld(mx, my, camera);
                    // Check if clicking on an enemy
                    var clickedEnemy = this._pickEntity(enemies, wp.x, wp.y);
                    if (clickedEnemy && clickedEnemy.type !== S.ENTITY_TYPE.AGENT) {
                        this.issueAttack(agents, clickedEnemy, map, world);
                    } else {
                        this.issueMove(agents, wp.x, wp.y, map, world);
                    }
                }
            }
        },

        // ------------------------------------------------------------------
        // Handle a single left-click in world space
        // ------------------------------------------------------------------
        _handleClick: function(agents, enemies, input, camera, map, world,
                               wx, wy, sx, sy) {

            var shift = input.isShiftHeld ? input.isShiftHeld() : false;

            // Did we click on an agent?
            var clickedAgent = this._pickAgent(agents, wx, wy);
            if (clickedAgent) {
                if (shift) {
                    // Toggle selection
                    if (clickedAgent.selected) {
                        this._deselectAgent(clickedAgent);
                    } else {
                        this._selectAgent(clickedAgent);
                    }
                } else {
                    this._deselectAll(agents);
                    this._selectAgent(clickedAgent);
                }
                return;
            }

            // Did we click on an enemy with agents selected?
            if (this.selectedAgents.length > 0) {
                var clickedTarget = this._pickEntity(enemies, wx, wy);
                if (clickedTarget && clickedTarget.alive &&
                    clickedTarget.type !== S.ENTITY_TYPE.AGENT) {
                    this.issueAttack(agents, clickedTarget, map, world);
                    return;
                }
            }

            // Clicked on empty ground – issue move if agents selected
            if (this.selectedAgents.length > 0) {
                this.issueMove(agents, wx, wy, map, world);
            } else {
                // Deselect on empty click when nothing selected
                this._deselectAll(agents);
            }
        },

        // ------------------------------------------------------------------
        // Box selection: select all agents inside the screen-space rectangle
        // ------------------------------------------------------------------
        _completeBoxSelect: function(agents, camera) {
            var x1 = Math.min(this.boxStartX,   this.boxCurrentX);
            var y1 = Math.min(this.boxStartY,   this.boxCurrentY);
            var x2 = Math.max(this.boxStartX,   this.boxCurrentX);
            var y2 = Math.max(this.boxStartY,   this.boxCurrentY);

            // Only clear & reselect if the box has meaningful size
            if ((x2 - x1) < 4 && (y2 - y1) < 4) return;

            this._deselectAll(agents);

            agents.forEach(function(a) {
                if (!a.alive) return;
                var sp = a.getScreenPos(camera);
                if (sp.sx >= x1 && sp.sx <= x2 &&
                    sp.sy >= y1 && sp.sy <= y2) {
                    this._selectAgent(a);
                }
            }, this);
        },

        // ------------------------------------------------------------------
        // issueMove: pathfind each selected agent toward the target position
        // with a small formation spread.
        // ------------------------------------------------------------------
        issueMove: function(agents, worldX, worldY, map, world) {
            var sel = this.selectedAgents.filter(function(a) { return a.alive; });

            sel.forEach(function(agent, idx) {
                var offset = FORMATION_OFFSETS[idx % FORMATION_OFFSETS.length];
                var tx = worldX + offset.x;
                var ty = worldY + offset.y;

                if (map && S.Movement) {
                    var path = S.Movement.findPath(map, agent.x, agent.y, tx, ty);
                    if (path.length > 0) {
                        path = S.Movement.smoothPath(map, path);
                    }
                    agent.path      = path;
                    agent.pathIndex = 0;
                    agent.state     = path.length > 0
                        ? S.AGENT_STATE.MOVING
                        : S.AGENT_STATE.IDLE;
                } else {
                    // No map – direct waypoint
                    agent.path      = [{ x: tx, y: ty }];
                    agent.pathIndex = 0;
                    agent.state     = S.AGENT_STATE.MOVING;
                }

                // Clear any existing attack target so movement takes priority
                agent.target = null;
            });
        },

        // ------------------------------------------------------------------
        // issueAttack: set each selected agent to attack a specific target
        // ------------------------------------------------------------------
        issueAttack: function(agents, targetEntity, map, world) {
            this.selectedAgents.forEach(function(agent) {
                if (!agent.alive) return;
                agent.target = targetEntity;
                agent.state  = S.AGENT_STATE.ATTACKING;
            });
        },

        // ------------------------------------------------------------------
        // Render: draw box-select rectangle and agent index labels
        // ------------------------------------------------------------------
        render: function(ctx, agents, camera) {
            // Box select overlay
            if (this.boxSelecting) {
                var x1 = Math.min(this.boxStartX,   this.boxCurrentX);
                var y1 = Math.min(this.boxStartY,   this.boxCurrentY);
                var w  = Math.abs(this.boxCurrentX  - this.boxStartX);
                var h  = Math.abs(this.boxCurrentY  - this.boxStartY);

                ctx.save();
                ctx.strokeStyle = 'rgba(0,255,255,0.8)';
                ctx.lineWidth   = 1.5;
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur  = 6;
                ctx.fillStyle   = 'rgba(0,255,255,0.06)';
                ctx.fillRect(x1, y1, w, h);
                ctx.strokeRect(x1, y1, w, h);
                ctx.restore();
            }
        },

        // ------------------------------------------------------------------
        // Internal helpers
        // ------------------------------------------------------------------

        _selectAgent: function(agent) {
            agent.selected = true;
            if (this.selectedAgents.indexOf(agent) === -1) {
                this.selectedAgents.push(agent);
            }
        },

        _deselectAgent: function(agent) {
            agent.selected = false;
            var idx = this.selectedAgents.indexOf(agent);
            if (idx !== -1) this.selectedAgents.splice(idx, 1);
        },

        _deselectAll: function(agents) {
            if (agents) {
                agents.forEach(function(a) { a.selected = false; });
            } else {
                this.selectedAgents.forEach(function(a) { a.selected = false; });
            }
            this.selectedAgents = [];
        },

        _agentByIndex: function(agents, index) {
            for (var i = 0; i < agents.length; i++) {
                if (agents[i].index === index) return agents[i];
            }
            return null;
        },

        _pickAgent: function(agents, wx, wy) {
            var best     = null;
            var bestDist = PICK_RADIUS;
            agents.forEach(function(a) {
                if (!a.alive) return;
                var dx = a.x - wx;
                var dy = a.y - wy;
                var d  = Math.sqrt(dx * dx + dy * dy);
                if (d < bestDist) {
                    bestDist = d;
                    best     = a;
                }
            });
            return best;
        },

        _pickEntity: function(entities, wx, wy) {
            var best     = null;
            var bestDist = PICK_RADIUS;
            if (!entities) return null;
            entities.forEach(function(e) {
                if (!e || !e.alive) return;
                var dx = e.x - wx;
                var dy = e.y - wy;
                var d  = Math.sqrt(dx * dx + dy * dy);
                if (d < bestDist) {
                    bestDist = d;
                    best     = e;
                }
            });
            return best;
        }
    };

}(window.Syndicate));
