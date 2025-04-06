/**
 * Global type definitions for GLOG 2d6 System
 */

import { GlogActor } from "./documents/actor.js";
import { GlogItem } from "./documents/item.js";

declare global {
  interface Game {
    glog2d6: {
      GlogActor: typeof GlogActor;
      GlogItem: typeof GlogItem;
      rollItemMacro: (itemName: string) => Promise<void>;
    }
  }

  interface CONFIG {
    GLOG: typeof import("./helpers/config").GLOG;
  }

  namespace Handlebars {
    interface HelperOptions {
      fn: (context?: any) => string;
      inverse: (context?: any) => string;
      hash: any;
      data: any;
    }
  }
}

// Document data interface
interface GlogActorData extends ActorData {
  type: 'character' | 'npc' | 'hireling';
  system: GlogActorDataSource;
}

interface GlogActorDataSource {
  hp: {
    value: number;
    max: number;
    temp: number;
  };
  wounds: Array<any>;
  attributes: {
    strength: GlogAttribute;
    dexterity: GlogAttribute;
    constitution: GlogAttribute;
    intelligence: GlogAttribute;
    wisdom: GlogAttribute;
    charisma: GlogAttribute;
  };
  derived: {
    movement: {
      value: number;
      exploration: number;
      combat: number;
      running: number;
      milesPerDay: number;
    };
    attack: {
      value: number;
    };
    defense: {
      value: number;
      armor: number;
      dexterity: number;
    };
    initiative: {
      value: number;
      bonus: number;
    };
    encumbrance: {
      value: number;
      max: number;
    };
  };
  details: {
    level: number;
    xp: {
      value: number;
      min: number;
      max: number;
    };
    templates: {
      list: Array<any>;
      max: number;
    };
    spellSlots?: {
      value: number;
    };
    spellDice?: {
      value: number;
      max: number;
    };
  };
  biography?: string;
  traits?: {
    background: string;
    reputation: string;
    quirks: string[];
  };
  reaction?: {
    value: number;
  };
  morale?: {
    value: number;
  };
  loyalty?: {
    value: number;
    max: number;
  };
  cost?: {
    value: number;
    period: string;
  };
  share?: {
    value: number;
  };
}

interface GlogAttribute {
  value: number;
  mod: number;
}

interface GlogItemData extends ItemData {
  type: 'weapon' | 'armor' | 'gear' | 'template' | 'spell' | 'feature' | 'wound';
  system: GlogItemDataSource;
}

interface GlogItemDataSource {
  description: string;
  source: string;
  quantity?: number;
  weight?: number;
  price?: number;
  slots?: number;
  weaponType?: string;
  damage?: string;
  attackBonus?: number;
  range?: number;
  reload?: string;
  broken?: number;
  armorType?: string;
  defense?: number;
  encumbrance?: number;
  penalties?: {
    swimming: boolean;
    endurance: number;
  };
  class?: string;
  level?: string;
  features?: string[];
  school?: string;
  target?: string;
  duration?: string;
  effect?: string;
  requirements?: string;
  activation?: string;
  severity?: number;
  healing?: string;
}
