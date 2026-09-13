// module/actor/handlers/item-management-handler.mjs
export class ItemManagementHandler {
    constructor(sheet) {
        this.sheet = sheet;
        this.actor = sheet.actor;
    }

    async handleItemCreate(event) {
        event.preventDefault();

        const itemType = this.extractItemTypeFromEvent(event);
        const itemData = this.buildNewItemData(itemType);

        return this.createNewItem(itemData);
    }

    async handleItemEdit(event) {
        event.preventDefault();

        const item = this.extractItemFromEvent(event);
        if (item) {
            item.sheet.render(true);
        }
    }

    async handleItemDelete(event) {
        event.preventDefault();

        const item = this.extractItemFromEvent(event);
        if (item) {
            return item.delete();
        }
    }

    extractItemTypeFromEvent(event) {
        return event.currentTarget.dataset.type;
    }

    /**
     * Every row that owns an item carries its id, so the nearest ancestor that
     * has one is the row -- no list of row class names to keep in step with the
     * templates, and note rows stopped being a special case that silently did
     * nothing.
     */
    extractItemFromEvent(event) {
        const row = event.currentTarget.closest("[data-item-id]");
        return row ? this.actor.items.get(row.dataset.itemId) : null;
    }

    buildNewItemData(itemType) {
        return {
            name: this.generateDefaultItemName(itemType),
            type: itemType,
            system: {}
        };
    }

    generateDefaultItemName(itemType) {
        const capitalizedType = itemType.charAt(0).toUpperCase() + itemType.slice(1);
        return `New ${capitalizedType}`;
    }

    async createNewItem(itemData) {
        const ItemClass = getDocumentClass("Item");
        return ItemClass.create(itemData, { parent: this.actor });
    }
}
