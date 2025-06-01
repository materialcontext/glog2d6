export class GLOG2D6ItemSheet extends foundry.appv1.sheets.ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["glog2d6", "sheet", "item"],
      width: 520,
      height: 480
    });
  }

  get template() {
    const path = "systems/glog2d6/templates/item";
    return `${path}/item-${this.item.type}-sheet.hbs`;
  }

  getData() {
    const context = super.getData();

    // Add roll data for formulas
    context.rollData = {};
    context.system = context.item.system;
    context.flags = context.item.flags;

    // Add type-specific data
    if (this.item.type === "armor") {
      context.armorTypes = {
        "light": "Light",
        "medium": "Medium",
        "heavy": "Heavy"
      };
    }

    if (this.item.type === "weapon") {
      context.weaponSizes = CONFIG.GLOG.CONSTANTS.WEAPON_SIZES;
    }

    if (this.item.type === "gear") {
      context.gearSizes = {
        "tiny": "Tiny",
        "small": "Small",
        "medium": "Medium",
        "large": "Large"
      };
    }

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Update armor values when type changes
    html.find('select[name="system.type"]').change(this._onArmorTypeChange.bind(this));

    // Update weapon values when type/size changes
    html.find('select[name="system.weaponType"]').change(this._onWeaponTypeChange.bind(this));
    html.find('select[name="system.size"]').change(this._onWeaponSizeChange.bind(this));
  }

  _onWeaponTypeChange(event) {
    const weaponType = event.target.value;
    const form = event.target.closest('form');
    const sizeSelect = form.querySelector('select[name="system.size"]');

    // Set default damage based on weapon type and current size
    this._updateWeaponDefaults(form, weaponType, sizeSelect.value);
  }

  _onWeaponSizeChange(event) {
    const size = event.target.value;
    const form = event.target.closest('form');
    const typeSelect = form.querySelector('select[name="system.weaponType"]');

    // Set default values based on size
    this._updateWeaponDefaults(form, typeSelect.value, size);
  }

  _updateWeaponDefaults(form, weaponType, size) {
    let damage, slots, attackPenalty, encumbrancePenalty;

    // Set defaults based on weapon type and size
    if (weaponType === "ranged") {
      damage = "1d6";
      slots = 1;
      attackPenalty = 0;
      encumbrancePenalty = 0;
    } else {
      // Melee weapons
      switch(size) {
        case 'light':
          damage = "1";
          slots = 1;
          attackPenalty = 0;
          encumbrancePenalty = 0;
          break;
        case 'medium':
          damage = "1d6";
          slots = 1;
          attackPenalty = 0;
          encumbrancePenalty = 0;
          break;
        case 'heavy':
          damage = "1d10";
          slots = 2;
          attackPenalty = 1;
          encumbrancePenalty = 1;
          break;
        default:
          damage = "1d6";
          slots = 1;
          attackPenalty = 0;
          encumbrancePenalty = 0;
      }
    }

    // Update form fields
    form.querySelector('input[name="system.damage"]').value = damage;
    form.querySelector('input[name="system.slots"]').value = slots;
    form.querySelector('input[name="system.attackPenalty"]').value = attackPenalty;
    form.querySelector('input[name="system.encumbrancePenalty"]').value = encumbrancePenalty;
  }

  _onArmorTypeChange(event) {
    const armorType = event.target.value;
    const form = event.target.closest('form');

    // Set default values based on armor type
    let armorBonus, encumbrancePenalty;
    switch(armorType) {
      case 'light':
        armorBonus = 1;
        encumbrancePenalty = 0;
        break;
      case 'medium':
        armorBonus = 2;
        encumbrancePenalty = 1;
        break;
      case 'heavy':
        armorBonus = 3;
        encumbrancePenalty = 2;
        break;
      default:
        armorBonus = 1;
        encumbrancePenalty = 0;
    }

    form.querySelector('input[name="system.armorBonus"]').value = armorBonus;
    form.querySelector('input[name="system.encumbrancePenalty"]').value = encumbrancePenalty;
  }
}
