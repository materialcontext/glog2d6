import { GLOG } from "../helpers/config";

export class GlogActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["glog2d6", "sheet", "actor"],
      template: "systems/glog2d6/templates/actor/character-sheet.hbs",
      width: 720,
      height: 680,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "attributes" }]
    });
  }

  /** @override */
  get template() {
    return `systems/glog2d6/templates/actor/${this.actor.type}-sheet.hbs`;
  }

  /** @override */
  getData() {
    const context = super.getData();
    const actorData = this.actor.toObject(false);

    // Handle Quirk controls
    html.find('.quirk-add').click(this._onQuirkAdd.bind(this));
    html.find('.quirk-delete').click(this._onQuirkDelete.bind(this));

    // Rollable elements
    html.find('.rollable').click(this._onRoll.bind(this));

    // Item quantity changes
    html.find('input[data-item-id]').change(this._onItemQuantityChange.bind(this));
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

    // Get default image for type
    let img = "icons/svg/item-bag.svg";
    if (type === "weapon") img = "icons/svg/sword.svg";
    if (type === "armor") img = "icons/svg/shield.svg";
    if (type === "spell") img = "icons/svg/book.svg";
    if (type === "feature") img = "icons/svg/aura.svg";
    if (type === "template") img = "icons/svg/statue.svg";

    // Create the item
    const itemData = {
      name: game.i18n.format(`GLOG.New${type.capitalize()}`),
      type: type,
      img: img,
      system: {}
    };

    // Handle special cases for new items
    if (type === "template") {
      itemData.name = game.i18n.format("GLOG.NewTemplateWithLevel", {
        class: game.i18n.localize("GLOG.ClassFighter"),
        level: game.i18n.localize("GLOG.TemplateA")
      });
      itemData.system = {
        class: "fighter",
        level: "A",
        features: []
      };
    }

    return await Item.create(itemData, {parent: this.actor});
  }

  /**
   * Handle changing item quantities
   * @param {Event} event   The originating change event
   * @private
   */
  _onItemQuantityChange(event) {
    event.preventDefault();
    const input = event.currentTarget;
    const itemId = input.dataset.itemId;
    const item = this.actor.items.get(itemId);
    const field = input.dataset.itemProperty || "system.quantity";
    const value = Number(input.value);

    // Update the item
    const updateData = {};
    updateData[field] = value;
    item.update(updateData);
  }

  /**
   * Handle adding a quirk
   * @param {Event} event   The originating click event
   * @private
   */
  async _onQuirkAdd(event) {
    event.preventDefault();
    const quirks = this.actor.system.traits.quirks || [];

    // Add a new empty quirk
    quirks.push("");

    // Update the actor
    await this.actor.update({
      "system.traits.quirks": quirks
    });
  }

  /**
   * Handle deleting a quirk
   * @param {Event} event   The originating click event
   * @private
   */
  async _onQuirkDelete(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const li = button.closest(".quirk");
    const quirkId = Number(li.dataset.quirkId);

    // Get existing quirks
    const quirks = duplicate(this.actor.system.traits.quirks || []);

    // Remove the quirk
    quirks.splice(quirkId, 1);

    // Update the actor
    await this.actor.update({
      "system.traits.quirks": quirks
    });
  }

  /**
   * Handle adding a wound
   * @param {Event} event   The originating click event
   * @private
   */
  async _onWoundAdd(event) {
    event.preventDefault();

    // Create a new wound item
    const itemData = {
      name: game.i18n.localize("GLOG.NewWound"),
      type: "wound",
      img: "icons/svg/blood.svg",
      system: {
        severity: 1,
        effect: "",
        healing: ""
      }
    };

    return await Item.create(itemData, {parent: this.actor});
  }

  /**
   * Handle editing a wound
   * @param {Event} event   The originating click event
   * @private
   */
  _onWoundEdit(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".wound");
    const wound = this.actor.items.get(li.dataset.woundId);
    wound.sheet.render(true);
  }

  /**
   * Handle deleting a wound
   * @param {Event} event   The originating click event
   * @private
   */
  _onWoundDelete(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".wound");

    // Show confirmation dialog
    new Dialog({
      title: game.i18n.localize("GLOG.DeleteWound"),
      content: `<p>${game.i18n.localize("GLOG.DeleteWoundPrompt")}</p>`,
      buttons: {
        yes: {
          icon: '<i class="fas fa-trash"></i>',
          label: game.i18n.localize("GLOG.Yes"),
          callback: () => this.actor.deleteEmbeddedDocuments("Item", [li.dataset.woundId])
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("GLOG.No")
        }
      },
      default: "no"
    }).render(true);
  }

  /**
   * Handle spell casting
   * @param {Item} item   The spell item being cast
   * @private
   */
  _onSpellCast(item) {
    // Get spell data
    const spellData = item.system;
    const actor = this.actor;
    const actorData = actor.system;

    // Check if actor has enough dice
    if (!actorData.details.spellDice || actorData.details.spellDice.value <= 0) {
      ui.notifications.warn(game.i18n.localize("GLOG.NoSpellDiceLeft"));
      return;
    }

    // Create dialog for spell casting
    const maxDice = Math.min(actorData.details.spellDice.value, 4); // Maximum of 4 dice

    new Dialog({
      title: game.i18n.format("GLOG.CastSpellName", {name: item.name}),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("GLOG.SpellDice")}</label>
            <select id="dice-amount">
              ${Array.from(Array(maxDice).keys()).map(i =>
                `<option value="${i+1}">${i+1}</option>`
              ).join('')}
            </select>
          </div>
        </form>
      `,
      buttons: {
        cast: {
          icon: '<i class="fas fa-magic"></i>',
          label: game.i18n.localize("GLOG.Cast"),
          callback: html => {
            const diceAmount = parseInt(html.find('#dice-amount').val());
            this._castSpell(item, diceAmount);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("GLOG.Cancel")
        }
      },
      default: "cast"
    }).render(true);
  }

  /**
   * Cast a spell with a specific number of dice
   * @param {Item} item       The spell item being cast
   * @param {number} diceAmount  Number of dice to use
   * @private
   */
  async _castSpell(item, diceAmount) {
    const actor = this.actor;
    const spell = item.name;
    const spellSchool = item.system.school;

    // Create the roll
    const roll = new Roll(`${diceAmount}d6`);
    await roll.evaluate({async: true});

    // Check for doubles and triples (mishaps and dooms)
    const uniqueValues = [...new Set(roll.dice[0].results.map(d => d.result))];
    const hasDouble = roll.dice[0].results.length - uniqueValues.length >= 1;
    const hasTriple = diceAmount >= 3 && uniqueValues.length <= diceAmount - 2;

    let mishapText = "";
    let doomText = "";

    if (hasTriple) {
      doomText = game.i18n.format("GLOG.DoomTriggered", {school: spellSchool.capitalize()});
    } else if (hasDouble) {
      mishapText = game.i18n.format("GLOG.MishapTriggered", {school: spellSchool.capitalize()});
    }

    // Determine how many dice return to pool (1-3 return, 4-6 are used up)
    const returnedDice = roll.dice[0].results.filter(d => d.result <= 3).length;
    const usedDice = diceAmount - returnedDice;

    // Calculate spell effect
    const rollTotal = roll.total;

    // Update spell dice
    const currentDice = actor.system.details.spellDice.value;
    const newDiceValue = Math.max(0, currentDice - usedDice);

    await actor.update({
      "system.details.spellDice.value": newDiceValue
    });

    // Create chat message
    const messageContent = `
      <div class="glog2d6 spell-cast">
        <h2>${spell}</h2>
        <div class="spell-result">
          <p><strong>${game.i18n.localize("GLOG.DiceRolled")}:</strong> ${diceAmount}</p>
          <p><strong>${game.i18n.localize("GLOG.DiceReturned")}:</strong> ${returnedDice}</p>
          <p><strong>${game.i18n.localize("GLOG.DiceConsumed")}:</strong> ${usedDice}</p>
          <p><strong>${game.i18n.localize("GLOG.SpellEffect")}:</strong> ${item.system.effect}</p>
          <p><strong>${game.i18n.localize("GLOG.Total")}:</strong> ${rollTotal}</p>
          ${mishapText ? `<p class="mishap">${mishapText}</p>` : ''}
          ${doomText ? `<p class="doom">${doomText}</p>` : ''}
        </div>
      </div>
    `;

    // Send chat message
    ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      content: messageContent,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      roll: roll
    });
  }

  /**
   * Handle clickable rolls
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle different roll types
    if (dataset.roll) {
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      let label = dataset.label ? dataset.label : '';

      // Determine if this is a check, save, or other roll
      let rollType = "other";
      if (label.includes(game.i18n.localize("GLOG.AttributeStr"))) rollType = "check";
      if (label.includes(game.i18n.localize("GLOG.AttributeDex"))) rollType = "check";
      if (label.includes(game.i18n.localize("GLOG.AttributeCon"))) rollType = "check";
      if (label.includes(game.i18n.localize("GLOG.AttributeInt"))) rollType = "check";
      if (label.includes(game.i18n.localize("GLOG.AttributeWis"))) rollType = "check";
      if (label.includes(game.i18n.localize("GLOG.AttributeCha"))) rollType = "check";

      // For GLOG 2d6 checks, open a dialog for difficulty
      if (rollType === "check") {
        this._showCheckDialog(roll, label);
      } else {
        // For other rolls, just roll and display
        roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          flavor: label,
          rollMode: game.settings.get('core', 'rollMode')
        });
      }
    }
  }

  /**
   * Show dialog for attribute checks with difficulty selection
   * @param {Roll} roll    The prepared roll
   * @param {string} label   The label for the roll
   * @private
   */
  _showCheckDialog(roll, label) {
    new Dialog({
      title: game.i18n.format("GLOG.RollCheck", {name: label}),
      content: `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize("GLOG.Difficulty")}</label>
            <select id="difficulty">
              <option value="6">${game.i18n.localize("GLOG.CheckEasy")}</option>
              <option value="7" selected>${game.i18n.localize("GLOG.CheckNormal")}</option>
              <option value="8">${game.i18n.localize("GLOG.CheckHard")}</option>
              <option value="10">${game.i18n.localize("GLOG.Save")}</option>
            </select>
          </div>
        </form>
      `,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d6"></i>',
          label: game.i18n.localize("GLOG.Roll"),
          callback: html => {
            const difficulty = parseInt(html.find('#difficulty').val());
            this._rollCheck(roll, label, difficulty);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("GLOG.Cancel")
        }
      },
      default: "roll"
    }).render(true);
  }

  /**
   * Roll an attribute check with selected difficulty
   * @param {Roll} roll      The prepared roll
   * @param {string} label     The label for the roll
   * @param {number} difficulty  The difficulty target number
   * @private
   */
  async _rollCheck(roll, label, difficulty) {
    await roll.evaluate({async: true});

    // Determine success or failure
    const isSuccess = roll.total >= difficulty;
    const isCrit = roll.dice[0].results[0].result === 6 && roll.dice[0].results[1].result === 6;
    const isFumble = roll.dice[0].results[0].result === 1 && roll.dice[0].results[1].result === 1;

    // Create chat message
    let resultText;
    if (isCrit) {
      resultText = `<h3 class="success">${game.i18n.localize("GLOG.CriticalSuccess")}</h3>`;
    } else if (isFumble) {
      resultText = `<h3 class="failure">${game.i18n.localize("GLOG.CriticalFailure")}</h3>`;
    } else if (isSuccess) {
      resultText = `<h3 class="success">${game.i18n.localize("GLOG.Success")}</h3>`;
    } else {
      resultText = `<h3 class="failure">${game.i18n.localize("GLOG.Failure")}</h3>`;
    }

    const difficultyText = (difficulty === 10)
      ? game.i18n.localize("GLOG.Save")
      : game.i18n.format("GLOG.DifficultyTarget", {target: difficulty});

    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${label} - ${difficultyText}`,
      content: resultText
    });
  }
} Add the actor's data to context.data for easier access
    context.system = actorData.system;

    // Add roll data for TinyMCE editors
    context.rollData = this.actor.getRollData();

    // Add config data
    context.config = GLOG;

    // Prepare items
    if (actorData.type == 'character' || actorData.type == 'npc') {
      this._prepareCharacterItems(context);
    }

    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} context The actor data being prepared.
   */
  _prepareCharacterItems(context) {
    // Initialize containers
    const weapons = [];
    const armor = [];
    const gear = [];
    const templates = [];
    const features = [];
    const spells = [];
    const wounds = [];

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;

      // Append to appropriate arrays
      if (i.type === 'weapon') {
        weapons.push(i);
      }
      else if (i.type === 'armor') {
        armor.push(i);
      }
      else if (i.type === 'gear') {
        gear.push(i);
      }
      else if (i.type === 'template') {
        templates.push(i);
      }
      else if (i.type === 'feature') {
        features.push(i);
      }
      else if (i.type === 'spell') {
        spells.push(i);
      }
      else if (i.type === 'wound') {
        wounds.push(i);
      }
    }

    // Assign items to context
    context.weapons = weapons;
    context.armor = armor;
    context.gear = gear;
    context.templates = templates;
    context.features = features;
    context.spells = spells;
    context.wounds = wounds;
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
      const item = this.actor.items.get(li.data("itemId"));

      // Show confirmation dialog
      new Dialog({
        title: `Delete ${item.name}`,
        content: `<p>Are you sure you want to delete ${item.name}?</p>`,
        buttons: {
          yes: {
            icon: '<i class="fas fa-trash"></i>',
            label: "Yes",
            callback: () => this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")])
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: "No"
          }
        },
        default: "no"
      }).render(true);
    });

    // Cast Spell
    html.find('.spell-cast').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));

      // Open a dialog for spell casting
      this._onSpellCast(item);
    });

    // Handle Wound controls
    html.find('.wound-add').click(this._onWoundAdd.bind(this));
    html.find('.wound-edit').click(this._onWoundEdit.bind(this));
    html.find('.wound-delete').click(this._onWoundDelete.bind(this));

    //
