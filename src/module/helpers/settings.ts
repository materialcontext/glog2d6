export function registerSettings() {
  // Register any system settings here
  game.settings.register("my-foundry-system", "macroShorthand", {
    name: "SETTINGS.MacroShorthandName",
    hint: "SETTINGS.MacroShorthandHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}
