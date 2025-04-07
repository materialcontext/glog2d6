import { GLOG } from "../helpers/config.js";
import { CharacterGenerator } from "../generators/character-generator.js";
import { LevelUp } from "../generators/level-up.js";

/**
 * Extend the basic ActorSheet with system-specific functionality
 * @extends {ActorSheet}
 */
export class GlogActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["glog2d6", "sheet", "actor"],
      template: "systems/glog2d6/templates/actor/character-sheet.hbs",
      width: 720,
      height: 680,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".tab-content", initial: "attributes" }],
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
    });
  }

  /** @override */
  get template(): string {
    return `systems/glog2d6/templates/actor/${this.actor.type}-sheet.hbs`;
  }

  /** @override */
  getData(): object {
    const context = super.getData() as any;
    const actorData = this.actor.toObject(false);

    // Add the actor's data to context for easier access
    context.system = actorData.system;

    // Add roll data for TinyMCE editors
    context.rollData = this.actor.getRollData();

    // Add config data
    context.config = GLOG;

    // Check if actor can level up
    context.canLevelUp = this._checkCanLevelUp();

    // Check if actor is a wizard
    context.isWizard = this._hasWizardClass();

    // Prepare items
    if (actorData.type == 'character' || actorData.type == 'npc') {
      this._prepareCharacterItems(context);
    }

    return context;
  }

  /**
   * Check if character can level up based on XP
   * @private
   */
  _checkCanLevelUp(): boolean {
    const actorData = this.actor.system;
    const currentLevel = actorData.details.level;
    const currentXP = actorData.details.xp.value;

    // XP requirements for each level
    const xpRequirements = [0, 1, 2000, 7000, 12000, 24000, 42000, 60000, 80000];

    // Check if character has enough XP and is below max level
    return currentLevel < 8 && currentXP >= xpRequirements[currentLevel + 1];
  }

  /**
   * Check if the character has a wizard class template
   * @private
   */
  _hasWizardClass(): boolean {
    const items = this.actor.items;
    return items.some(i => i.type === 'template' && i.system.class === 'wizard');
  }

  /**
   * Organize and classify Items for Character sheets
   * @param {Object} context The actor data being prepared
   * @private
   */
  _prepareCharacterItems(context: any): void {
    // Initialize containers
    const weapons: any[] = [];
    const armor: any[] = [];
    const gear: any[] = [];
    const templates: any[] = [];
    const features: any[] = [];
    const spells: any[] = [];
    const wounds: any[] = [];

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

    // Sort items by name
    const sorter = (a, b) => a.name.localeCompare(b.name);
    weapons.sort(sorter);
    armor.sort(sorter);
    gear.sort(sorter);
    templates.sort((a, b) => {
      // Sort templates by level first, then by name
      const levelOrder = { A: 1, B: 2, C: 3, D: 4 };
      const levelDiff = levelOrder[a.system.level] - levelOrder[b.system.level];
      return levelDiff !== 0 ? levelDiff : a.name.localeCompare(b.name);
    });
    features.sort(sorter);
    spells.sort(sorter);
    wounds.sort((a, b) => a.system.severity - b.system.severity);

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
  activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Level Up button listener
    html.find('.level-up-btn').click(this._onLevelUp.bind(this));

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Update Inventory Item
    html.find('.edit-btn').click(ev => {
      const li = $(ev.currentTarget).closest(".item");
      const item = this.actor.items.get(li.data("itemId") as string);
      if (item) item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.delete-btn').click(this._onItemDelete.bind(this));

    // Cast Spell
    html.find('.cast-btn').click(ev => {
      const li = $(ev.currentTarget).closest(".item");
      const item = this.actor.items.get(li.data("itemId") as string);
      if (item) this._onSpellCast(item);
    });

    // Handle Wound controls
    html.find('.add-wound-btn').click(this._onWoundAdd.bind(this));
    html.find('.wound-edit').click(this._onWoundEdit.bind(this));
    html.find('.wound-delete').click(this._onWoundDelete.bind(this));

    // Handle Quirk controls
    html.find('.add-quirk-btn').click(this._onQuirkAdd.bind(this));
    html.find('.quirk-delete').click(this._onQuirkDelete.bind(this));

    // Rollable elements
    html.find('.rollable, .attribute-modifier').click(this._onRoll.bind(this));

    // Item quantity changes
    html.find('input[data-item-id]').change(this._onItemQuantityChange.bind(this));

    // Setup tooltips
    this._setupTooltips(html);
  }

  /**
   * Setup tooltips for the sheet
   * @param {JQuery} html The sheet's rendered HTML
   * @private
   */
  _setupTooltips(html: JQuery): void {
    // The tooltips are handled through CSS, no additional setup required
    // But we could add more advanced tooltip handling here if needed
  }

  /**
   * Handle creating a new Owned Item for the actor
   * @param {Event} event The originating click event
   * @private
   */
  async _onItemCreate(event: Event): Promise<Item | undefined> {
    event.preventDefault();
    const header = event.currentTarget as HTMLElement;
    const type = header.dataset.type as string;

    // Get default image for type
    let img = "icons/svg/item-bag.svg";
    if (type === "weapon") img = "icons/svg/sword.svg";
    if (type === "armor") img = "icons/svg/shield.svg";
    if (type === "spell") img = "icons/svg/book.svg";
    if (type === "feature") img = "icons/svg/aura.svg";
    if (type === "template") img = "icons/svg/statue.svg";
    if (type === "wound") img = "icons/svg/blood.svg";

    // Create the item
    const itemData: any = {
      name: game.i18n.format(`GLOG.New${type.charAt(0).toUpperCase() + type.slice(1)}`),
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
   * Handle deleting an item
   * @param {Event} event The originating click event
   * @private
   */
  _onItemDelete(event: Event): void {
    event.preventDefault();
    const li = $(event.currentTarget).closest(".item");
    const itemId = li.data("itemId") as string;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    // Show confirmation dialog
    new Dialog({
      title: `Delete ${item.name}`,
      content: `<p>Are you sure you want to delete ${item.name}?</p>`,
      buttons: {
        yes: {
          icon: '<i class="fas fa-trash"></i>',
          label: "Yes",
          callback: () => this.actor.deleteEmbeddedDocuments("Item", [itemId])
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: "No"
        }
      },
      default: "no"
    }).render(true);
  }

  /**
   * Handle changing item quantities
   * @param {Event} event The originating change event
   * @private
   */
  _onItemQuantityChange(event: Event): void {
    event.preventDefault();
    const input = event.currentTarget as HTMLInputElement;
    const itemId = input.dataset.itemId;
    if (!itemId) return;

    const item = this.actor.items.get(itemId);
    if (!item) return;

    const field = input.dataset.itemProperty || "system.quantity";
    const value = Number(input.value);

    // Update the item
    const updateData: any = {};
    updateData[field] = value;
    item.update(updateData);
  }

  /**
   * Handle adding a quirk
   * @param {Event} event The originating click event
   * @private
   */
  async _onQuirkAdd(event: Event): Promise<void> {
    event.preventDefault();
    const quirks = duplicate(this.actor.system.traits?.quirks || []) as string[];

    // Add a new empty quirk
    quirks.push("");

    // Update the actor
    await this.actor.update({
      "system.traits.quirks": quirks
    });
  }

  /**
   * Handle deleting a quirk
   * @param {Event} event The originating click event
   * @private
   */
  async _onQuirkDelete(event: Event): Promise<void> {
    event.preventDefault();
    const button = event.currentTarget as HTMLElement;
    const li = button.closest(".quirk") as HTMLElement;
    const quirkId = Number(li.dataset.quirkId);

    // Get existing quirks
    const quirks = duplicate(this.actor.system.traits?.quirks || []) as string[];

    // Remove the quirk
    quirks.splice(quirkId, 1);

    // Update the actor
    await this.actor.update({
      "system.traits.quirks": quirks
    });
  }

  /**
   * Handle adding a wound
   * @param {Event} event The originating click event
   * @private
   */
  async _onWoundAdd(event: Event): Promise<Item | undefined> {
    event.preventDefault();

    // Create a dialog to select existing wound or create new
    const woundPack = game.packs.get("glog2d6.wounds");
    let woundOptions = "";

    if (woundPack) {
      const wounds = await woundPack.getDocuments();
      woundOptions = wounds.map(w => `<option value="${w.id}">${w.name}</option>`).join("");
    }

    new Dialog({
      title: game.i18n.localize("GLOG.AddWound"),
      content: `
        <form>
          <div class="form-group">
            <label>Select a wound:</label>
            <select id="wound-select">
              <option value="new">${game.i18n.localize("GLOG.CreateNew")}</option>
              ${woundOptions}
            </select>
          </div>
        </form>
      `,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: game.i18n.localize("GLOG.Add"),
          callback: async (html) => {
            const select = html.find('#wound-select')[0] as HTMLSelectElement;
            const woundId = select.value;

            if (woundId === "new") {
              // Create a new wound
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
            } else if (woundPack) {
              // Get the wound from the compendium
              const wound = await woundPack.getDocument(woundId);
              if (wound) {
                const woundData = wound.toObject();
                return await Item.create(woundData, {parent: this.actor});
              }
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("GLOG.Cancel")
        }
      },
      default: "add"
    }).render(true);
  }

  /**
   * Handle editing a wound
   * @param {Event} event The originating click event
   * @private
   */
  _onWoundEdit(event: Event): void {
    event.preventDefault();
    const li = (event.currentTarget as HTMLElement).closest(".wound") as HTMLElement;
    if (!li?.dataset.woundId) return;

    const wound = this.actor.items.get(li.dataset.woundId);
    if (wound) wound.sheet.render(true);
  }

  /**
   * Handle deleting a wound
   * @param {Event} event The originating click event
   * @private
   */
  _onWoundDelete(event: Event): void {
    event.preventDefault();
    const li = (event.currentTarget as HTMLElement).closest(".wound") as HTMLElement;
    if (!li?.dataset.woundId) return;

    // Show confirmation dialog
    new Dialog({
      title: game.i18n.localize("GLOG.DeleteWound"),
      content: `<p>${game.i18n.localize("GLOG.DeleteWoundPrompt")}</p>`,
      buttons: {
        yes: {
          icon: '<i class="fas fa-trash"></i>',
          label: game.i18n.localize("GLOG.Yes"),
          callback: () => this.actor.deleteEmbeddedDocuments("Item", [li.dataset.woundId as string])
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
   * Handle leveling up
   * @param {Event} event The originating click event
   * @private
   */
  _onLevelUp(event: Event): void {
    event.preventDefault();

    // Only for character actors
    if (this.actor.type !== 'character') return;

    // Only allow level up if there's enough XP
    if (!this._checkCanLevelUp()) {
      ui.notifications.warn(game.i18n.localize("GLOG.NotEnoughXP"));
      return;
    }

    // Perform level up
    LevelUp.levelUp(this.actor);
  }

  /**
   * Handle spell casting
   * @param {Item} item The spell item being cast
   * @private
   */
  _onSpellCast(item: Item): void {
    // Get spell data
    const spellData = item.system;
    const actor = this.actor;
    const actorData = actor.system as GlogActorDataSource;

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
        <form class="glog2d6">
          <div class="form-group">
            <label>${game.i18n.localize("GLOG.SpellDice")}</label>
            <select id="dice-amount">
              ${Array.from(Array(maxDice).keys()).map(i =>
                `<option value="${i+1}">${i+1}</option>`
              ).join('')}
            </select>
          </div>
          <div class="spell-details">
            <div class="spell-property">
              <span class="property-label">${game.i18n.localize("GLOG.School")}:</span>
              <span class="property-value">${item.system.school || "—"}</span>
            </div>
            <div class="spell-property">
              <span class="property-label">${game.i18n.localize("GLOG.Range")}:</span>
              <span class="property-value">${item.system.range || "—"}</span>
            </div>
            <div class="spell-property">
              <span class="property-label">${game.i18n.localize("GLOG.Target")}:</span>
              <span class="property-value">${item.system.target || "—"}</span>
            </div>
            <div class="spell-property">
              <span class="property-label">${game.i18n.localize("GLOG.Duration")}:</span>
              <span class="property-value">${item.system.duration || "—"}</span>
            </div>
            <div class="spell-effect">
              <p>${item.system.effect || ""}</p>
            </div>
          </div>
        </form>
      `,
      buttons: {
        cast: {
          icon: '<i class="fas fa-magic"></i>',
          label: game.i18n.localize("GLOG.Cast"),
          callback: (html) => {
            const diceAmount = parseInt((html.find('#dice-amount')[0] as HTMLSelectElement).value);
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
   * @param {Item} item The spell item being cast
   * @param {number} diceAmount Number of dice to use
   * @private
   */
  async _castSpell(item: Item, diceAmount: number): Promise<void> {
    const actor = this.actor;
    const spell = item.name;
    const spellSchool = item.system.school;

    // Create the roll
    const roll = new Roll(`${diceAmount}d6`);
    await roll.evaluate({async: true});

    // Check for doubles and triples (mishaps and dooms)
    const results = roll.dice[0].results.map(d => d.result);
    const uniqueValues = [...new Set(results)];
    const hasDouble = roll.dice[0].results.length - uniqueValues.length >= 1;
    const hasTriple = diceAmount >= 3 && uniqueValues.length <= diceAmount - 2;

    let mishapText = "";
    let doomText = "";

    if (hasTriple) {
      doomText = game.i18n.format("GLOG.DoomTriggered", {
        school: spellSchool ? String(spellSchool).charAt(0).toUpperCase() + String(spellSchool).slice(1) : "Unknown"
      });
    } else if (hasDouble) {
      mishapText = game.i18n.format("GLOG.MishapTriggered", {
        school: spellSchool ? String(spellSchool).charAt(0).toUpperCase() + String(spellSchool).slice(1) : "Unknown"
      });
    }

    // Determine how many dice return to pool (1-3 return, 4-6 are used up)
    const returnedDice = roll.dice[0].results.filter(d => d.result <= 3).length;
    const usedDice = diceAmount - returnedDice;

    // Calculate spell effect
    const rollTotal = roll.total;

    // Update spell dice
    const currentDice = Number((this.actor.system as GlogActorDataSource).details.spellDice?.value || 0);
    const newDiceValue = Math.max(0, currentDice - usedDice);

    await this.actor.update({
      "system.details.spellDice.value": newDiceValue
    });

    // Create chat message
    const messageContent = `
      <div class="glog2d6 spell-cast">
        <h2>${spell}</h2>
        <div class="spell-result">
          <div class="dice-roll">
            <div class="dice-result">
              <div class="dice-formula">${diceAmount}d6</div>
              <div class="dice-tooltip">
                <div class="dice">
                  <ol class="dice-rolls">
                    ${results.map(r => `<li class="roll die d6">${r}</li>`).join('')}
                  </ol>
                </div>
              </div>
            </div>
          </div>
          <div class="spell-details">
            <p><strong>${game.i18n.localize("GLOG.DiceRolled")}:</strong> ${diceAmount}</p>
            <p><strong>${game.i18n.localize("GLOG.DiceReturned")}:</strong> ${returnedDice}</p>
            <p><strong>${game.i18n.localize("GLOG.DiceConsumed")}:</strong> ${usedDice}</p>
            <p><strong>${game.i18n.localize("GLOG.SpellEffect")}:</strong> ${item.system.effect}</p>
            <p><strong>${game.i18n.localize("GLOG.Total")}:</strong> ${rollTotal}</p>
            ${mishapText ? `<p class="mishap">${mishapText}</p>` : ''}
            ${doomText ? `<p class="doom">${doomText}</p>` : ''}
          </div>
        </div>
      </div>
    `;

    // Send chat message
    ChatMessage.create({
      user: game.user?.id || "",
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: messageContent,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      roll: roll
    });
  }

  /**
   * Handle clickable rolls
   * @param {Event} event The originating click event
   * @private
   */
  _onRoll(event: Event): void {
    event.preventDefault();
    const element = event.currentTarget as HTMLElement;
    const dataset = element.dataset;

    // Handle different roll types
    if (dataset.roll) {
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      let label = dataset.label ? dataset.label : '';

      // Determine if this is a check, save, or other roll
      let rollType = "other";
      if (label.includes(game.i18n.localize("GLOG.AttributeStrength"))) rollType = "check";
      if (label.includes(game.i18n.localize("GLOG.AttributeDexterity"))) rollType = "check";
      if (label.includes(game.i18n.localize("GLOG.AttributeConstitution"))) rollType = "check";
      if (label.includes(game.i18n.localize("GLOG.AttributeIntelligence"))) rollType = "check";
      if (label.includes(game.i18n.localize("GLOG.AttributeWisdom"))) rollType = "check";
      if (label.includes(game.i18n.localize("GLOG.AttributeCharisma"))) rollType = "check";

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
   * @param {Roll} roll The prepared roll
   * @param {string} label The label for the roll
   * @private
   */
  _showCheckDialog(roll: Roll, label: string): void {
    new Dialog({
      title: game.i18n.format("GLOG.RollCheck", {name: label}),
      content: `
        <form class="glog2d6">
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
          callback: (html) => {
            const difficulty = parseInt((html.find('#difficulty')[0] as HTMLSelectElement).value);
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
   * @param {Roll} roll The prepared roll
   * @param {string} label The label for the roll
   * @param {number} difficulty The difficulty target number
   * @private
   */
  async _rollCheck(roll: Roll, label: string, difficulty: number): Promise<void> {
    await roll.evaluate({async: true});

    // Determine success or failure
    const isSuccess = roll.total >= difficulty;
    const results = roll.dice[0].results;
    const isCrit = results.length >= 2 && results[0].result === 6 && results[1].result === 6;
    const isFumble = results.length >= 2 && results[0].result === 1 && results[1].result === 1;

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
}
