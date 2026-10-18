# Make your own character: start here

You make your character from LPC parts (the [Universal LPC generator](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/)), then paint your own touches on top: horns, a crown, a scar, a crest, anything. Your paint follows the character through every animation automatically.

## Just want to try it? (nothing to install)

Double-click **`demo.html`**. It opens in your browser with a knight and an orc to paint on.

- **Paint** on the big frame. Your paint shows up on the four walking previews on the right.
- **Facings:** Back / Left / Front / Right are drawn separately, because a head looks different from each side.
- **Example: horns & plume** shows what a finished mod looks like.
- **Save mod…** gives you a small `.json` file. Send that file to whoever puts characters in the game.

## Making your own character (needs Node.js)

1. Install **Node.js 22 or newer** from https://nodejs.org (you also need Edge or Chrome, which you most likely have).
2. Open a terminal in the `editor` folder and run once:
   ```
   npm install
   ```
3. Start the editor:
   ```
   npm run dev
   ```
   then open http://localhost:5180
4. Design your character on the LPC generator. When you're happy with it, copy the **whole address** from the address bar.
5. In the editor, press **Import from LPC generator…**, paste the address, name your character and press Import. It takes about a minute.
6. Paint your touches on all four facings. **Mirror** paints both sides at once; **Copy to opposite** turns your left-facing drawing into the right-facing one.
7. **Export sheet PNG** gives the finished sprite sheet. **Credits** gives the artists' names, which must go in the game's credits.

## With Claude Code

Copy this whole folder to `~/.claude/skills/lpc-sprite-mods` (on Windows: `C:\Users\<you>\.claude\skills\lpc-sprite-mods`), then ask Claude something like:

> Use the lpc-sprite-mods skill: make me an elf ranger with a green hood, and add a glowing rune on the forehead.

Claude writes the generator link, imports it, draws the mod and shows you a screenshot.

## Keys

B pencil · E eraser · I pick a colour · M mirror · G grid · F fit · 1-4 facings · [ ] frames · arrows nudge the layer · Ctrl+Z / Ctrl+Y undo and redo · mouse wheel zooms · right-drag pans
