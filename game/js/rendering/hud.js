window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // HUD – in-mission heads-up display
    // -------------------------------------------------------------------------

    var PANEL_HEIGHT  = 130;   // bottom panel height in pixels
    var SLOT_WIDTH    = 180;   // width per agent slot
    var SLIDER_W      = 15;    // IPA slider bar width
    var SLIDER_H      = 80;    // IPA slider bar height
    var SLIDER_MARGIN = 8;     // gap between sliders

    // Alert fade speed (alpha units per second)
    var ALERT_FADE    = 1.2;

    S.HUD = {

        // Track which IPA slider is being dragged: null | { agentIndex, stat }
        ipaSliderDragging: null,

        // Alert message queue
        alerts: [],

        // Internal: tracks which agent index was last interacted with via portrait click
        _portraitClickIdx: -1,

        // ------------------------------------------------------------------
        // render – draw the entire HUD onto ctx
        // ------------------------------------------------------------------
        render: function(ctx, canvas, world, missionManager, selectedAgents) {
            if (!ctx || !canvas) return;

            var cw = canvas.width;
            var ch = canvas.height;
            var panelY = ch - PANEL_HEIGHT;

            // ---- Bottom panel background --------------------------------
            ctx.save();
            ctx.fillStyle = 'rgba(5, 5, 15, 0.88)';
            ctx.fillRect(0, panelY, cw, PANEL_HEIGHT);
            ctx.strokeStyle = S.COLORS.NEON_CYAN;
            ctx.lineWidth   = 1;
            ctx.shadowColor = S.COLORS.NEON_CYAN;
            ctx.shadowBlur  = 6;
            ctx.beginPath();
            ctx.moveTo(0, panelY);
            ctx.lineTo(cw, panelY);
            ctx.stroke();
            ctx.shadowBlur  = 0;
            ctx.restore();

            // ---- Agent slots (left portion of panel) --------------------
            var agents = world ? world.agents : [];
            for (var i = 0; i < 4; i++) {
                this._renderAgentSlot(ctx, agents[i] || null, i, panelY, selectedAgents, cw);
            }

            // ---- IPA sliders (right portion, for the first selected agent) --
            var selectedAgent = (selectedAgents && selectedAgents.length > 0)
                ? selectedAgents[0]
                : null;
            if (selectedAgent) {
                this._renderIPASliders(ctx, selectedAgent, cw, panelY);
            }

            // ---- Weapon quick-info (near bottom-right, left of IPA) ------
            if (selectedAgent && selectedAgent.weapon) {
                this._renderWeaponInfo(ctx, selectedAgent, cw, panelY);
            }

            // ---- Top-left: mission objectives ----------------------------
            if (missionManager) {
                this._renderObjectives(ctx, missionManager);
            }

            // ---- Top-centre: mission time --------------------------------
            if (missionManager) {
                this._renderMissionTime(ctx, missionManager, cw);
            }

            // ---- Alert messages (centre screen) -------------------------
            this._renderAlerts(ctx, cw, ch);
        },

        // ------------------------------------------------------------------
        // _renderAgentSlot
        // ------------------------------------------------------------------
        _renderAgentSlot: function(ctx, agent, slotIndex, panelY, selectedAgents, cw) {
            var x   = slotIndex * SLOT_WIDTH + 8;
            var y   = panelY + 8;
            var w   = SLOT_WIDTH - 16;
            var h   = PANEL_HEIGHT - 16;

            var isSelected = selectedAgents && agent &&
                selectedAgents.indexOf(agent) !== -1;

            ctx.save();

            // Slot background
            ctx.fillStyle = isSelected
                ? 'rgba(0,255,255,0.08)'
                : 'rgba(20,20,40,0.7)';
            ctx.fillRect(x, y, w, h);

            // Border
            ctx.strokeStyle = isSelected ? S.COLORS.NEON_CYAN : '#334466';
            ctx.lineWidth   = isSelected ? 2 : 1;
            if (isSelected) {
                ctx.shadowColor = S.COLORS.NEON_CYAN;
                ctx.shadowBlur  = 8;
            }
            ctx.strokeRect(x, y, w, h);
            ctx.shadowBlur = 0;

            // Slot index hint (small top-left corner number)
            ctx.font      = '10px monospace';
            ctx.fillStyle = '#446688';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(slotIndex + 1, x + 4, y + 4);

            if (!agent) {
                // Empty slot
                ctx.fillStyle = '#334466';
                ctx.font      = '11px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('--', x + w / 2, y + h / 2);
                ctx.restore();
                return;
            }

            // Agent name
            var nameColor = agent.alive ? S.COLORS.NEON_CYAN : '#443333';
            ctx.font      = '11px monospace';
            ctx.fillStyle = nameColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            if (agent.alive) {
                ctx.shadowColor = S.COLORS.NEON_CYAN;
                ctx.shadowBlur  = 4;
            }
            ctx.fillText(agent.name || 'Agent', x + w / 2, y + 16);
            ctx.shadowBlur = 0;

            // Health bar
            var maxHp  = (typeof agent.getMaxHealth === 'function') ? agent.getMaxHealth() : agent.maxHealth || 100;
            var ratio  = agent.alive ? Math.max(0, agent.health / maxHp) : 0;
            var barX   = x + 6;
            var barY   = y + 32;
            var barW   = w - 12;
            var barH   = 8;

            ctx.fillStyle = '#111122';
            ctx.fillRect(barX, barY, barW, barH);

            var hpColor = ratio > 0.6 ? S.COLORS.NEON_GREEN
                        : ratio > 0.3 ? S.COLORS.NEON_AMBER
                        : '#ff2040';
            ctx.fillStyle = hpColor;
            if (agent.alive) {
                ctx.shadowColor = hpColor;
                ctx.shadowBlur  = 4;
            }
            ctx.fillRect(barX, barY, barW * ratio, barH);
            ctx.shadowBlur = 0;

            // HP label
            ctx.font      = '9px monospace';
            ctx.fillStyle = '#aaaacc';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            var hpText = agent.alive
                ? Math.ceil(agent.health) + '/' + Math.ceil(maxHp)
                : 'KIA';
            ctx.fillText(hpText, x + w - 6, barY + barH + 2);

            // Weapon name
            var weaponName = (agent.weapon && agent.weapon.name) || 'Unarmed';
            ctx.font      = '10px monospace';
            ctx.fillStyle = '#8888aa';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(weaponName, x + w / 2, barY + barH + 14);

            // State indicator
            var stateStr  = agent.state || 'IDLE';
            var stateColor = '#334455';
            if (stateStr === 'ATTACKING') stateColor = '#ff4444';
            else if (stateStr === 'MOVING') stateColor = '#44aaff';
            else if (stateStr === 'IDLE')   stateColor = '#448844';

            ctx.font      = '9px monospace';
            ctx.fillStyle = stateColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(stateStr, x + w / 2, y + h - 6);

            // Dead overlay
            if (!agent.alive) {
                ctx.fillStyle = 'rgba(80,0,0,0.35)';
                ctx.fillRect(x, y, w, h);
                // Red X
                ctx.strokeStyle = '#ff2020';
                ctx.lineWidth   = 2;
                ctx.shadowColor = '#ff2020';
                ctx.shadowBlur  = 6;
                ctx.beginPath();
                ctx.moveTo(x + 8,     y + 8);
                ctx.lineTo(x + w - 8, y + h - 8);
                ctx.moveTo(x + w - 8, y + 8);
                ctx.lineTo(x + 8,     y + h - 8);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            ctx.restore();
        },

        // ------------------------------------------------------------------
        // _renderIPASliders – three vertical draggable bars for I, P, A
        // ------------------------------------------------------------------
        _renderIPASliders: function(ctx, agent, cw, panelY) {
            // Place sliders in the right portion of the panel
            var totalW   = 3 * SLIDER_W + 2 * SLIDER_MARGIN + 36;  // 36 = labels area
            var startX   = cw - totalW - 220;   // leave room for weapon info
            var startY   = panelY + (PANEL_HEIGHT - SLIDER_H) / 2;

            var stats = [
                { key: 'intelligence', label: 'I', color: S.COLORS.NEON_CYAN    },
                { key: 'perception',   label: 'P', color: S.COLORS.NEON_GREEN   },
                { key: 'adrenaline',   label: 'A', color: '#ff4444'             }
            ];

            for (var i = 0; i < stats.length; i++) {
                var st  = stats[i];
                var sx  = startX + i * (SLIDER_W + SLIDER_MARGIN + 8);
                var val = agent[st.key] || 0;

                ctx.save();

                // Background track
                ctx.fillStyle = '#111122';
                ctx.strokeStyle = '#334455';
                ctx.lineWidth   = 1;
                ctx.fillRect(sx, startY, SLIDER_W, SLIDER_H);
                ctx.strokeRect(sx, startY, SLIDER_W, SLIDER_H);

                // Fill (from bottom)
                var fillH    = Math.round(SLIDER_H * val);
                var fillY    = startY + SLIDER_H - fillH;
                ctx.fillStyle = st.color;
                ctx.shadowColor = st.color;
                ctx.shadowBlur  = 6;
                ctx.globalAlpha = 0.85;
                ctx.fillRect(sx, fillY, SLIDER_W, fillH);
                ctx.globalAlpha = 1;
                ctx.shadowBlur  = 0;

                // Label above
                ctx.font      = '11px monospace';
                ctx.fillStyle = st.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.shadowColor  = st.color;
                ctx.shadowBlur   = 4;
                ctx.fillText(st.label, sx + SLIDER_W / 2, startY - 2);
                ctx.shadowBlur = 0;

                // Value below
                ctx.font      = '9px monospace';
                ctx.fillStyle = '#888899';
                ctx.textBaseline = 'top';
                ctx.fillText(Math.round(val * 100), sx + SLIDER_W / 2, startY + SLIDER_H + 3);

                ctx.restore();
            }
        },

        // ------------------------------------------------------------------
        // _renderWeaponInfo – weapon name and cooldown indicator
        // ------------------------------------------------------------------
        _renderWeaponInfo: function(ctx, agent, cw, panelY) {
            var weapon = agent.weapon;
            var x = cw - 200;
            var y = panelY + 12;

            ctx.save();

            ctx.font      = '11px monospace';
            ctx.fillStyle = S.COLORS.NEON_AMBER;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.shadowColor  = S.COLORS.NEON_AMBER;
            ctx.shadowBlur   = 4;
            ctx.fillText(weapon.name || 'WEAPON', cw - 16, y);
            ctx.shadowBlur = 0;

            // Cooldown bar (ready = full green, cooling = partial amber)
            var cdRatio = (agent.weaponCooldown > 0 && weapon.cooldown > 0)
                ? Math.max(0, 1 - agent.weaponCooldown / weapon.cooldown)
                : 1;
            var barW = 100;
            var barX = cw - 16 - barW;
            var barY = y + 16;

            ctx.fillStyle = '#111122';
            ctx.fillRect(barX, barY, barW, 5);

            var cdColor = cdRatio >= 1 ? S.COLORS.NEON_GREEN : S.COLORS.NEON_AMBER;
            ctx.fillStyle = cdColor;
            ctx.shadowColor = cdColor;
            ctx.shadowBlur  = 3;
            ctx.fillRect(barX, barY, barW * cdRatio, 5);
            ctx.shadowBlur = 0;

            ctx.font      = '9px monospace';
            ctx.fillStyle = cdRatio >= 1 ? '#44ff88' : '#ffaa44';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText(cdRatio >= 1 ? 'READY' : 'RELOAD', cw - 16, barY + 8);

            ctx.restore();
        },

        // ------------------------------------------------------------------
        // _renderObjectives – top-left checklist
        // ------------------------------------------------------------------
        _renderObjectives: function(ctx, missionManager) {
            var objectives = missionManager.getObjectiveStatus
                ? missionManager.getObjectiveStatus()
                : [];
            if (objectives.length === 0) return;

            var ox = 12;
            var oy = 12;
            var lineH = 18;

            ctx.save();
            ctx.font = '11px monospace';
            ctx.textBaseline = 'top';

            // Panel background
            var panelW = 260;
            var panelH = objectives.length * lineH + 24;
            ctx.fillStyle = 'rgba(5,5,15,0.75)';
            ctx.fillRect(ox - 4, oy - 4, panelW, panelH);
            ctx.strokeStyle = '#334455';
            ctx.lineWidth   = 1;
            ctx.strokeRect(ox - 4, oy - 4, panelW, panelH);

            // Header
            ctx.fillStyle = S.COLORS.NEON_CYAN;
            ctx.shadowColor = S.COLORS.NEON_CYAN;
            ctx.shadowBlur  = 4;
            ctx.fillText('OBJECTIVES', ox, oy);
            ctx.shadowBlur  = 0;

            objectives.forEach(function(obj, idx) {
                var ty    = oy + 16 + idx * lineH;
                var color = obj.completed ? S.COLORS.NEON_GREEN : '#aaaacc';

                // Checkbox
                ctx.strokeStyle = color;
                ctx.lineWidth   = 1;
                ctx.strokeRect(ox, ty + 1, 10, 10);
                if (obj.completed) {
                    ctx.fillStyle = S.COLORS.NEON_GREEN;
                    ctx.shadowColor = S.COLORS.NEON_GREEN;
                    ctx.shadowBlur  = 4;
                    ctx.fillRect(ox + 2, ty + 3, 6, 6);
                    ctx.shadowBlur = 0;
                }

                // Text
                ctx.fillStyle = color;
                ctx.textAlign = 'left';
                // Truncate long text
                var text = obj.text || '';
                if (text.length > 28) text = text.substring(0, 27) + '…';
                ctx.fillText(text, ox + 16, ty + 1);
            });

            ctx.restore();
        },

        // ------------------------------------------------------------------
        // _renderMissionTime – top centre
        // ------------------------------------------------------------------
        _renderMissionTime: function(ctx, missionManager, cw) {
            var timeStr = missionManager.getFormattedTime
                ? missionManager.getFormattedTime()
                : '00:00';

            ctx.save();
            ctx.font         = '16px monospace';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle    = S.COLORS.NEON_AMBER;
            ctx.shadowColor  = S.COLORS.NEON_AMBER;
            ctx.shadowBlur   = 8;
            ctx.fillText(timeStr, cw / 2, 12);
            ctx.shadowBlur   = 0;
            ctx.restore();
        },

        // ------------------------------------------------------------------
        // Alert system
        // ------------------------------------------------------------------
        showAlert: function(text, color, duration) {
            this.alerts.push({
                text    : text,
                color   : color || S.COLORS.NEON_CYAN,
                duration: duration || 2.5,
                timer   : duration || 2.5
            });
            // Keep max 4 alerts at once
            if (this.alerts.length > 4) {
                this.alerts.shift();
            }
        },

        updateAlerts: function(dt) {
            for (var i = this.alerts.length - 1; i >= 0; i--) {
                this.alerts[i].timer -= dt;
                if (this.alerts[i].timer <= 0) {
                    this.alerts.splice(i, 1);
                }
            }
        },

        _renderAlerts: function(ctx, cw, ch) {
            if (this.alerts.length === 0) return;

            ctx.save();
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';

            var baseY = ch * 0.32;

            this.alerts.forEach(function(alert, idx) {
                var alpha = Math.min(1, alert.timer * ALERT_FADE);
                if (alpha <= 0) return;

                var y = baseY - idx * 28;

                ctx.globalAlpha = alpha;
                ctx.font        = '18px monospace';
                ctx.fillStyle   = alert.color;
                ctx.shadowColor = alert.color;
                ctx.shadowBlur  = 16;
                ctx.fillText(alert.text, cw / 2, y);
                ctx.shadowBlur  = 0;
            });

            ctx.globalAlpha = 1;
            ctx.restore();
        },

        // ------------------------------------------------------------------
        // handleInput – check HUD interactions; return true if input consumed
        // ------------------------------------------------------------------
        handleInput: function(input, agents) {
            if (!input) return false;

            var mx = input.screenX;
            var my = input.screenY;

            var canvas = S.Renderer ? S.Renderer.getCanvas() : null;
            if (!canvas) return false;

            var cw = canvas.width;
            var ch = canvas.height;
            var panelY = ch - PANEL_HEIGHT;

            // Check if mouse is in bottom panel
            if (my < panelY) return false;

            // ---- Portrait click → select agent -------------------------
            if (input.leftClick && input.leftClick.y >= panelY) {
                var cx = input.leftClick.x;
                for (var i = 0; i < 4; i++) {
                    var slotX = i * SLOT_WIDTH + 8;
                    var slotW = SLOT_WIDTH - 16;
                    if (cx >= slotX && cx <= slotX + slotW) {
                        if (agents && agents[i] && agents[i].alive) {
                            // Select this agent (single selection)
                            if (S.Selection) {
                                agents.forEach(function(a) { a.selected = false; });
                                S.Selection.selectedAgents = [agents[i]];
                                agents[i].selected = true;
                            }
                        }
                        return true;
                    }
                }
            }

            // ---- IPA slider dragging -----------------------------------
            var selectedAgent = (S.Selection && S.Selection.selectedAgents.length > 0)
                ? S.Selection.selectedAgents[0]
                : null;

            if (selectedAgent) {
                var stats   = ['intelligence', 'perception', 'adrenaline'];
                var totalW  = 3 * SLIDER_W + 2 * SLIDER_MARGIN + 36;
                var startX  = cw - totalW - 220;
                var startY  = panelY + (PANEL_HEIGHT - SLIDER_H) / 2;

                // Start drag
                if (input.leftDown && !this.ipaSliderDragging) {
                    for (var si = 0; si < 3; si++) {
                        var sx = startX + si * (SLIDER_W + SLIDER_MARGIN + 8);
                        if (mx >= sx && mx <= sx + SLIDER_W &&
                            my >= startY && my <= startY + SLIDER_H) {
                            this.ipaSliderDragging = { stat: stats[si], sliderX: sx };
                            break;
                        }
                    }
                }

                // Update drag
                if (this.ipaSliderDragging && input.leftDown) {
                    var relY = my - startY;
                    var newVal = S.clamp(1 - (relY / SLIDER_H), 0, 1);
                    selectedAgent[this.ipaSliderDragging.stat] = newVal;
                    return true;
                }

                // End drag
                if (!input.leftDown) {
                    this.ipaSliderDragging = null;
                }
            }

            return false;
        }
    };

}(window.Syndicate));
