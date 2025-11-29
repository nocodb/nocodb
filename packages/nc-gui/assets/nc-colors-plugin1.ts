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

export default plugin(({ addDynamic }) => {
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
        const opacity = opacityPart ? Number(opacityPart) / 100 : undefined

        const className = base.replace(`${group}-`, '') // "nc-brand-50"
        const color = flatColors[className]

        if (!color) return

        console.log('color', color, base, opacityPart, opacity)

        const rgb = color.startsWith('#') ? hexToRgba(color) : `var(${color})`

        const style: Record<string, any> = {}

        switch (group) {
          case 'text':
            style['--tw-text-opacity'] = opacity ?? 1
            style.color = `rgba(${rgb}, var(--tw-text-opacity))`
            break
          case 'bg':
            style['--tw-bg-opacity'] = opacity ?? 1
            style['background-color'] = `rgba(${rgb}, var(--tw-bg-opacity))`
            break
          case 'border':
            style['--tw-border-opacity'] = opacity ?? 1
            style['border-color'] = `rgba(${rgb}, var(--tw-border-opacity))`
            break
          case 'decoration':
            style['--tw-text-decoration-opacity'] = opacity ?? 1
            style['text-decoration-color'] = `rgba(${rgb}, var(--tw-text-decoration-opacity))`
            break
          case 'placeholder':
            style['--tw-placeholder-opacity'] = opacity ?? 1
            style.color = `rgba(${rgb}, var(--tw-placeholder-opacity))`
            break
          case 'shadow':
            style['--tw-shadow-color'] = `rgba(${rgb}, ${opacity ?? 1})`
            style['--tw-shadow'] = 'var(--tw-shadow-colored)'
            break
          case 'ring':
            style['--tw-ring-opacity'] = opacity ?? 1
            style['--tw-ring-color'] = `rgba(${rgb}, var(--tw-ring-opacity))`
            break
          case 'ring-offset':
            style['--tw-ring-offset-color'] = `rgba(${rgb}, ${opacity ?? 1})`
            break
          case 'outline':
            style['--tw-outline-color'] = `rgba(${rgb}, ${opacity ?? 1})`
            style['outline-color'] = `rgba(${rgb}, ${opacity ?? 1})`
            break
          case 'divide':
            style['--tw-divide-opacity'] = opacity ?? 1
            style['border-color'] = `rgba(${rgb}, var(--tw-divide-opacity))`
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
            style['--tw-backdrop-opacity'] = opacity ?? 1
            style['--tw-backdrop-color'] = `rgba(${rgb}, var(--tw-backdrop-opacity))`
            break
          case 'marker':
            style.color = `rgba(${rgb}, ${opacity ?? 1})`
            break
        }

        console.log('style', style)

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
