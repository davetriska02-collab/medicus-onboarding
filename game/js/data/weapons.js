window.Syndicate = window.Syndicate || {};

(function(S) {
    'use strict';

    /**
     * Master weapon definitions.
     *
     * Fields:
     *   name           - Display name
     *   damage         - Damage per hit (per pellet for shotgun)
     *   range          - Effective range in world tiles
     *   rateOfFire     - Shots per second
     *   spread         - Max angular spread in radians (0 = perfectly accurate)
     *   accuracy       - Base hit probability at point-blank  (0–1)
     *   pellets        - Number of projectiles per shot (default 1)
     *   penetrates     - Bullet passes through targets if true
     *   projectileType - 'bullet' | 'laser' | 'flame'
     *   color          - Projectile/tracer colour
     *   cost           - Purchase cost in credits
     *   description    - Flavour text
     */
    S.WeaponData = Object.freeze({

        pistol: {
            name           : 'Pistol',
            damage         : 12,
            range          : 8,
            rateOfFire     : 2.0,
            spread         : 0.05,
            accuracy       : 0.85,
            pellets        : 1,
            penetrates     : false,
            projectileType : 'bullet',
            color          : '#ffff44',
            cost           : 0,
            description    : 'Standard issue sidearm. Reliable and accurate.'
        },

        shotgun: {
            name           : 'Shotgun',
            damage         : 8,
            range          : 4,
            rateOfFire     : 1.0,
            spread         : 0.30,
            accuracy       : 0.70,
            pellets        : 5,
            penetrates     : false,
            projectileType : 'bullet',
            color          : '#ffaa44',
            cost           : 25000,
            description    : 'Devastating at close range. Five-pellet spread.'
        },

        uzi: {
            name           : 'Uzi',
            damage         : 8,
            range          : 6,
            rateOfFire     : 6.0,
            spread         : 0.15,
            accuracy       : 0.60,
            pellets        : 1,
            penetrates     : false,
            projectileType : 'bullet',
            color          : '#ffff44',
            cost           : 50000,
            description    : 'High rate of fire submachine gun. Spray and pray.'
        },

        minigun: {
            name           : 'Minigun',
            damage         : 12,
            range          : 7,
            rateOfFire     : 10.0,
            spread         : 0.20,
            accuracy       : 0.50,
            pellets        : 1,
            penetrates     : false,
            projectileType : 'bullet',
            color          : '#ffdd44',
            cost           : 150000,
            description    : 'Massive damage output. The barrel never cools down.'
        },

        flamethrower: {
            name           : 'Flamethrower',
            damage         : 20,
            range          : 3,
            rateOfFire     : 8.0,
            spread         : 0.40,
            accuracy       : 1.00,
            pellets        : 1,
            penetrates     : false,
            projectileType : 'flame',
            color          : '#ff6600',
            cost           : 100000,
            description    : 'Area denial weapon. Hot, messy, effective.'
        },

        laser: {
            name           : 'Laser',
            damage         : 35,
            range          : 10,
            rateOfFire     : 0.5,
            spread         : 0.00,
            accuracy       : 1.00,
            pellets        : 1,
            penetrates     : false,
            projectileType : 'laser',
            color          : '#ff0044',
            cost           : 200000,
            description    : 'Precise long-range beam weapon. Never misses at range.'
        },

        gaussgun: {
            name           : 'Gauss Gun',
            damage         : 60,
            range          : 12,
            rateOfFire     : 0.3,
            spread         : 0.00,
            accuracy       : 0.95,
            pellets        : 1,
            penetrates     : true,
            projectileType : 'laser',
            color          : '#4444ff',
            cost           : 350000,
            description    : 'Electromagnetic railgun. One shot, multiple kills.'
        }

    });

    /**
     * Create a live weapon instance from a type key.
     *
     * Returns a mutable copy of the base data plus:
     *   type     - the key string  e.g. 'pistol'
     *   cooldown - seconds between shots (1 / rateOfFire)
     *   currentCooldown - runtime countdown (starts at 0, ready to fire)
     *
     * @param {string} type  - key in S.WeaponData
     * @returns {object|null}
     */
    S.createWeapon = function(type) {
        var def = S.WeaponData[type];
        if (!def) {
            console.warn('S.createWeapon: unknown weapon type "' + type + '"');
            return null;
        }

        var w = Object.assign({}, def);   // shallow copy
        w.type            = type;
        w.cooldown        = 1.0 / w.rateOfFire;
        w.currentCooldown = 0;            // ready to fire immediately

        return w;
    };

}(window.Syndicate));
