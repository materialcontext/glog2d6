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
                description: 'Nimble maneuver',
                localBonus: 1
            },
            'Escape Artist': {
                dialog: true,
                description: 'Escape attempt',
                localBonus: 2
            },
            'Poisoner': {
                formula: '2d6 + @int',
                attribute: 'int',
                description: 'Poison knowledge/application'
            },
            'At the Gates': {
                dialog: true,
                description: 'Trying to keep you out is foolish',
                localBonus: 1
            },
            'Tough': {
                formula: '2d6 + @con + 1',
                attribute: 'con',
                description: 'Endurance check',
                localBonus: 1
            },
            'Courtly Education': {
                dialog: true,
                description: 'Courtly knowledge',
                localBonus: 1
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
                description: 'Trap knowledge/setting',
                localBonus: 2
            },
            'Thievery Training': {
                dialog: true,
                description: 'Thievery check',
                localBonus: 1
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
            const reputationFeature = this.actor.items.find(i =>
                i.type === "feature" &&
                i.system.active &&
                i.name.includes("Reputation for")
            );

            const reputationMod = this.getReputationModifier(reputationFeature);

            const config = {
                formula: rollType === 'reaction' ? '2d6 + @reputation' : '2d6 + @attr + @reputation',
                attribute: rollType === 'reaction' ? null : 'cha',
                reputationMod: reputationMod,
                description: `${featureName} (${rollType === 'reaction' ? 'Reaction' : 'Diplomacy'})`
            };
            await this.executeRoll(featureName, config);
        });

        dialog.render(true);
    }

    getReputationModifier(reputationFeature) {
        if (!reputationFeature?.system.reputationType) return 0;

        // Get reputation data and return modifier
        const reputations = CONFIG.GLOG?.REPUTATIONS?.reputations || [];
        const repData = reputations.find(r => r.name === reputationFeature.system.reputationType);

        // Parse the modifier from description (e.g., "+1 bonus" or "-1 penalty")
        if (repData?.description.includes('+1')) return 1;
        if (repData?.description.includes('-1')) return -1;
        return 0;
    }

    async openAttributeDialog(featureName) {
        const dialog = new AttributeSelectionDialog(this.actor, featureName, async (selectedAttribute) => {
            const config = {
                formula: '2d6 + @attr + @bonus',
                attribute: selectedAttribute,
                description: `${featureName} (${selectedAttribute.toUpperCase()})`
            };
            await this.executeRoll(featureName, config);
        });

        dialog.render(true);
    }

    async executeRoll(featureName, config) {
        const featureConfig = this.rollConfigs[featureName];

        // Add local bonus from feature config
        if (featureConfig?.localBonus && !config.localBonus) {
            config.localBonus = featureConfig.localBonus;
        }

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

        if (config.attribute) {
            data.attr = this.actor.system.attributes[config.attribute].effectiveMod;
        } else {
            data.attr = 0;
        }

        data.reputation = config.reputationMod || 0;

        return data;
    }

    buildExtraContent(config, rollData) {
        const parts = [];

        if (config.attribute && rollData.attr !== 0) {
            parts.push(`${config.attribute.toUpperCase()}: ${rollData.attr >= 0 ? '+' : ''}${rollData.attr}`);
        }

        if (rollData.reputation !== 0) {
            parts.push(`Reputation: ${rollData.reputation >= 0 ? '+' : ''}${rollData.reputation}`);
        }

        if (rollData.bonus > 0) {
            parts.push(`Skill bonus: +${rollData.bonus}`);
        }

        return parts.length > 0 ? `<br><small>${parts.join(', ')}</small>` : '';
    }
}
