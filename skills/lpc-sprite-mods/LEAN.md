# Lean (lpc-sprite-mods)

Getting the same result with less time and fewer tokens.

- **Don't read the generator's 768 definition files.** Write the link from SKILL.md's name list. If a name fails, look up only that one (`git clone --depth 1 --filter=blob:none --sparse`, then `git sparse-checkout set sheet_definitions`: a few MB instead of the 1.5 GB repo).
- **One import per character, reused.** An import takes about a minute (two headless renders). Mods are separate files, so try any number of mods on one import.
- **Write mods as text grids** and stamp them per facing (see `presetHornsAndPlume` in `editor/src/02_mod.js`), rather than listing pixels one by one.
- **Check with one screenshot:** `npm run render -- <id> mod.json out.png --preview=p.png` shows the big frame plus all four facings animating. Look at it once per facing change, not after every pixel.
- **Front and back first.** Mirror mode does both sides in one stroke; then do left; *Copy to opposite* makes right; nudge with the arrow keys.
- **Skip the dev server when no import is needed.** `demo.html` paints and exports with nothing installed.
