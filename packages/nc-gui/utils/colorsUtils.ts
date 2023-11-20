import colors from 'windicss/colors'

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

export const enumColor = {
  light: ['#cfdffe', '#d0f1fd', '#c2f5e8', '#ffdaf6', '#ffdce5', '#fee2d5', '#ffeab6', '#d1f7c4', '#ede2fe', '#eeeeee'],
  dark: [
    '#2d7ff999',
    '#18bfff99',
    '#20d9d299',
    '#ff08c299',
    '#f82b6099',
    '#ff6f2c99',
    '#fcb40099',
    '#20c93399',
    '#8b46ff99',
    '#666',
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
