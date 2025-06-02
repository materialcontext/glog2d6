// module/actions/core/action-validation.mjs

import { ValidationError } from './action-document.mjs';

/**
 * Lightweight validation functions for actions
 *
 * Based on the original GLOG 2d6 system, most actions are very permissive.
 * We only validate the basics and let the game mechanics handle the rest.
 *
 * Philosophy:
 * - Players can always try actions (even unarmed attacks)
 * - Resource constraints are suggestions, not hard blocks
 * - Most validation is about missing data, not game rules
 */
export class ActionValidation {

    /**
     * Core validations - the bare minimum needed
     */

    static requireActor(actor) {
        if (!actor) {
            throw new ValidationError("No actor selected");
        }

        if (!actor.system) {
            throw new ValidationError("Actor data is corrupted");
        }
    }

    static requireOwnership(actor) {
        if (!actor.isOwner && !game.user.isGM) {
            throw new ValidationError("You don't have permission to control this actor");
        }
    }

    /**
     * Spell-specific validations (only area that's strict)
     */

    static requireSpell(actor, spellId) {
        const spell = actor.items.get(spellId);

        if (!spell) {
            throw new ValidationError("Spell not found");
        }

        if (spell.type !== "spell") {
            throw new ValidationError("Selected item is not a spell");
        }

        return spell;
    }

    static requireMagicDice(actor, minimumDice) {
        const current = actor.system.magicDiceCurrent || 0;

        if (current < minimumDice) {
            throw new ValidationError(`Need ${minimumDice} magic dice, only have ${current}`);
        }

        return current;
    }

    /**
     * Target validation (when specific targets are required)
     */

    static requireTarget(target) {
        if (!target) {
            throw new ValidationError("No target selected");
        }

        return target;
    }

    /**
     * Weapon validation (optional - for when specific weapon is needed)
     */

    static requireSpecificWeapon(actor, weaponId) {
        const weapon = actor.items.get(weaponId);

        if (!weapon) {
            throw new ValidationError("Weapon not found");
        }

        if (weapon.type !== "weapon") {
            throw new ValidationError("Selected item is not a weapon");
        }

        if (!weapon.system.equipped) {
            throw new ValidationError(`${weapon.name} is not equipped`);
        }

        return weapon;
    }

    /**
     * Soft validations - these check conditions but don't necessarily block actions
     */

    static checkWeaponCondition(weapon) {
        const breakageLevel = weapon.system.breakage?.level || 0;
        const maxLevel = weapon.system.breakage?.maxLevel || 2;

        if (breakageLevel >= maxLevel) {
            // Don't throw - just warn. Broken weapons can still be used, just poorly
            ui.notifications.warn(`${weapon.name} is damaged and will be less effective`);
        }

        return breakageLevel;
    }

    static checkAmmo(actor, weapon) {
        if (weapon.system.weaponType !== 'ranged') return true;

        // Check for ammo but don't block the action
        const hasAmmo = this.findAmmoForWeapon(actor, weapon);
        if (!hasAmmo) {
            ui.notifications.warn(`No ammunition found for ${weapon.name}`);
        }

        return hasAmmo;
    }

    static checkResource(actor, resourcePath, amount) {
        const current = this.getNestedProperty(actor.system, resourcePath);

        if (current < amount) {
            const resourceName = this.formatResourceName(resourcePath);
            ui.notifications.warn(`Low ${resourceName}: ${current}/${amount}`);
            return false;
        }

        return true;
    }

    /**
     * Utility methods
     */

    static getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    static formatResourceName(resourcePath) {
        return resourcePath
            .split('.')
            .pop()
            .replace(/([A-Z])/g, ' $1')
            .toLowerCase()
            .trim();
    }

    static findAmmoForWeapon(actor, weapon) {
        const weaponType = weapon.system.weaponType;
        let ammoNames = [];

        switch (weaponType) {
            case 'bow':
                ammoNames = ['arrows', 'arrow'];
                break;
            case 'crossbow':
                ammoNames = ['bolts', 'bolt'];
                break;
            default:
                ammoNames = ['bullets', 'ammunition', 'rounds'];
                break;
        }

        return actor.items.find(i =>
            i.type === "gear" &&
            ammoNames.some(name => i.name.toLowerCase().includes(name)) &&
            (i.system.quantity || 0) > 0
        );
    }


    /**
     * Custom validation for edge cases
     */

    static custom(testFunction, errorMessage) {
        return (actor, ...args) => {
            const result = testFunction(actor, ...args);
            if (!result) {
                throw new ValidationError(errorMessage);
            }
            return result;
        };
    }

    static requireMagicDice(actor, minimumDice) {
        const current = actor.system.magicDiceCurrent || 0;

        if (current < minimumDice) {
            throw new ValidationError(`${actor.name} needs ${minimumDice} magic dice but only has ${current}`);
        }

        return current;
    }

    /**
     * Spell validations
     */

    static requireSpell(actor, spellId) {
        const spell = actor.items.get(spellId);

        if (!spell) {
            throw new ValidationError("Spell not found on actor");
        }

        if (spell.type !== "spell") {
            throw new ValidationError("Item is not a spell");
        }

        return spell;
    }

    static requireSpellSlots(actor, minimumSlots) {
        const current = actor.system.spellSlots || 0;

        if (current < minimumSlots) {
            throw new ValidationError(`${actor.name} needs ${minimumSlots} spell slots but only has ${current}`);
        }

        return current;
    }

    /**
     * Feature validations
     */

    static requireFeature(actor, featureName) {
        const feature = actor.items.find(i =>
            i.type === "feature" &&
            i.system.active &&
            i.name === featureName
        );

        if (!feature) {
            throw new ValidationError(`${actor.name} does not have the active feature: ${featureName}`);
        }

        return feature;
    }


    static requireClass(actor, className) {
        const hasClass = actor.items.some(i =>
            i.type === "feature" &&
            i.system.active &&
            i.system.classSource === className
        );

        if (!hasClass) {
            throw new ValidationError(`${actor.name} is not a ${className}`);
        }

        return true;
    }

    /**
     * Target validations
     */

    static requireTarget(target) {
        if (!target) {
            throw new ValidationError("No target selected for this action");
        }

        return target;
    }

    static requireTargetType(target, expectedType) {
        if (target.document?.documentName !== expectedType) {
            throw new ValidationError(`Target must be a ${expectedType}`);
        }

        return target;
    }

    static requireTargetInRange(actor, target, range) {
        // This would need to calculate distance based on tokens
        // For now, just check if we have the necessary data
        if (!actor.token || !target.token) {
            // Can't validate range without token positions
            return true;
        }

        const distance = this.calculateDistance(actor.token, target.token);
        if (distance > range) {
            throw new ValidationError(`Target is ${distance}' away, but action has range of ${range}'`);
        }

        return distance;
    }

    static requireLineOfSight(actor, target) {
        // This would need to check for walls and obstacles
        // For now, just verify we have tokens to work with
        if (!actor.token || !target.token) {
            return true; // Can't validate without tokens
        }

        // TODO: Implement actual line of sight checking
        // This would use Foundry's wall detection system
        return true;
    }

    /**
     * Condition validations
     */

    static requireNotCondition(actor, conditionName) {
        // Check for specific conditions that would prevent actions
        const wounds = actor.system.wounds?.list || [];

        // Check for specific wound effects
        switch (conditionName) {
            case 'unconscious':
                if (actor.system.hp?.value <= 0) {
                    throw new ValidationError(`${actor.name} is unconscious and cannot act`);
                }
                break;

            case 'no_healing':
                const hasNoHealing = wounds.some(w =>
                    w.effects?.noHealing === true
                );
                if (hasNoHealing) {
                    throw new ValidationError(`${actor.name} has wounds that prevent healing`);
                }
                break;

            case 'silenced':
                // Check for effects that prevent spellcasting
                // This would be expanded based on your condition system
                break;
        }

        return true;
    }

    static requireWounds(actor, maximum) {
        const woundCount = actor.system.wounds?.count || 0;

        if (woundCount > maximum) {
            throw new ValidationError(`${actor.name} has too many wounds to perform this action (${woundCount}/${maximum})`);
        }

        return woundCount;
    }

    /**
     * Environmental validations
     */

    static requireLighting(minimumLevel) {
        // This would check scene lighting or token-specific lighting
        // For now, just check if we have a scene
        if (!canvas.scene) {
            return true; // No scene to validate
        }

        // TODO: Implement actual lighting level checking
        // This would consider:
        // - Scene darkness level
        // - Token light sources
        // - Environmental effects
        return true;
    }

    static requireNotWeather(forbiddenWeather) {
        // This would check environmental conditions
        // Could be stored in scene flags or a weather module
        const currentWeather = canvas.scene?.getFlag('glog2d6', 'weather');

        if (forbiddenWeather.includes(currentWeather)) {
            throw new ValidationError(`Cannot perform this action in ${currentWeather} weather`);
        }

        return true;
    }

    /**
     * Equipment state validations
     */

    static requireWeaponNotBroken(weapon) {
        const breakageLevel = weapon.system.breakage?.level || 0;
        const maxLevel = weapon.system.breakage?.maxLevel || 2;

        if (breakageLevel >= maxLevel) {
            throw new ValidationError(`${weapon.name} is broken and cannot be used`);
        }

        return breakageLevel;
    }

    static requireAmmo(actor, weaponType) {
        // Check for appropriate ammunition
        let ammoType;
        switch (weaponType) {
            case 'bow':
                ammoType = 'arrows';
                break;
            case 'crossbow':
                ammoType = 'bolts';
                break;
            case 'pistol':
            case 'rifle':
            case 'shotgun':
                ammoType = 'ammunition';
                break;
            default:
                return true; // No ammo required
        }

        const hasAmmo = actor.items.some(i =>
            i.type === "gear" &&
            i.name.toLowerCase().includes(ammoType) &&
            (i.system.quantity || 0) > 0
        );

        if (!hasAmmo) {
            throw new ValidationError(`${actor.name} has no ${ammoType} for their ${weaponType}`);
        }

        return true;
    }

    /**
     * Custom validation builder
     */

    static custom(testFunction, errorMessage) {
        return (actor, ...args) => {
            const result = testFunction(actor, ...args);
            if (!result) {
                throw new ValidationError(errorMessage);
            }
            return result;
        };
    }

    /**
     * Utility methods
     */

    static getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    static formatResourceName(resourcePath) {
        return resourcePath
            .split('.')
            .pop()
            .replace(/([A-Z])/g, ' $1')
            .toLowerCase()
            .trim();
    }

    /**
     * Validation chains for complex requirements
     */

    static validateChain(actor, ...validations) {
        const results = [];

        for (const validation of validations) {
            if (typeof validation === 'function') {
                results.push(validation(actor));
            } else if (Array.isArray(validation)) {
                const [fn, ...args] = validation;
                results.push(fn(actor, ...args));
            }
        }

        return results;
    }

    /**
     * Conditional validations
     */

    static validateIf(condition, validation) {
        return (actor, ...args) => {
            if (condition(actor, ...args)) {
                return validation(actor, ...args);
            }
            return true;
        };
    }

    static validateUnless(condition, validation) {
        return (actor, ...args) => {
            if (!condition(actor, ...args)) {
                return validation(actor, ...args);
            }
            return true;
        };
    }
}
