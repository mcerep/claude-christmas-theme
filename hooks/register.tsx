import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { SCENE } from './scene.js'

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
    // The app asks again whenever the window's width changes. Stamping the
    // width into the drawing (an invisible comment) makes each size a new
    // document, so the app loads it fresh and the animation restarts instead
    // of staying frozen after a resize.
    const width = e.viewport?.columns ?? 0
    return (
      <Svg
        source={SCENE.replace('<defs>', `<!-- width ${width} --><defs>`)}
        alt="Pixel-tile mosaic of Christmas Eve: snow falling as Santa's sleigh and reindeer fly past the moon, over a house strung with twinkling lights"
        isInteractive
      />
    )
  })
}
