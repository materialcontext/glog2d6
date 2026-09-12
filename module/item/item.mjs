export class GLOG2D6Item extends Item {

  prepareData() {
    super.prepareData();
  }

  prepareBaseData() {
    // Always run the base lifecycle first: it prepares the type data model and
    // resets Foundry's ActiveEffect application phases. Skipping it makes every
    // preparation after the first throw on v14.
    super.prepareBaseData();
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    // Future: calculate derived values for items
  }
}
