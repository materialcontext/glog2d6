/**
 * Register system settings
 */
export function registerSettings(): void {
  // Register any system settings here
  game.settings.register("glog2d6", "macroShorthand", {
    name: "SETTINGS.MacroShorthandName",
    hint: "SETTINGS.MacroShorthandHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}
