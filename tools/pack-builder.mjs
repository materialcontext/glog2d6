import fs from 'fs';
import path from 'path';

class PackBuilder {
  constructor() {
    this.contentDir = './content';
    this.packsDir = './packs';
  }

  async buildAllPacks() {
    console.log('Building content packs...');

    await this.buildItemPack('weapons', 'basic-weapons');
    await this.buildItemPack('equipment', 'basic-equipment');
    await this.buildItemPack('armor', 'basic-armor');
    await this.buildActorPack('spells', 'core-spells');

    console.log('All packs built successfully!');
  }

  async buildItemPack(contentFile, packName) {
    const contentPath = path.join(this.contentDir, `${contentFile}.json`);
    const packPath = path.join(this.packsDir, `${packName}.db`);

    if (!fs.existsSync(contentPath)) {
      console.log(`Skipping ${packName} - no content file found`);
      return;
    }

    const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    const items = content[Object.keys(content)[0]]; // Get first key's array

    const packData = items.map((item, index) => {
      return {
        _id: this.generateId(),
        name: item.name,
        type: item.type,
        img: item.img || 'icons/svg/item-bag.svg',
        system: item.system || {},
        folder: null,
        sort: index * 100
      };
    });

    fs.writeFileSync(packPath, packData.map(item => JSON.stringify(item)).join('\n'));
    console.log(`Built ${packName}.db with ${packData.length} items`);
  }

  async buildActorPack(contentFile, packName) {
    // Similar to buildItemPack but for actors
    const contentPath = path.join(this.contentDir, `${contentFile}.json`);
    const packPath = path.join(this.packsDir, `${packName}.db`);

    if (!fs.existsSync(contentPath)) {
      console.log(`Skipping ${packName} - no content file found`);
      return;
    }

    const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    const actors = content[Object.keys(content)[0]];

    const packData = actors.map((actor, index) => {
      return {
        _id: this.generateId(),
        name: actor.name,
        type: actor.type || 'npc',
        img: actor.img || 'icons/svg/mystery-man.svg',
        system: actor.system || {},
        folder: null,
        sort: index * 100
      };
    });

    fs.writeFileSync(packPath, packData.map(actor => JSON.stringify(actor)).join('\n'));
    console.log(`Built ${packName}.db with ${packData.length} actors`);
  }

  generateId() {
    return 'a' + Math.random().toString(36).substr(2, 15);
  }
}

// Run if called directly
if (process.argv[1].endsWith('pack-builder.mjs')) {
  const builder = new PackBuilder();
  builder.buildAllPacks().catch(console.error);
}

export default PackBuilder;
