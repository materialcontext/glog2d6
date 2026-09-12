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
- `FormApplication` subclasses: `gm-roll-system.mjs`, `recon-dialog.mjs`,
  `reputation-roll-dialog.mjs`, `attribute-selection-dialog.mjs`,
  `actor-trauma-system.mjs`
- `Dialog` / `Dialog.confirm` in `actor-sheet.mjs` and `sheet-roll-handler.mjs`
  → `foundry.applications.api.DialogV2`
- `Hooks.on('renderSidebarTab', ...)` in `glog2d6.mjs` — the sidebar moved to
  ApplicationV2 in v13 and this hook no longer fires, so the `/recon` chat button
  is missing. The chat-log render hook is the replacement.

## Known domain inconsistency (needs a ruling, not a code fix)

Breakage levels disagree across the codebase:

- `actor.mjs#breakEquippedItem` and `BreakageCalculator` treat `level >= maxLevel`
  as broken. For armor (`maxLevel: 1`) that means level 1 is already broken.
- `inventory-tab.hbs` shows `BROKEN` only when `level > maxLevel`, i.e. at 2.
- The armor sheet offers Fine (0) / Damaged 1 / Broken (2).

The sheets preserve their existing option lists so nothing changes underfoot, but
armor's `maxLevel` should probably become `2` (matching weapons) or the display
rules should move to `level >= maxLevel`.

## Tests

`npm run test:run` — 120 tests across:

- `tests/item-sheet-config.test.mjs` — the pure domain layer.
- `tests/item-sheet.test.mjs` — renders every item template through the real
  sheet's `_prepareContext` / `_configureRenderParts` and asserts the markup,
  plus the submit pipeline and the manifest.

`tests/setup.js` provides `foundry.utils` and ApplicationV2/DocumentSheetV2
doubles. Only `selectOptions` is registered as a core Handlebars helper, so a
template that reaches for a removed or unregistered helper fails the render test
— that is the regression guard for this class of breakage.

## Sources

- [Enact final deprecations to remove backwards compatible support for changes in V12 — foundryvtt#13436](https://github.com/foundryvtt/foundryvtt/issues/13436)
- [The `{#select}` handlebars helper is deprecated — foundryvtt#10471](https://github.com/foundryvtt/foundryvtt/issues/10471)
- [vagabond/FOUNDRY_V14_MIGRATION.md](https://github.com/mordachai/vagabond/blob/main/FOUNDRY_V14_MIGRATION.md)
