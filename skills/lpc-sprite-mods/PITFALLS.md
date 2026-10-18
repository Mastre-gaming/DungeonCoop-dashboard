# Pitfalls (lpc-sprite-mods)

What went wrong while building it, and the fix in place.

1. **Grabbing the generator's sheet too early gives a half-drawn character.** Layers keep loading for seconds after the selections show; the first export had a bald knight in most rows. Fix: wait until the whole sheet is unchanged for 5 one-second checks in a row (`lpc_import.mjs`).
2. **A few files are missing on the generator's own site** (for example `cape/solid/bg/climb.png`, `legs/armour/plate/male/run.png`, `weapon/blunt/waraxe/behind/hurt/waraxe.png`). Those frames come out missing that layer; it's not our bug. The importer prints which files failed.
3. **Changing the address's `#...` on an open generator page doesn't reliably reload the character.** Always open a fresh page per character.
4. **The generator's internals are minified and change.** Use only the hash and `window.canvasRenderer.canvas` / `.addedCustomAnimations` (its "sanctioned globals for tooling"); never internal function names.
5. **Big weapons add blocks below the 54 standard rows**, at 128 or 192 pixels per frame, stacked in the order of `addedCustomAnimations`. Reading the sheet as 64-pixel rows alone misses the knight's sword slash.
6. **A `behind` layer and later layers.** Without the "an earlier layer may be covered" rule, the side-view horn hid behind the plume. Layers may cover earlier layers' pixels; only `behind` stops at the tracked part.
7. **Vite's dev server must watch `public/imports`.** Telling it to ignore the folder (to avoid reloads) made new imports load the HTML page instead of `meta.json` ("Unexpected token '<'").
8. **`file://` pages can't fetch.** The single-file demo carries its sheets inside (`window.__EMBED`) and swaps `fetch`; Import shows how to start the helper instead of failing silently.
9. **Setting a `<select>`'s value from a script fires no `change` event.** Tests and automation must use the keyboard or call the app (`dbg.app.loadCharacter`).
10. **The self-test paints.** It saves the person's own layers, colour and tool, and puts them back afterwards.
11. **Python's `-I` flag drops the script's own folder from the import path.** Use it only for code that reads downloaded files, not for our own scripts that import a helper module.
12. **A side view is not a squashed front view.** Horns that stick out sideways read as short upright shapes from the side. Draw each facing; don't just copy the front.
