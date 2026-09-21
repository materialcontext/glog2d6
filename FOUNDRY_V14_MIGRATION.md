# Foundry VTT v14 — item sheet migration

Notes from bringing the item sheets up to Foundry VTT v14. Written after the
upgrade broke item editing; kept here so the next core bump has a starting point.

## What actually broke

### 1. The `{{#select}}` Handlebars helper was removed (root cause)

`{{#select}}` was deprecated in v12 and **removed in v14** as part of the
end-of-deprecation sweep, alongside `{{colorPicker}}` and `selectOptions`'
`nameAttr` parameter. Every `<select>` in the item sheets was built with it:

| Template | `{{#select}}` blocks |
| --- | --- |
| `item-weapon-sheet.hbs` | size, condition |
| `item-armor-sheet.hbs` | type, condition |
| `item-gear-sheet.hbs` | size |
| `item-feature-sheet.hbs` | class source, template, reputation |
| `item-torch-sheet.hbs` | light animation |

A missing Handlebars helper throws during render, so the whole sheet failed —
not just the dropdown. The actor templates never used `{{#select}}`, which is
why the breakage looked item-specific.

**Fix:** all dropdowns now use `{{selectOptions choices selected=value}}`, with
the choice lists supplied by the sheet.

### 2. Item sheets were still on the AppV1 framework

`GLOG2D6ItemSheet extends foundry.appv1.sheets.ItemSheet`. AppV1 still exists in
v14 but is deprecated and slated for removal (currently targeted at v16), and it
no longer benefits from the v14 render pipeline (two-pass state preservation,
detached windows, ProseMirror-only editors).

**Fix:** rewritten on `HandlebarsApplicationMixin(ItemSheetV2)`.

### 3. `prepareBaseData()` / `prepareDerivedData()` never called `super`

`GLOG2D6Item` and `GLOG2D6Actor` both overrode these without calling up. On v14
the base `prepareBaseData()` is what resets Foundry's ActiveEffect phase
tracking; skipping it makes the *second* and every later preparation of a
document throw `ActiveEffect application phase 'initial' has already completed`.
For an item sheet that means the first open works and every subsequent edit
fails.

**Fix:** both documents call `super` first.

## Bugs found along the way (pre-existing, not v14)

- **`weaponTypeOptions` emitted a duplicate value.** The "Explosive" checkbox was
  registered with `value: 'thrown'`, so ticking Explosive stored `thrown` and the
  explosive attack bonus could never apply.
- **Changing weapon size threw a `TypeError`.** `_onWeaponSizeChange` looked up
  `select[name="system.weaponType"]`, but the template had been converted to
  checkboxes, so `typeSelect.value` dereferenced `null`. `_onWeaponTypeChange`
  was dead code for the same reason.
- **The reputation picker never appeared.** `item-feature-sheet.hbs` tested
  `{{#if (or (contains name "Reputation for") ...)}}`, but `name` was never put
  into the render context — the expression was always false.
- **`note` items were undeclared.** `template.json` defines a `note` item type
  and the system creates, opens and reveals them, but `system.json`'s
  `documentTypes.Item` omitted it, so the subtype was never registered.
- **Stray literal in the feature sheet.** An `i` was rendering above the
  Description label.
- **`weaponSizes` context was wrong.** The old `getData()` passed
  `CONFIG.GLOG.CONSTANTS.WEAPON_SIZES` (`{LIGHT: 'light'}`) where the template
  wanted labels; the template ignored it and hardcoded the list instead.
- **Empty weapon type arrays.** `getWeaponTypes()` treated `[]` as a real value
  and returned it, instead of falling back to `melee`.

## Shape of the new code

```
module/item/item-sheet-config.mjs   pure data + pure functions, no Foundry globals
module/item/item-sheet.mjs          thin ApplicationV2 adapter
templates/item/item-*-sheet.hbs     one body template per type, no <form> wrapper
```

`item-sheet-config.mjs` is the single place a new item type is registered:

```js
export const ITEM_SHEET_CONFIG = {
    armor: {
        position: { height: 480 },                  // optional window override
        choices: ({ system }) => ({ ... }),          // render context slice
        autoFields: ["system.type"],                 // fields that drive derived stats
        derive: system => armorDefaults(system.type) // the derived stats themselves
    }
};
```

Adding a type = one entry plus `templates/item/item-<type>-sheet.hbs`. The
template path, preload list, sheet registration list and window options all
derive from that table.

### Notable behaviour changes

- **Derived stats are recomputed on submit, not by poking the DOM.** The old
  sheet wrote directly into `<input>` elements on `change`. The new sheet
  computes the baseline profile in `_processFormData`, so armor-type and
  weapon-size changes land as a single validated document update.
- **Weapon type is always stored as an array.** `getWeaponTypes()` still accepts
  the legacy string form for existing world items.
- **Templates no longer own a `<form>`.** ApplicationV2 renders the sheet with
  `tag: "form"`; a nested `<form>` would detach every field from submission.
  There is a test asserting this.
- **Image picker** uses `data-action="editImage"` (DocumentSheetV2's built-in
  action) rather than AppV1's implicit `data-edit` handling.

## Still on AppV1 (not addressed here)

These are outside the item sheet scope but will need the same treatment before
AppV1 is removed:

- `module/actor/actor-sheet.mjs`, `module/actor/hireling-sheet.mjs` —
  `foundry.appv1.sheets.ActorSheet`
- `module/systems/error-tracking.mjs` — compares against
  `foundry.appv1.sheets.ActorSheet.prototype`
- `FormApplication` subclasses: `roll-request-dialog.mjs`,
  `reputation-roll-dialog.mjs`, `attribute-selection-dialog.mjs`,
  `actor-trauma-system.mjs`
- `Dialog` / `Dialog.confirm` in `actor-sheet.mjs` and `sheet-roll-handler.mjs`
  → `foundry.applications.api.DialogV2`

## The Recon button

`Hooks.on('renderSidebarTab', ...)` stopped firing when the sidebar moved to
ApplicationV2 in v13, so the Recon icon vanished from the chat controls. The
chat input and its controls are now rendered outside the normal render pass and
re-parented afterwards ([foundryvtt#12719](https://github.com/foundryvtt/foundryvtt/issues/12719)),
so there is no stable seam left to splice an icon into.

The check now lives as a one-shot tool under the **Token scene controls**, using
the documented `getSceneControlButtons` hook. Note the v13 shape change: both
`controls` and each control's `tools` are records keyed by name, not arrays, and
a tool without `onChange`/`onClick` throws inside core
([foundryvtt#12761](https://github.com/foundryvtt/foundryvtt/issues/12761)).

```js
Hooks.on("getSceneControlButtons", controls => {
    controls.tokens.tools.glog2d6Recon = {
        name: "glog2d6Recon", title: "Recon Check", icon: "fas fa-binoculars",
        button: true, order: Object.keys(controls.tokens.tools).length,
        onChange: () => game.glog2d6.rollRequest("recon")
    };
});
```

The `/recon` chat command is unaffected and still works.

## One condition track

Breakage used to disagree with itself in three places: `breakEquippedItem` and
`BreakageCalculator` treated `level >= maxLevel` as broken (so armor at
`maxLevel: 1` was broken at level 1), `inventory-tab.hbs` only showed `BROKEN`
above `maxLevel`, and the armor sheet offered Fine / Damaged 1 / Broken.

`module/systems/breakage-calculator.mjs` is now the single source of truth:

```
level 0  Fine
level 1  Damaged      weapon die steps down; armor/shield lose 1 protection
level 2  Broken       weapon deals "0"; armor/shield give 0
```

`maxLevel` is **2** for weapons, armor and shields alike, and "broken" is always
`level >= BREAKAGE_MAX_LEVEL`. Everything reads through that module:

- `item-sheet-config.mjs` builds one condition dropdown for all three types.
- `actor.mjs#breakEquippedItem` steps the track with `nextLevel()` / `isBroken()`.
- `actor-combat-system.mjs` runs *shields* through `calculateArmorBonus` too;
  previously shield breakage was ignored entirely.
- `inventory-tab.hbs` uses `{{isBroken}}` / `{{isDamaged}}` helpers, replacing
  two divergent per-type branches with one.
- The item sheet coerces the submitted level to a number and pins `maxLevel`;
  `<select>` submits strings and template.json types do no coercion.

Shields gained a condition block (they were rendered in the armor branch of the
inventory list but had no breakage data) and a Condition field on their sheet.

### Migration

`migrateContent()` (content version `1.3.0`) normalises every breakable item in
the world and on actors. Levels carry over unchanged — the old armor sheet
already meant 2 by "Broken" — so only `maxLevel` and out-of-range levels move.
`breakageMigration()` is pure and idempotent, and is covered by tests.

Unlinked token actors and compendium packs are not walked.

## Tests

`npm run test:run` — 155 tests across:

- `tests/item-sheet-config.test.mjs` — the pure domain layer.
- `tests/item-sheet.test.mjs` — renders every item template through the real
  sheet's `_prepareContext` / `_configureRenderParts` and asserts the markup,
  plus the submit pipeline and the manifest.
- `tests/breakage.test.mjs` — the condition track, its effects, the world
  migration, and the inventory badge compiled out of the real template.

`tests/setup.js` provides `foundry.utils` and ApplicationV2/DocumentSheetV2
doubles. Only `selectOptions` is registered as a core Handlebars helper, so a
template that reaches for a removed or unregistered helper fails the render test
— that is the regression guard for this class of breakage.

## Sources

- [Enact final deprecations to remove backwards compatible support for changes in V12 — foundryvtt#13436](https://github.com/foundryvtt/foundryvtt/issues/13436)
- [The `{#select}` handlebars helper is deprecated — foundryvtt#10471](https://github.com/foundryvtt/foundryvtt/issues/10471)
- [vagabond/FOUNDRY_V14_MIGRATION.md](https://github.com/mordachai/vagabond/blob/main/FOUNDRY_V14_MIGRATION.md)
