import colors from 'windicss/colors'
import { enumColors as enumColor } from 'nocodb-sdk'
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

function getCSSVariable(variable: string) {
  return window.getComputedStyle(document.documentElement).getPropertyValue(variable)
}

export const themeV3Colors = {
  base: {
    white: getCSSVariable('--color-base-white'),
    black: getCSSVariable('--color-base-black'),
  },
  brand: {
    50: getCSSVariable('--color-brand-50'),
    100: getCSSVariable('--color-brand-100'),
    200: getCSSVariable('--color-brand-200'),
    300: getCSSVariable('--color-brand-300'),
    400: getCSSVariable('--color-brand-400'),
    500: getCSSVariable('--color-brand-500'),
    600: getCSSVariable('--color-brand-600'),
    700: getCSSVariable('--color-brand-700'),
    800: getCSSVariable('--color-brand-800'),
    900: getCSSVariable('--color-brand-900'),
  },
  gray: {
    10: '#FCFCFC',
    50: getCSSVariable('--color-grey-50'),
    100: getCSSVariable('--color-grey-100'),
    200: getCSSVariable('--color-grey-200'),
    300: getCSSVariable('--color-grey-300'),
    400: getCSSVariable('--color-grey-400'),
    500: getCSSVariable('--color-grey-500'),
    600: getCSSVariable('--color-grey-600'),
    700: getCSSVariable('--color-grey-700'),
    800: getCSSVariable('--color-grey-800'),
    900: getCSSVariable('--color-grey-900'),
  },
  red: {
    50: getCSSVariable('--color-red-50'),
    100: getCSSVariable('--color-red-100'),
    200: getCSSVariable('--color-red-200'),
    300: getCSSVariable('--color-red-300'),
    400: getCSSVariable('--color-red-400'),
    500: getCSSVariable('--color-red-500'),
    600: getCSSVariable('--color-red-600'),
    700: getCSSVariable('--color-red-700'),
    800: getCSSVariable('--color-red-800'),
    900: getCSSVariable('--color-red-900'),
  },
  pink: {
    50: getCSSVariable('--color-pink-50'),
    100: getCSSVariable('--color-pink-100'),
    200: getCSSVariable('--color-pink-200'),
    300: getCSSVariable('--color-pink-300'),
    400: getCSSVariable('--color-pink-400'),
    500: getCSSVariable('--color-pink-500'),
    600: getCSSVariable('--color-pink-600'),
    700: getCSSVariable('--color-pink-700'),
    800: getCSSVariable('--color-pink-800'),
    900: getCSSVariable('--color-pink-900'),
  },
  orange: {
    50: getCSSVariable('--color-orange-50'),
    100: getCSSVariable('--color-orange-100'),
    200: getCSSVariable('--color-orange-200'),
    300: getCSSVariable('--color-orange-300'),
    400: getCSSVariable('--color-orange-400'),
    500: getCSSVariable('--color-orange-500'),
    600: getCSSVariable('--color-orange-600'),
    700: getCSSVariable('--color-orange-700'),
    800: getCSSVariable('--color-orange-800'),
    900: getCSSVariable('--color-orange-900'),
  },
  purple: {
    50: getCSSVariable('--color-purple-50'),
    100: getCSSVariable('--color-purple-100'),
    200: getCSSVariable('--color-purple-200'),
    300: getCSSVariable('--color-purple-300'),
    400: getCSSVariable('--color-purple-400'),
    500: getCSSVariable('--color-purple-500'),
    600: getCSSVariable('--color-purple-600'),
    700: getCSSVariable('--color-purple-700'),
    800: getCSSVariable('--color-purple-800'),
    900: getCSSVariable('--color-purple-900'),
  },
  blue: {
    50: getCSSVariable('--color-blue-50'),
    100: getCSSVariable('--color-blue-100'),
    200: getCSSVariable('--color-blue-200'),
    300: getCSSVariable('--color-blue-300'),
    400: getCSSVariable('--color-blue-400'),
    500: getCSSVariable('--color-blue-500'),
    600: getCSSVariable('--color-blue-600'),
    700: getCSSVariable('--color-blue-700'),
    800: getCSSVariable('--color-blue-800'),
    900: getCSSVariable('--color-blue-900'),
  },
  yellow: {
    50: getCSSVariable('--color-yellow-50'),
    100: getCSSVariable('--color-yellow-100'),
    200: getCSSVariable('--color-yellow-200'),
    300: getCSSVariable('--color-yellow-300'),
    400: getCSSVariable('--color-yellow-400'),
    500: getCSSVariable('--color-yellow-500'),
    600: getCSSVariable('--color-yellow-600'),
    700: getCSSVariable('--color-yellow-700'),
    800: getCSSVariable('--color-yellow-800'),
    900: getCSSVariable('--color-yellow-900'),
  },
  maroon: {
    50: getCSSVariable('--color-maroon-50'),
    100: getCSSVariable('--color-maroon-100'),
    200: getCSSVariable('--color-maroon-200'),
    300: getCSSVariable('--color-maroon-300'),
    400: getCSSVariable('--color-maroon-400'),
    500: getCSSVariable('--color-maroon-500'),
    600: getCSSVariable('--color-maroon-600'),
    700: getCSSVariable('--color-maroon-700'),
    800: getCSSVariable('--color-maroon-800'),
    900: getCSSVariable('--color-maroon-900'),
  },
  green: {
    50: getCSSVariable('--color-green-50'),
    100: getCSSVariable('--color-green-100'),
    200: getCSSVariable('--color-green-200'),
    300: getCSSVariable('--color-green-300'),
    400: getCSSVariable('--color-green-400'),
    500: getCSSVariable('--color-green-500'),
    600: getCSSVariable('--color-green-600'),
    700: getCSSVariable('--color-green-700'),
    800: getCSSVariable('--color-green-800'),
    900: getCSSVariable('--color-green-900'),
  },
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
export const lightTheme = {
  content: {
    'nc-content-gray': {
      extreme: themeV3Colors.base.black,
      emphasis: themeV3Colors.gray[900],
      DEFAULT: themeV3Colors.gray[800],
      subtle: themeV3Colors.gray[700],
      subtle2: themeV3Colors.gray[600],
      muted: themeV3Colors.gray[500],
    },
    'nc-content-brand': {
      DEFAULT: themeV3Colors.brand[500],
      disabled: themeV3Colors.brand[600],
      hover: themeV3Colors.gray[300],
    },
    'nc-content-inverted-primary': {
      DEFAULT: themeV3Colors.base.white,
      hover: themeV3Colors.base.white,
      disabled: themeV3Colors.gray[400],
    },
    'nc-content-inverted-secondary': {
      DEFAULT: themeV3Colors.gray[700],
      hover: themeV3Colors.gray[700],
      disabled: themeV3Colors.gray[400],
    },
    'nc-content-red': {
      dark: themeV3Colors.red[700],
      medium: themeV3Colors.red[500],
      light: themeV3Colors.red[300],
    },
    'nc-content-green': {
      dark: themeV3Colors.green[700],
      medium: themeV3Colors.green[500],
      light: themeV3Colors.green[300],
    },
    'nc-content-yellow': {
      dark: themeV3Colors.yellow[700],
      medium: themeV3Colors.yellow[500],
      light: themeV3Colors.yellow[300],
    },
    'nc-content-blue': {
      dark: themeV3Colors.blue[700],
      medium: themeV3Colors.blue[500],
      light: themeV3Colors.blue[300],
    },
    'nc-content-purple': {
      dark: themeV3Colors.purple[700],
      medium: themeV3Colors.purple[500],
      light: themeV3Colors.purple[300],
    },
    'nc-content-pink': {
      dark: themeV3Colors.pink[700],
      medium: themeV3Colors.pink[500],
      light: themeV3Colors.pink[300],
    },
    'nc-content-orange': {
      dark: themeV3Colors.orange[700],
      medium: themeV3Colors.orange[500],
      light: themeV3Colors.orange[300],
    },
    'nc-content-maroon': {
      dark: themeV3Colors.maroon[700],
      medium: themeV3Colors.maroon[500],
      light: themeV3Colors.maroon[300],
    },
  },
  background: {
    'nc-bg-default': themeV3Colors.base.white,
    'nc-bg-brand': themeV3Colors.brand[50],
    'nc-bg-gray': {
      extralight: themeV3Colors.gray[50],
      light: themeV3Colors.gray[100],
      medium: themeV3Colors.gray[200],
      dark: themeV3Colors.gray[300],
      extradark: themeV3Colors.gray[400],
    },
    'nc-bg-red': {
      light: themeV3Colors.red[50],
      dark: themeV3Colors.red[100],
    },
    'nc-bg-green': {
      light: themeV3Colors.green[50],
      dark: themeV3Colors.green[100],
    },
    'nc-bg-yellow': {
      light: themeV3Colors.yellow[50],
      dark: themeV3Colors.yellow[100],
    },
    'nc-bg-blue': {
      light: themeV3Colors.blue[50],
      dark: themeV3Colors.blue[100],
    },
    'nc-bg-purple': {
      light: themeV3Colors.purple[50],
      dark: themeV3Colors.purple[100],
    },
    'nc-bg-pink': {
      light: themeV3Colors.pink[50],
      dark: themeV3Colors.pink[100],
    },
    'nc-bg-orange': {
      light: themeV3Colors.orange[50],
      dark: themeV3Colors.orange[100],
    },
    'nc-bg-maroon': {
      light: themeV3Colors.maroon[50],
      dark: themeV3Colors.maroon[100],
    },
  },
  border: {
    'nc-border-brand': themeV3Colors.brand[500],
    'nc-border-gray': {
      extralight: themeV3Colors.gray[50],
      light: themeV3Colors.gray[100],
      medium: themeV3Colors.gray[200],
      dark: themeV3Colors.gray[300],
      extradark: themeV3Colors.gray[400],
    },
    'nc-border-red': {
      DEFAULT: themeV3Colors.red[500],
    },
    'nc-border-green': {
      DEFAULT: themeV3Colors.green[500],
    },
    'nc-border-yellow': {
      DEFAULT: themeV3Colors.yellow[500],
    },
    'nc-border-blue': {
      DEFAULT: themeV3Colors.blue[500],
    },
    'nc-border-purple': {
      DEFAULT: themeV3Colors.purple[500],
    },
    'nc-border-pink': {
      DEFAULT: themeV3Colors.pink[500],
    },
    'nc-border-orange': {
      DEFAULT: themeV3Colors.orange[500],
    },
    'nc-border-maroon': {
      DEFAULT: themeV3Colors.maroon[500],
    },
  },
  fill: {
    'nc-fill-primary': {
      DEFAULT: themeV3Colors.brand[500],
      hover: themeV3Colors.brand[600],
      disabled: themeV3Colors.gray[300],
      disabled2: themeV3Colors.brand[200],
    },
    'nc-fill-secondary': {
      DEFAULT: themeV3Colors.base.white,
      hover: themeV3Colors.gray[50],
      disabled: themeV3Colors.base.white,
    },
    'nc-fill-warning': {
      DEFAULT: themeV3Colors.red[500],
      hover: themeV3Colors.red[600],
      disabled: themeV3Colors.gray[50],
    },
    'nc-fill-success': {
      DEFAULT: themeV3Colors.green[500],
      hover: themeV3Colors.green[600],
      disabled: themeV3Colors.gray[50],
    },
    'nc-fill-red': {
      dark: themeV3Colors.red[700],
      medium: themeV3Colors.red[500],
      light: themeV3Colors.red[300],
    },
    'nc-fill-green': {
      dark: themeV3Colors.green[700],
      medium: themeV3Colors.green[500],
      light: themeV3Colors.green[300],
    },
    'nc-fill-yellow': {
      dark: themeV3Colors.yellow[700],
      medium: themeV3Colors.yellow[500],
      light: themeV3Colors.yellow[300],
    },
    'nc-fill-blue': {
      dark: themeV3Colors.blue[700],
      medium: themeV3Colors.blue[500],
      light: themeV3Colors.blue[300],
    },
    'nc-fill-purple': {
      dark: themeV3Colors.purple[700],
      medium: themeV3Colors.purple[500],
      light: themeV3Colors.purple[300],
    },
    'nc-fill-pink': {
      dark: themeV3Colors.pink[700],
      medium: themeV3Colors.pink[500],
      light: themeV3Colors.pink[300],
    },
    'nc-fill-orange': {
      dark: themeV3Colors.orange[700],
      medium: themeV3Colors.orange[500],
      light: themeV3Colors.orange[300],
    },
    'nc-fill-maroon': {
      dark: themeV3Colors.maroon[700],
      medium: themeV3Colors.maroon[500],
      light: themeV3Colors.maroon[300],
    },
  },
}
