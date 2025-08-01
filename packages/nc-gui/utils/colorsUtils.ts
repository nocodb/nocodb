import colors from 'windicss/colors'
import { enumColors as enumColor } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
export { enumColors as enumColor } from 'nocodb-sdk'

export const theme = {
  light: ['#ffdce5', '#fee2d5', '#ffeab6', '#d1f7c4', '#ede2fe', '#eee', '#cfdffe', '#d0f1fd', '#c2f5e8', '#ffdaf6'],
  dark: [
    '#f82b6099',
    '#ff6f2c99',
    '#fcb40099',
    '#20c93399',
    '#8b46ff99',
    '#666',
    '#2d7ff999',
    '#18bfff99',
    '#20d9d299',
    '#ff08c299',
  ],
}

export const themeColors = {
  'background': '#FFFFFF',
  'surface': '#FFFFFF',
  'primary': '#4351e8',
  'primary-selected': '#EBF0FF',
  'primary-selected-sidebar': '#EBF0FF',
  'hover': '#E1E3E6',
  'scrollbar': '#d7d7d7',
  'scrollbar-hover': '#cbcbcb',
  'border': '#F3F4F6',
  'secondary': '#F2F4F7',
  'secondary-darken-1': '#018786',
  'error': '#B00020',
  'info': '#2196F3',
  'success': '#4CAF50',
  'warning': '#FB8C00',
}

export const themeV2Colors = {
  /** Primary shades */
  'royal-blue': {
    'DEFAULT': '#4351E8',
    '50': '#E7E8FC',
    '100': '#D4D8FA',
    '200': '#B0B6F5',
    '300': '#8C94F1',
    '400': '#6773EC',
    '500': '#4351E8',
    '600': '#1A2BD8',
    '700': '#1421A6',
    '800': '#0E1774',
    '900': '#080D42',
  },

  /** Accent shades */
  'pink': colors.pink,
}

// @deprecated
// Use CSS variables from variables.css directly in future like:
// color: var(--nc-content-brand-default)
// background: var(--nc-background-brand)
// The above values map 1:1 directly with Figma CSS variables.
export const themeV3Colors = {
  base: {
    white: '#FFFFFF',
    black: '#000000',
  },
  brand: {
    50: '#EBF0FF',
    100: '#D6E0FF',
    200: '#ADC2FF',
    300: '#85A3FF',
    400: '#5C85FF',
    500: '#3366FF',
    600: '#2952CC',
    700: '#1F3D99',
    800: '#142966',
    900: '#0A1433',
  },
  gray: {
    10: '#FCFCFC',
    50: '#F9F9FA',
    100: '#F4F4F5',
    200: '#E7E7E9',
    300: '#D5D5D9',
    400: '#9AA2AF',
    500: '#6A7184',
    600: '#4A5268',
    700: '#374151',
    800: '#1F293A',
    900: '#101015',
  },
  red: {
    50: '#FFF2F1',
    100: '#FFDBD9',
    200: '#FFB7B2',
    300: '#FF928C',
    400: '#FF6E65',
    500: '#FF4A3F',
    600: '#E8463C',
    700: '#CB3F36',
    800: '#B23830',
    900: '#7D2721',
  },
  pink: {
    50: '#FFEEFB',
    100: '#FED8F4',
    200: '#FEB0E8',
    300: '#FD89DD',
    400: '#FD61D1',
    500: '#FC3AC6',
    600: '#CA2E9E',
    700: '#972377',
    800: '#65174F',
    900: '#320C28',
  },
  orange: {
    50: '#FFF5EF',
    100: '#FEE6D6',
    200: '#FDCDAD',
    300: '#FCB483',
    400: '#FB9B5A',
    500: '#FA8231',
    600: '#E1752C',
    700: '#C86827',
    800: '#964E1D',
    900: '#4B270F',
  },
  purple: {
    50: '#F3ECFA',
    100: '#E5D4F5',
    200: '#CBA8EB',
    300: '#B17DE1',
    400: '#9751D7',
    500: '#7D26CD',
    600: '#641EA4',
    700: '#4B177B',
    800: '#320F52',
    900: '#190829',
  },
  blue: {
    50: '#EDF9FF',
    100: '#D7F2FF',
    200: '#AFE5FF',
    300: '#86D9FF',
    400: '#5ECCFF',
    500: '#36BFFF',
    600: '#2B99CC',
    700: '#207399',
    800: '#164C66',
    900: '#0B2633',
  },
  yellow: {
    50: '#fffbf2',
    100: '#fff0d1',
    200: '#fee5b0',
    300: '#fdd889',
    400: '#fdcb61',
    500: '#fcbe3a',
    600: '#ca982e',
    700: '#977223',
    800: '#654c17',
    900: '#32260c',
  },
  maroon: {
    50: '#FFF0F7',
    100: '#FFCFE6',
    200: '#FFABD2',
    300: '#EC7DB1',
    400: '#D45892',
    500: '#B33771',
    600: '#9D255D',
    700: '#801044',
    800: '#690735',
    900: '#42001F',
  },
  green: {
    50: '#ECFFF2',
    100: '#D4F7E0',
    200: '#A9EFC1',
    300: '#7DE6A3',
    400: '#52DE84',
    500: '#27D665',
    600: '#1FAB51',
    700: '#17803D',
    800: '#105628',
    900: '#082B14',
  },
}

type ThemeV3ColorKeys = Exclude<keyof typeof themeV3Colors, 'base'>
type Shade = keyof (typeof themeV3Colors)[ThemeV3ColorKeys]

/**
 * Get a random color from the themeV3Colors
 * @param randomNumber - The random number to use to get the color
 * @param shade - The shade of the color to get
 * @returns The color
 */
export function getThemeV3RandomColor(randomNumber: number = 1, shade: Shade = 600): string {
  const colorGroups = Object.keys(themeV3Colors).filter((key) => key !== 'base') as ThemeV3ColorKeys[]

  const groupIndex = Math.floor(Math.random() * 1000 * randomNumber) % colorGroups.length
  const colorGroup = colorGroups[groupIndex]!

  const selectedGroup = themeV3Colors[colorGroup]
  return selectedGroup[shade]
}

const isValidHex = (hex: string) => /^#([A-Fa-f0-9]{3,4}){1,2}$/.test(hex)

const getChunksFromString = (st: string, chunkSize: number) => st.match(new RegExp(`.{${chunkSize}}`, 'g'))

const convertHexUnitTo256 = (hexStr: string) => parseInt(hexStr.repeat(2 / hexStr.length), 16)

export const hexToRGB = (hex: string) => {
  if (!isValidHex(hex)) {
    throw new Error('Invalid HEX')
  }

  const chunkSize = Math.floor((hex.length - 1) / 3)

  const hexArr = getChunksFromString(hex.slice(1), chunkSize)!

  const [r, g, b] = hexArr.map(convertHexUnitTo256)

  return `${r}, ${g}, ${b}`
}

export const baseThemeColors = [
  themeV2Colors['royal-blue'].DEFAULT,
  '#2D7FF9',
  '#18BFFF',
  '#0C4E65',
  '#EC2CBD',
  '#F82B60',
  '#F57134',
  '#1BAF2C',
  '#8B46FF',
  '#1B51A2',
  '#146C8E',
  '#24716E',
  '#8A2170',
  '#941737',
  '#B94915',
  '#0E4C15',
  '#381475',
  '#333333',
]

export const baseIconColors = ['#36BFFF', '#FA8231', '#FCBE3A', '#27D665', '#6A7184', '#FF4A3F', '#FC3AC6', '#7D26CD']

const designSystem = {
  light: [
    // '#EBF0FF',
    // '#D6E0FF',
    // '#ADC2FF',
    // '#85A3FF',
    // '#5C85FF',
    '#3366FF',
    '#2952CC',
    '#1F3D99',
    '#142966',
    '#0A1433',
    // '#FCFCFC',
    // '#F9F9FA',
    // '#F4F4F5',
    // '#E7E7E9',
    // '#D5D5D9',
    // '#9AA2AF',
    // '#6A7184',
    '#4A5268',
    '#374151',
    '#1F293A',
    '#101015',
    // '#FFF2F1',
    // '#FFDBD9',
    // '#FFB7B2',
    // '#FF928C',
    // '#FF6E65',
    // '#FF4A3F',
    '#E8463C',
    '#CB3F36',
    '#B23830',
    '#7D2721',
    // '#FFEEFB',
    // '#FED8F4',
    // '#FEB0E8',
    // '#FD89DD',
    // '#FD61D1',
    '#FC3AC6',
    '#CA2E9E',
    '#972377',
    '#65174F',
    '#320C28',
    // '#FFF5EF',
    // '#FEE6D6',
    // '#FDCDAD',
    // '#FCB483',
    // '#FB9B5A',
    '#FA8231',
    '#E1752C',
    '#C86827',
    '#964E1D',
    '#4B270F',

    // '#F3ECFA',
    // '#E5D4F5',
    // '#CBA8EB',
    // '#B17DE1',
    // '#9751D7',
    '#7D26CD',
    '#641EA4',
    '#4B177B',
    '#320F52',
    '#190829',

    // '#EDF9FF',
    // '#D7F2FF',
    // '#AFE5FF',
    // '#86D9FF',
    // '#5ECCFF',
    '#36BFFF',
    '#2B99CC',
    '#207399',
    '#164C66',
    '#0B2633',
    // '#fffbf2',
    // '#fff0d1',
    // '#fee5b0',
    // '#fdd889',
    // '#fdcb61',
    // '#fcbe3a',
    '#ca982e',
    '#977223',
    '#654c17',
    '#32260c',
  ],
  dark: [],
}

// convert string into a unique color
export const stringToColor = (input: string, colorArray = designSystem.light) => {
  // Calculate a numeric hash value from the input string
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Ensure the hash value is within the array length
  const index = Math.abs(hash) % colorArray.length

  // Return the selected color
  return colorArray[index]
}

// Function to convert hex color to RGB
function hexToRGBObject(hexColor: string) {
  // Remove '#' if present in the hexColor
  hexColor = hexColor.replace(/^#/, '')

  // Split the hexColor into red, green, and blue components
  const r = parseInt(hexColor.substring(0, 2), 16)
  const g = parseInt(hexColor.substring(2, 4), 16)
  const b = parseInt(hexColor.substring(4, 6), 16)

  return { r, g, b }
}

export function isColorDark(hexColor: string) {
  const rgbColor = hexToRGBObject(hexColor)

  const luminance = 0.299 * rgbColor.r + 0.587 * rgbColor.g + 0.114 * rgbColor.b
  // Choose a luminance threshold (e.g., 0.5) to determine darkness/lightness
  return luminance < 128
}

export function getEnumColorByIndex(i: number, mode: 'light' | 'dark' = 'light') {
  return enumColor[mode][i % enumColor[mode].length]
}

export const themeV4Colors = {
  base: {
    white: 'var(--color-base-white)',
    black: 'var(--color-base-black)',
  },
  brand: {
    50: 'var(--color-brand-50)',
    100: 'var(--color-brand-100)',
    200: 'var(--color-brand-200)',
    300: 'var(--color-brand-300)',
    400: 'var(--color-brand-400)',
    500: 'var(--color-brand-500)',
    600: 'var(--color-brand-600)',
    700: 'var(--color-brand-700)',
    800: 'var(--color-brand-800)',
    900: 'var(--color-brand-900)',
  },
  gray: {
    10: '#FCFCFC',
    50: 'var(--color-grey-50)',
    100: 'var(--color-grey-100)',
    200: 'var(--color-grey-200)',
    300: 'var(--color-grey-300)',
    400: 'var(--color-grey-400)',
    500: 'var(--color-grey-500)',
    600: 'var(--color-grey-600)',
    700: 'var(--color-grey-700)',
    800: 'var(--color-grey-800)',
    900: 'var(--color-grey-900)',
  },
  red: {
    50: 'var(--color-red-50)',
    100: 'var(--color-red-100)',
    200: 'var(--color-red-200)',
    300: 'var(--color-red-300)',
    400: 'var(--color-red-400)',
    500: 'var(--color-red-500)',
    600: 'var(--color-red-600)',
    700: 'var(--color-red-700)',
    800: 'var(--color-red-800)',
    900: 'var(--color-red-900)',
  },
  pink: {
    50: 'var(--color-pink-50)',
    100: 'var(--color-pink-100)',
    200: 'var(--color-pink-200)',
    300: 'var(--color-pink-300)',
    400: 'var(--color-pink-400)',
    500: 'var(--color-pink-500)',
    600: 'var(--color-pink-600)',
    700: 'var(--color-pink-700)',
    800: 'var(--color-pink-800)',
    900: 'var(--color-pink-900)',
  },
  orange: {
    50: 'var(--color-orange-50)',
    100: 'var(--color-orange-100)',
    200: 'var(--color-orange-200)',
    300: 'var(--color-orange-300)',
    400: 'var(--color-orange-400)',
    500: 'var(--color-orange-500)',
    600: 'var(--color-orange-600)',
    700: 'var(--color-orange-700)',
    800: 'var(--color-orange-800)',
    900: 'var(--color-orange-900)',
  },
  purple: {
    50: 'var(--color-purple-50)',
    100: 'var(--color-purple-100)',
    200: 'var(--color-purple-200)',
    300: 'var(--color-purple-300)',
    400: 'var(--color-purple-400)',
    500: 'var(--color-purple-500)',
    600: 'var(--color-purple-600)',
    700: 'var(--color-purple-700)',
    800: 'var(--color-purple-800)',
    900: 'var(--color-purple-900)',
  },
  blue: {
    50: 'var(--color-blue-50)',
    100: 'var(--color-blue-100)',
    200: 'var(--color-blue-200)',
    300: 'var(--color-blue-300)',
    400: 'var(--color-blue-400)',
    500: 'var(--color-blue-500)',
    600: 'var(--color-blue-600)',
    700: 'var(--color-blue-700)',
    800: 'var(--color-blue-800)',
    900: 'var(--color-blue-900)',
  },
  yellow: {
    50: 'var(--color-yellow-50)',
    100: 'var(--color-yellow-100)',
    200: 'var(--color-yellow-200)',
    300: 'var(--color-yellow-300)',
    400: 'var(--color-yellow-400)',
    500: 'var(--color-yellow-500)',
    600: 'var(--color-yellow-600)',
    700: 'var(--color-yellow-700)',
    800: 'var(--color-yellow-800)',
    900: 'var(--color-yellow-900)',
  },
  maroon: {
    50: 'var(--color-maroon-50)',
    100: 'var(--color-maroon-100)',
    200: 'var(--color-maroon-200)',
    300: 'var(--color-maroon-300)',
    400: 'var(--color-maroon-400)',
    500: 'var(--color-maroon-500)',
    600: 'var(--color-maroon-600)',
    700: 'var(--color-maroon-700)',
    800: 'var(--color-maroon-800)',
    900: 'var(--color-maroon-900)',
  },
  green: {
    50: 'var(--color-green-50)',
    100: 'var(--color-green-100)',
    200: 'var(--color-green-200)',
    300: 'var(--color-green-300)',
    400: 'var(--color-green-400)',
    500: 'var(--color-green-500)',
    600: 'var(--color-green-600)',
    700: 'var(--color-green-700)',
    800: 'var(--color-green-800)',
    900: 'var(--color-green-900)',
  },
}

/**
 * ### Light Theme Configuration
 * In this project, we've integrated a custom WindiCSS configuration that aligns with our Figma design system.
 * This setup introduces shorthand class names for various UI elements like text color, border color,
 * background color, and more. The goal is to ensure design consistency and streamline the development
 * process by directly reflecting Figma styles in our codebase.
 *
 * #### Why We Introduced This
 *
 * The light theme was introduced to:
 * - **Maintain Consistency**: Ensures that the color scheme used in the design (Figma) is reflected accurately in the codebase.
 * - **Ease of Use**: Simplifies the application of colors by using intuitive, design-referenced class names.
 *
 * #### Usage
 *
 * The configuration extends WindiCSS with custom screens, font sizes, font weights, colors, and other utilities.
 * These can be used directly in files through class names.
 *
 * ###### Text Color
 * To apply a text color, you can use:
 * ```html
 * <p class="text-nc-content-grey-subtle">This is subtle grey text.</p>
 * ```
 *
 * ###### Border Color
 * To apply a border color, you can use:
 * ```html
 * <div class="border-nc-border-gray-light">This div has a light grey border.</div>
 * ```
 *
 * ###### Background Color
 * To apply a background color, you can use:
 * ```html
 * <div class="bg-nc-bg-brand">This div has a brand color background.</div>
 * <div class="bg-nc-bg-blue-dark">This div has a blue dark color background.</div>
 * ```
 *
 * ###### Fill Color
 * light theme fill colors are globally extended in WindiCSS and can be used for various purposes such as:
 * - **SVG Fill**:
 * ```html
 * <svg class="fill-nc-fill-primary">...</svg>
 * ```
 * - **Text Color**:
 * ```html
 * <p class="text-nc-fill-red-dark">...</p>
 * ```
 * - **Border Color**:
 * ```html
 * <div class="border-nc-fill-primary">...</div>
 * ```
 * - **Background Color**:
 * ```html
 * <div class="bg-nc-fill-primary-hover">...</div>
 * ```
 * This setup ensures that your styles are consistent with your design specifications and easily maintainable across the project.
 */
export const themeVariables = {
  content: {
    'nc-content-gray': {
      extreme: themeV4Colors.base.black,
      emphasis: themeV4Colors.gray[900],
      DEFAULT: themeV4Colors.gray[800],
      subtle: themeV4Colors.gray[700],
      subtle2: themeV4Colors.gray[600],
      muted: themeV4Colors.gray[500],
    },
    'nc-content-brand': {
      DEFAULT: themeV4Colors.brand[500],
      disabled: themeV4Colors.brand[600],
      hover: themeV4Colors.gray[300],
    },
    'nc-content-inverted-primary': {
      DEFAULT: themeV4Colors.base.white,
      hover: themeV4Colors.base.white,
      disabled: themeV4Colors.gray[500],
    },
    'nc-content-inverted-secondary': {
      DEFAULT: themeV4Colors.gray[700],
      hover: themeV4Colors.gray[700],
      disabled: themeV4Colors.gray[500],
    },
    'nc-content-red': {
      dark: themeV4Colors.red[700],
      medium: themeV4Colors.red[500],
      light: themeV4Colors.red[300],
    },
    'nc-content-green': {
      dark: themeV4Colors.green[700],
      medium: themeV4Colors.green[500],
      light: themeV4Colors.green[300],
    },
    'nc-content-yellow': {
      dark: themeV4Colors.yellow[700],
      medium: themeV4Colors.yellow[500],
      light: themeV4Colors.yellow[300],
    },
    'nc-content-blue': {
      dark: themeV4Colors.blue[700],
      medium: themeV4Colors.blue[500],
      light: themeV4Colors.blue[300],
    },
    'nc-content-purple': {
      dark: themeV4Colors.purple[700],
      medium: themeV4Colors.purple[500],
      light: themeV4Colors.purple[300],
    },
    'nc-content-pink': {
      dark: themeV4Colors.pink[700],
      medium: themeV4Colors.pink[500],
      light: themeV4Colors.pink[300],
    },
    'nc-content-orange': {
      dark: themeV4Colors.orange[700],
      medium: themeV4Colors.orange[500],
      light: themeV4Colors.orange[300],
    },
    'nc-content-maroon': {
      dark: themeV4Colors.maroon[700],
      medium: themeV4Colors.maroon[500],
      light: themeV4Colors.maroon[300],
    },
  },
  background: {
    'nc-bg-default': themeV4Colors.base.white,
    'nc-bg-brand': themeV4Colors.brand[50],
    'nc-bg-gray': {
      extralight: themeV4Colors.gray[50],
      light: themeV4Colors.gray[100],
      medium: themeV4Colors.gray[200],
      dark: themeV4Colors.gray[300],
      extradark: themeV4Colors.gray[400],
    },
    'nc-bg-red': {
      light: themeV4Colors.red[50],
      dark: themeV4Colors.red[100],
    },
    'nc-bg-green': {
      light: themeV4Colors.green[50],
      dark: themeV4Colors.green[100],
    },
    'nc-bg-yellow': {
      light: themeV4Colors.yellow[50],
      dark: themeV4Colors.yellow[100],
    },
    'nc-bg-blue': {
      light: themeV4Colors.blue[50],
      dark: themeV4Colors.blue[100],
    },
    'nc-bg-purple': {
      light: themeV4Colors.purple[50],
      dark: themeV4Colors.purple[100],
    },
    'nc-bg-pink': {
      light: themeV4Colors.pink[50],
      dark: themeV4Colors.pink[100],
    },
    'nc-bg-orange': {
      light: themeV4Colors.orange[50],
      dark: themeV4Colors.orange[100],
    },
    'nc-bg-maroon': {
      light: themeV4Colors.maroon[50],
      dark: themeV4Colors.maroon[100],
    },
  },
  border: {
    'nc-border-brand': themeV4Colors.brand[500],
    'nc-border-gray': {
      extralight: themeV4Colors.gray[50],
      light: themeV4Colors.gray[100],
      medium: themeV4Colors.gray[200],
      dark: themeV4Colors.gray[300],
      extradark: themeV4Colors.gray[400],
    },
    'nc-border-red': {
      DEFAULT: themeV4Colors.red[500],
    },
    'nc-border-green': {
      DEFAULT: themeV4Colors.green[500],
    },
    'nc-border-yellow': {
      DEFAULT: themeV4Colors.yellow[500],
    },
    'nc-border-blue': {
      DEFAULT: themeV4Colors.blue[500],
    },
    'nc-border-purple': {
      DEFAULT: themeV4Colors.purple[500],
    },
    'nc-border-pink': {
      DEFAULT: themeV4Colors.pink[500],
    },
    'nc-border-orange': {
      DEFAULT: themeV4Colors.orange[500],
    },
    'nc-border-maroon': {
      DEFAULT: themeV4Colors.maroon[500],
    },
  },
  fill: {
    'nc-fill-primary': {
      DEFAULT: themeV4Colors.brand[500],
      hover: themeV4Colors.brand[600],
      disabled: themeV4Colors.gray[300],
      disabled2: themeV4Colors.brand[200],
    },
    'nc-fill-secondary': {
      DEFAULT: themeV4Colors.base.white,
      hover: themeV4Colors.gray[50],
      disabled: themeV4Colors.base.white,
    },
    'nc-fill-warning': {
      DEFAULT: themeV4Colors.red[500],
      hover: themeV4Colors.red[600],
      disabled: themeV4Colors.gray[50],
    },
    'nc-fill-success': {
      DEFAULT: themeV4Colors.green[500],
      hover: themeV4Colors.green[600],
      disabled: themeV4Colors.gray[50],
    },
    'nc-fill-red': {
      dark: themeV4Colors.red[700],
      medium: themeV4Colors.red[500],
      light: themeV4Colors.red[300],
    },
    'nc-fill-green': {
      dark: themeV4Colors.green[700],
      medium: themeV4Colors.green[500],
      light: themeV4Colors.green[300],
    },
    'nc-fill-yellow': {
      dark: themeV4Colors.yellow[700],
      medium: themeV4Colors.yellow[500],
      light: themeV4Colors.yellow[300],
    },
    'nc-fill-blue': {
      dark: themeV4Colors.blue[700],
      medium: themeV4Colors.blue[500],
      light: themeV4Colors.blue[300],
    },
    'nc-fill-purple': {
      dark: themeV4Colors.purple[700],
      medium: themeV4Colors.purple[500],
      light: themeV4Colors.purple[300],
    },
    'nc-fill-pink': {
      dark: themeV4Colors.pink[700],
      medium: themeV4Colors.pink[500],
      light: themeV4Colors.pink[300],
    },
    'nc-fill-orange': {
      dark: themeV4Colors.orange[700],
      medium: themeV4Colors.orange[500],
      light: themeV4Colors.orange[300],
    },
    'nc-fill-maroon': {
      dark: themeV4Colors.maroon[700],
      medium: themeV4Colors.maroon[500],
      light: themeV4Colors.maroon[300],
    },
  },
}

export const getLighterTint = (
  color: string,
  option?: {
    saturationMod?: number
    brightnessMod?: number
  },
) => {
  const evalColor = tinycolor(color)

  const hsv = evalColor.toHsv()

  const safeS = hsv.s < 0.01 ? 0 : 5 + (option?.saturationMod ?? 0) // prevent gray → red
  const safeV = Math.min(100, (hsv.s < 0.01 ? 97 : 100) + (option?.brightnessMod ?? 0))

  return tinycolor({
    h: hsv.h,
    s: safeS,
    v: safeV,
  }).toHexString()
}

export const getOppositeColorOfBackground = (color: string) => {
  return tinycolor.isReadable(color || '#ccc', '#fff', { level: 'AA', size: 'large' })
    ? '#fff'
    : tinycolor.mostReadable(color || '#ccc', ['#0b1d05', '#fff']).toHex8String()
}
