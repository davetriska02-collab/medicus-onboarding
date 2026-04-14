window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    /**
     * Base entity class.
     * All game objects (agents, civilians, enemies, projectiles, vehicles) extend this.
     */
    class Entity {
        constructor(x, y, type) {
            this.id      = Entity.nextId++;
            this.x       = x;           // world float
            this.y       = y;           // world float
            this.type    = type;        // from S.ENTITY enum
            this.facing  = 0;           // radians
            this.alive   = true;
            this.removed = false;       // flagged for cleanup by world
        }

        /**
         * Advance entity state.
         * @param {number} dt   - delta time in seconds
         * @param {object} world - world/map context
         */
        update(dt, world) {
            // Override in subclass
        }

        /**
         * Draw the entity.
         * @param {CanvasRenderingContext2D} ctx
         * @param {object} camera - S.Camera
         */
        render(ctx, camera) {
            // Override in subclass
        }

        /**
         * Euclidean distance to another entity (world space).
         * @param {Entity} other
         * @returns {number}
         */
        distanceTo(other) {
            var dx = this.x - other.x;
            var dy = this.y - other.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        /**
         * Convert this entity's world position to screen coords.
         * @param {object} camera - S.Camera
         * @returns {{sx: number, sy: number}}
         */
        getScreenPos(camera) {
            var s = S.worldToScreen(this.x, this.y, camera);
            return { sx: s.x, sy: s.y };
        }
    }

    /** Auto-incrementing unique ID across all entities. */
    Entity.nextId = 1;

    S.Entity = Entity;

}(window.Syndicate));
