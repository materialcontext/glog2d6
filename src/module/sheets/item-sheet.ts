import { GLOG } from "../helpers/config";

export class GlogItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["glog2d6", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    return `systems/glog2d6/templates/item/${this.item.type}-sheet.hbs`;
  }

  /** @override */
  getData() {
    const context = super.getData();

    // Add item data
    const itemData = context.item.toObject(false);
    context.system = itemData.system;

    // Add config data
    context.config = GLOG;

    // Add type-specific data
    if (this.item.type === 'weapon') {
      context.isRanged = ['ranged', 'firearm'].includes(context.system.weaponType);
    }

    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Handle feature list in template sheet
    if (this.item.type === 'template') {
      html.find('.feature-add').click(this._onFeatureAdd.bind(this));
      html.find('.feature-delete').click(this._onFeatureDelete.bind(this));
    }
  }

  /**
   * Handle adding a feature to a template
   * @private
   */
  async _onFeatureAdd(event) {
    event.preventDefault();

    // Get existing features
    const features = duplicate(this.item.system.features || []);

    // Add a new empty feature
    features.push("");

    // Update the item
    await this.item.update({
      "system.features": features
    });
  }

  /**
   * Handle deleting a feature from a template
   * @param {Event} event   The originating click event
   * @private
   */
  async _onFeatureDelete(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const index = button.dataset.index;

    // Get existing features
    const features = duplicate(this.item.system.features || []);

    // Remove the feature
    features.splice(index, 1);

    // Update the item
    await this.item.update({
      "system.features": features
    });
  }
}
