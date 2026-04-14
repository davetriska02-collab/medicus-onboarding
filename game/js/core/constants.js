window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Tile geometry
    // -------------------------------------------------------------------------
    S.TILE_WIDTH  = 64;
    S.TILE_HEIGHT = 32;
    S.MAP_SIZE    = 64;

    // -------------------------------------------------------------------------
    // Palette
    // -------------------------------------------------------------------------
    S.COLORS = Object.freeze({
        BACKGROUND    : '#0a0a12',
        ROAD          : '#1a1a2e',
        SIDEWALK      : '#252540',
        GRASS         : '#0a1a0a',
        BUILDING_BASE : '#12121f',
        NEON_CYAN     : '#00ffff',
        NEON_MAGENTA  : '#ff00ff',
        NEON_AMBER    : '#ffaa00',
        NEON_GREEN    : '#00ff88',
        PLAYER_COLOR  : '#00ffff',
        ENEMY_COLOR   : '#ff2040',
        CIVILIAN_COLOR: '#666680'
    });

    // -------------------------------------------------------------------------
    // Enum helpers – simple frozen objects so typos fail loudly
    // -------------------------------------------------------------------------
    function makeEnum(arr) {
        var obj = {};
        arr.forEach(function(k) { obj[k] = k; });
        return Object.freeze(obj);
    }

    // Screen / state-machine states
    S.SCREEN = makeEnum([
        'TITLE', 'WORLDMAP', 'BRIEFING', 'MISSION',
        'DEBRIEF', 'RESEARCH', 'LOADOUT'
    ]);

    // Terrain tile types
    S.TERRAIN = makeEnum([
        'ROAD', 'SIDEWALK', 'GRASS', 'WATER', 'BUILDING_FLOOR'
    ]);

    // Entity categories
    S.ENTITY_TYPE = makeEnum([
        'AGENT', 'CIVILIAN', 'ENEMY', 'VEHICLE', 'PROJECTILE'
    ]);

    // Agent FSM states
    S.AGENT_STATE = makeEnum([
        'IDLE', 'MOVING', 'ATTACKING', 'DEAD'
    ]);

    // Enemy AI FSM states
    S.AI_STATE = makeEnum([
        'PATROL', 'ALERT', 'CHASE', 'ENGAGE', 'FLEE'
    ]);

    // Civilian FSM states
    S.CIVILIAN_STATE = makeEnum([
        'WANDER', 'FLEE', 'PERSUADED'
    ]);

    // Weapon types
    S.WEAPON_TYPES = makeEnum([
        'UNARMED',
        'PISTOL',
        'SHOTGUN',
        'UZI',
        'MINIGUN',
        'FLAMETHROWER',
        'GAUSS_GUN',
        'LASER',
        'LONG_RANGE',
        'PERSUADERTRON',
        'SCANNER',
        'MEDIKIT',
        'TIME_BOMB'
    ]);

    // -------------------------------------------------------------------------
    // Game tuning constants
    // -------------------------------------------------------------------------
    S.AGENT_SPEED        = 3.0;   // world-units per second
    S.ENEMY_SPEED        = 2.5;
    S.CIVILIAN_SPEED     = 1.0;
    S.PATHFIND_MAX_NODES = 2000;

    // Camera smooth-pan lerp rate (per second)
    S.CAMERA_LERP = 12.0;

    // Zoom limits and step
    S.ZOOM_MIN  = 0.5;
    S.ZOOM_MAX  = 2.0;
    S.ZOOM_STEP = 0.1;

    // Frame-rate safeguard: cap dt to avoid spiral-of-death
    S.MAX_DT = 1 / 15;

    // Minimap overlay size in pixels
    S.MINIMAP_SIZE = 160;

}(window.Syndicate));
