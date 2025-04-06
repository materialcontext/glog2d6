export class MySystemItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["my-foundry-system", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    const path = "systems/my-foundry-system/templates/item";
    return `${path}/${this.item.type}-sheet.hbs`;
  }

  /** @override */
  getData() {
    const context = super.getData();

    // Add item data
    const itemData = context.item.toObject(false);

    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;
  }
}
