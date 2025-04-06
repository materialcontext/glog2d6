export class MySystemActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["my-foundry-system", "sheet", "actor"],
      template: "systems/my-foundry-system/templates/actor/character-sheet.hbs",
      width: 600,
      height: 680,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "attributes" }]
    });
  }

  /** @override */
  getData() {
    // Basic data
    const context = super.getData();

    // Add actor and item data
    const actorData = context.actor.toObject(false);

    // Add labels for attributes
    const labels = {
      attributes: {
        strength: game.i18n.localize("MY-SYSTEM.AbilityStr"),
        dexterity: game.i18n.localize("MY-SYSTEM.AbilityDex"),
        constitution: game.i18n.localize("MY-SYSTEM.AbilityCon"),
        intelligence: game.i18n.localize("MY-SYSTEM.AbilityInt"),
        wisdom: game.i18n.localize("MY-SYSTEM.AbilityWis"),
        charisma: game.i18n.localize("MY-SYSTEM.AbilityCha")
      }
    };

    // Add to context
    context.labels = labels;

    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Update Inventory Item
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
    });
  }

  /**
   * Handle creating a new Owned Item for the actor
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;

    // Create a new item
    const itemData = {
      name: `New ${type.capitalize()}`,
      type: type,
      data: {}
    };
    await this.actor.createEmbeddedDocuments("Item", [itemData]);
  }
}
