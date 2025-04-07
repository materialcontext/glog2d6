import { GLOG } from "../helpers/config.js";

/**
 * Extend the basic ItemSheet with system-specific features
 * @extends {ItemSheet}
 */
export class GlogItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["glog2d6", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      resizable: true
    });
  }

  /** @override */
  get template(): string {
    return `systems/glog2d6/templates/item/${this.item.type}-sheet.hbs`;
  }

  /** @override */
  getData(): object {
    const context = super.getData() as any;

    // Add item data
    const itemData = context.item.toObject(false);
    context.system = itemData.system;

    // Add config data
    context.config = GLOG;

    // Add type-specific data
    if (this.item.type === 'weapon') {
      context.isRanged = ['ranged', 'firearm'].includes(context.system.weaponType);
    }

    // Set dark mode class if in local storage
    const darkMode = localStorage.getItem('glog2d6.darkMode') === 'true';
    if (darkMode) {
      this.element?.addClass('theme-dark');
    }

    return context;
  }

  /** @override */
  activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Add theme toggle button to header
    const headerButtons = $(`
      <div class="header-buttons">
        <button class="theme-toggle" title="Toggle Dark Mode">
          <i class="fas fa-moon"></i>
        </button>
      </div>
    `);
    html.find('.window-header .window-title').after(headerButtons);
    html.find('.theme-toggle').click(this._onThemeToggle.bind(this));

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Handle feature list in template sheet
    if (this.item.type === 'template') {
      html.find('.feature-add').click(this._onFeatureAdd.bind(this));
      html.find('.feature-delete').click(this._onFeatureDelete.bind(this));

      // Add listener for class selection change
      html.find('select[name="system.class"]').change(this._onClassChange.bind(this));
      html.find('select[name="system.level"]').change(this._onLevelChange.bind(this));
    }
  }

  /**
   * Toggle dark mode
   * @private
   */
  _onThemeToggle(event: Event): void {
    event.preventDefault();
    const isDark = this.element.hasClass('theme-dark');

    if (isDark) {
      this.element.removeClass('theme-dark');
      localStorage.setItem('glog2d6.darkMode', 'false');
    } else {
      this.element.addClass('theme-dark');
      localStorage.setItem('glog2d6.darkMode', 'true');
    }
  }

  /**
   * Handle class change
   * @private
   */
  async _onClassChange(event: Event): Promise<void> {
    event.preventDefault();
    const select = event.currentTarget as HTMLSelectElement;
    const classType = select.value;

    // Get the current level
    const level = this.item.system.level;

    // Auto-populate features based on class and level
    await this._populateClassFeatures(classType, level);
  }

  /**
   * Handle level changes
   * @private
   */
  async _onLevelChange(event: Event): Promise<void> {
    event.preventDefault();
    const select = event.currentTarget as HTMLSelectElement;
    const level = select.value;

    // Get the current class
    const classType = this.item.system.class;

    // Auto-populate features based on class and level
    await this._populateClassFeatures(classType, level);
  }

  /**
   * Class feature population
   * @private
   */
  async _populateClassFeatures(classType: string, level: string): Promise<void> {
    // Define features for each class at each level
    const classFeatures = {
      acrobat: {
        A: ["Tricky", "Nimble"],
        B: ["Escape Artist", "Close Call"],
        C: ["Traceur", "Redirect"],
        D: ["The Greatest Escape"]
      },
      assassin: {
        A: ["Poisoner", "Deadly Improvisation"],
        B: ["Mr. Thus-and-Such", "Studied Target"],
        C: ["Dramatic Infiltration", "Co-Conspirator"],
        D: ["Assassinate"]
      },
      barbarian: {
        A: ["Foreign", "At the Gates"],
        B: ["Reputation For…", "Danger Sense"],
        C: ["Tough", "Feats of Strength"],
        D: ["Tread the Jeweled Thrones"]
      },
      courtier: {
        A: ["Courtly Education", "Fast Talker"],
        B: ["Welcome Guest", "Entourage"],
        C: ["Never Forget a Face", "Loyal Servants"],
        D: ["Windfall"]
      },
      fighter: {
        A: ["Battle Scars", "Veteran's Eye"],
        B: ["Armor Training", "Reputation for Mercy"],
        C: ["Superior Combatant", "Impress"],
        D: ["Double Attack"]
      },
      hunter: {
        A: ["Tracker", "Woodsman"],
        B: ["Stalker", "Animal Companion"],
        C: ["Trapper", "Advantageous Terrain"],
        D: ["Legendary Hunt"]
      },
      thief: {
        A: ["Pick-Pocket", "Black Market Gossip"],
        B: ["Well-Planned Heist", "Change Hands"],
        C: ["Always Prepared", "A Motley Crew"],
        D: ["Heist of the Century"]
      },
      wizard: {
        A: ["School of Magic", "Book Casting"],
        B: ["Ancient Tongues", "Intellect Fortress"],
        C: ["One More Thing", "Autochthonous Spell"],
        D: ["Wizard's Tower"]
      }
    };

    // Get features for the selected class and level
    const features = classType && level && classFeatures[classType] && classFeatures[classType][level]
      ? classFeatures[classType][level]
      : [];

    // Update the item
    await this.item.update({
      "system.features": features
    });
  }

  /**
   * Handle adding a feature to a template
   * @private
   */
  async _onFeatureAdd(event: Event): Promise<void> {
    event.preventDefault();

    // Get existing features
    const features = duplicate(this.item.system.features || []) as string[];

    // Add a new empty feature
    features.push("");

    // Update the item
    await this.item.update({
      "system.features": features
    });
  }

  /**
   * Handle deleting a feature from a template
   * @param {Event} event The originating click event
   * @private
   */
  async _onFeatureDelete(event: Event): Promise<void> {
    event.preventDefault();
    const button = event.currentTarget as HTMLElement;
    const index = button.dataset.index;
    if (!index) return;

    // Get existing features
    const features = duplicate(this.item.system.features || []) as string[];

    // Remove the feature
    features.splice(parseInt(index), 1);

    // Update the item
    await this.item.update({
      "system.features": features
    });
  }
}
