// src/module/data/spells.ts
// All spells in alphabetical order as they appear in the source document

export const Spells = [
  {
    name: "Acid Spit",
    img: "icons/svg/acid.svg",
    type: "spell",
    system: {
      range: "–",
      target: "self",
      duration: "[sum] rounds",
      effect: "You spit acid for the duration. Make an attack roll against a target within 30'. On a hit, the target takes [sum] damage. Unless they spend a turn washing it off, they take another 1d6 damage over the next [dice] turns.",
      }
  },
  {
    name: "Albrecht's Unreliable Disintegrator",
    img: "icons/svg/disintegrate.svg",
    type: "spell",
    system: {
      range: "–",
      target: "object or creature",
      duration: "instant",
      effect: "Target creature of [dice] HD or less, or an object weighing less than [dice]x200lbs, disintegrates into nothingness. Save negates. Magical objects get +2 to their save. You can disintegrate a section of an object or creature but not very precisely.",
      }
  },
  {
    name: "All Things Adjacent",
    img: "icons/svg/dimension.svg",
    type: "spell",
    system: {
      range: "–",
      target: "self",
      duration: "[dice] rounds",
      effect: "You are adjacent to all things within your line of sight. You can punch anything you can see. You can pick up any object and put it in your pocket as if it were beside you. However, you are affected as if you were in every location at once. Obviously, casting this in sight of the sun is instantly fatal.",
      }
  },
  {
    name: "Animate Potion",
    img: "icons/svg/potion.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "potion or liquid",
      duration: "[dice] hours",
      effect: "You turn a potion into an obedient homunculus (HD 0). It is tiny (1' tall) and feeble (Str 1), but it can go where you direct and even bring you small items, such as keys. The potion can be drunk as normal. Despite the name, this spell works on any liquid except water.",
      }
  },
  {
    name: "Become Delicious",
    img: "icons/svg/food.svg",
    type: "spell",
    system: {
      range: "50'",
      target: "creature of [dice]^2 HP or less",
      duration: "[sum] varies",
      effect: "Target creature smells and tastes delicious for the spell's duration. The smell radiates 20' in calm air, but can spread via wind or leave a trail. Sentient creatures can usually resist the urge to eat the target without a Save, but animals and other ravenous creatures must Save or select the spell's target as their primary attack target. Insects will be attracted to the target for the spell's duration. The target may attempt to cover up the smell with a strong enough scent. The effect lasts 1 [dice]: minutes, 2 [dice]: hours, 3 [dice]: months, 4 [dice] years. This spell can also affect dead creatures.",
      }
  },
  {
    name: "Bless",
    img: "icons/svg/blessing.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "sustainable",
      effect: "Choose one effect per [dice] invested: (a) The target treats all critical failures as critical successes for the duration of the spell, (b) The target automatically passes their next Save (c) Creature or object counts as holy for the duration of the spell, (d) Target gets a new Save against any ongoing mental effect.",
      }
  },
  {
    name: "Blood Jelly",
    img: "icons/svg/blood.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "meat with your blood",
      duration: "permanent",
      effect: "You touch dead meat or a pool of blood and create a tiny blood jelly. It starts as the size of a thimble. It's transparent with a red spidery nucleus. It won't harm anyone who contributed blood to its creation. The blood jelly will react the same way you do to any potions or items fed to it. It's a great guinea pig. If it stays small and you feed it an entire potion, you can consume it to also gain the potion's effect. The more you feed a blood jelly, the larger it grows. They lose 10% of their weight each day, and gain 10% of what they eat. It takes an hour to eat something as big as they are. They have 1HD per doubling past 100 pounds and their default attack is sucking 1d4 points of blood per HD they have. Given 1000 pounds of meat, a fist-sized jelly takes about a day and a night to reach 100 pounds and 1HD. The more magical and unusual things you feed to it, the stranger it will become.",
      }
  },
  {
    name: "Blood to Quicksilver",
    img: "icons/svg/mercury.svg",
    type: "spell",
    system: {
      range: "100'",
      target: "magical creature",
      duration: "instant",
      effect: "The magic in the target's blood turns to mercury. Target takes 1d6+1 damage per the number of MD they possess, or 1d6 damage per HD for magical creatures (unicorns, dragons, etc.). Additionally, they lose [dice] MD for [dice] rounds. Save for half damage and to negate MD loss. Non-magical creatures, or creatures that have no spellcasting ability, are unaffected by this spell.",
      }
  },
  {
    name: "Beautify",
    img: "icons/svg/beautiful.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature or object",
      duration: "[sum] hours",
      effect: "Target is made more beautiful. Dirt falls away, pimples disappear, teeth whiten, lice vanish, gouges fill in, and varnish looks new again. Will also restore [dice] points of Charisma if damaged, to former max. If [sum] is greater than 12, the effect is permanent.",
      }
  },
  {
    name: "Blossom",
    img: "icons/svg/flower.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "plant",
      duration: "permanent",
      effect: "Touched plant flourishes. Seeds germinate, flower buds swell and bloom, and a sickly plant regains vigor. Heals [sum] HP to a plant creature. If cast on a fruit, the fruit will grow up to the maximum normal size or 2x as big (whichever is smaller). Yes, you can use this to double your rations, as long as your rations are fruit or vegetables.",
      }
  },
  {
    name: "Candlemass",
    img: "icons/svg/candle.svg",
    type: "spell",
    system: {
      range: "–",
      target: "your hand",
      duration: "[sum] * [dice] minutes",
      effect: "You conjure [dice] lit candles in your hand. Each behaves as any regular candle, except they cannot be put out and will burn even underwater. They may also be easily attached to any solid surface. The candles disappear as the spell expires.",
      }
  },
  {
    name: "Capture in a Bottle",
    img: "icons/svg/bottle.svg",
    type: "spell",
    system: {
      range: "30'",
      target: "creature",
      duration: "varies",
      effect: "This spell requires an empty bottle to cast. A creature of up to [dice]^2 HP must Save or be pulled into the bottle and trapped. Anyone opening the bottle releases the creature, and if the bottle is broken, the creature is freed as well. The spell duration is [sum] rounds at 1 [die], minutes at 2 [dice], hours at 3 [dice], or permanent at 4 [dice].",
      }
  },
  {
    name: "Charm Person",
    img: "icons/svg/charm.svg",
    type: "spell",
    system: {
      range: "50'",
      target: "person",
      duration: "[dice] hours",
      effect: "The person regards you as a good friend and ignores the obvious spell you just cast on them. If you invest 4 dice into this spell, the duration becomes permanent unless removed.",
      }
  },
  {
    name: "Circle of Frost",
    img: "icons/svg/ice.svg",
    type: "spell",
    system: {
      range: "self",
      target: "[dice] * 10' radius",
      duration: "until melted or freed",
      effect: "All creatures in the area take 1d4 damage, Save for half. Everything that fails its Save is frozen to whatever surface they were touching. Boots are frozen to the ground, keys are frozen in their locks. Creatures are usually immobilized from the boots down, unless they were playing in a fountain or something. Attempting to break loose requires a successful Strength check, or dealing [sum] damage to the ice. The DC is 7 + [dice]x2.",
      }
  },
  {
    name: "Clarity",
    img: "icons/svg/clarity.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "instant",
      effect: "Target makes another Save against an emotion-affecting effect (fear, anger, sadness, pleasure, pain).",
      }
  },
  {
    name: "Color Spray",
    img: "icons/svg/rainbow.svg",
    type: "spell",
    system: {
      range: "15' cone",
      target: "sighted creatures",
      duration: "varies",
      effect: "If [sum] is equal or greater to the creature's HD, it is befuddled for 1d6 rounds. If [sum] is three times the creature's HD or more, it is stunned for a round, then befuddled for 1d6 rounds. If [sum] is five times the creature's HD, it is stunned for 1d6 rounds, then befuddled for 1d6 rounds.",
      }
  },
  {
    name: "Command Coins",
    img: "icons/svg/coins.svg",
    type: "spell",
    system: {
      range: "50'",
      target: "coins",
      duration: "[dice] rounds",
      effect: "You can telekinetically control up to [sum] * 10 coins within range. You can move them in any direction at a speed of 30 feet per round. You can use them to create distractions, form simple shapes, or even have them attack as a swarm dealing 1d4 damage per 10 coins.",
      }
  },
  {
    name: "Control Flame",
    img: "icons/svg/flame.svg",
    type: "spell",
    system: {
      range: "50'",
      target: "fire",
      duration: "[sum] rounds",
      effect: "Control a ball of fire the size of a head (1D) / a person (2D) / a wagon (3D) / a house (4D). You can do [dice] things with it per round. If it's part of a creature, they get a save whenever you try to do something with it.",
      }
  },
  {
    name: "Death Mask",
    img: "icons/svg/mask.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "humanoid corpse",
      duration: "permanent",
      effect: "You touch a corpse and the face peels off like a mask, while the rest of the corpse quickly rots into dust. When you (and only you) wear the mask, you will look and sound like the person whose face you're wearing, but only to sentient people (no effect on animals, spirits, or constructs). The mask will rot into uselessness after [sum] days. If [dice] is 4, the mask is permanent. This spell consumes the corpse.",
      }
  },
  {
    name: "Death Scythe",
    img: "icons/svg/scythe.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "corpse",
      duration: "[dice] hours",
      effect: "The corpse disintegrates as you pluck a black scythe from it. This scythe is a +1 Heavy weapon that deals double damage to creatures of the same type.",
      }
  },
  {
    name: "Detect Metals",
    img: "icons/svg/ore.svg",
    type: "spell",
    system: {
      range: "100'",
      target: "self",
      duration: "[sum] minutes",
      effect: "You can identify the eight true metals. In order of brightness: scarletite, gold, silver, mercury, iron, and tin. Lead and copper are nearly invisible. You see them through walls and barriers as faint shimmers, but the spell bleeds into your other senses. If you cast this spell with 3 or more [dice], your eyes turn gold and the effects are permanent.",
      }
  },
  {
    name: "Disguise",
    img: "icons/svg/disguise.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "object or creature",
      duration: "[dice] hours",
      effect: "You cloak the object in illusion, making it appear as another object of the same type. An apple could be disguised as any other type of fruit; a table could be disguised as any other type of furniture. A humanoid can be disguised as any other humanoid of comparable size. This only extends to the visual properties of the object (not voice, smell, etc.). The maximum size of the object depends on how many dice are invested in the spell: human (1D) / ogre (2D) / dragon (3D) / ship (4D).",
      }
  },
  {
    name: "Doom Song",
    img: "icons/svg/doom.svg",
    type: "spell",
    system: {
      range: "100'",
      target: "creature",
      duration: "sustainable [dice]",
      effect: "Target creature loses [sum] HP. On the second turn the target takes [dice] more damage for the duration. On the third turn a Death appears. On the 4th turn the target's soul is ripped from their body and drug to their afterlife.",
      }
  },
  {
    name: "Door Dimension",
    img: "icons/svg/door.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "door or portcullis",
      duration: "[sum] hours",
      effect: "Turns the target door into a portal that connects the room in which it was cast to the demiplane of infinite doors. At one dice the door leads only to a stone platform floating in the ether. At two dice a staircase leads away from the platform and connects to one other portal you've created. At three dice it leads to a wall-less foyer with staircases leading up to all the portals you've created. At four dice it leads to a central nexus connecting every door in the world. Your own portals are nearby, but good luck navigating to anything else.",
      }
  },
  {
    name: "Duo-Dimensionality",
    img: "icons/svg/dimension.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "[sum] minutes",
      effect: "The target becomes flat and two-dimensional. They can walk through cracks, behind bookshelves, and most closed doors. If they turn so that they are facing someone edge-on, they cannot be seen. They weigh one pound. With 4 [dice] the effect is measured in hours, not minutes, and if the sum is greater than 12, the effect is permanent.",
      }
  },
  {
    name: "Elegant Judgment",
    img: "icons/svg/judgment.svg",
    type: "spell",
    system: {
      range: "200'",
      target: "20' diameter",
      duration: "instant",
      effect: "Does [sum] damage, Save vs. Charisma for half. Like a fireball, but the flames are purple and gold. Creatures with 17 or more Charisma, non-sentient creatures, beautiful objects, the dead, and Elves are immune to this spell.",
      }
  },
  {
    name: "Essential Salt",
    img: "icons/svg/salt.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "corpse",
      duration: "instant",
      effect: "You reduce a corpse into a coarse grit that can be stored in a tiny (3 per inventory slot) pouch or vial. You can cast speak with dead to speak with the spirit as many times as you want (normally you are limited to one attempt per corpse). This requires you to spread the salt out on a flat surface; be mindful it doesn't get blown away or mixed in with mundane sand.",
      }
  },
  {
    name: "Explode Corpse",
    img: "icons/svg/explosion.svg",
    type: "spell",
    system: {
      range: "200'",
      target: "20' diameter",
      duration: "instant",
      effect: "Target corpse explodes, dealing damage in a [dice]x5' radius, Save for half. The maximum damage dealt is dependent on the creature's size: Rat: 1, Dog: 1d6, Human: 2d6, Cow: 3d6, Elephant: 6d6, Whale: 8d6. This spell cannot target undead creatures unless you control them.",
      }
  },
  {
    name: "Explosion Containment",
    img: "icons/svg/shield.svg",
    type: "spell",
    system: {
      range: "–",
      target: "self",
      duration: "[dice] hours",
      effect: "You may cast this spell as a reaction. Save, with a bonus equal to [sum]. Any incoming damage from an explosion or high-speed impact is stored in the palm of your hand. You also block damage that would be dealt to anything in a cone behind you. You can't use this spell to stop an arrow, a magic missile, or a falling wall, but you can use it to stop a barrel of gunpowder, exploding magical equipment, or a fireball. Before the spell's duration expires, you must release the explosion in a cone aimed from the palm of your hand.",
      }
  },
  {
    name: "Extract Value",
    img: "icons/svg/coins.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "up to [dice]^2 cubic feet",
      duration: "instant",
      effect: "Obliterate target objects into gold coins, equaling their monetary value, and a pile of flammable red dust, equaling the remaining weight.",
      }
  },
  {
    name: "Extract Venom",
    img: "icons/svg/poison.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "instant",
      effect: "You pierce a creature with a sharp object and draw all of the venom out, which then pools in your hand or a vial. If you use this to remove the poison from a poisoned creature, that creature gets a new save with a +4 [dice] bonus. You can also use this to draw all of the poison out of a venomous creature. Unwilling venomous creatures get a save. Note that this spell doesn't work on all poisons, just venoms (organic, mechanically delivered poisons, usually from things with fangs or stingers). Most biomancers keep one of their fingernails razor sharp for this purpose.",
      }
  },
  {
    name: "Fade",
    img: "icons/svg/invisibility.svg",
    type: "spell",
    system: {
      range: "50'",
      target: "object or creature",
      duration: "[dice] rounds",
      effect: "Target phases out, and becomes unable to affect the world in any way except visually. It just floats there like an illusion until the spell concludes. Not even magic can affect the target. If they would be in a solid object when the spell expires, they are harmlessly shunted into the nearest open space. The maximum size of the object depends on how many dice are invested in the spell: human (1D) / ogre (2D) / dragon (3D) / ship (4D).",
      }
  },
  {
    name: "Fear",
    img: "icons/svg/terror.svg",
    type: "spell",
    system: {
      range: "50'",
      target: "creature",
      duration: "[sum] rounds",
      effect: "Terrify everyone. NPCs make a morale check, PCs Save vs Fear.",
      }
  },
  {
    name: "Feather",
    img: "icons/svg/feather.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature or object",
      duration: "[dice]^2 rounds",
      effect: "Object's weight (but not mass) drops by 99%. You can cast this spell on yourself as a reaction (even when it isn't your turn). Most things fall at 60' per round.",
      }
  },
  {
    name: "Fireball",
    img: "icons/svg/fire.svg",
    type: "spell",
    system: {
      range: "200'",
      target: "20' diameter",
      duration: "instant",
      effect: "Does [sum] fire damage to all objects. Save for half.",
      }
  },
  {
    name: "Floating Disk",
    img: "icons/svg/disk.svg",
    type: "spell",
    system: {
      range: "5'",
      target: "empty space",
      duration: "[dice] hours",
      effect: "A floating disk springs into existence beside you. It floats 4\" above the floor and never exerts weight on the floor beneath it. It follows you, always within 5' of you. It can go upstairs and across water. Maximum weight is [dice] * 500 lbs. If you stand atop it, you can direct it.",
      }
  },
  {
    name: "Floral Salvage",
    img: "icons/svg/flower.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "instant",
      effect: "Flowers (caster chooses the type) erupt from the target's wounds. Target takes 1 damage for every point of damage it has already taken, not exceeding [sum]x2. Save for half. If this damage kills the target, their corpse is entirely consumed by plant growth, and turns into a beautiful tree covered in flowers. Height is 2d4 x creature's HD in feet.",
      }
  },
  {
    name: "Fool's Gold",
    img: "icons/svg/gold.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "object weight [sum]*10 lbs.",
      duration: "[dice] hours",
      effect: "Touched object, or heap of objects, appears to be gold for the spell's duration. Only alchemy or magic will reveal that it is not truly gold.",
      }
  },
  {
    name: "Fortune's Favor",
    img: "icons/svg/luck.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "[dice] rounds",
      effect: "Creature is restored to max HP at the start of each round and all doubles crit for the duration.",
      }
  },
  {
    name: "Grease",
    img: "icons/svg/oil.svg",
    type: "spell",
    system: {
      range: "50'",
      target: "object; surface",
      duration: "[dice] *2 rounds",
      effect: "Can be cast directly on a creature or a 10' x 10' surface. Grease causes held objects to be dropped and moving creatures to fall prone, if a Dex check is failed.",
      }
  },
  {
    name: "Hand of the Hound",
    img: "icons/svg/hand.svg",
    type: "spell",
    system: {
      range: "self",
      target: "one or both hands",
      duration: "10 minutes",
      effect: "Your hand falls off and grows into a monstrous version of itself. You continue to control it, but if it dies, you don't have a hand anymore. You can have this affect both hands, but you'll look quite foolish. HP: [dice]	Attack: [dice]	Defense: [your dexterity] + [dice] Strength: [your Strength] + [dice]",
      }
  },
  {
    name: "Heal",
    img: "icons/svg/heal.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "object weight [sum]*10 lbs.",
      duration: "[dice] hours",
      effect: "Heal up to [sum] HP of creatures you touch. You may distribute healing among as many creatures as you would like, as long as the total HP healed does not exceed [sum] and you maintain concentration. If you invest 3 [dice] you may instead choose to remove one cure, affliction, or permanent injury from a single target, and if you invest 4 [dice] you may do both.",
      }
  },
  {
    name: "Heat Metal",
    img: "icons/svg/fire-metal.svg",
    type: "spell",
    system: {
      range: "50'",
      target: "metal object",
      duration: "[sum] rounds",
      effect: "Target metal object becomes warm. Each round after the first, it deals 1d6 damage to anything touching it, or [dice]d6 damage if the metal has become liquid. The maximum size of the object depends on how many dice are invested in the spell: 1 [dice]: sword-sized, 2 [dice]: door- or armor-sized, melts lead and tin after 5 rounds. 3 [dice]: cart-sized, melts gold, silver, and copper after 5 rounds, 4 [dice]: room-sized, melts iron after 5 rounds.",
      }
  },
  {
    name: "Horrible Glyph",
    img: "icons/svg/glyph.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "surface",
      duration: "[sum] rounds",
      effect: "The solid surface touched is marked with a glyph so horrible that anyone who can see it must Save vs Fear or be overcome with disgust and retreat until it can no longer see the glyph. If a creature is marked and can see the glyph, it may even harm itself to remove the glyph. You may choose its appearance but anything you choose will turnout suitably dishing.",
      }
  },
  {
    name: "Hypnotic Orb",
    img: "icons/svg/orb.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "spherical object",
      duration: "[dice]^2 minutes",
      effect: "You enchant a mostly-spherical object so that its surface is covered with a captivating, shimmering pattern. (Apples and most potatoes count as mostly-spherical; coins do not). Any creature who sees the enchanted object must make a save or be compelled to sit still and observe it for the spell's duration. Flying creatures will land, or circle it. You are not immune to this effect. The effect is broken if the line of sight is broken, if something startles them (a loud adjacent shout), or if they see signs of obvious danger (such as someone killing their friends). Groups of statistically identical NPCs should make their saves as a group.",
      }
  },
  {
    name: "Ignite",
    img: "icons/svg/fire.svg",
    type: "spell",
    system: {
      range: "100'",
      target: "object or creature",
      duration: "instant",
      effect: "Target object or creature takes [sum] + [dice] damage and catches on fire dealing 1d6 damage each round until extinguished. Save negates.",
      }
  },
  {
    name: "Illusion",
    img: "icons/svg/illusion.svg",
    type: "spell",
    system: {
      range: "50'",
      target: "[dice] * 5' diameter",
      duration: "sustainable",
      effect: "You create an illusion (basically a perfect hologram) of whatever object or creature you want. It can move as long as you dictate, but it cannot make any sound (or smell, touch, etc.). Creating the illusion of presence is easier than the illusion of absence. Creating an absence requires at least 3 [dice].",
      }
  },
  {
    name: "Illusion of Youth",
    img: "icons/svg/youth.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "[dice] days",
      effect: "Touched creature is cloaked with an illusion that makes them appear to be in their physical prime. If [sum] > 12 the effect is permanent.",
      }
  },
  {
    name: "Infantilize",
    img: "icons/svg/baby.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "varies",
      effect: "Target saves or becomes an adorable child version of itself. Creatures lose 1 HD (-4 max HP, -1 to hit, -1 to save). Player characters have their Strength dropped to 5 if higher. The target is so adorable all who see it must make a save the first time they try to harm it. If they fail this save, they hesitate, wasting their action. The spell duration is [sum] rounds at 1 [die], minutes at 2 [dice], hours at 3 [dice], or permanent at 4 [dice].",
      }
  },
  {
    name: "Inflict Pain",
    img: "icons/svg/pain.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "[dice] days",
      effect: "Target takes [sum]*2 psychic damage. Save negates. Only works on things that feel pain. Cannot inflict wounds.",
      }
  },
  {
    name: "Invisibility",
    img: "icons/svg/invisible.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "object or creature",
      duration: "[dice] *10 mins",
      effect: "Object is invisible as long as it doesn't move. Each round of movement reduces the duration by 10 minutes. Invisible creatures gain the ability to see other invisible objects. Alternatively, can be used to suppress an object's invisibility.",
      }
  },
  {
    name: "Jealous Queen's Kiss",
    img: "icons/svg/queen.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "[sum] hours",
      effect: "You force [dice] interdictions upon the target with a kiss. Because it's required that you kiss the target, you may only cast this spell on a willing or helpless (bound, unconscious, ...) creature. Impossible or contradictory interdictions are ignored. Multiple castings of this spell overwrite the older ones, they don't stack. Any time the target breaks one of the interdictions, they must Save or suffer a wound.",
      }
  },
  {
    name: "Keep Still",
    img: "icons/svg/statue.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature or object",
      duration: "varies",
      effect: "The target is unable to leave its place - it can perform any action except for moving. Creatures may attempt a Str Sav to move at half speed for one turn. The spell duration is [sum] rounds at 1 [die], minutes at 2 [dice], hours at 3 [dice], or permanent at 4 [dice].",
      }
  },
  {
    name: "Knock",
    img: "icons/svg/door-open.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature or object",
      duration: "varies",
      effect: "Object is opened. Doors are flung wide, locks are broken, shackles are bent open, belts come undone. Treat this as a Strength check made with a Strength of 10 + ([dice] * 4). Worn armor falls off if the wearer fails a save. Creatures must save or vomit (a free action).",
      }
  },
  {
    name: "Leadfall",
    img: "icons/svg/lead.svg",
    type: "spell",
    system: {
      range: "30'",
      target: "creature or object",
      duration: "[sum] rounds",
      effect: "Object is opened. Doors are flung wide, locks are broken, shackles are bent open, belts come undone. Treat this as a Strength check made with a Strength of 10 + ([dice] * 4). Worn armor falls off if the wearer fails a save. Creatures must save or vomit (a free action).",
      }
  },
  {
    name: "Levitate",
    img: "icons/svg/levitate.svg",
    type: "spell",
    system: {
      range: "30'",
      target: "creature or object",
      duration: "sustainable",
      effect: "You will an object to raise, lower, or hover. You cannot move the object horizontally, and you cannot move it more than 10' per turn. Maximum weight is 500 lbs * [dice].",
      }
  },
  {
    name: "Light",
    img: "icons/svg/light.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature or object",
      duration: "[dice] hours",
      effect: "Object illuminates within 10' + ([dice] * 10'). If you invest 4 dice, this light has the qualities of sunlight.",
      }
  },
  {
    name: "Locate Animal",
    img: "icons/svg/track.svg",
    type: "spell",
    system: {
      range: "[dice] miles",
      target: "creature",
      duration: "[dice] hours",
      effect: "Name a common animal. You now know where the nearest example of the animal is.",
      }
  },
  {
    name: "Lock",
    img: "icons/svg/lock.svg",
    type: "spell",
    system: {
      range: "30'",
      target: "object",
      duration: "[dice] * 5 minutes",
      effect: "Non-living object closes and becomes locked. If the object is a door, chest, or similar object, it will slam shut, dealing [sum] damage to any creature passing through it and then trapping them. This spell works on things that aren't technically portals (for example, a sword could be locked in its scabbard). Each casting die you invest beyond the first makes the object more difficult to open, and gives -1 to any Strength checks made to force the object open. Alternatively, this spell can be cast on a creature's orifice; the creature gets a save to resist, and another save at the end of each of its turns.",
      }
  },
  {
    name: "Loyal Steel",
    img: "icons/svg/sword.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "one weapon",
      duration: "[sum] minutes",
      effect: "You enchant a weapon to float in the air at your side and protect you. Whenever you are attacked, the weapon counterattacks. It strikes as if wielded by you. The spell ends as its duration expires or after [dice] successful hits.",
      }
  },
  {
    name: "Magic Missile",
    img: "icons/svg/missile.svg",
    type: "spell",
    system: {
      range: "200'",
      target: "creature",
      duration: "instant",
      effect: "Target takes [sum] damage, no save.",
      }
  },
  {
    name: "Magic Mouth",
    img: "icons/svg/mouth.svg",
    type: "spell",
    system: {
      range: "–",
      target: "self",
      duration: "[sum] hours",
      effect: "You gain [dice] extra inventory slots that can be accessed by swallowing or regurgitating the item you wish to store. The stored items are undetectable and none of their harmful effects affect you. As the spell expires, you vomit any items still stored.",
      }
  },
  {
    name: "Magnetize",
    img: "icons/svg/magnet.svg",
    type: "spell",
    system: {
      range: "50'",
      target: "ferromagnetic object",
      duration: "[sum] minutes",
      effect: "Target iron object becomes highly magnetic, instantly attracting all unsecured magnetic objects in a 5*[dice]' radius to it. If the object is carried, the carrier must make a strength check against a DC of 7 + [dice] to not lose the item. The size of the object that can be targeted or affected also increases with [dice]: one [dice], hand-sized; two [dice] sword-sized; three [dice], person-sized; four dice horse-sized. At four [dice] the effect is permanent. This also works on nickel, cobalt, and manganese alloys.",
      }
  },
  {
    name: "Mental Domination",
    img: "icons/svg/mind.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "[sum] minutes",
      effect: "A living creature makes a Charisma save. On a failed save, the creature falls under your control for the duration. It will obey any order except obviously suicidal ones, and you can use an action to take direct control of the creature and control its movements, though this will require you to stand still. Dominated creatures retain their mental ability scores, personalities, and desires. However, their loyalty to the caster is so great it obliterates all other concerns, except for basic self-preservation. At 4-dice even this instinct is overrun.",
      }
  },
  {
    name: "Metal Chime",
    img: "icons/svg/bell.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "one metal object",
      duration: "[dice] days",
      effect: "You touch and enchant a piece of metal to make a terrific noise the next time it strikes a solid surface or is struck. All creatures within 100' (except you) must Save or be deafened for 1 minute. If used as a signal, it can be heard up to a mile away.",
      }
  },
  {
    name: "Mercury's Haste",
    img: "icons/svg/haste.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "one metal object",
      duration: "[sum] rounds",
      effect: "Target creature's body becomes mercury. Save negates. They can flow through gaps as a liquid, but sink in water. They are immune to piercing damage and reduce all other incoming non-magical damage by 2. They move at 2x normal speed, but cannot jump.",
      }
  },
  {
    name: "Mirror Object",
    img: "icons/svg/mirror.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "mirror",
      duration: "[dice] hours",
      effect: "You reach into a mirror-like surface and pull out a copy of an object adjacent to the mirror. The object that you pull out must be within reach of the mirror (as if it were a window), small enough to fit through the mirror (as if it were a window) and light enough for you to pull through with one hand. The mirror object looks and feels exactly like the object it copied. It doesn't copy magical properties. You cannot duplicate living things this way. The mirror object pops like a bubble if it suffers a solid blow (a mirror sword could be used once then vanishes). If you invest at least 4 dice into this spell, it can copy the magical properties of an item, but those magical properties will only function once for up to [sum] minutes and then the object vanishes.",
      }
  },
 {
    name: "Mirror Self",
    img: "icons/svg/mirror-clone.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "mirror",
      duration: "sustainable",
      effect: "You reach into a mirror-like surface and pull out a copy of yourself. The mirror must be large enough for you to pass through. Your mirror clone behaves as you wish. It can walk and talk, but it cannot pick anything up. You can see through its eyes and hear through its ears. You can cast spells through places of your mirror twin as a free action. The mirror twin pops like a bubble if it suffers a solid blow.",
      }
  },
  {
    name: "Monsterize",
    img: "icons/svg/monster.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "[sum] minutes",
      effect: "Target saves or becomes a horrible monster version of itself. Monsters get +1 HD (+4 max HP, +1 to hit, +1 to save). Player characters have their Strength raised to 12. The target flies into a rage, and is incapable of tactics, kindness, or retreat, even if urged by friends.",
      }
  },
  {
    name: "Mutate",
    img: "icons/svg/mutation.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "permanent",
      effect: "Target saves or gains random mutation. Roll for a random mutation [dice] times and the caster chooses one from among the options.",
      }
  },
  {
    name: "Olfactory Revelation",
    img: "icons/svg/nose.svg",
    type: "spell",
    system: {
      range: "–",
      target: "self",
      duration: "[sum] minutes",
      effect: "You gain an unbelievable sense of smell. Functions like darkvision up to 60'. New smells are confusing.",
      }
  },
  {
    name: "Pale Transmutation",
    img: "icons/svg/transmutation.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "[sum] cubic feet of metal",
      duration: "permanent",
      effect: "True transmutation is impossible. No one's ever been able to do it with magic anyway. But The Pale King got close. Slide your hand over [sum] cubic feet of metal objects. They transmute in the following [dice] ways: [one]: everything, but gold turns to lead [three] iron turns to glass. It's opaque and fragile. [three]: as [two] and copper and bronze sublimate into a corrosive gas dealing 1d6 damage for [dice] rounds in a 2*Target radius. [four]: as [three] and silver ignites dealing 1d6 damage to anything in contact with it for [dice] rounds.",
      }
  },
  {
    name: "Paper Automaton",
    img: "icons/svg/origami.svg",
    type: "spell",
    system: {
      range: "–",
      target: "paper",
      duration: "[sum] hours",
      effect: "You enchant a piece of plant-based paper or parchment to obey your commands. The paper folds into a tiny humanoid shape and follows simple instructions. It can lift nothing heavier than a single coin, but it can write and read. It has [dice] HP, Defense 0, and is destroyed at 0 HP, but takes no damage from bludgeoning weapons. The size of the automaton depends on the dice you invest in the spell. mouse (1D) / dog (2D) / person (3D) / elephant (4D).",
      }
  },
  {
    name: "Prismatic Ray",
    img: "icons/svg/rainbow-ray.svg",
    type: "spell",
    system: {
      range: "200'",
      target: "creature or object",
      duration: "instant",
      effect: "Target suffers a different effect depending on which color strikes the target. Roll a d10. Red. Target takes [sum] fire damage, save for half. Orange. Target takes [sum] bludgeoning damage and is knocked prone. Save negates. Yellow. Target takes [sum] lightning damage, save for half. Green. Target takes [sum] acid damage, save for half. Blue. Target takes [sum] ice damage, save for half. Purple. Target takes [sum] necrotic damage and is blinded for [sum] rounds. Save negates. Struck twice. Roll a d6 twice. Add effects; make one save. As 7. As 7. Struck thrice. Roll a d6 three times.",
      }
  },
  {
    name: "Rain of Arrows",
    img: "icons/svg/arrows.svg",
    type: "spell",
    system: {
      range: "200'",
      target: "20' Diameter",
      duration: "instant",
      effect: "Does [sum] damage. As Fireball except that the caster fires an arrow into the air (which turns into a multitude) and the damage is all piercing damage. Doesn't work in places with low ceilings (less than 100').",
      }
  },
  {
    name: "Raise Crawling Claw",
    img: "icons/svg/hand.svg",
    type: "spell",
    system: {
      range: "20'",
      target: "corpse",
      duration: "2 hours",
      effect: "Target is raised as a certain type of undead and obedient to the caster. Calculating the HD as if they were an unskilled member of their species. You cannot use this spell on a corpse that has HD greater than 2[dice]. The stats given are for a human-sized hand. Larger ones will be stronger and deal more damage. When this spell expires, the undead collapses into dust. Undead are technically non-sentient, but can still be commanded. Their Intelligence score represents their ability to behave intelligently in combat. They understand commands of up to two words, optionally accompanied by pointing at something. If you die while undead are under your control, each undead has an independent 50% chance of going wild and attacking the nearest living thing, and a 50% chance of seeking to devour your corpse and then attack the nearest living thing. These spells consume the corpse.",
      }
  },
  {
    name: "Raise Skeleton",
    img: "icons/svg/skeleton.svg",
    type: "spell",
    system: {
      range: "20'",
      target: "corpse",
      duration: "2 hours",
      effect: "HD as base creature, Def 14, Weapon or Claw 1d6 Move 12, Int 0, Mor 20. Double damage from bludgeoning. This is for a human-sized skeleton.",
      }
  },
  {
    name: "Raise Skin Kite",
    img: "icons/svg/skin.svg",
    type: "spell",
    system: {
      range: "20'",
      target: "corpse",
      duration: "2 hours",
      effect: "HD as base creature, Def 10, Whip 1d6, Fly 12, Int 5, Mor 20. Carrying capacity: 40 lbs. You can carve a mouth rune into a skin kite (a one-hour process), which allows you to cast a single spell through the skin kite (as if you were the skin kite). You must be able to see both the skin kite and the skin kite's target. After casting a spell through a skin kite, the kite disintegrates. These stats are for a human-sized skin kite.",
      }
  },
  {
    name: "Raise Zombie",
    img: "icons/svg/zombie.svg",
    type: "spell",
    system: {
      range: "20'",
      target: "corpse",
      duration: "2 hours",
      effect: "HD as base creature, HP +50%, Def 10, Slam 1d6, Move 6, Int 0, Mor 20. Zombies that are killed have a 50% chance to regain 1 HP at the start of their next turn; this ability is usable only once but refreshes if the zombie is healed above 1 HP. These stats are for a human-sized zombie. Zombies can fly if the base creature can fly.",
      }
  },
  {
    name: "Regenerate",
    img: "icons/svg/regenerate.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "[dice] hours",
      effect: "Target regenerates [dice] HP every 10 / [dice] minutes. If a unicorn horn or green troll heart is consumed during the casting, the recipient also regrows all missing limbs and body parts.",
      }
  },
  {
    name: "Revenant",
    img: "icons/svg/undead.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "player character corpse",
      duration: "[sum] minutes",
      effect: "A dead PC or hireling immediately returns to life as an undead, exactly as they were when they died (except for new injuries they may have gained in the process of dying). Their HP is [sum], up to their normal maximum HP. You cannot use this spell against any PC who died more than 10 minutes ago. When the duration elapses, the PC disintegrates.",
      }
  },
  {
    name: "Rot",
    img: "icons/svg/decay.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature or object",
      duration: "[sum] minutes",
      effect: "Creatures take [dice]^2 damage, save for half, and show physical (but not mechanical) signs of aging (white hair, wrinkles, but no loss of strength). Objects are aged according to how many dice are invested: [sum] weeks (1D) / [sum] months (2D) / [sum] years (3D+). Books sprout into mold, wood becomes soggy, lamps run out of fuel and grow cold, and stone is entirely unaffected. Undead are not damaged, and are instead healed for [sum] + [dice] HP.",
      }
  },
  {
    name: "Scry",
    img: "icons/svg/eye.svg",
    type: "spell",
    system: {
      range: "[dice] * 10'",
      target: "point in space",
      duration: "sustainable",
      effect: "You conjure an invisible sensor to a point in space that you designate. You do not have to have line of sight to cast it. If you can see invisible things, the sensor is a duplicate of your eye. As long as you maintain concentration, you can see through this sensor with your normal senses. This spell requires something to scry on, usually a mirror, quiet pool, clouds, or bonfire. If you invest at least two casting dice, you can also hear through the sensor. If you invest at least three dice, you can also speak through the sensor. If you use an actual crystal ball when casting this spell, the range is instead [dice] miles. Crystal balls are rare enough that they are never offered for sale, but are worth upwards of 3,000c.",
      }
  },
  {
    name: "Serpents of the Earth",
    img: "icons/svg/snake.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "natural soil or stone",
      duration: "sustainable",
      effect: "[Sum] enormous serpents of HD 1d4 crawl up from the dirt. They have Attack +3, Defense +3 and deal 1d6+HD damage, except for the 1 HD serpents, which are small and bite for 1 damage + deadly poison. Serpents are not controlled by you. They're just pissed off snakes.",
      }
  },
  {
    name: "Shadow Betrayal",
    img: "icons/svg/shadow.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature's shadow",
      duration: "[sum] rounds",
      effect: "The target takes damage if their shadow is attacked.",
      }
  },
  {
    name: "Shrivel",
    img: "icons/svg/shrivel.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "creature",
      duration: "[dice] *2 rounds",
      effect: "Target loses half of its current HP and loses [dice] Strength. When the spell ends, the lost HP and Strength return. If the [sum] is greater than 12, the lost HP does not return, and the Strength damage is permanent. The apparent age of the target increases considerably for the duration.",
      }
  },
  {
    name: "Sleep",
    img: "icons/svg/sleep.svg",
    type: "spell",
    system: {
      range: "50'",
      target: "creature",
      duration: "[sum] minutes",
      effect: "Target falls into a magical slumber, and can't be awoken by anything less vigorous than a slap. Non-alert, unaware targets are not allowed a Save. Has no effect on creatures with HD greater than [sum]. If [sum] is at least 4 times the creature's HD, the duration becomes permanent (until slapped) and the creature no longer needs to eat or drink while sleeping.",
      }
  },
  {
    name: "Speak with Birds",
    img: "icons/svg/bird.svg",
    type: "spell",
    system: {
      range: "–",
      target: "self and bird",
      duration: "2 * [sum] minutes",
      effect: "You can talk to a bird, and it can talk back. If there is a party of 3-6 adventurer's moving through the forest nearby, a random songbird has a [sum]x10% chance of knowing where they are and if they're doing anything extra weird. Birds of prey are rarer, but more observant.",
      }
  },
  {
    name: "Speak with Dead",
    img: "icons/svg/skull.svg",
    type: "spell",
    system: {
      range: "–",
      target: "corpse",
      duration: "[dice] minutes",
      effect: "You can converse freely with any corpse that has an intact jaw. The words of the dead tend to be cryptic and unhelpful, especially if the creature has no reason to help you. You can only converse with each corpse once. Corpses usually don't remember exactly how they died.",
      }
  },
  {
    name: "Spiteful Queen's Gift",
    img: "icons/svg/queen-gift.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "object",
      duration: "[dice] hours",
      effect: "The target is imbued with incendiary potency and will explode when touched by anyone but you. Any creature within 5' of the exploding object takes [sum] damage. If the object is not triggered before the duration, the spell expires and the magics harmlessly dissipate. The target objects are likely to be destroyed by the explosion; wooden items have 5-in-6 chance of breaking, iron items 3-in-6 and magic items 1-in-6.",
      }
  },
  {
    name: "Spit to Swords",
    img: "icons/svg/sword-spit.svg",
    type: "spell",
    system: {
      range: "–",
      target: "your spit",
      duration: "[sum] minutes",
      effect: "You transform your spit into blades. By spitting into your hand, you can create a light weapon for [dice] minutes. Alternatively, you may spit darts at a creature within 20', dealing 1d6 damage.",
      }
  },
  {
    name: "The Great Gambler",
    img: "icons/svg/dice.svg",
    type: "spell",
    system: {
      range: "–",
      target: "self",
      duration: "[sum] minutes",
      effect: "You are possessed by the spirit of Amashak the Evergreen, the greatest gambler who ever lived, who was eventually devoured by an alchemical ooze. She is pragmatic, calculating, and flirtatious. Your rolls are now coin flips. Heads i s12.Tails is 2. Ends if you fail to roleplay Amashak.",
      }
  },
  {
    name: "Transform Metal",
    img: "icons/svg/metal-transform.svg",
    type: "spell",
    system: {
      range: "touch",
      target: "metal object",
      duration: "permanent",
      effect: "Transform a target metal object however you wish. The size of the affected object and the possible extent of the transformation increases with the number of [dice]: [one] mold a sword-sized object into simple shapes. [two] mold a child-sized object into featureless complex shapes [three] mold a person-sized object into statue-like shapes or break it into multiple large pieces. [four] mold an object the size of an entire wall or floor into many finely machined parts, remove impurities, or shatter it to dust.",
      }
  },
  {
    name: "Unseen Orchestra",
    img: "icons/svg/music.svg",
    type: "spell",
    system: {
      range: "30'",
      target: "area",
      duration: "[sum] minutes",
      effect: "Invisible instruments play music of your choice in the designated area. The music can be as simple as a melody or as complex as a full orchestral arrangement. The quality depends on your knowledge of music, but can be quite impressive. The music can be heard by all within range and can even drown out other sounds if desired.",
      }
  },
  {
    name: "Wall of Doors",
    img: "icons/svg/door-wall.svg",
    type: "spell",
    system: {
      range: "20'",
      target: "a big enough empty space",
      duration: "[sum] minutes",
      effect: "You summon a 10' by 10' set of wooden double doors per [dice] arranged in a flat plane. You can orient it however you want. It has [sum] HP. You can control who and what can open the doors.",
      }
  },
  {
    name: "Wall of Earth",
    img: "icons/svg/wall-earth.svg",
    type: "spell",
    system: {
      range: "20'",
      target: "a big enough empty space",
      duration: "[sum] minutes",
      effect: "You rearrange dirt to form a 10' by 10' panel per [dice]. You can mold the wall, similar to cutting holes and notches in a sheet of paper. The wall has Defense 2 and [dice]x2 HD. If it is horizontal, the wall must be anchored on at least 2 sides.",
      }
  },
  {
    name: "Wall of Fire",
    img: "icons/svg/wall-fire.svg",
    type: "spell",
    system: {
      range: "20'",
      target: "a big enough empty space",
      duration: "[sum] minutes",
      effect: "You summon fire to form a 10' by 10' panel per [dice]. You can mold the wall, similar to cutting holes and notches in a sheet of paper. The wall does not block line of sight. It deals 1d6 fire damage to anything that passes through it. Save vs Dex or be set on fire.",
      }
  },
  {
    name: "Wall of Light",
    img: "icons/svg/wall-light.svg",
    type: "spell",
    system: {
      range: "20'",
      target: "a big enough empty space",
      duration: "[sum] minutes",
      effect: "You conjure either (a) a hemisphere that is 5' in diameter for every invested casting die, or (b) a 10' by 10' panel for every invested casting die, which can be arranged in any contiguous formation joined by their edges. For example, three casting dice would allow you to build a 10' by 30' wall. The wall is intangible, but you can control what each side shows. It can be either (a) inky darkness, (b) light out to 30', (c) mirror, or (d) transparency. Both sides do not have to show the same thing, so one side could show a mirror surface while the other can be seen through. You can change these surfaces with a thought.",
      }
  },
  {
    name: "Wall of Wind",
    img: "icons/svg/wind.svg",
    type: "spell",
    system: {
      range: "20'",
      target: "a big enough empty space",
      duration: "[sum] minutes",
      effect: "You summon wind to form a 10' by 10' panel per [dice]. You can mold the wall, similar to cutting holes and notches in a sheet of paper. The wall does not block line of sight. Powerful winds will knock small projectiles out of the air and prevent vermin (anything smaller than a rat) from crossing. Ranged attacks that pass through the wall get a -[dice] penalty to hit.",
      }
  },
  {
    name: "Wave of Mutilation",
    img: "icons/svg/blood-wave.svg",
    type: "spell",
    system: {
      range: "30' cone",
      target: "objects and creatures",
      duration: "instant",
      effect: "Everything in a 30' cone takes [sum] slashing damage. This spell leaves dozens of deep cuts. It shreds clothing, paper, and other fragile items.",
      }
  },
  {
    name: "Wizard Vision",
    img: "icons/svg/wizard-eye.svg",
    type: "spell",
    system: {
      range: "–",
      target: "self",
      duration: "[sum] minutes",
      effect: "One [dice]: You can see invisible things. You can see through illusions. Non-magical disguises (such as the ones assassins use) are not penetrated. Two dice: As above, except you can see through magical darkness, and see the true forms of shapeshifters. Three dice there are also some permanent effects: You can forever see invisible things as a slight warping or lensing of light. You know \"there's something over there\" and what size it roughly is, but nothing else. You can tell someone is a spellcaster by looking them in the eyes. The price for this gift is your mind. It is difficult for the human brain to stare at all the etheropelagic lifeforms that surround us, and all the unseen angles of parallel universes. You suffer a permanent loss of 1d6 Wisdom (as you reject the impossible reality you are looking at, and go a tiny bit insane) or 1d6 Charisma (as you accept this transcendental truth and become forever alienated from your fellow humans, who will never understand the truth). (Werewolves are both wolf and human, and appear as a wolf through your left eye and a human through your right eye. Doppelgangers have no true form and appear as a roiling mass of all the people they've been before.)",
      }
  }
];
