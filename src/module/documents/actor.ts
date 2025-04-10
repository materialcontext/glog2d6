import { GLOG } from "../helpers/config.js";

/**
 * Extend the base Actor document to implement system-specific logic
 * @extends {Actor}
 */
export class GlogActor extends Actor {
  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareData(): void {
    super.prepareData();
  }

  /**
   * Prepare base data for an Actor
   * @override
   */
  prepareBaseData(): void {
    super.prepareBaseData();
    const actorData = this.system as GlogActorDataSource;

    // Reset derived values that will be calculated in prepareDerivedData
    if (actorData.derived) {
      actorData.derived.defense.value = 0;
      actorData.derived.initiative.value = 0;
    }
  }

  /**
   * Prepare derived data that depends on other attributes
   * @override
   */
  prepareDerivedData(): void {
    const actorData = this.system as GlogActorDataSource;

    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
  }

  /**
   * Prepare Character type specific data
   * @param {GlogActorDataSource} actorData The actor data being prepared
   * @private
   */
  _prepareCharacterData(actorData: GlogActorDataSource): void {
    if (this.type !== 'character') return;

    // Calculate attribute modifiers using the GLOG 2d6 table
    this._calculateAttributeModifiers(actorData);

    // Calculate derived stats
    this._calculateDerivedStats(actorData);
  }

  /**
   * Prepare NPC type specific data
   * @param {GlogActorDataSource} actorData The actor data being prepared
   * @private
   */
  _prepareNpcData(actorData: GlogActorDataSource): void {
    if (this.type !== 'npc') return;

    // Calculate attribute modifiers
    this._calculateAttributeModifiers(actorData);

    // Calculate derived stats
    this._calculateDerivedStats(actorData);
  }

  /**
   * Calculate attribute modifiers based on GLOG 2d6 rules
   * @param {GlogActorDataSource} actorData The actor data being prepared
   * @private
   */
  _calculateAttributeModifiers(actorData: GlogActorDataSource): void {
    // Loop through all attributes
    for (const [key, attribute] of Object.entries(actorData.attributes)) {
      // Calculate the modifier using the GLOG 2d6 attribute table
      const value = attribute.value;

      // GLOG 2d6 modifier table
      if (value === 2) {
        attribute.mod = -3;
      } else if (value >= 3 && value <= 4) {
        attribute.mod = -2;
      } else if (value >= 5 && value <= 6) {
        attribute.mod = -1;
      } else if (value === 7) {
        attribute.mod = 0;
      } else if (value >= 8 && value <= 9) {
        attribute.mod = 1;
      } else if (value >= 10 && value <= 11) {
        attribute.mod = 2;
      } else if (value >= 12) {
        attribute.mod = 3;
      }
    }
  }

  /**
   * Calculate all derived statistics
   * @param {GlogActorDataSource} actorData The actor data being prepared
   * @private
   */
  _calculateDerivedStats(actorData: GlogActorDataSource): void {
    // Skip if no derived data exists
    if (!actorData.derived) return;

    // Calculate defense (Dexterity bonus minus Encumbrance)
    const dexMod = actorData.attributes.dexterity.mod;
    actorData.derived.defense.dexterity = dexMod > 0 ? dexMod : 0;
    actorData.derived.defense.value = actorData.derived.defense.armor +
                                     actorData.derived.defense.dexterity -
                                     actorData.derived.encumbrance.value;

    // Calculate initiative (based on Wisdom)
    actorData.derived.initiative.value = actorData.attributes.wisdom.mod +
                                        actorData.derived.initiative.bonus;

    // Calculate movement based on base value and modifiers
    this._calculateMovement(actorData);
  }

  /**
   * Calculate movement values
   * @param {GlogActorDataSource} actorData The actor data being prepared
   * @private
   */
  _calculateMovement(actorData: GlogActorDataSource): void {
    // Base movement calculations
    const base = actorData.derived.movement.value;

    if (base === 4) {
      actorData.derived.movement.exploration = 120;
      actorData.derived.movement.combat = 40;
      actorData.derived.movement.running = 120;
      actorData.derived.movement.milesPerDay = 24;
    } else if (base === 3) {
      actorData.derived.movement.exploration = 90;
      actorData.derived.movement.combat = 30;
      actorData.derived.movement.running = 90;
      actorData.derived.movement.milesPerDay = 18;
    } else if (base === 2) {
      actorData.derived.movement.exploration = 60;
      actorData.derived.movement.combat = 20;
      actorData.derived.movement.running = 60;
      actorData.derived.movement.milesPerDay = 12;
    } else if (base === 1) {
      actorData.derived.movement.exploration = 30;
      actorData.derived.movement.combat = 10;
      actorData.derived.movement.running = 30;
      actorData.derived.movement.milesPerDay = 6;
    } else if (base <= 0) {
      actorData.derived.movement.exploration = 0;
      actorData.derived.movement.combat = 0;
      actorData.derived.movement.running = 0;
      actorData.derived.movement.milesPerDay = 0;
    }
  }
}
