// src/module/helpers/content-packs.ts

import { ClassFeatures } from "../data/class-features.js";
import { Spells } from "../data/spells.js";
import { Wounds } from "../data/wounds.js";

/**
 * Helper for creating and managing content packs
 */
export class ContentPacks {

  /**
   * Create initial content packs for the system
   */
  static async createInitialPacks(): Promise<void> {
    // Only proceed if the user is a GM
    if (!game.user.isGM) return;

    // Check if packs already exist
    const existingPacks = game.packs.filter(p => p.metadata.package === "glog2d6");
    if (existingPacks.length > 0) return;

    // Create spell pack
    await this.createSpellPack();

    // Create feature pack
    await this.createFeaturePack();

    // Create wound pack
    await this.createWoundPack();

    // Notify the user
    ui.notifications.info("GLOG 2d6 content packs created successfully!");
  }

  /**
   * Create the spell pack
   */
  static async createSpellPack(): Promise<void> {
    // Create the compendium pack
    const pack = await CompendiumCollection.createCompendium({
      name: "spells",
      label: "GLOG Spells",
      path: "packs/spells.db",
      entity: "Item",
      package: "glog2d6"
    });

    // Add spells to the pack
    for (const spell of Spells) {
      await Item.create(spell, {pack: pack.collection});
    }
  }

  /**
   * Create the feature pack
   */
  static async createFeaturePack(): Promise<void> {
    // Create the compendium pack
    const pack = await CompendiumCollection.createCompendium({
      name: "features",
      label: "GLOG Features",
      path: "packs/features.db",
      entity: "Item",
      package: "glog2d6"
    });

    // Add features to the pack
    for (const feature of ClassFeatures) {
      await Item.create(feature, {pack: pack.collection});
    }
  }

  /**
   * Create the wound pack
   */
  static async createWoundPack(): Promise<void> {
    // Create the compendium pack
    const pack = await CompendiumCollection.createCompendium({
      name: "wounds",
      label: "GLOG Wounds",
      path: "packs/wounds.db",
      entity: "Item",
      package: "glog2d6"
    });

    // Add wounds to the pack
    for (const wound of Wounds) {
      await Item.create(wound, {pack: pack.collection});
    }
  }
}
