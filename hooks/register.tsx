import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { LOOP_SECONDS, SCENE } from './scene.js'

// Midnight-blue Christmas Eve. The scene is always night, so the theme is
// dark-only: light text in either app mode. Secondary and muted text (the
// thinking text, the spinner's label) are bright enough to read over the art.
const { theme, problems } = makeColors({
  label: 'Christmas Eve',
  only: 'dark',
  roles: { accent: '#f2c14e', danger: '#ff6b6b', success: '#5fd18c', warning: '#ffc857', pro: '#c9a7ff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0a1326',
        'surface-1': '#111c36',
        'surface-2': '#182545',
        'surface-3': '#1c2a4c',
        'text-primary': '#f6f8ff',
        'text-secondary': '#e2e8f8',
        'text-muted': '#c3cde6',
      },
    },
  },
})

// A thicker veil behind the panels so words stand off the tiles.
const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'christmas', glass: { blur: 4, tint: '#0a1326', opacity: 0.55 } },
}

// The app sometimes freezes the backdrop (after a resize, in split screen) and
// only restarts it when it loads the drawing again. So every LOOP_SECONDS the
// mod hands it a freshly stamped copy. Every animation in the scene repeats
// evenly within that time, so the fresh copy starts on the same frame the old
// one had reached: no visible jump when it's running, and a thaw when it isn't.
let reloads = 0

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) $.ui.toast(unpainted)

    const set = await $.theme.set(LOOK)
    if (!set.isDrawn) $.ui.status(set.reason)

    $.clock.every(LOOP_SECONDS * 1000, () => {
      reloads++
      $.ui.invalidate('ui.render')
    })

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    if (e.props.scene !== 'christmas') return next(e)
    const { Svg } = $.ui.resolve(e)
    return (
      <Svg
        source={SCENE.replace('<defs>', `<!-- copy ${reloads} --><defs>`)}
        alt="Pixel-tile mosaic of Christmas Eve: snow falling as Santa's sleigh and reindeer fly past the moon, over a house strung with twinkling lights"
        isInteractive
      />
    )
  })
}
