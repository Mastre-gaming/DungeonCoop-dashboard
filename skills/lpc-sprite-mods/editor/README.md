# Sprite Painter

Paint mods onto characters from the [Universal LPC Spritesheet Character Generator](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/).
Whatever you paint follows a tracked part (a hat or the head) through every frame of every animation, so one drawing per facing gives a fully animated sheet.

## Run

```
npm install
npm run dev        # http://localhost:5180 — Import only works here (it renders in a headless Edge)
```

## Use

1. **Design** a character on the generator, copy the whole address, then **Import** it. Pick the part to track; a hat or the head works best.
2. **Paint** on the big frame. Tools: B pencil, E eraser, I pick colour, M mirror, G grid, F fit. Wheel zooms; right-drag or Space-drag pans. Ctrl+Z / Ctrl+Y undo and redo.
3. **Facings**: 1-4 or the buttons (Back, Left, Front, Right). Each facing has its own pixels. *Copy to opposite* copies Left↔Right mirrored, or Front↔Back. Arrow keys nudge the current layer.
4. **Layers** draw bottom to top. A layer never paints over the body, armour or weapons; it only covers empty space, the tracked part and earlier layers. Mark a layer **behind** to keep it off the tracked part too, for things like a far horn.
5. **Export sheet PNG** gives the whole sheet in the generator's layout. **Credits** gives the attribution text: most LPC art requires credit (CC-BY-SA / GPL).

Mods autosave per character in the browser. *Save mod… / Load mod…* move them as JSON files.

Command line import: `npm run import -- "<generator link>" --id=orc --name="Orc" [--anchor=head]`

## Check

`npm run build && npm test` runs the `?test` self-test (15 checks; painting is done with real pointer events) and saves screenshots to `shots/`.
