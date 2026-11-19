# Christmas Eve+ — a Claude Code theme

An extended version of [mebessusn/claude-christmas-theme](https://github.com/mebessusn/claude-christmas-theme), the pixel-art Christmas Eve theme by mebessusn. Every pixel is a small tile with a character stamped in it. All credit for the original scene, palette and idea goes to the original author.

What this fork adds:

- **In the sky:** a black hole binary with faint gravitational-wave ripples (emitted at twice the orbital frequency, as a quadrupole source should), and a slow pulsar sweeping its beams.
- **On the ground:** a snowman, presents, a lamp post, a grazing doe and two more trees.
- **Depth:** snow-capped mountains, haze, rolling hills with distant trees and a few village windows, and a pixel-art Green Bank Telescope.
- **Look:** a zoomed-out view, forest-green sidebar and panels, and clear glass behind the conversation.
- **Keeps animating in the current Claude desktop app.** The app pauses a moving backdrop that is too costly to draw, flickers like a flash, or is too large. This version draws its tiles as pattern-filled shapes, draws the tile glyphs as outlines instead of text, has no hard flicker, and stays under the app's 131,072-character limit for a scene. Its animations also continue across redraws instead of restarting. If the app does pause it, it rests on a designed still frame.

The backdrop draws in the Claude desktop and mobile apps. Terminals show only the colors. The theme is dark-only.

## Install

If you already have the original theme, turn it off first, or the two will fight over the backdrop:

```
claude plugin disable christmas-eve@my-mods
```

Then, from a shell:

```
claude plugin install christmas-eve-plus --marketplace mcerep/claude-christmas-theme
```

Or at the prompt of a Claude Code terminal session:

```
/plugin install christmas-eve-plus --marketplace mcerep/claude-christmas-theme
```

Answer `y` to add the marketplace, then choose the **user** scope. Open a new session to see it.

## Turn it off

```
claude plugin disable christmas-eve-plus@christmas-eve-plus
```

## Tinkering

- `hooks/scene.js` builds the scene. Its settings are named constants next to what they control, for example `ZOOM_OUT`, `GBT_X`, `DOE_X`, `BH_PERIOD`, `PSR_PERIOD` and `SMOKE_LIFE`. The sprites, including the telescope, are pixel maps written as rows of characters.
- `hooks/register.tsx` sets the colors and the glass behind the conversation (`GLASS_BLUR`, `GLASS_OPACITY`).
- `tools/glyph-paths.py` regenerates the tile glyph outlines in `hooks/glyph-paths.js`.
- Keep the scene under the app's 131,072-character limit, measured at the largest it can get at any clock time (it is about 126,700 now), and cheap to draw.

## License

The original repository has no license, so the original author's work in this fork is shared with credit, for personal use. Ask them before reusing it beyond that.
