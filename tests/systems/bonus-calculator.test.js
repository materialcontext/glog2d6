// tests/systems/bonus-calculator.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { BonusCalculator } from '../../module/systems/bonus-calculator.mjs'
import { createMockActor } from '../mocks/actor-data.js'

describe('BonusCalculator', () => {
    let actor, calculator

    beforeEach(() => {
        actor = createMockActor()
        calculator = new BonusCalculator(actor)
    })

    const addFeature = (name, classSource = 'Fighter', active = true) => {
        actor.items.push({
            type: 'feature', name, system: { active, classSource }
        })
    }

    const setEncumbrance = (value) => { actor.system.inventory.encumbrance = value }
    const mockTemplateCount = (templateCounts) => {
        actor.getClassTemplateCount = vi.fn((cls) => templateCounts[cls] || 0)
    }

    describe('Feature Bonus Collection', () => {
        it('calculates Acrobat bonuses with encumbrance checks', () => {
            const testCases = [
                { templates: 1, encumbrance: 0, expectedBonus: 0 },  // No bonus at 1 template
                { templates: 3, encumbrance: 0, expectedBonus: 1 },  // (3-1)/2 = 1
                { templates: 5, encumbrance: 0, expectedBonus: 2 },  // (5-1)/2 = 2
                { templates: 3, encumbrance: 1, expectedBonus: 0 },  // Encumbered = no bonus
            ]

            testCases.forEach(({ templates, encumbrance, expectedBonus }) => {
                actor.items = []
                addFeature('Acrobat Training', 'Acrobat')
                mockTemplateCount({ 'Acrobat': templates })
                setEncumbrance(encumbrance)

                const bonuses = calculator.calculateBonuses()

                if (expectedBonus > 0) {
                    expect(bonuses.has('details.movement.bonus')).toBe(true)
                    expect(bonuses.get('details.movement.bonus').total).toBe(expectedBonus)
                    expect(bonuses.has('defense.melee.bonus')).toBe(true)
                    expect(bonuses.get('defense.melee.bonus').total).toBe(expectedBonus)
                } else {
                    expect(bonuses.size).toBe(0)
                }
            })
        })

        it('calculates class-specific bonuses', () => {
            const featureTests = [
                {
                    feature: 'Combat Training',
                    class: 'Fighter',
                    expected: [['combat.attack.bonus', 2]]
                },
                {
                    feature: 'Barbarian Heritage',
                    class: 'Barbarian',
                    templates: 3,
                    expected: [['hp.bonus', 2]] // templates - 1
                },
                {
                    feature: 'Thievery Training',
                    class: 'Thief',
                    templates: 5,
                    expected: [['skills.stealth.bonus', 2]] // (5-1)/2
                },
                {
                    feature: 'Assassin Training',
                    class: 'Assassin',
                    expected: [['skills.stealth.bonus', 2]]
                },
                {
                    feature: 'Noble Bearing',
                    class: 'Courtier',
                    templates: 3,
                    expected: [['skills.reaction.bonus', 1]] // (3-1)/2
                },
                {
                    feature: 'Archery Training',
                    class: 'Hunter',
                    templates: 4,
                    expected: [['combat.archery.bonus', 1]] // (4-1)/2
                },
                {
                    feature: 'Magical Training',
                    class: 'Wizard',
                    templates: 3,
                    intMod: 2,
                    expected: [['magicDiceMax', 2], ['spellSlots', 4]] // templates-1, templates-1+intMod
                },
                {
                    feature: 'Intellect Fortress',
                    class: 'Wizard',
                    templates: 5,
                    expected: [['saves.int.bonus', 2], ['saves.wis.bonus', 2]] // (5-1)/2
                }
            ]

            featureTests.forEach(({ feature, class: className, templates = 2, intMod = 0, expected }) => {
                actor.items = [];
                addFeature(feature, className);
                mockTemplateCount({ [className]: templates });
                if (intMod) actor.system.attributes.int.mod = intMod;
                const bonuses = calculator.calculateBonuses()

                expected.forEach(([target, value]) => {
                    expect(bonuses.has(target)).toBe(true)
                    expect(bonuses.get(target).total).toBe(value)
                })
            })
        })

        it('ignores inactive features', () => {
            addFeature('Combat Training', 'Fighter', false) // inactive

            const bonuses = calculator.calculateBonuses()

            expect(bonuses.size).toBe(0)
        })

        it('ignores features without bonus definitions', () => {
            addFeature('Unknown Feature', 'Fighter')

            const bonuses = calculator.calculateBonuses()

            expect(bonuses.size).toBe(0)
        })
    })

    describe('Bonus Stacking', () => {
        it('stacks bonuses from multiple features', () => {
            addFeature('Combat Training', 'Fighter')        // +2 attack
            addFeature('Archery Training', 'Hunter')        // +1 archery (with 3 templates)
            mockTemplateCount({ 'Fighter': 2, 'Hunter': 3 })

            const bonuses = calculator.calculateBonuses()

            expect(bonuses.get('combat.attack.bonus').total).toBe(2)
            expect(bonuses.get('combat.archery.bonus').total).toBe(1)
        })

        it('combines same-target bonuses', () => {
            addFeature('Thievery Training', 'Thief')
            addFeature('Assassin Training', 'Assassin')
            mockTemplateCount({ 'Thief': 3, 'Assassin': 2 }) // Both at once

            const bonuses = calculator.calculateBonuses()

            expect(bonuses.get('skills.stealth.bonus').total).toBe(3) // 1 + 2
        })
    })

    describe('Bonus Breakdown', () => {
        it('provides source breakdown for bonuses', () => {
            addFeature('Combat Training', 'Fighter')

            const bonuses = calculator.calculateBonuses()
            const breakdown = bonuses.get('combat.attack.bonus').breakdown

            expect(breakdown).toHaveLength(1)
            expect(breakdown[0].source).toBe('Combat Training')
            expect(breakdown[0].value).toBe(2)
            expect(breakdown[0].type).toBe('feature')
        })

        it('tracks multiple sources in breakdown', () => {
            addFeature('Thievery Training', 'Thief')
            addFeature('Assassin Training', 'Assassin')
            mockTemplateCount({ 'Thief': 3 })

            const bonuses = calculator.calculateBonuses()
            const breakdown = bonuses.get('skills.stealth.bonus').breakdown

            expect(breakdown).toHaveLength(2)
            expect(breakdown.map(b => b.source)).toContain('Thievery Training')
            expect(breakdown.map(b => b.source)).toContain('Assassin Training')
        })
    })
    describe('Edge Cases', () => {
        it('handles actors with no items', () => {
            actor.items = []

            expect(() => calculator.calculateBonuses()).not.toThrow()
            expect(calculator.calculateBonuses().size).toBe(0)
        })

        it('logs and continues when getClassTemplateCount is missing', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
            delete actor.getClassTemplateCount
            addFeature('Barbarian Heritage', 'Barbarian')

            // Should not throw at the system level
            const bonusSystem = new (class {
                constructor() { this.actor = actor; this.bonusCalculator = calculator }
                calculateAndApplyAllBonuses() {
                    try {
                        this.bonusCalculator.calculateBonuses(); // Remove unused variable
                    } catch (error) {
                        console.error(`🚨 BONUS CALCULATION FAILED FOR ${this.actor.name.toUpperCase()}! 🚨`);
                    }
                }
            })()

            expect(() => bonusSystem.calculateAndApplyAllBonuses()).not.toThrow()
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🚨 BONUS CALCULATION FAILED'))

            consoleSpy.mockRestore()
        })
        it('returns empty breakdown for non-existent targets', () => {
            const breakdown = calculator.getBonusBreakdown('nonexistent.target')
            expect(breakdown).toEqual([])
        })
    })
})
