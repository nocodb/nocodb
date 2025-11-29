import plugin from 'windicss/plugin'

function hexToRgba(hex: string) {
  const cleaned = hex.replace('#', '')
  const bigint = parseInt(cleaned, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `${r}, ${g}, ${b}`
}

const themeV4Colors = {
  base: { white: '--rgb-color-base-white', black: '--rgb-color-base-black' },
  brand: {
    inverted: '--rgb-nc-bg-brand-inverted',
    20: '--rgb-color-brand-20',
    50: '--rgb-color-brand-50',
    100: '--rgb-color-brand-100',
    200: '--rgb-color-brand-200',
    300: '--rgb-color-brand-300',
    400: '--rgb-color-brand-400',
    500: '--rgb-color-brand-500',
    600: '--rgb-color-brand-600',
    700: '--rgb-color-brand-700',
    800: '--rgb-color-brand-800',
    900: '--rgb-color-brand-900',
  },
  gray: {
    10: '#FCFCFC',
    50: '--rgb-color-gray-50',
    100: '--rgb-color-gray-100',
    200: '--rgb-color-gray-200',
    300: '--rgb-color-gray-300',
    400: '--rgb-color-gray-400',
    500: '--rgb-color-gray-500',
    600: '--rgb-color-gray-600',
    700: '--rgb-color-gray-700',
    800: '--rgb-color-gray-800',
    900: '--rgb-color-gray-900',
  },
  red: {
    50: '--rgb-color-red-50',
    100: '--rgb-color-red-100',
    200: '--rgb-color-red-200',
    300: '--rgb-color-red-300',
    400: '--rgb-color-red-400',
    500: '--rgb-color-red-500',
    600: '--rgb-color-red-600',
    700: '--rgb-color-red-700',
    800: '--rgb-color-red-800',
    900: '--rgb-color-red-900',
  },
  pink: {
    50: '--rgb-color-pink-50',
    100: '--rgb-color-pink-100',
    200: '--rgb-color-pink-200',
    300: '--rgb-color-pink-300',
    400: '--rgb-color-pink-400',
    500: '--rgb-color-pink-500',
    600: '--rgb-color-pink-600',
    700: '--rgb-color-pink-700',
    800: '--rgb-color-pink-800',
    900: '--rgb-color-pink-900',
  },
  orange: {
    50: '--rgb-color-orange-50',
    100: '--rgb-color-orange-100',
    200: '--rgb-color-orange-200',
    300: '--rgb-color-orange-300',
    400: '--rgb-color-orange-400',
    500: '--rgb-color-orange-500',
    600: '--rgb-color-orange-600',
    700: '--rgb-color-orange-700',
    800: '--rgb-color-orange-800',
    900: '--rgb-color-orange-900',
  },
  purple: {
    50: '--rgb-color-purple-50',
    100: '--rgb-color-purple-100',
    200: '--rgb-color-purple-200',
    300: '--rgb-color-purple-300',
    400: '--rgb-color-purple-400',
    500: '--rgb-color-purple-500',
    600: '--rgb-color-purple-600',
    700: '--rgb-color-purple-700',
    800: '--rgb-color-purple-800',
    900: '--rgb-color-purple-900',
  },
  blue: {
    50: '--rgb-color-blue-50',
    100: '--rgb-color-blue-100',
    200: '--rgb-color-blue-200',
    300: '--rgb-color-blue-300',
    400: '--rgb-color-blue-400',
    500: '--rgb-color-blue-500',
    600: '--rgb-color-blue-600',
    700: '--rgb-color-blue-700',
    800: '--rgb-color-blue-800',
    900: '--rgb-color-blue-900',
  },
  yellow: {
    50: '--rgb-color-yellow-50',
    100: '--rgb-color-yellow-100',
    200: '--rgb-color-yellow-200',
    300: '--rgb-color-yellow-300',
    400: '--rgb-color-yellow-400',
    500: '--rgb-color-yellow-500',
    600: '--rgb-color-yellow-600',
    700: '--rgb-color-yellow-700',
    800: '--rgb-color-yellow-800',
    900: '--rgb-color-yellow-900',
  },
  maroon: {
    50: '--rgb-color-maroon-50',
    100: '--rgb-color-maroon-100',
    200: '--rgb-color-maroon-200',
    300: '--rgb-color-maroon-300',
    400: '--rgb-color-maroon-400',
    500: '--rgb-color-maroon-500',
    600: '--rgb-color-maroon-600',
    700: '--rgb-color-maroon-700',
    800: '--rgb-color-maroon-800',
    900: '--rgb-color-maroon-900',
  },
  green: {
    50: '--rgb-color-green-50',
    100: '--rgb-color-green-100',
    200: '--rgb-color-green-200',
    300: '--rgb-color-green-300',
    400: '--rgb-color-green-400',
    500: '--rgb-color-green-500',
    600: '--rgb-color-green-600',
    700: '--rgb-color-green-700',
    800: '--rgb-color-green-800',
    900: '--rgb-color-green-900',
  },
}

// Flatten the colors for easier lookup
const flatColors: Record<string, string> = {}
Object.entries(themeV4Colors).forEach(([group, colors]) => {
  Object.entries(colors).forEach(([key, val]) => {
    flatColors[`nc-${group}-${key}`] = val
  })
})

export default plugin(({ addUtilities, addDynamic }) => {
  const utils: Record<string, any> = {}

  console.log('gpupfdks')

  Object.entries(themeV4Colors).forEach(([group, colors]) => {
    Object.entries(colors).forEach(([key, cssVariable]) => {
      const className = `nc-${group}-${key}`

      let rgb = cssVariable.startsWith('#') ? hexToRgba(cssVariable) : `var(${cssVariable})`

      // Text color
      utils[`.text-${className}`] = {
        '--tw-text-opacity': '1',
        'color': `rgba(${rgb}, var(--tw-text-opacity))`,
      }

      // Background color
      utils[`.bg-${className}`] = {
        '--tw-bg-opacity': '1',
        'background-color': `rgba(${rgb}, var(--tw-bg-opacity))`,
      }

      // Border color
      utils[`.border-${className}`] = {
        '--tw-border-opacity': '1',
        'border-color': `rgba(${rgb}, var(--tw-border-opacity))`,
      }

      // Text decoration color - (decoration-*)
      utils[`.decoration-${className}`] = {
        '--tw-text-decoration-opacity': '1',
        'text-decoration-color': `rgba(${rgb}, var(--tw-text-decoration-opacity))`,
      }
      // Placeholder color - (placeholder-*)
      utils[`.placeholder-${className}::placeholder`] = {
        '--tw-placeholder-opacity': '1',
        'color': `rgba(${rgb}, var(--tw-placeholder-opacity))`,
      }
      utils[`.placeholder-${className}::-webkit-input-placeholder`] = {
        '--tw-placeholder-opacity': '1',
        'color': `rgba(${rgb}, var(--tw-placeholder-opacity))`,
      }

      // Shadow color - (shadow-* uses --tw-shadow-color)
      utils[`.shadow-${className}`] = {
        '--tw-shadow-color': `rgba(${rgb}, 1)`,
        '--tw-shadow': 'var(--tw-shadow-colored)',
      }

      // Ring color - (ring-* uses --tw-ring-color)
      utils[`.ring-${className}`] = {
        '--tw-ring-opacity': '1',
        '--tw-ring-color': `rgba(${rgb}, var(--tw-ring-opacity))`,
      }

      // Ring offset color - (ring-offset-*)
      utils[`.ring-offset-${className}`] = {
        '--tw-ring-offset-color': `rgba(${rgb}, 1)`,
      }

      // Outline color - (outline-* uses outline-color)
      utils[`.outline-${className}`] = {
        '--tw-outline-color': `rgba(${rgb}, 1)`,
        'outline-color': `rgba(${rgb}, 1)`,
      }

      // Divide color - (divide-*)
      utils[`.divide-${className} > :not([hidden]) ~ :not([hidden])`] = {
        '--tw-divide-opacity': '1',
        'border-color': `rgba(${rgb}, var(--tw-divide-opacity))`,
      }

      // Accent color - (accent-*)
      utils[`.accent-${className}`] = {
        'accent-color': `rgba(${rgb}, 1)`,
      }

      // Fill color - (fill-*)
      utils[`.fill-${className}`] = {
        fill: `rgba(${rgb}, 1)`,
      }

      // Stroke color - (stroke-*)
      utils[`.stroke-${className}`] = {
        stroke: `rgba(${rgb}, 1)`,
      }

      // Caret color - (caret-*)
      utils[`.caret-${className}`] = {
        'caret-color': `rgba(${rgb}, 1)`,
      }

      // Backdrop color - (backdrop-*)
      utils[`.backdrop-${className}`] = {
        '--tw-backdrop-opacity': '1',
        '--tw-backdrop-color': `rgba(${rgb}, var(--tw-backdrop-opacity))`,
      }

      // MARKER COLOR
      utils[`.marker-${className} *::marker`] = {
        color: `rgba(${rgb}, 1)`,
      }
    })
  })

  addUtilities(utils, {
    layer: 'components',
    variants: ['responsive'],
  })

  const colorGroups = [
    'text',
    'bg',
    'border',
    'decoration',
    'placeholder',
    'shadow',
    'ring',
    'ring-offset',
    'outline',
    'divide',
    'accent',
    'fill',
    'stroke',
    'caret',
    'backdrop',
    'marker',
  ]

  colorGroups.forEach((group) => {
    addDynamic(
      `${group}`,
      ({ Utility, Style }) => {
        const raw = Utility.raw // e.g., "text-nc-brand-50/50"
        const [base = '', opacityPart] = raw.split('/')

        if (opacityPart === undefined) return

        const opacity = opacityPart ? Number(opacityPart) / 100 : undefined

        const className = base.replace(`${group}-`, '') // "nc-brand-50"
        const color = flatColors[className]

        if (!color) return

        const rgb = color.startsWith('#') ? hexToRgba(color) : `var(${color})`

        const style: Record<string, any> = {}

        switch (group) {
          case 'text':
            style.color = `rgba(${rgb},${opacity ?? 1})`
            break
          case 'bg':
            style['background-color'] = `rgba(${rgb},${opacity ?? 1})`
            break
          case 'border':
            style['border-color'] = `rgba(${rgb},${opacity ?? 1})`
            break
          case 'decoration':
            style['text-decoration-color'] = `rgba(${rgb},${opacity ?? 1})`
            break
          case 'placeholder':
            style.color = `rgba(${rgb},${opacity ?? 1})`
            break
          case 'shadow':
            style['--tw-shadow'] = 'var(--tw-shadow-colored)'
            break
          case 'ring':
            style['--tw-ring-color'] = `rgba(${rgb},${opacity ?? 1})`
            break
          case 'ring-offset':
            style['--tw-ring-offset-color'] = `rgba(${rgb}, ${opacity ?? 1})`
            break
          case 'outline':
            style['outline-color'] = `rgba(${rgb}, ${opacity ?? 1})`
            break
          case 'divide':
            style['border-color'] = `rgba(${rgb},${opacity ?? 1})`
            break
          case 'accent':
            style['accent-color'] = `rgba(${rgb}, ${opacity ?? 1})`
            break
          case 'fill':
            style.fill = `rgba(${rgb}, ${opacity ?? 1})`
            break
          case 'stroke':
            style.stroke = `rgba(${rgb}, ${opacity ?? 1})`
            break
          case 'caret':
            style['caret-color'] = `rgba(${rgb}, ${opacity ?? 1})`
            break
          case 'backdrop':
            style['--tw-backdrop-color'] = `rgba(${rgb},${opacity ?? 1})`
            break
          case 'marker':
            style.color = `rgba(${rgb}, ${opacity ?? 1})`
            break
        }

        return Style.generate(Utility.class, style)
      },
      {
        group: `${group}`,
        completions: [`${group}-{colorName}`, `${group}-{colorName}/{int}`],
        variants: ['responsive'],
      },
    )
  })
})
