# Istraveth — The Shattered Concord Map

A zoomable, online map of the continent of **Istraveth** for the *Shattered Concord* D&D 5e campaign. Zoom out for a continent overview; zoom all the way in to see town streets, forest trails, and a toggleable **D&D battle grid** (square *or* hex).

**🔒 Spoiler-safe.** Every place, label, and description on this map is drawn only from the player-facing *Player's Primer*. There are no DM secrets here — share the link with your table freely.

---

## Features

- **One map, every scale.** Vector-drawn, so it stays crisp from the whole continent down to individual streets.
- **Battle-board grid.** Toggle a **square** or **hex** grid; the readout tells you the scale at the current zoom (≈5 ft per square at street level).
- **Layer toggles.** Names & labels, roads & rivers, the Front, terrain detail, and realm shading — turn any of them off.
- **Travel-to menu.** Jump straight to any settlement or region.
- **Click anything.** Settlements and regions open a short, spoiler-free description.
- **Lore-locked geography.** Velgrath east, Kalvann west, the Thir Vale and Rimefang between them, Lanthorne Bay to the south, the Wyldewold and the Ashen Deep where the story puts them.

## Using it as a DM board

1. Use **Travel to…** (or zoom) to the location of your scene.
2. Zoom in until the street layout fills the screen.
3. Turn the **Battle grid** to **Square** (5e default) or **Hex** (overland/travel).
4. The grid is anchored to the world, so it stays put while you pan during a fight.

> The town layouts are generated for visualization and atmosphere, not as surveyed blueprints — perfect for "you're somewhere along this street" framing.

## Project structure

```
index.html            # page shell + Leaflet
css/style.css          # parchment theme + UI
js/world-data.js       # the world: coastline, nations, regions, settlements, roads (player-safe)
js/town-generator.js   # seeded street/building/trail generator
js/map.js              # Leaflet engine: zoom tiers, grid, labels, popups
```

Want to move a town or rename a landmark? Edit `js/world-data.js` — every place is a plain entry with `pos: [northing, easting]` and a player-safe `desc`. The streets regenerate from each town's `seed` (change the seed for a different layout; keep it to stay stable).

---

## Put it online with GitHub Pages

> **First, one bit of housekeeping:** delete the leftover **`.git_broken_DELETE_ME`** folder (a harmless artifact from setup). On macOS, drag it to the Trash, or run `rm -rf .git_broken_DELETE_ME` from inside this folder.

1. On GitHub, **create a new empty repository** named `shattered-concord-map` (don't add a README, license, or .gitignore — this folder already has them).
2. In a terminal, from inside this folder, initialise git and push:

   ```bash
   git init
   git add .
   git commit -m "Istraveth — Shattered Concord map"
   git branch -M main
   git remote add origin https://github.com/<YOUR-USERNAME>/shattered-concord-map.git
   git push -u origin main
   ```

3. In the repo on GitHub: **Settings → Pages**. Under *Build and deployment*, set **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**, and **Save**.
4. Wait ~1 minute. Your map will be live at:

   ```
   https://<YOUR-USERNAME>.github.io/shattered-concord-map/
   ```

That URL is the link you share with your players.

> Updating later: edit files, then `git add . && git commit -m "update" && git push`. Pages redeploys automatically.

---

## Credits

- Map engine: [Leaflet](https://leafletjs.com/) (BSD-2-Clause), loaded from CDN.
- World, lore, and all place names: *The Shattered Concord* © its author. This map renders only the player-facing layer of that setting.
