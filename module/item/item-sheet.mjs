export class GLOG2D6ItemSheet extends foundry.appv1.sheets.ItemSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["glog2d6", "sheet", "item"],
      width: 520,
      height: 480
    });
  }

  get template() {
    const path = "systems/glog2d6/templates/item";
    return ``;
  }

  getData() {
    const context = super.getData();
  }

  activateListeners(html) {
    super.activateListeners(html);
  }
}
