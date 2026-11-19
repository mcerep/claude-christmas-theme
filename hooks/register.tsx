import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { sceneAt } from './scene.js'

// Christmas Eve, dark-only (the scene is always night): light text in either app mode.
// Secondary and muted text (the thinking text, the spinner's label) are bright enough to
// read over the art.
// Local change: the surfaces (sidebar, cards, panels, menus) are forest green instead of
// the original midnight blue (#0a1326 / #111c36 / #182545 / #1c2a4c). The theme has no
// sidebar-only colour, so the sidebar follows these. Each step is a few percent lighter,
// and surface-3 stays close to surface-0 so muted text keeps its contrast.
const { theme, problems } = makeColors({
  label: 'Christmas Eve',
  only: 'dark',
  roles: { accent: '#f2c14e', danger: '#ff6b6b', success: '#5fd18c', warning: '#ffc857', pro: '#c9a7ff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0c1f15', // page / sidebar: deep forest green
        'surface-1': '#11281a', // cards
        'surface-2': '#142d1e', // panels
        'surface-3': '#162f20', // menus
        'text-primary': '#f2f8f3',
        'text-secondary': '#dce9de',
        'text-muted': '#b6cbba',
      },
    },
  },
})

// The frosted veil behind the panels. The original used blur 4, opacity 0.55, a thick
// veil so words stand off the tiles. Local change: fully clear (no blur, no tint), so
// text sits directly on the art. (A faint veil, blur 1 / 25%, was tried and made no
// difference to the scene sometimes freezing.) Raise both if text gets hard to read.
const GLASS_BLUR = 0 // px
const GLASS_OPACITY = 0 // 0 = clear glass, 1 = solid tint
const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'christmas', glass: { blur: GLASS_BLUR, tint: '#0a1326', opacity: GLASS_OPACITY } },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) $.ui.toast(unpainted)

    const set = await $.theme.set(LOOK)
    if (!set.isDrawn) $.ui.status(set.reason)

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    if (e.props.scene !== 'christmas') return next(e)
    const { Svg } = $.ui.resolve(e)
    // Local change: draw the scene at its phase for this moment, so a redraw
    // continues the animation instead of restarting it (sceneAt, scene.js).
    // Date.now() rather than $.clock.now() keeps the engine's rules for when it
    // asks this hook to draw exactly as they were.
    const nowSeconds = Date.now() / 1000
    return (
      <Svg
        source={sceneAt(nowSeconds)}
        alt="Pixel-tile mosaic of Christmas Eve: snow falling as Santa's sleigh and reindeer fly past the moon, over a house strung with twinkling lights"
        isInteractive
      />
    )
  })
}
