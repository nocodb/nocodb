import plugin from 'windicss/plugin'

export default plugin(({ addUtilities }) => {
  const utils: Record<string, any> = {}

  utils['.nc-h-screen'] = {
    'height': '100vh',
    '@supports (height: 100dvh)': {
      height: '100dvh',
    },
  }

  utils['.nc-min-h-screen'] = {
    'min-height': '100vh',
    '@supports (min-height: 100dvh)': {
      'min-height': '100dvh',
    },
  }

  utils['.nc-w-screen'] = {
    'width': '100vw',
    '@supports (width: 100dvw)': {
      width: '100dvw',
    },
  }

  utils['.nc-min-w-screen'] = {
    'min-width': '100vw',
    '@supports (width: 100dvw)': {
      'min-width': '100dvw',
    },
  }

  addUtilities(utils, {
    layer: 'utilities',
    variants: ['responsive'],
    completions: Object.keys(utils).map((k) => k.replace(/^\./, '')), // <-- this enables autocomplete in IDE
  })
})
