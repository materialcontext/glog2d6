// src/module/data/class-features.ts

// Define all class features as items for the compendium
export const ClassFeatures = [
  // ACROBAT FEATURES
  {
    name: "Tricky",
    img: "icons/svg/dice.svg",
    type: "feature",
    system: {
      requirements: "Acrobat Template A",
      activation: "passive",
      description: "Whenever you Attack or execute a Combat Maneuver and get doubles (other than snake-eyes), you may attempt a free Combat Maneuver or Dexterity check."
    }
  },
  {
    name: "Nimble",
    img: "icons/svg/agility.svg",
    type: "feature",
    system: {
      requirements: "Acrobat Template A",
      activation: "passive",
      description: "You get +1 bonus on all Dexterity Checks related to balancing, climbing, tumbling, and Sneak. Reduce all fall damage by 1d6."
    }
  },
  {
    name: "Escape Artist",
    img: "icons/svg/chains.svg",
    type: "feature",
    system: {
      requirements: "Acrobat Template B",
      activation: "passive",
      description: "You have +2 bonus on all checks to escape something that is restraining you. This includes grapples, lynchings, and awkward social situations, but not sealed coffins."
    }
  },
  {
    name: "Close Call",
    img: "icons/svg/aura.svg",
    type: "feature",
    system: {
      requirements: "Acrobat Template B",
      activation: "passive",
      description: "You always get a Dexterity save to get out of the path of danger, even if you have no idea it's coming. Additionally, whenever you have at least 1 HP and would roll a Trauma Save as a result of a critical hit or a failed save, drop to 0 HP instead."
    }
  },
  {
    name: "Traceur",
    img: "icons/svg/climb.svg",
    type: "feature",
    system: {
      requirements: "Acrobat Template C",
      activation: "passive",
      description: "You ignore any movement penalties caused by obstacles and any action penalties caused by moving. If there is a stable wall, you may treat it as if it were flat ground while moving, so long as you end your movement on a flat (horizontal) surface."
    }
  },
  {
    name: "Redirect",
    img: "icons/svg/direction.svg",
    type: "feature",
    system: {
      requirements: "Acrobat Template C",
      activation: "reaction",
      description: "When an enemy misses you with a melee attack, you may choose an adjacent target to take the blow instead. The new target rolls their defense as normal."
    }
  },
  {
    name: "The Greatest Escape",
    img: "icons/svg/angel.svg",
    type: "feature",
    system: {
      requirements: "Acrobat Template D",
      activation: "passive",
      description: "Once per lifetime, you can literally escape death. Your DM will describe the afterlife to you, as well as the opportunity that allows you to escape (if you wish to). This ability has no effect if your body has been destroyed beyond plausibility. A solo adventure to return to the land of the living is encouraged, but not required."
    }
  },

  // ASSASSIN FEATURES
  {
    name: "Poisoner",
    img: "icons/svg/poison.svg",
    type: "feature",
    system: {
      requirements: "Assassin Template A",
      activation: "passive",
      description: "You know all there is to know about poisons and with a week and a few 10s silver to the right people you can acquire toxic plants, venomous animals, or inorganic poisons. When you roll 11-12 to craft a poison, you tailor a special version that takes effect at the speed (rounds, minutes, hours, days, etc.) you wish and as dramatically as you want."
    }
  },
  {
    name: "Deadly Improvisation",
    img: "icons/svg/dagger.svg",
    type: "feature",
    system: {
      requirements: "Assassin Template A",
      activation: "passive",
      description: "You ignore all penalties to improvised weapons and your light weapons deal an additional 1d4 damage."
    }
  },
  {
    name: "Mr. Thus-and-Such",
    img: "icons/svg/mask.svg",
    type: "feature",
    system: {
      requirements: "Assassin Template B",
      activation: "passive",
      description: "With a week and a few 10s of silver to the right friends, you can create a foolproof false identity. For example, you might acquire appropriate clothing, letters of introduction, and official-looking certification to establish yourself as an important merchant from a remote city. Make a disguise check. On 11-12 the effect is perfect. On a 2-3 there is a small flaw, detectable only by those who are exceptionally worldly."
    }
  },
  {
    name: "Studied Target",
    img: "icons/svg/eye.svg",
    type: "feature",
    system: {
      requirements: "Assassin Template B",
      activation: "passive",
      description: "Keep a list of potential targets – up to the number of Assassin templates you possess – and important facts about them. Whenever you attempt to track, investigate, or harm a target on your list, you may cross off a fact related to the target and add a +1 bonus to the roll. It's up to you to explain how such a fact is relevant. These facts can be simple but they shouldn't be obvious."
    }
  },
  {
    name: "Dramatic Infiltration",
    img: "icons/svg/clockwork.svg",
    type: "feature",
    system: {
      requirements: "Assassin Template C",
      activation: "action",
      description: "So long as you are not in immediate danger, you may declare that you are walking off-screen. Later on in a different scene, you may reveal yourself to have been a minor NPC in the background of the scene \"all along\" as long as there actually are minor NPCs in the background of the scene. You can always walk back on stage at any time, even climbing in a window. This ability is limited only by plausibility."
    }
  },
  {
    name: "Co-Conspirator",
    img: "icons/svg/silhouette.svg",
    type: "feature",
    system: {
      requirements: "Assassin Template C",
      activation: "passive",
      description: "Whenever you work with a hireling you've hired to murder or spy on a target, that hireling receives bonuses as if they were you so long as you are in the scene with them."
    }
  },
  {
    name: "Assassinate",
    img: "icons/svg/skull.svg",
    type: "feature",
    system: {
      requirements: "Assassin Template D",
      activation: "passive",
      description: "Any target you know three facts about who fails a Trauma Save against you dies instantly."
    }
  },

  // BARBARIAN FEATURES
  {
    name: "Foreign",
    img: "icons/svg/travel.svg",
    type: "feature",
    system: {
      requirements: "Barbarian Template A",
      activation: "passive",
      description: "It's obvious to anyone who sees you that you're not from around here, and locals immediately mark you as an outsider. As a result, you can always find someone to explain what's happening or find people looking for cheap or disposable help. You also get 2 random features from outsider quirks. Everyone outside your culture thinks this stuff is weird."
    }
  },
  {
    name: "At the Gates",
    img: "icons/svg/gate.svg",
    type: "feature",
    system: {
      requirements: "Barbarian Template A",
      activation: "passive",
      description: "Locks fail. Walls crumble. Nothing can be held at bay forever, especially you. You get a +1 bonus on all attempts to break down doors, bypass locks, scale or destroy walls, or otherwise overcome obstacles specifically designed to keep you out, including social norms and spells."
    }
  },
  {
    name: "Reputation For...",
    img: "icons/svg/sound.svg",
    type: "feature",
    system: {
      requirements: "Barbarian Template B",
      activation: "passive",
      description: "Whether or not it's true, people of your culture have a certain reputation. There's a 50% chance characters you meet can tell where you're from just by appearance. Roll or choose from: 1. Violence, 2. Deceit, 3. Cowardice, 4. Generosity, 5. Fairness, 6. Mercy. Each provides different bonuses and penalties to social interactions."
    }
  },
  {
    name: "Danger Sense",
    img: "icons/svg/warning.svg",
    type: "feature",
    system: {
      requirements: "Barbarian Template B",
      activation: "passive",
      description: "You get a +1 bonus to Hide checks for every two Barbarian templates you possess. You cannot be surprised and while you are leading, improve all Ambush Die results by 1."
    }
  },
  {
    name: "Tough",
    img: "icons/svg/armor.svg",
    type: "feature",
    system: {
      requirements: "Barbarian Template C",
      activation: "passive",
      description: "These men are weak and decadent. Where they crumble, you survive. You get a +1 bonus on all Endurance checks and Trauma Saves. The first time you take a wound in an encounter regain 1d6 HP."
    }
  },
  {
    name: "Feats of Strength",
    img: "icons/svg/muscle.svg",
    type: "feature",
    system: {
      requirements: "Barbarian Template C",
      activation: "passive",
      description: "Whenever you roll doubles (other than snake eyes) on a Strength check double your Strength bonus for that roll. Likewise, when you roll doubles and hit with a Melee Attack roll (other than snake-eyes) add your Strength bonus to damage."
    }
  },
  {
    name: "Tread the Jeweled Thrones",
    img: "icons/svg/crown.svg",
    type: "feature",
    system: {
      requirements: "Barbarian Template D",
      activation: "passive",
      description: "Kings are nothing to you, you were born to lay them low. Sovereigns and tyrants have no HP against you. This includes true sovereigns, leaders of criminal syndicates or cults, divine champions, etc."
    }
  },

  // COURTIER FEATURES
  {
    name: "Courtly Education",
    img: "icons/svg/book.svg",
    type: "feature",
    system: {
      requirements: "Courtier Template A",
      activation: "passive",
      description: "You get +1 language and are trained in archery. You get a +1 bonus on all rolls related to dress, dance, etiquette, horsemanship, flattery or verse."
    }
  },
  {
    name: "Fast Talker",
    img: "icons/svg/mouth.svg",
    type: "feature",
    system: {
      requirements: "Courtier Template A",
      activation: "passive",
      description: "You are an expert blatherer, liar, and wit. Whenever you fail a social check and roll doubles (other than snake eyes), make up a new argument or lie and re-roll the check. If you succeed on such a check and roll doubles, slip an additional piece of information into the conversation. The target believes it without even thinking about it, so long as it seems plausible."
    }
  },
  {
    name: "Welcome Guest",
    img: "icons/svg/door.svg",
    type: "feature",
    system: {
      requirements: "Courtier Template B",
      activation: "passive",
      description: "You have no trouble finding an invitation to dinner and never pay for lodging. When entering a new town you have a 4-in-6 chance of having already received an invitation from a local lord or wealthy merchant."
    }
  },
  {
    name: "Entourage",
    img: "icons/svg/group.svg",
    type: "feature",
    system: {
      requirements: "Courtier Template B",
      activation: "passive",
      description: "Gain 2 free hirelings. These hirelings don't cost you gold or count toward the total number of hirelings you can hire. Who exactly these lackeys are seems to change by the hour, but there's always a couple around."
    }
  },
  {
    name: "Never Forget a Face",
    img: "icons/svg/brain.svg",
    type: "feature",
    system: {
      requirements: "Courtier Template C",
      activation: "passive",
      description: "Memorizing the ins-and-outs of noble lineage and court life has given you a perfect memory for names and faces. When you meet someone new, you have a 2-in-6 chance of knowing their name. If they are nobility or from an otherwise prominent house, you have a 4-in-6 chance and also know their title and details about their family. This may even apply to named monsters and other implausible encounters."
    }
  },
  {
    name: "Loyal Servants",
    img: "icons/svg/hand.svg",
    type: "feature",
    system: {
      requirements: "Courtier Template C",
      activation: "passive",
      description: "If an Attack would cause you to make a Trauma Save, an adjacent hireling takes the damage instead. Your servants will act proactively on your behalf, doing their best to look after what they believe to be your interests."
    }
  },
  {
    name: "Windfall",
    img: "icons/svg/coins.svg",
    type: "feature",
    system: {
      requirements: "Courtier Template D",
      activation: "passive",
      description: "You inherit 4d6 * 1000 gold. Perhaps an uncle died. 1d6 nuisance relatives will be showing up at your door to live in your house and ask for money, and turning them away would be deadly to your reputation. Coincidentally, there is a 4-in-6 chance that the Assassin's Guild has just accepted a contract to kill you."
    }
  },

  // FIGHTER FEATURES
  {
    name: "Battle Scars",
    img: "icons/svg/blood.svg",
    type: "feature",
    system: {
      requirements: "Fighter Template A",
      activation: "passive",
      description: "Each time you recover from a wound that could have killed you, increase your max HP by 1 up to the number of fighter templates you possess. You regain this much HP at the start and end of every fight."
    }
  },
  {
    name: "Veteran's Eye",
    img: "icons/svg/eye.svg",
    type: "feature",
    system: {
      requirements: "Fighter Template A",
      activation: "passive",
      description: "You've seen and fought opponents of every imaginable kind and you can size people up at a glance. You have a good idea of what an enemy is capable of and how much punishment he can take. At the start of combat you learn the target's current HP (in hit dice) and Strength or Dexterity (whichever is higher) of a number of enemies equal to your intelligence modifier (minimum 1)."
    }
  },
  {
    name: "Armor Training",
    img: "icons/svg/shield.svg",
    type: "feature",
    system: {
      requirements: "Fighter Template B",
      activation: "passive",
      description: "You ignore 1 point of encumbrance from armor. Sundering your shield always reduces damage by the full 12 points, and shields are not improvised weapons for you."
    }
  },
  {
    name: "Reputation for Mercy",
    img: "icons/svg/angel.svg",
    type: "feature",
    system: {
      requirements: "Fighter Template B",
      activation: "passive",
      description: "You've been fair in your dealings and merciful to your opponents. Your reputation has spread far beyond you. Whenever you encounter another fighter or leader of importance there is a 5-in-6 chance they've heard of you. You have a +1 bonus to all reaction rolls and Diplomacy checks against characters who've heard of you. In the event you do not deserve such a reputation, replace this feature with the Barbarian's Reputation for Violence feature. Once you lose this feature, you cannot regain it."
    }
  },
  {
    name: "Superior Combatant",
    img: "icons/svg/sword.svg",
    type: "feature",
    system: {
      requirements: "Fighter Template C",
      activation: "passive",
      description: "When you hit with an attack and roll doubles it's a critical hit. If you miss but get doubles, execute a free Combat Maneuver."
    }
  },
  {
    name: "Impress",
    img: "icons/svg/stars.svg",
    type: "feature",
    system: {
      requirements: "Fighter Template C",
      activation: "passive",
      description: "Whenever you win a fight against challenging foes, people who don't like you make a new reaction roll. This even works on people you just defeated in combat, unless you caused them undeserved or disproportionate harm."
    }
  },
  {
    name: "Double Attack",
    img: "icons/svg/daggers.svg",
    type: "feature",
    system: {
      requirements: "Fighter Template D",
      activation: "passive",
      description: "You can attack twice per round on your turn."
    }
  },

  // HUNTER FEATURES
  {
    name: "Tracker",
    img: "icons/svg/footprint.svg",
    type: "feature",
    system: {
      requirements: "Hunter Template A",
      activation: "passive",
      description: "When you have the Recon Die, your chances of surprising the enemy or finding its trail increase to 2-in-6. You may designate a specific creature as your quarry. You learn one new fact about it whenever you encounter it."
    }
  },
  {
    name: "Woodsman",
    img: "icons/svg/tree.svg",
    type: "feature",
    system: {
      requirements: "Hunter Template A",
      activation: "passive",
      description: "You don't need to make Endurance checks related to travel, you are not Deprived for resting without bedroll or fire, you have no trouble finding sources of food and water in the wilderness, and you ignore penalties from difficult terrain when alone."
    }
  },
  {
    name: "Stalker",
    img: "icons/svg/shadow.svg",
    type: "feature",
    system: {
      requirements: "Hunter Template B",
      activation: "passive",
      description: "You get a +1 bonus to Sneak and Hide checks for every 2 Hunter templates you possess. Improve all results of the Ambush die by 1."
    }
  },
  {
    name: "Animal Companion",
    img: "icons/svg/wolf.svg",
    type: "feature",
    system: {
      requirements: "Hunter Template B",
      activation: "passive",
      description: "You have an animal companion you trained yourself. This companion can perform a certain action when a condition is true. The most common one is \"attack when I fire\", but others are possible. Normally you'd spend a round giving orders to your pet. It learns an extra such action for each Hunter template you possess."
    }
  },
  {
    name: "Trapper",
    img: "icons/svg/net.svg",
    type: "feature",
    system: {
      requirements: "Hunter Template C",
      activation: "passive",
      description: "You're experienced with all kinds of animal traps. You can set any animal trap (snares, pits, cages, etc.) in five minutes and you immediately spot any such trap. You get a +2 bonus on any roll to construct or spot non-magical traps outside this expertise."
    }
  },
  {
    name: "Advantageous Terrain",
    img: "icons/svg/mountain.svg",
    type: "feature",
    system: {
      requirements: "Hunter Template C",
      activation: "passive",
      description: "If you have the Recon die and roll an active or passive encounter in the wild, you can draw the map for the encounter and may decide where everyone is, so long as it's plausible. If you are outdoors but in an urban environment, you may add 2 minor features to the scene."
    }
  },
  {
    name: "Legendary Hunt",
    img: "icons/svg/bow.svg",
    type: "feature",
    system: {
      requirements: "Hunter Template D",
      activation: "passive",
      description: "You can kill anything. Work with your DM to plan a hunt of any non-humanoid creature in the game world. Whatever you kill should be utterly unique and the reward for killing it should take the place of a capstone feature."
    }
  },

  // THIEF FEATURES
  {
    name: "Pick-Pocket",
    img: "icons/svg/hand.svg",
    type: "feature",
    system: {
      requirements: "Thief Template A",
      activation: "action",
      description: "You can steal a single item off of any person you come into physical contact with so long as it is plausible to do so and they don't have reason to be suspicious of you. The object must not be firmly secured and you must be able to see the object or declare a location on their person (e.g. 'left pocket'). Eventually they figure out it's been stolen. Try not to be a suspect. You can also use this to place an item on someone."
    }
  },
  {
    name: "Black Market Gossip",
    img: "icons/svg/sound.svg",
    type: "feature",
    system: {
      requirements: "Thief Template A",
      activation: "passive",
      description: "You have a 4-in-6 chance of knowing the origin, owner, and history of any unique item you see or hear about. This feature also works if you see or hear about the owner of such an item."
    }
  },
  {
    name: "Well-Planned Heist",
    img: "icons/svg/map.svg",
    type: "feature",
    system: {
      requirements: "Thief Template B",
      activation: "passive",
      description: "If you thoroughly investigate a building or lair before breaking in, you may add the Recon Die to any one roll during the break-in by explaining how the recon helped. Additionally, when you roll the Recon Die, you reveal evidence of secret passages as well as monsters."
    }
  },
  {
    name: "Change Hands",
    img: "icons/svg/sleight.svg",
    type: "feature",
    system: {
      requirements: "Thief Template B",
      activation: "action",
      description: "You don't have it. At any time you can reduce your HP to zero and declare that you don't have the thing you had. Give it to any character you've encountered since you acquired or last used the item."
    }
  },
  {
    name: "Always Prepared",
    img: "icons/svg/bag.svg",
    type: "feature",
    system: {
      requirements: "Thief Template C",
      activation: "passive",
      description: "When in town, you may spend any amount of money and inventory slots to buy an Unlabeled Package. When the package is unwrapped, you declare what it contains. The contents must use the appropriate number of Inventory Slots, not cost more than you paid, and be available in town. You can only have two Unlabeled Packages at a time."
    }
  },
  {
    name: "A Motley Crew",
    img: "icons/svg/group.svg",
    type: "feature",
    system: {
      requirements: "Thief Template C",
      activation: "passive",
      description: "You may hire any specialist you need for a heist in place of mercenaries. All characters hired this way are level 1 thieves with a specialized class feature. They all hate each other. Let your DM know in advance so they can prepare a roster of options."
    }
  },
  {
    name: "Heist of the Century",
    img: "icons/svg/gem.svg",
    type: "feature",
    system: {
      requirements: "Thief Template D",
      activation: "passive",
      description: "You can steal anything. It's time to prove it. Work with your DM to plan a heist of anything in the game world. Whatever you steal should be irreplaceable and take the place of a capstone feature."
    }
  },

  // WIZARD FEATURES
  {
    name: "School of Magic",
    img: "icons/svg/book.svg",
    type: "feature",
    system: {
      requirements: "Wizard Template A",
      activation: "passive",
      description: "Pick a school of magic. Each school of magic comes with restrictions, perks, and minor improvements to certain spells associated with your school. Each school of magic also comes with a starting spellbook."
    }
  },
  {
    name: "Book Casting",
    img: "icons/svg/scroll.svg",
    type: "feature",
    system: {
      requirements: "Wizard Template A",
      activation: "passive",
      description: "You cast from a scroll or a spellbook in a way that does not expend the spell. You do not gain the free casting die normally generated by a scroll, and automatically fumble the spell if you take any damage before the casting is completed at the end of the round. The spell vanishes from the scroll and returns again the next morning."
    }
  },
  {
    name: "Ancient Tongues",
    img: "icons/svg/runes.svg",
    type: "feature",
    system: {
      requirements: "Wizard Template B",
      activation: "passive",
      description: "When you encounter a bit of language that you don't know—like a page in a book, inscription on a ring, or occult phrase—there's a 2-in-6 chance you know it. Not that you know the whole language, just that you happen to know what this particular bit of language means."
    }
  },
  {
    name: "Intellect Fortress",
    img: "icons/svg/brain.svg",
    type: "feature",
    system: {
      requirements: "Wizard Template B",
      activation: "passive",
      description: "You get +1 to Int and Wis Saves for each Wizard template you possess."
    }
  },
  {
    name: "One More Thing…",
    img: "icons/svg/insight.svg",
    type: "feature",
    system: {
      requirements: "Wizard Template C",
      activation: "action",
      description: "When the DM finishes introducing a named character or new part of the world you can add one extra detail–limited to what the table tolerates."
    }
  },
  {
    name: "Autochthonous Spell",
    img: "icons/svg/magic.svg",
    type: "feature",
    system: {
      requirements: "Wizard Template C",
      activation: "passive",
      description: "Choose one Legendary spell from your Wizard school or work with your DM to create another. This spell is endemic to your mind, does not take up a spell slot, and vanishes from your mind when cast. It returns to you in the morning--unless you write it down--in which case it becomes a normal spell and can be consumed and destroyed. If you lose it in this way, you have a 1-in-6 chance of recovering it during each downtime."
    }
  },
  {
    name: "Wizard's Tower",
    img: "icons/svg/tower.svg",
    type: "feature",
    system: {
      requirements: "Wizard Template D",
      activation: "passive",
      description: "You feel compelled to build a tower. Maybe not a literal tower. It could be a library, laboratory, or another building suitable for arcane research. You must spend 1000s on a starter structure. If another member of the party already has such a building you may use that instead. Every floor of your tower grants you an additional spell slot. Each new addition to the tower costs double the previous one. You may enchant it and stock it with creatures if you wish, at great expense."
    }
  }
];
