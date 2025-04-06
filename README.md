# GLOG 2d6 System for Foundry VTT

A custom Foundry VTT system implementation for the 2d6 variant of the Goblin Laws of Gaming (GLOG) ruleset.

## Features

- Complete implementation of the GLOG 2d6 core mechanics
- Character, NPC, and Hireling actor types
- Support for all item types (weapons, armor, spells, templates, etc.)
- Customizable character sheets with all the core GLOG features
- Automatic dice rolls for attributes, attacks, and saves
- Full template (class) implementation with A/B/C/D levels
- Spell casting system with dice management, mishaps, and dooms
- Wound tracking system

## Installation

### Method 1: Install via Foundry VTT

1. In the Foundry VTT setup screen, navigate to "Add-on Modules"
2. Click "Install System"
3. Search for "GLOG 2d6"
4. Click "Install"

### Method 2: Manual Installation

1. Download the latest release from the [releases page](https://github.com/yourusername/glog2d6/releases)
2. Extract the ZIP file
3. Place the extracted folder in your Foundry VTT systems directory
4. Restart Foundry VTT

### Method 3: Build from Source

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the system: `npm run build`
4. Link or copy the `dist` directory to your Foundry VTT systems folder

## Usage

### Creating a Character

1. Create a new world using the GLOG 2d6 system
2. Create a new actor of type "Character"
3. Fill in attributes
4. Add templates (classes) via the Features tab
5. Add items, spells, etc.

### Rolling Dice

The system supports the following roll types:
- Attribute checks (with difficulty selection)
- Saves
- Attack rolls
- Spell casting

Click on the attribute modifier to make an attribute check.

### Spell Casting

Spells use the GLOG dice pool system:
1. Each wizard template provides 1 magic die (MD)
2. When casting a spell, choose how many dice to invest
3. Dice showing 1-3 return to your pool, 4-6 are exhausted
4. Doubles cause mishaps, triples cause dooms

### Templates (Classes)

Templates represent character classes in GLOG:
1. Each character can have up to 4 templates
2. Templates are assigned levels A through D
3. Each template provides specific features and abilities

### Wounds

The system tracks wounds according to GLOG 2d6 rules:
1. When reduced to 0 HP, characters make a trauma save
2. Failed saves result in wounds
3. Characters with more wounds than their level must retire

## System Architecture

The system is built with TypeScript and follows a modular architecture:

- `src/module/documents`: Core document classes (Actor, Item)
- `src/module/sheets`: Sheet implementations for UI
- `src/module/helpers`: Utility functions and configurations
- `src/templates`: Handlebars templates for UI rendering
- `src/styles`: SCSS stylesheets

## Customization

The system is designed to be easily customizable:

- Modify `src/module/helpers/config.ts` to change system constants
- Edit language files in `src/lang/` to change terminology
- Create custom templates and styles in their respective directories

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- The GLOG community for the incredible ruleset
- The Foundry VTT community for their support and resources

## Contact

For questions, issues, or feature requests, please use the GitHub issue tracker.
