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

    extractItemFromEvent(event) {
        const itemElement = $(event.currentTarget).parents(".gear-item, .feature-card");
        const itemId = itemElement.data("itemId");
        return this.actor.items.get(itemId);
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
