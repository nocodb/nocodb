import plugin from 'windicss/plugin'

export default plugin(({ addUtilities }) => {
  const utils: Record<string, any> = {}

  // Helper to generate viewport-safe utilities with dvh/svh progressive enhancement
  const addScreenUtil = (name: string, prop: string, unit: string, dUnit: string, sUnit: string, value: number) => {
    const suffix = value === 100 ? '' : `-${value}`
    utils[`.nc-${name}${suffix}`] = {
      [prop]: `${value}${unit}`,
      [`@supports (${prop}: ${value}${dUnit})`]: {
        [prop]: `${value}${dUnit}`,
      },
      [`@supports (${prop}: ${value}${sUnit})`]: {
        [prop]: `${value}${sUnit}`,
      },
    }
  }

  // Generate utilities for 0-100 (nc-h-screen = 100vh, nc-h-screen-80 = 80vh, etc.)
  for (let i = 0; i <= 100; i++) {
    addScreenUtil('h-screen', 'height', 'vh', 'dvh', 'svh', i)
    addScreenUtil('min-h-screen', 'min-height', 'vh', 'dvh', 'svh', i)
    addScreenUtil('max-h-screen', 'max-height', 'vh', 'dvh', 'svh', i)
    addScreenUtil('w-screen', 'width', 'vw', 'dvw', 'svw', i)
    addScreenUtil('min-w-screen', 'min-width', 'vw', 'dvw', 'svw', i)
    addScreenUtil('max-w-screen', 'max-width', 'vw', 'dvw', 'svw', i)
  }

  // Scroll fade masks — apply on scrollable containers
  // nc-scroll-fade       → fade top & bottom
  // nc-scroll-fade-top   → fade top only
  // nc-scroll-fade-bottom → fade bottom only
  const fadeSize = '34px'

  utils['.nc-scroll-fade'] = {
    'mask-image': `linear-gradient(transparent 0%, black ${fadeSize}, black calc(100% - ${fadeSize}), transparent 100%)`,
    '-webkit-mask-image': `linear-gradient(transparent 0%, black ${fadeSize}, black calc(100% - ${fadeSize}), transparent 100%)`,
  }

  utils['.nc-scroll-fade-top'] = {
    'mask-image': `linear-gradient(transparent 0%, black ${fadeSize}, black 100%)`,
    '-webkit-mask-image': `linear-gradient(transparent 0%, black ${fadeSize}, black 100%)`,
  }

  utils['.nc-scroll-fade-bottom'] = {
    'mask-image': `linear-gradient(black 0%, black calc(100% - ${fadeSize}), transparent 100%)`,
    '-webkit-mask-image': `linear-gradient(black 0%, black calc(100% - ${fadeSize}), transparent 100%)`,
  }

  addUtilities(utils, {
    layer: 'utilities',
    variants: ['responsive'],
    completions: Object.keys(utils).map((k) => k.replace(/^\./, '')),
  })
})
