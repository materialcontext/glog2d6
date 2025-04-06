export class MySystemItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // augmented. This might be particularly useful for items with specific needs.
    super.prepareData();
  }
}
