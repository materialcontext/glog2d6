// tests/dice/actor-rolls.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ActorRolls } from '../../module/dice/actor-rolls.mjs'
import { createMockActor, createMockItem } from '../mocks/actor-data.js'

describe('ActorRolls', () => {
    let actor, rolls, mockRoll

    beforeEach(() => {
        actor = createMockActor()
        rolls = new ActorRolls(actor)

        // Mock the roll creation and chat message
        mockRoll = {
            total: 10,
            evaluate: vi.fn().mockResolvedValue(true),
            terms: [{ results: [{ result: 4 }, { result: 6 }] }]
        }

        actor.createRoll = vi.fn().mockReturnValue(mockRoll)
        actor._createRollChatMessage = vi.fn()
    })

    const setAttr = (attr, value, mod) => {
        actor.system.attributes[attr] = { value, mod, effectiveMod: mod }
    }
    const setSaveBonus = (attr, bonus, breakdown = []) => {
        if (!actor.system.saves) actor.system.saves = {}
        actor.system.saves[attr] = { bonus, breakdown }
    }

    describe('Attribute Rolls', () => {
        it('rolls attribute checks with correct modifier', async () => {
            setAttr('str', 14, 4)

            await rolls.rollAttribute('str', 7)

            expect(actor.createRoll).toHaveBeenCalledWith('2d6 + @mod', { mod: 4 }, 'strength')
            expect(actor._createRollChatMessage).toHaveBeenCalledWith(
                `${actor.name} - STR Check`,
                mockRoll
            )
        })

        it('uses correct context for different attributes', () => {
            const contextTests = [
                { attr: 'str', expectedContext: 'strength' },
                { attr: 'cha', expectedContext: 'social' },
                { attr: 'dex', expectedContext: 'attribute' },
                { attr: 'int', expectedContext: 'attribute' }
            ]

            contextTests.forEach(({ attr, expectedContext }) => {
                setAttr(attr, 10, 2)
                rolls.rollAttribute(attr)
                expect(actor.createRoll).toHaveBeenCalledWith('2d6 + @mod', { mod: 2 }, expectedContext)
            })
        })
    })

    describe('Save Rolls', () => {
        it('rolls saves with attribute modifier and save bonuses', () => {
            setAttr('wis', 12, 3)
            setSaveBonus('wis', 2, [{ source: 'Intellect Fortress', value: 2 }])

            rolls.rollSave('wis')

            expect(actor.createRoll).toHaveBeenCalledWith(
                '2d6 + @mod + @saveBonus',
                { mod: 3, saveBonus: 2 },
                'attribute'
            )
        })

        it('handles missing save bonuses gracefully', () => {
            setAttr('con', 8, 1)
            // No save bonus set

            rolls.rollSave('con')

            expect(actor.createRoll).toHaveBeenCalledWith(
                '2d6 + @mod + @saveBonus',
                { mod: 1, saveBonus: 0 },
                'save'
            )
        })

        it('creates chat message with success/failure and bonus breakdown', () => {
            setAttr('int', 10, 2)
            setSaveBonus('int', 3, [{ source: 'Test Feature', value: 3 }])
            mockRoll.total = 12 // Success (>= 10)

            rolls.rollSave('int')

            expect(actor._createRollChatMessage).toHaveBeenCalledWith(
                `${actor.name} - INT Save`,
                mockRoll,
                expect.stringContaining('Success')
            )
        })
    })

    describe('Attack Rolls', () => {
        beforeEach(() => {
            actor.system.combat = {
                attack: { value: 3, bonus: 2 },
                archery: { bonus: 1 }
            }
            actor.system.attributes.str = { mod: 3 }
            actor._getBestWeapon = vi.fn()
            actor.analyzeEquippedWeapons = vi.fn().mockReturnValue({ hasWeapons: false })
        })

        it('builds attack data for weapon attacks', async () => {
            const weapon = createMockItem('weapon', {
                system: {
                    name: 'Sword',
                    weaponType: 'melee',
                    damage: '1d8',
                    attackPenalty: 0
                }
            })

            await rolls.rollAttack(weapon)

            expect(actor.createRoll).toHaveBeenCalledWith(
                '2d6 + @atk + @bonus + @dual + @str',
                expect.objectContaining({
                    atk: 3,
                    bonus: 2,
                    str: 3,
                    archery: 0,
                    penalty: 0
                }),
                'attack'
            )
        })

        it('handles ranged weapons correctly', () => {
            const bow = createMockItem('weapon', {
                system: {
                    weaponType: 'ranged',
                    attackPenalty: 0
                }
            })

            rolls.rollAttack(bow)

            expect(actor.createRoll).toHaveBeenCalledWith(
                '2d6 + @atk + @bonus + @dual + @archery',
                expect.objectContaining({
                    str: 0,        // No str for ranged
                    archery: 1     // Archery bonus applied
                }),
                'attack'
            )
        })

        it('applies weapon penalties', () => {
            const heavyWeapon = createMockItem('weapon', {
                system: {
                    weaponType: 'melee',
                    attackPenalty: 2
                }
            })

            rolls.rollAttack(heavyWeapon)

            expect(actor.createRoll).toHaveBeenCalledWith(
                '2d6 + @atk + @bonus + @dual + @str - @penalty',
                expect.objectContaining({
                    penalty: 2
                }),
                'attack'
            )
        })

        it('calculates dual wield bonus', () => {
            // Mock dual wielding scenario
            actor.items = [
                createMockItem('weapon', { system: { equipped: true } }),
                createMockItem('weapon', { system: { equipped: true } })
            ]

            rolls.rollAttack()

            expect(actor.createRoll).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    dual: 1  // Dual wield bonus
                }),
                'attack'
            )
        })
    })

    describe('Defense Rolls', () => {
        it('rolls general defense', () => {
            actor.system.defense = { total: 5, armor: 2, dexBonus: 3 }

            rolls.rollDefense()

            expect(actor.createRoll).toHaveBeenCalledWith('2d6 + @def', { def: 5 }, 'defense')
            expect(actor._createRollChatMessage).toHaveBeenCalledWith(
                `${actor.name} - Defense`,
                mockRoll,
                expect.stringContaining('Armor: +2, Dex: +3')
            )
        })

        it('rolls melee defense with melee bonuses', () => {
            actor.system.defense = {
                meleeTotal: 7,
                armor: 2,
                dexBonus: 3,
                meleeBonus: 2
            }

            rolls.rollMeleeDefense()

            expect(actor.createRoll).toHaveBeenCalledWith('2d6 + @def', { def: 7 }, 'defense')
            expect(actor._createRollChatMessage).toHaveBeenCalledWith(
                `${actor.name} - Melee Defense`,
                mockRoll,
                expect.stringContaining('Melee: +2')
            )
        })

        it('rolls ranged defense with ranged bonuses', () => {
            actor.system.defense = {
                rangedTotal: 8,
                armor: 2,
                dexBonus: 3,
                rangedBonus: 3
            }

            rolls.rollRangedDefense()

            expect(actor.createRoll).toHaveBeenCalledWith('2d6 + @def', { def: 8 }, 'defense')
            expect(actor._createRollChatMessage).toHaveBeenCalledWith(
                `${actor.name} - Ranged Defense`,
                mockRoll,
                expect.stringContaining('Ranged: +3')
            )
        })
    })

    describe('Skill Rolls', () => {
        it('rolls stealth skills with bonuses', () => {
            setAttr('dex', 14, 4)
            actor.system.skills = { stealth: { bonus: 2 } }

            const skillTests = [
                { method: 'rollSneak', attr: 'dex', name: 'Sneak' },
                { method: 'rollHide', attr: 'wis', name: 'Hide' },
                { method: 'rollDisguise', attr: 'int', name: 'Disguise' }
            ]

            skillTests.forEach(({ method, attr, name }) => {
                setAttr(attr, 14, 4)
                rolls[method]()

                expect(actor.createRoll).toHaveBeenCalledWith(
                    `2d6 + @${attr} + @stealth`,
                    { [attr]: 4, stealth: 2 },
                    'stealth'
                )
                expect(actor._createRollChatMessage).toHaveBeenCalledWith(
                    `${actor.name} - ${name}`,
                    mockRoll,
                    expect.stringContaining('Stealth bonus: +2')
                )
            })
        })

        it('rolls social skills', () => {
            setAttr('cha', 12, 3)
            actor.system.skills = { reaction: { bonus: 1 } }

            const socialTests = [
                { method: 'rollReaction', hasBonus: true },
                { method: 'rollDiplomacy', hasBonus: false },
                { method: 'rollIntimidate', hasBonus: false }
            ]

            socialTests.forEach(({ method, hasBonus }) => {
                rolls[method]()

                if (hasBonus) {
                    expect(actor.createRoll).toHaveBeenCalledWith(
                        '2d6 + @reaction',
                        { reaction: 1 },
                        'social'
                    )
                } else {
                    expect(actor.createRoll).toHaveBeenCalledWith(
                        '2d6 + @cha',
                        { cha: 3 },
                        'social'
                    )
                }
            })
        })
    })

    describe('Weapon Damage', () => {
        it('calculates damage with weapon dice and base damage', () => {
            const weapon = createMockItem('weapon', {
                system: { damage: '1d8', weaponType: 'melee' }
            })
            setAttr('str', 14, 4)

            global.Roll = vi.fn().mockImplementation(() => ({
                evaluate: vi.fn().mockResolvedValue(true),
                total: 12
            }))

            rolls.rollWeaponDamage(weapon, 15, 10) // attack 15 vs defense 10

            expect(global.Roll).toHaveBeenCalledWith(
                '1d8 + @base',
                { base: 9 } // (15-10) + 4 str
            )
        })

        it('handles weapons without damage dice', () => {
            const weapon = createMockItem('weapon', {
                system: { damage: '0', weaponType: 'melee' }
            })
            setAttr('str', 10, 2)

            rolls.rollWeaponDamage(weapon, 12, 8)

            // Should show base damage only (6 = 12-8+2)
            expect(actor._createRollChatMessage).toHaveBeenCalledWith(
                expect.stringContaining('Damage'),
                expect.any(Object),
                expect.stringContaining('Base Damage: 6')
            )
        })

        it('does not add strength to ranged weapon damage', () => {
            const bow = createMockItem('weapon', {
                system: { damage: '1d6', weaponType: 'ranged' }
            })
            setAttr('str', 14, 4)

            global.Roll = vi.fn().mockImplementation(() => ({
                evaluate: vi.fn().mockResolvedValue(true),
                total: 8
            }))

            rolls.rollWeaponDamage(bow, 15, 10)

            expect(global.Roll).toHaveBeenCalledWith(
                '1d6 + @base',
                { base: 5 } // (15-10), no str bonus
            )
        })
    })

    describe('Movement Roll', () => {
        it('rolls movement with effective movement value', () => {
            actor.system.details = {
                movement: 4,
                effectiveMovement: 3 // Encumbered
            }

            rolls.rollMovement()

            expect(actor.createRoll).toHaveBeenCalledWith('2d6 + @move', { move: 3 }, 'movement')
            expect(actor._createRollChatMessage).toHaveBeenCalledWith(
                `${actor.name} - Movement`,
                mockRoll
            )
        })

        it('falls back to base movement if no effective movement', () => {
            actor.system.details = { movement: 5 }

            rolls.rollMovement()

            expect(actor.createRoll).toHaveBeenCalledWith('2d6 + @move', { move: 5 }, 'movement')
        })
    })

    describe('Edge Cases', () => {
        it('handles missing skill bonuses', () => {
            setAttr('dex', 10, 2)
            // No stealth skill defined

            rolls.rollSneak()

            expect(actor.createRoll).toHaveBeenCalledWith(
                '2d6 + @dex + @stealth',
                { dex: 2, stealth: 0 },
                'stealth'
            )
        })

        it('handles missing combat stats', () => {
            delete actor.system.combat

            expect(() => rolls.rollAttack()).not.toThrow()
        })

        it('warns about trauma saves but does not implement', () => {
            const warnSpy = vi.spyOn(ui.notifications, 'warn').mockImplementation(() => { })

            rolls.rollTraumaSave('Critical Hit')

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Trauma Save')
            )
            warnSpy.mockRestore()
        })
    })
})
