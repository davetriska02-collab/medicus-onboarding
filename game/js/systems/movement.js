window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // Binary Min-Heap for A* open set
    // Stores objects with a .f property; smallest f is at the top.
    // -------------------------------------------------------------------------
    class MinHeap {
        constructor() {
            this._data = [];
        }

        get size() { return this._data.length; }

        push(node) {
            this._data.push(node);
            this._bubbleUp(this._data.length - 1);
        }

        pop() {
            var top  = this._data[0];
            var last = this._data.pop();
            if (this._data.length > 0) {
                this._data[0] = last;
                this._sinkDown(0);
            }
            return top;
        }

        _bubbleUp(i) {
            var data = this._data;
            while (i > 0) {
                var parent = (i - 1) >> 1;
                if (data[parent].f <= data[i].f) break;
                var tmp = data[parent];
                data[parent] = data[i];
                data[i] = tmp;
                i = parent;
            }
        }

        _sinkDown(i) {
            var data = this._data;
            var n    = data.length;
            for (;;) {
                var l    = (i << 1) + 1;
                var r    = l + 1;
                var best = i;
                if (l < n && data[l].f < data[best].f) best = l;
                if (r < n && data[r].f < data[best].f) best = r;
                if (best === i) break;
                var tmp  = data[best];
                data[best] = data[i];
                data[i]  = tmp;
                i = best;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Movement & pathfinding system
    // -------------------------------------------------------------------------

    S.Movement = {

        // ------------------------------------------------------------------
        // findPath
        //
        // A* on the tile grid.  Returns an array of {x, y} waypoints using
        // tile-centre coordinates (tile + 0.5), or [] if no path found.
        //
        // map must implement:
        //   getTile(col, row) → { walkable: bool, cover: number }
        //   or tileAt(col, row) with the same interface.
        //   size → number (assumed square; falls back to S.MAP_SIZE)
        // ------------------------------------------------------------------
        findPath: function(map, startX, startY, endX, endY) {
            var mapSize = map.size || S.MAP_SIZE;

            var sx = Math.floor(startX);
            var sy = Math.floor(startY);
            var ex = Math.floor(endX);
            var ey = Math.floor(endY);

            // Clamp to grid
            sx = S.clamp(sx, 0, mapSize - 1);
            sy = S.clamp(sy, 0, mapSize - 1);
            ex = S.clamp(ex, 0, mapSize - 1);
            ey = S.clamp(ey, 0, mapSize - 1);

            if (sx === ex && sy === ey) {
                return [{ x: ex + 0.5, y: ey + 0.5 }];
            }

            // ---- helpers -------------------------------------------------
            // Support both raw 2D array (map[col][row]) and object-with-methods
            var getTile = function(cx, cy) {
                if (cx < 0 || cy < 0 || cx >= mapSize || cy >= mapSize) return null;
                if (map.getTile)  return map.getTile(cx, cy);
                if (map.tileAt)   return map.tileAt(cx, cy);
                // Raw 2D array: map[col][row]
                if (Array.isArray(map) && map[cx]) return map[cx][cy] || null;
                return null;
            };

            var isWalkable = function(cx, cy) {
                var t = getTile(cx, cy);
                return t && t.walkable;
            };

            // Chebyshev heuristic (accounts for diagonal movement)
            var heuristic = function(ax, ay, bx, by) {
                var dx = Math.abs(ax - bx);
                var dy = Math.abs(ay - by);
                return Math.max(dx, dy);
            };

            var key = function(cx, cy) { return cy * mapSize + cx; };

            // ---- A* ------------------------------------------------------
            var SQRT2 = 1.4142135623730951;
            var openSet  = new MinHeap();
            var cameFrom = {};    // key → {px, py}
            var gScore   = {};    // key → number
            var inOpen   = {};    // key → bool (lazy removal via flag)
            var closed   = {};    // key → bool

            var startKey = key(sx, sy);
            gScore[startKey] = 0;
            openSet.push({ x: sx, y: sy, f: heuristic(sx, sy, ex, ey), g: 0 });
            inOpen[startKey] = true;

            var nodesExpanded = 0;
            var bestNode      = { x: sx, y: sy };
            var bestH         = heuristic(sx, sy, ex, ey);

            var DIRS = [
                { dx:  1, dy:  0, cost: 1.0 },
                { dx: -1, dy:  0, cost: 1.0 },
                { dx:  0, dy:  1, cost: 1.0 },
                { dx:  0, dy: -1, cost: 1.0 },
                { dx:  1, dy:  1, cost: SQRT2 },
                { dx:  1, dy: -1, cost: SQRT2 },
                { dx: -1, dy:  1, cost: SQRT2 },
                { dx: -1, dy: -1, cost: SQRT2 }
            ];

            while (openSet.size > 0 && nodesExpanded < S.PATHFIND_MAX_NODES) {
                var current = openSet.pop();
                var ck      = key(current.x, current.y);

                if (closed[ck]) continue;   // lazy removal
                closed[ck] = true;
                nodesExpanded++;

                // Track best node (closest to goal) for partial paths
                var h = heuristic(current.x, current.y, ex, ey);
                if (h < bestH) {
                    bestH    = h;
                    bestNode = current;
                }

                if (current.x === ex && current.y === ey) {
                    return S.Movement._reconstructPath(cameFrom, ex, ey, key, mapSize);
                }

                for (var di = 0; di < DIRS.length; di++) {
                    var d  = DIRS[di];
                    var nx = current.x + d.dx;
                    var ny = current.y + d.dy;
                    var nk = key(nx, ny);

                    if (closed[nk]) continue;
                    if (!isWalkable(nx, ny)) continue;

                    // No corner-cutting: if diagonal, both cardinal neighbours must be walkable
                    if (d.cost > 1.0) {
                        if (!isWalkable(current.x + d.dx, current.y) ||
                            !isWalkable(current.x, current.y + d.dy)) continue;
                    }

                    var ng = current.g + d.cost;
                    var existingG = gScore[nk];

                    if (existingG === undefined || ng < existingG) {
                        gScore[nk]    = ng;
                        cameFrom[nk] = { px: current.x, py: current.y };
                        var fScore    = ng + heuristic(nx, ny, ex, ey);
                        openSet.push({ x: nx, y: ny, f: fScore, g: ng });
                    }
                }
            }

            // No complete path – return best partial path to closest reached node
            if (bestNode.x === sx && bestNode.y === sy) return [];
            return S.Movement._reconstructPath(cameFrom, bestNode.x, bestNode.y, key, mapSize);
        },

        // ------------------------------------------------------------------
        // Internal: reconstruct path from cameFrom map
        // ------------------------------------------------------------------
        _reconstructPath: function(cameFrom, ex, ey, keyFn, mapSize) {
            var path = [];
            var cx   = ex;
            var cy   = ey;

            while (cx !== undefined && cy !== undefined) {
                path.push({ x: cx + 0.5, y: cy + 0.5 });
                var k  = keyFn(cx, cy);
                var cf = cameFrom[k];
                if (!cf) break;
                cx = cf.px;
                cy = cf.py;
            }

            path.reverse();
            return path;
        },

        // ------------------------------------------------------------------
        // smoothPath
        //
        // String-pulling: if we can skip a waypoint while maintaining LOS,
        // remove it.  Operates on the {x, y} tile-centre array in place.
        // ------------------------------------------------------------------
        smoothPath: function(map, path) {
            if (!path || path.length <= 2) return path;

            var result = [path[0]];
            var i      = 0;

            while (i < path.length - 1) {
                // Find the furthest waypoint reachable from path[i] with LOS
                var farthest = i + 1;
                for (var j = i + 2; j < path.length; j++) {
                    if (S.Movement.hasLineOfSight(map, path[i].x, path[i].y,
                                                       path[j].x, path[j].y)) {
                        farthest = j;
                    } else {
                        break;
                    }
                }
                result.push(path[farthest]);
                i = farthest;
            }

            return result;
        },

        // ------------------------------------------------------------------
        // hasLineOfSight
        //
        // Bresenham's line through tile grid.
        // Returns false if any non-walkable tile is encountered.
        // Coordinates are world-float (tile centres or exact).
        // ------------------------------------------------------------------
        hasLineOfSight: function(map, x1, y1, x2, y2) {
            var mapSize = map.size || S.MAP_SIZE;

            var getTile = function(cx, cy) {
                if (cx < 0 || cy < 0 || cx >= mapSize || cy >= mapSize) return null;
                if (map.getTile) return map.getTile(cx, cy);
                if (map.tileAt)  return map.tileAt(cx, cy);
                // Raw 2D array
                if (Array.isArray(map) && map[cx]) return map[cx][cy] || null;
                return null;
            };

            var tx1 = Math.floor(x1);
            var ty1 = Math.floor(y1);
            var tx2 = Math.floor(x2);
            var ty2 = Math.floor(y2);

            var dx = Math.abs(tx2 - tx1);
            var dy = Math.abs(ty2 - ty1);
            var sx = tx1 < tx2 ? 1 : -1;
            var sy = ty1 < ty2 ? 1 : -1;
            var err = dx - dy;

            var cx = tx1;
            var cy = ty1;

            var maxIter = dx + dy + 2;   // safety cap

            for (var iter = 0; iter <= maxIter; iter++) {
                var t = getTile(cx, cy);
                if (!t || !t.walkable) return false;

                if (cx === tx2 && cy === ty2) return true;

                var e2 = 2 * err;
                if (e2 > -dy) { err -= dy; cx += sx; }
                if (e2 <  dx) { err += dx; cy += sy; }
            }

            return true;
        },

        // ------------------------------------------------------------------
        // moveAlongPath
        //
        // Advances entity along its stored path array at its own speed.
        // Entity must have: x, y, path, pathIndex, facing, getSpeed()
        //
        // Returns true when the path is fully consumed.
        // ------------------------------------------------------------------
        moveAlongPath: function(entity, dt) {
            if (!entity.path || entity.pathIndex >= entity.path.length) return true;

            var wp    = entity.path[entity.pathIndex];
            var dx    = wp.x - entity.x;
            var dy    = wp.y - entity.y;
            var dist  = Math.sqrt(dx * dx + dy * dy);
            var speed = typeof entity.getSpeed === 'function'
                        ? entity.getSpeed()
                        : (entity.speed || S.AGENT_SPEED);

            if (dist < 0.2) {
                entity.x = wp.x;
                entity.y = wp.y;
                entity.pathIndex++;
                return (entity.pathIndex >= entity.path.length);
            }

            var step = Math.min(speed * dt, dist);
            entity.x      += (dx / dist) * step;
            entity.y      += (dy / dist) * step;
            entity.facing  = Math.atan2(dy, dx);

            return false;
        }
    };

}(window.Syndicate));
