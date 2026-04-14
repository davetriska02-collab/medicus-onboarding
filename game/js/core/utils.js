window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    // -------------------------------------------------------------------------
    // 2-D Vector math
    // All functions return plain {x, y} objects; inputs may also be {x, y}.
    // -------------------------------------------------------------------------

    /** Create a 2D vector */
    S.vec2 = function(x, y) { return { x: x, y: y }; };

    /** Add two vectors */
    S.vecAdd = function(a, b) { return { x: a.x + b.x, y: a.y + b.y }; };

    /** Subtract b from a */
    S.vecSub = function(a, b) { return { x: a.x - b.x, y: a.y - b.y }; };

    /** Multiply vector by scalar */
    S.vecMul = function(v, s) { return { x: v.x * s, y: v.y * s }; };

    /** Length (magnitude) of a vector */
    S.vecLen = function(v) { return Math.sqrt(v.x * v.x + v.y * v.y); };

    /** Normalise a vector (returns {x:0,y:0} for zero-length) */
    S.vecNorm = function(v) {
        var len = S.vecLen(v);
        if (len < 1e-9) return { x: 0, y: 0 };
        return { x: v.x / len, y: v.y / len };
    };

    /** Distance between two points */
    S.vecDist = function(a, b) { return S.vecLen(S.vecSub(b, a)); };

    /** Dot product */
    S.vecDot = function(a, b) { return a.x * b.x + a.y * b.y; };

    /** Angle of vector in radians (atan2) */
    S.vecAngle = function(v) { return Math.atan2(v.y, v.x); };

    // -------------------------------------------------------------------------
    // Scalar helpers
    // -------------------------------------------------------------------------

    /** Linear interpolation */
    S.lerp = function(a, b, t) { return a + (b - a) * t; };

    /** Clamp value between min and max */
    S.clamp = function(val, min, max) {
        return val < min ? min : val > max ? max : val;
    };

    /** Uniform random float in [min, max) */
    S.randomRange = function(min, max) {
        return min + Math.random() * (max - min);
    };

    /** Random integer in [min, max] inclusive */
    S.randomInt = function(min, max) {
        return Math.floor(min + Math.random() * (max - min + 1));
    };

    // -------------------------------------------------------------------------
    // Seeded pseudo-random number generator (mulberry32)
    // Returns a zero-argument function that produces values in [0, 1).
    // -------------------------------------------------------------------------
    S.seededRandom = function(seed) {
        var s = seed >>> 0;
        return function() {
            s += 0x6d2b79f5;
            var t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };

    // -------------------------------------------------------------------------
    // Colour utilities
    // -------------------------------------------------------------------------

    /**
     * Convert HSL (all in [0,1]) to an RGB object {r, g, b} each in [0,255].
     * Useful for procedurally generating palette variations.
     */
    S.hslToRgb = function(h, s, l) {
        var r, g, b;
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            var hue2rgb = function(p, q, t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    };

    /**
     * Format a money value: 1234567 → "$1,234,567"
     */
    S.formatMoney = function(amount) {
        var n = Math.floor(amount);
        return '$' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    // -------------------------------------------------------------------------
    // Misc helpers
    // -------------------------------------------------------------------------

    /**
     * Return the 8-direction index (0-7, clockwise from E) for an angle in
     * radians. Useful for sprite facing direction.
     *   0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
     */
    S.angleToFacing = function(radians) {
        var a = ((radians % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        return Math.round(a / (Math.PI / 4)) % 8;
    };

    /**
     * Deep-copy a plain-object / array tree (no functions / circular refs).
     */
    S.deepCopy = function(obj) {
        return JSON.parse(JSON.stringify(obj));
    };

}(window.Syndicate));
