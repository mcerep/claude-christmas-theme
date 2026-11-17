import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { SCENE } from './scene.js'

// Midnight-blue Christmas Eve by night; a snowy morning by day.
const { theme, problems } = makeColors({
  label: 'Christmas Eve',
  roles: { accent: '#d64545', danger: '#e05555', success: '#3fa66b', warning: '#e0a81e', pro: '#9a6bc4' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#e4ecf7',
        'surface-1': '#eef3fb',
        'surface-2': '#f7fafe',
        'text-primary': '#16203a',
        'text-secondary': '#3a4765',
        'text-muted': '#5c6a88',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0a1326',
        'surface-1': '#111c36',
        'surface-2': '#182545',
        'surface-3': '#1f2e52',
        'text-primary': '#eef3ff',
        'text-secondary': '#c4d0ea',
        'text-muted': '#93a2c6',
      },
    },
  },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'christmas', glass: { blur: 2, tint: '#0a1326', opacity: 0.3 } },
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
    return (
      <Svg
        source={SCENE}
        alt="Pixel-tile mosaic of Christmas Eve: snow falling as Santa's sleigh and reindeer fly past the moon, over a house strung with twinkling lights"
        isInteractive
      />
    )
  })
}
