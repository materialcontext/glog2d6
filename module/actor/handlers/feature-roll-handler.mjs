import { AttributeSelectionDialog } from '../../dialogs/attribute-selection-dialog.mjs';

export class FeatureRollHandler {
    constructor(actor) {
        this.actor = actor;
        this.rollConfigs = this.buildRollConfigs();
    }

    buildRollConfigs() {
        return {
            'Nimble': {
                dialog: true,
                description: 'Nimble maneuver'
            },
            'Escape Artist': {
                dialog: true,
                description: 'Escape attempt'
            },
            'Poisoner': {
                formula: '2d6 + @int',
                attribute: 'int',
                description: 'Poison knowledge/application'
            },
            'At the Gates': {
                dialog: true,
                description: 'Trying to keep you out is foolish'
            },
            'Tough': {
                formula: '2d6 + @con + 1',
                attribute: 'con',
                description: 'Endurance check'
            },
            'Courtly Education': {
                dialog: true,
                description: 'Courtly knowledge'
            },
            'Welcome Guest': {
                formula: '1d6',
                description: 'Welcome Guest charm'
            },
            'Never Forget a Face': {
                formula: '1d6',
                description: 'Face recognition'
            },
            'Trapper': {
                dialog: true,
                description: 'Trap knowledge/setting'
            },
            'Thievery Training': {
                dialog: true,
                description: 'Thievery check'
            },
            'Well-Planned Heist': {
                formula: '1d6',
                description: 'Heist planning'
            },
            'Black Market Gossip': {
                formula: '1d6',
                description: 'Gather information'
            },
            'Ancient Tongues': {
                formula: '1d6',
                description: 'Decipher ancient text'
            }
        };
    }

    async rollFeature(featureName) {
        const config = this.rollConfigs[featureName];

        // Handle reputation features
        if (featureName.toLowerCase().includes('reputation for')) {
            return this.openReputationDialog(featureName);
        }

        if (!config) {
            ui.notifications.warn(`No roll configuration for ${featureName}`);
            return;
        }

        if (config.dialog) {
            return this.openAttributeDialog(featureName);
        }

        return this.executeRoll(featureName, config);
    }

    async openReputationDialog(featureName) {
        const { ReputationRollDialog } = await import('../../dialogs/reputation-roll-dialog.mjs');

        const dialog = new ReputationRollDialog(this.actor, featureName, async (rollType) => {
            const config = {
                formula: '2d6 + @attr + @bonus',
                attribute: rollType === 'reaction' ? 'cha' : 'cha', // Both use CHA
                skill: rollType, // 'reaction' or 'diplomacy'
                description: `${featureName} (${rollType === 'reaction' ? 'Reaction' : 'Charisma check'})`
            };
            await this.executeRoll(featureName, config);
        });

        dialog.render(true);
    }

    async openAttributeDialog(featureName) {
        const dialog = new AttributeSelectionDialog(this.actor, featureName, async (selectedAttribute) => {
            const config = {
                formula: '2d6 + @attr + @bonus',
                attribute: selectedAttribute,
                skill: skill,
                description: `${featureName} (${selectedAttribute.toUpperCase()})`
            };
            await this.executeRoll(featureName, config);
        });

        dialog.render(true);
    }

    async executeRoll(featureName, config) {
        const rollData = this.buildRollData(config);
        const roll = this.actor.createRoll(config.formula, rollData, 'feature');
        await roll.evaluate();

        const extraContent = this.buildExtraContent(config, rollData);

        this.actor._createRollChatMessage(
            `${this.actor.name} - ${config.description}`,
            roll,
            extraContent
        );

        return roll;
    }

    buildRollData(config) {
        const data = {};

        // Add attribute modifier if specified
        if (config.attribute) {
            data[config.attribute] = this.actor.system.attributes[config.attribute].effectiveMod;
        }

        // Add skill bonus if applicable
        if (config.skill && this.actor.system.skills[config.skill]) {
            data.bonus = this.actor.system.skills[config.skill].bonus || 0;
        } else {
            data.bonus = 0;
        }

        return data;
    }

    buildExtraContent(config, rollData) {
        const parts = [];

        if (config.attribute) {
            const attrMod = rollData[config.attribute];
            if (attrMod !== 0) {
                parts.push(`${config.attribute.toUpperCase()}: ${attrMod >= 0 ? '+' : ''}${attrMod}`);
            }
        }

        if (rollData.bonus > 0) {
            parts.push(`Skill bonus: +${rollData.bonus}`);
        }

        return parts.length > 0 ? `<br><small>${parts.join(', ')}</small>` : '';
    }
}
