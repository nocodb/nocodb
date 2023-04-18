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
  'primary-selected': '#F0F1FF',
  'primary-selected-sidebar': '#ededff',
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

export const projectThemeColors = [
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

// convert string into a unique color
export const stringToColour = function (str: string) {
  let i
  let hash = 0
  for (i = 0; i < str?.length ?? 0; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  let colour = '#'
  for (i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff
    colour += `00${value.toString(16)}`.substr(-2)
  }
  return colour
}
