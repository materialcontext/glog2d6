// module/actor/hireling-sheet.mjs
import { GLOG2D6ActorSheet } from "./actor-sheet.mjs";
import { toggleTorchItem } from './handlers/torch-handlers.mjs';
import { ItemManagementHandler } from './handlers/item-management-handler.mjs';
import { DataContextBuilder } from './data-context-builder.mjs';

export class GLOG2D6HirelingSheet extends GLOG2D6ActorSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            width: 400,
            height: 550
        });
    }

    /**
     * Override component initialization to only use what hirelings need
     */
    initializeMixinsAndComponents() {
        // Only initialize the components hirelings actually need
        this.itemManager = new ItemManagementHandler(this);
        this.dataContextBuilder = new DataContextBuilder(this.actor);
    }

    /**
     * Override component check to work for hirelings
     */
    _ensureComponentsInitialized() {
        if (this._componentsInitialized) return;

        // Initialize only what hirelings need
        this.initializeMixinsAndComponents();
        this._componentsInitialized = true;
    }

    /**
     * Override getData to work for hirelings
     */
    async getData() {
        // Ensure minimal components are initialized
        this._ensureComponentsInitialized();

        // Get base context
        const context = await foundry.appv1.sheets.ActorSheet.prototype.getData.call(this);

        // Use the DataContextBuilder's safe fallback
        const result = this.dataContextBuilder._buildSafeContext(context);

        // Ensure torch system exists
        if (!result.system.torch) {
            result.system.torch = {
                lit: false,
                activeTorchId: null
            };
        }

        // Calculate inventory slots used
        if (result.system.inventory) {
            let slotsUsed = 0;
            this.actor.items.forEach(item => {
                slotsUsed += item.system.slots || 0;
            });
            result.system.inventory.slots.used = slotsUsed;
        }

        return result;
    }

    /**
     * Override activateListeners to avoid parent's component dependencies
     */
    activateListeners(html) {
        // Call grandparent's activateListeners
        foundry.appv1.sheets.ActorSheet.prototype.activateListeners.call(this, html);

        // Only add handlers if editable
        if (!this.isEditable) return;

        // Register our handlers
        html.find('.item-create').click(this.handleItemCreate.bind(this));
        html.find('.item-delete').click(this.handleItemDelete.bind(this));
        html.find('.torch-icon[data-action="toggle-torch"]').click(this.handleTorchItemToggle.bind(this));
    }

    /**
     * Provide the handlers the parent's event registry would expect
     */
    async handleItemCreate(event) {
        return this.itemManager.handleItemCreate(event);
    }

    async handleItemDelete(event) {
        return this.itemManager.handleItemDelete(event);
    }

    async handleTorchItemToggle(event) {
        const result = await toggleTorchItem(this.actor, event);
        if (result?.ok) {
            this.render(false);
        }
    }
}
