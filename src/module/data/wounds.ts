// src/module/data/wounds.ts

// Define all wounds as items for the compendium
export const Wounds = [
  {
    name: "Marked",
    img: "icons/svg/blood.svg",
    type: "wound",
    system: {
      severity: 1,
      effect: "Roll 1d6 to see which part of you is marked and then reduce one physical stat by 1 point until rest and recover hit points. When you remove this wound, reroll your 1d6 for max HP and keep the result if higher. This penalty stacks.",
      healing: "Removed during downtime between adventures.",
      description: "Roll 1d6: 1: Leg, 2: Chest, 3: Arm, 4: Shoulder, 5: Abdomen, 6: Hand. A noticeable mark or scar appears on the indicated body part."
    }
  },
  {
    name: "Concussed",
    img: "icons/svg/brain.svg",
    type: "wound",
    system: {
      severity: 2,
      effect: "Reduce your Intelligence and Wisdom by 1 point until you rest and recover hit points. When you remove this wound, reroll your 1d6 for max HP and keep the result if higher. This penalty stacks.",
      healing: "Removed during downtime between adventures.",
      description: "Your head rings and your thoughts are fuzzy. You have difficulty focusing and remembering details."
    }
  },
  {
    name: "Hobbled",
    img: "icons/svg/leg.svg",
    type: "wound",
    system: {
      severity: 3,
      effect: "Your movement is reduced to 10' until the wound is healed. After you've recovered, reroll your max HP and keep the result if higher. This penalty does not stack.",
      healing: "Removed during downtime between adventures.",
      description: "Your leg is injured or twisted, significantly impeding your mobility."
    }
  },
  {
    name: "Smashed",
    img: "icons/svg/face.svg",
    type: "wound",
    system: {
      severity: 4,
      effect: "You look a mess and take a -1 penalty to all Charisma and Reaction checks until you get it fixed. This penalty stacks. If you roll this a second time you also use your mouth to chew or talk.",
      healing: "Removed during downtime between adventures.",
      description: "Your face is bruised, bloody, or otherwise visibly damaged, making you look frightening or pitiful to others."
    }
  },
  {
    name: "Slashed",
    img: "icons/svg/slash.svg",
    type: "wound",
    system: {
      severity: 5,
      effect: "You cannot regain HP until you've rested and had the wound stitched shut. Common healing only goes so far, magical or otherwise. After the stitches heal, reroll your max HP on 1d8 and keep the result if it's higher. This penalty stacks.",
      healing: "Removed during downtime between adventures after proper medical treatment.",
      description: "A deep cut or laceration that continuously bleeds without proper treatment."
    }
  },
  {
    name: "Humiliated",
    img: "icons/svg/shame.svg",
    type: "wound",
    system: {
      severity: 6,
      effect: "Do not lose this wound until after you get revenge. When you recover from this, reroll your maximum HP on 1d8. Keep the result if it's higher. This penalty does not stack.",
      healing: "Removed only after exacting revenge on the source of humiliation.",
      description: "You've been defeated in a particularly embarrassing way. Your pride is wounded and you obsess over getting even."
    }
  },
  {
    name: "Ruptured",
    img: "icons/svg/internal.svg",
    type: "wound",
    system: {
      severity: 7,
      effect: "Reduce Strength and Dexterity by 1 until you see a medical specialist. After recovering, reroll your max HP on 1d8 and keep the result if higher. This penalty does not stack.",
      healing: "Removed during downtime between adventures after visiting a specialist.",
      description: "An internal injury that causes pain with movement and exertion."
    }
  },
  {
    name: "Crushed",
    img: "icons/svg/shattered.svg",
    type: "wound",
    system: {
      severity: 8,
      effect: "Your body and spirit are crushed. Reduce all stats by 1 until you've recovered from this wound. This wound takes longer to overcome and thus you cannot remove it during your next downtime. After recovering, reroll your HP on 1d8 and keep the result if higher.",
      healing: "Cannot be removed during the next downtime, requires extended rest.",
      description: "Multiple broken bones or extensive damage has left you in a terrible state, both physically and mentally."
    }
  },
  {
    name: "Maimed",
    img: "icons/svg/dismember.svg",
    type: "wound",
    system: {
      severity: 9,
      effect: "Part of your body is damaged beyond repair. Roll 1d6: 1: Roll twice more and keep both results. 2: Sword Arm: -1 to attacks and fine motor actions. 3: Face: -2 to Charisma and Reaction rolls. 4: Shield Arm. 5-6: Leg: Movement reduced to 10' and -2 to Defense and evasion.",
      healing: "Requires a prosthesis or magical enhancement to compensate for the loss.",
      description: "You've permanently lost functionality in a body part. If not removed after 3 months in-game time, you automatically gain a basic prosthetic and remove this wound."
    }
  },
  {
    name: "Scrambled",
    img: "icons/svg/confusion.svg",
    type: "wound",
    system: {
      severity: 10,
      effect: "Take 2 wounds instead of 1. You feel like a slightly different person. Reroll your Charisma then take a -2 penalty to all mental stats until you recover.",
      healing: "Removed during downtime between adventures.",
      description: "Your mind has been altered by trauma, changing something fundamental about your personality."
    }
  },
  {
    name: "Broken",
    img: "icons/svg/broken-bone.svg",
    type: "wound",
    system: {
      severity: 11,
      effect: "Internal bleeding, broken ribs, concussion. It's hard to breathe or focus. Take 2 wounds and reduce all stats by 1 until you recover. At the start of each round of combat make a DC 7 Constitution check, if you fail you fall unconscious at the end of your turn. Otherwise increase the DC by 1 and repeat it on your next turn.",
      healing: "Removed after extensive medical treatment and downtime.",
      description: "You're on the verge of complete collapse, with multiple serious injuries threatening your life."
    }
  },
  {
    name: "Doomed",
    img: "icons/svg/skull.svg",
    type: "wound",
    system: {
      severity: 12,
      effect: "You shouldn't have survived that. You have dreams of your own death. Take 2 wounds instead of 1. The next time you fail a Trauma save, you die. Until you recover, you have a 50% chance of the nightmares ruining your sleep, depriving you of its benefits.",
      healing: "Remove this wound only if it is your last one.",
      description: "Death has marked you and watches your every move. You live on borrowed time, feeling the cold presence of your impending demise."
    }
  }
];
