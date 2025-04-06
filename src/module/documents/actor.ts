export class MySystemActor extends Actor {
  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  /**
   * Prepare derived data that depends on other attributes
   */
  prepareDerivedData() {
    const actorData = this.system;

    // Calculate attribute modifiers
    for (let [key, attribute] of Object.entries(actorData.attributes)) {
      // Calculate the modifier using the attribute value
      attribute.mod = Math.floor((attribute.value - 10) / 2);
    }
  }
}
