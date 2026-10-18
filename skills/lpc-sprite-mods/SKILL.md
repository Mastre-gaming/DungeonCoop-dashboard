---
name: lpc-sprite-mods
description: "LPC character sprites with your own touches: use when a 2D top-down game needs heroes, mobs or NPCs, when someone wants to design their character, or when asked to import from the Universal LPC Spritesheet Character Generator, add a helmet, horns, crown, scar, emblem or plume that follows the character through every animation, or export a game-ready LPC sheet with its credits. Includes Sprite Painter, a three.js editor."
---

# lpc-sprite-mods (v1, draft)

Characters come from the [Universal LPC Spritesheet Character Generator](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/): about 650 hand-drawn parts, already animated in four facings (walk, slash, thrust, spellcast, shoot, hurt, idle, run and more). We keep that base and style and **only add modifications**: pixels painted once per facing that follow a tracked part (a hat or the head) through every frame. Heroes are made **at dev time**: each friend describes or paints their hero; nothing in the game calls an AI.

Origin: the owner's sprite tests on 2026-10-17. A from-scratch knight scored about 4/10 and clashed with LPC's style; the horned LPC knight proved that adding to LPC keeps the style and every animation for free.

## What is here

| Path | What |
|---|---|
| `demo.html` | The editor in one file: double-click it. It comes with a knight and an orc. Everything works except Import. |
| `editor/` | Sprite Painter, a Vite + three.js project. The module of this skill. |
| `editor/tools/lpc_import.mjs` | Generator link to `public/imports/<id>/` (`sheet.png`, `bare.png`, `credits.txt`, `meta.json`). It renders in a headless Edge or Chrome. |
| `editor/tools/render_mod.mjs` | Character + mod JSON to finished sheet PNG (+ an editor screenshot), with no clicking. |
| `editor/examples/orc-crown.json` | A mod written by hand: the file format in practice. |
| `START_HERE.md` | The quick start for a person (a friend with no Claude can follow it). |

Needs Node 22+ (it uses Node's own WebSocket) and Edge or Chrome installed. Stack: three 0.186.1, Vite 8.3.4.

## The workflow (what to do when someone wants a character)

1. **Design in the generator.** Pick the parts, then copy the whole address: everything after `#` is the character, as `key=Item_variant` pairs, e.g. `#sex=male&body=Body_Color_green&head=Orc_male_green&weapon=Waraxe_waraxe`. You can also write the link yourself (see "Writing generator links").
2. **Import** (in `editor/`, after `npm install`):
   `npm run import -- "<link>" --id=orc --name="Orc" [--anchor=hat]`, or the editor's Import button while `npm run dev` runs.
   The anchor defaults to `hat`, then `head`. A hat is the steadiest; the head works for everyone.
3. **Mod.** Either the person paints in the editor (`npm run dev`, then open http://localhost:5180), or you write a mod JSON (format below) and apply it with `npm run build` then `npm run render -- orc mod.json out/orc.png --preview=out/orc-preview.png`.
4. **Check by eye.** Look at the preview screenshot, all four facings and at least walk plus one attack. Sideways is where mods go wrong. Never say a mod is done from the numbers alone.
5. **Ship** the exported sheet with the character's `credits.txt`. Most LPC art is CC-BY-SA or GPL: the game needs a credits screen that lists it.

## The mod rules (the editor and the render tool share them)

- Pixels are stored **relative to the anchor point**: the top centre of the tracked part (`ax = floor((left + right) / 2)` over its top 7 rows, `ay = top`). The part's pixels in each frame = where the sheet differs from the same character without that part (`bare.png`).
- Each facing (`north`, `west`, `south`, `east`) has its own pixels. West and east are pixel mirrors in LPC: copy them mirrored, then nudge.
- A mod pixel is drawn on **empty space, on the tracked part, or over an earlier layer**. It never covers the body, clothes or weapons, so sword swings pass in front of it. A layer marked `behind` only fills empty space (a far horn, a cape edge behind the head).
- Layers draw in order: first is bottom.

### Mod file (`sprite-painter/1`)

```json
{ "format": "sprite-painter/1",
  "layers": [ { "name": "Crown", "visible": true, "behind": false,
                "px": { "south": ["0,-2,e2b848ff", "-1,-1,a07028ff"], "north": [], "west": [], "east": [] } } ] }
```

Each entry is `dx,dy,rrggbbaa`, with dx to the right of and dy below the anchor point. dy below 0 is above the head.

### Drawing pixels that look like LPC

Dark outline (`#1e161e`-ish) around every shape. A 3 to 4 step ramp per material (steel `#5a6276 #8a96a8 #c0cad6 #f0f4fa`, gold `#a07028 #e2b848 #fff0a0`). Light from the top-left: from behind (north) the light side swaps. Keep additions small at 64-pixel scale: a horn is about 9 pixels tall. From the side, a thing that sticks out sideways (a horn, an ear) reads as a short upright shape. Draw it in front of the plume, and put the far one in a `behind` layer.

## Writing generator links

Keys are the parts' `type_name`; values are `Name_variant` with spaces kept as `_`. These have been tested: `body=Body_Color_light`, `body=Body_Color_green`, `head=Human_Male_light`, `head=Orc_male_green`, `expression=Neutral_light`, `armour=Plate_steel`, `legs=Armour_steel`, `shoes=Armour_steel`, `arms=Armour_steel`, `gloves=Gloves_steel`, `hat=Greathelm_steel`, `cape=Solid_red`, `clothes=TShirt_brown`, `legs=Pants_brown`, `shoes=Basic_Boots_brown`, `weapon=Arming_Sword_steel`, `weapon=Waraxe_waraxe`, `shield=Crusader_shield_crusader`.

Colours come from palettes: metal (`ceramic brass copper bronze iron steel silver gold`), cloth (`brown leather walnut yellow tan orange rose maroon red pink lavender purple blue navy teal bluegray forest green white sky slate gray black charcoal`), skin (`light amber olive taupe bronze brown black green ...`), hair (`raven black dark_brown chestnut blonde platinum white red ginger ...`).

When unsure of a name, the import fails with "did not take every part": open the generator, click the part, and read the address bar. The full catalogue is the repo's `sheet_definitions/**/*.json` (`type_name`, `name`, `recolors.material`).

## Sheet layout (needed to read exports)

64-pixel frames, 13 wide, 54 rows. Row starts: spellcast 0, thrust 4, walk 8, slash 12, shoot 16, hurt 20 (front only), climb 21 (back only), idle 22, jump 26, sit 30, emote 34, run 38, combat 42, backslash 46, halfslash 50. Within each group, the rows are back, left, front, right. Walk loops frames 1-8 (0 is standing). Big weapons add blocks below row 54, in the order the generator lists them (`meta.json` `custom`): `slash_128` 128 px, `slash_oversize` 192 px, and so on (sizes in `editor/src/01_sheet.js`).

## Quality bar

- The mod is in **every** frame where the anchor is found. The editor's animation menu shows `found/total`; anything short is a frame to look at.
- Weapons and shields pass in front of the mod; nothing floats off the head during a swing.
- It reads as LPC: outlined, shaded from the top-left, no lone single-pixel noise, about the scale of LPC's own parts.
- All four facings are drawn. A mod that exists only from the front is not done.
- `credits.txt` ships with the sheet.
- `npm run build && npm test` passes 15/15. Its painting checks click on the canvas; they don't call functions.

## Check it

```
cd editor && npm install
npm run build && npm test            15/15, screenshots in shots/
npm run demo                         rebuilds ../demo.html (copy it up a level)
```
