window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Procedural city map generator
    // Produces a 2D array [MAP_SIZE][MAP_SIZE] of tile objects.
    //
    // Tile schema:
    //   {
    //     terrain  : S.TERRAIN.*,
    //     building : null | { height:1-3, style:0-3, color:'#rrggbb', footW, footH }
    //     walkable : bool,
    //     cover    : bool          // provides cover in combat
    //   }
    // -------------------------------------------------------------------------

    var MS  = S.MAP_SIZE;   // 64

    // Neon palette used for building windows
    var NEON_PALETTE = [
        S.COLORS.NEON_CYAN,
        S.COLORS.NEON_MAGENTA,
        S.COLORS.NEON_AMBER,
        S.COLORS.NEON_GREEN
    ];

    // Road grid spacing: a road every ROAD_EVERY tiles, 2 tiles wide
    var ROAD_EVERY = 8;   // block size including the road itself

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function makeTile(terrain) {
        return {
            terrain : terrain,
            building: null,
            walkable: (terrain !== S.TERRAIN.BUILDING_FLOOR),
            cover   : false
        };
    }

    /**
     * Returns true if the given column or row index falls on a road tile.
     * Roads are 2 tiles wide starting at multiples of ROAD_EVERY.
     */
    function isRoadIndex(i) {
        var mod = ((i % ROAD_EVERY) + ROAD_EVERY) % ROAD_EVERY;
        return mod === 0 || mod === 1;
    }

    /**
     * Returns true if the given index is the tile immediately adjacent to a
     * road on either side (i.e. sidewalk).
     */
    function isSidewalkIndex(i) {
        var mod = ((i % ROAD_EVERY) + ROAD_EVERY) % ROAD_EVERY;
        return mod === 2 || mod === (ROAD_EVERY - 1);
    }

    /**
     * Pick a seeded random neon colour.
     */
    function randNeon(rng) {
        return NEON_PALETTE[Math.floor(rng() * NEON_PALETTE.length)];
    }

    // -------------------------------------------------------------------------
    // Main generator
    // -------------------------------------------------------------------------

    /**
     * generateMap(seed, params) → 2D tile array [col][row] (col = x, row = y)
     *
     * params (all optional):
     *   parkCount   : number of park blocks (default 2)
     */
    S.generateMap = function(seed, params) {
        params = params || {};
        var rng = S.seededRandom(seed || 12345);

        // 1 – Allocate grid, fill with GRASS
        var map = [];
        var col, row;
        for (col = 0; col < MS; col++) {
            map[col] = [];
            for (row = 0; row < MS; row++) {
                map[col][row] = makeTile(S.TERRAIN.GRASS);
            }
        }

        // 2 – Lay road grid (every ROAD_EVERY tiles, 2 tiles wide)
        for (col = 0; col < MS; col++) {
            for (row = 0; row < MS; row++) {
                if (isRoadIndex(col) || isRoadIndex(row)) {
                    map[col][row].terrain  = S.TERRAIN.ROAD;
                    map[col][row].walkable = true;
                }
            }
        }

        // 3 – Lay sidewalk tiles adjacent to roads
        for (col = 0; col < MS; col++) {
            for (row = 0; row < MS; row++) {
                if (map[col][row].terrain === S.TERRAIN.ROAD) continue;
                if (isSidewalkIndex(col) || isSidewalkIndex(row)) {
                    map[col][row].terrain  = S.TERRAIN.SIDEWALK;
                    map[col][row].walkable = true;
                }
            }
        }

        // 4 – Identify buildable blocks
        // A block starts at (blockOriginCol, blockOriginRow) and runs to
        // the next road, exclusive of road and sidewalk tiles.
        // Blocks start at sidewalk+1 and end at the tile before the next sidewalk.
        var blockOrigins = [];
        for (col = 0; col < MS; col++) {
            var colMod = ((col % ROAD_EVERY) + ROAD_EVERY) % ROAD_EVERY;
            if (colMod === 3) {   // first interior tile of a block column
                for (row = 0; row < MS; row++) {
                    var rowMod = ((row % ROAD_EVERY) + ROAD_EVERY) % ROAD_EVERY;
                    if (rowMod === 3) {   // first interior tile of a block row
                        blockOrigins.push({ col: col, row: row });
                    }
                }
            }
        }

        // Block interior width = ROAD_EVERY - 4  (road2 + sidewalk1 each side = 4)
        var blockInner = ROAD_EVERY - 4;   // e.g. 4 tiles interior per block

        // 5 – Designate parks (no buildings)
        var parkCount = params.parkCount !== undefined ? params.parkCount : 2;
        var parkSet   = {};
        var parkTries = 0;
        while (Object.keys(parkSet).length < parkCount && parkTries < 200) {
            parkTries++;
            var pi = Math.floor(rng() * blockOrigins.length);
            parkSet[pi] = true;
        }

        // 6 – Place buildings in non-park blocks
        blockOrigins.forEach(function(origin, idx) {
            var isPark = !!parkSet[idx];

            // 70 % chance a block gets buildings
            if (isPark || rng() > 0.70) return;

            var numBuildings = 1 + Math.floor(rng() * 3);   // 1–3 buildings
            var attempts = 0;

            for (var b = 0; b < numBuildings; b++) {
                attempts = 0;
                while (attempts < 20) {
                    attempts++;
                    // Random footprint within the block interior
                    var fw = 2 + Math.floor(rng() * 3);   // 2–4 tiles wide
                    var fh = 2 + Math.floor(rng() * 3);   // 2–4 tiles deep

                    // Random offset within the block
                    var maxOX = blockInner - fw;
                    var maxOY = blockInner - fh;
                    if (maxOX < 0 || maxOY < 0) continue;

                    var ox = Math.floor(rng() * (maxOX + 1));
                    var oy = Math.floor(rng() * (maxOY + 1));

                    var bCol = origin.col + ox;
                    var bRow = origin.row + oy;

                    // Check all tiles are still grass (no overlap)
                    var ok = true;
                    for (var dc = 0; dc < fw && ok; dc++) {
                        for (var dr = 0; dr < fh && ok; dr++) {
                            var tc = bCol + dc;
                            var tr = bRow + dr;
                            if (tc >= MS || tr >= MS) { ok = false; break; }
                            if (map[tc][tr].terrain !== S.TERRAIN.GRASS) { ok = false; }
                        }
                    }
                    if (!ok) continue;

                    // Place building
                    var height = 1 + Math.floor(rng() * 3);
                    var style  = Math.floor(rng() * 4);
                    var color  = randNeon(rng);

                    var bldg = { height: height, style: style, color: color,
                                 footW: fw, footH: fh };

                    for (var dc2 = 0; dc2 < fw; dc2++) {
                        for (var dr2 = 0; dr2 < fh; dr2++) {
                            var tc2 = bCol + dc2;
                            var tr2 = bRow + dr2;
                            map[tc2][tr2].terrain  = S.TERRAIN.BUILDING_FLOOR;
                            map[tc2][tr2].walkable = false;
                            map[tc2][tr2].cover    = true;
                            map[tc2][tr2].building = bldg;
                            // Tag which tile is the "origin" of this building for rendering
                            map[tc2][tr2].bldgOriginCol = bCol;
                            map[tc2][tr2].bldgOriginRow = bRow;
                        }
                    }
                    break;
                }
            }
        });

        return map;
    };

    // -------------------------------------------------------------------------
    // Spawn points
    // -------------------------------------------------------------------------

    /**
     * getSpawnPoints(map) → array of { x, y } world-grid positions
     * Returns walkable tiles that are adjacent to a road tile, suitable for
     * spawning agents, enemies, and civilians.
     */
    S.getSpawnPoints = function(map) {
        var points = [];
        var dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (var col = 1; col < MS - 1; col++) {
            for (var row = 1; row < MS - 1; row++) {
                var tile = map[col][row];
                if (!tile.walkable) continue;
                if (tile.terrain === S.TERRAIN.ROAD) continue; // not on road itself
                // Check if any neighbour is a road
                var nearRoad = false;
                for (var d = 0; d < dirs.length; d++) {
                    var nc = col + dirs[d][0];
                    var nr = row + dirs[d][1];
                    if (nc >= 0 && nc < MS && nr >= 0 && nr < MS) {
                        if (map[nc][nr].terrain === S.TERRAIN.ROAD) {
                            nearRoad = true;
                            break;
                        }
                    }
                }
                if (nearRoad) {
                    points.push({ x: col, y: row });
                }
            }
        }
        return points;
    };

    // -------------------------------------------------------------------------
    // Bounds-checked walkability test
    // -------------------------------------------------------------------------

    /**
     * isWalkable(map, x, y) → bool
     * Returns false for out-of-bounds coordinates.
     */
    S.isWalkable = function(map, x, y) {
        var col = Math.floor(x);
        var row = Math.floor(y);
        if (col < 0 || col >= MS || row < 0 || row >= MS) return false;
        return map[col][row].walkable;
    };

}(window.Syndicate));
