export interface ButtonColorStateType {
  background: string;
  text: string;
}

export interface ButtonColorMapType {

}

export const buttonColorMap = {
  solid: {
    brand: {
      base: { background: '#3366FF', text: '#FFFFFF' },
      hover: { background: '#2952CC', text: '#FFFFFF' },
      loader: '#3366FF',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    red: {
      base: { background: '#FF4A3F', text: '#FFFFFF' },
      hover: { background: '#CB3F36', text: '#FFFFFF' },
      loader: '#FF4A3F',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    green: {
      base: { background: '#27D665', text: '#FFFFFF' },
      hover: { background: '#1FAB51', text: '#FFFFFF' },
      loader: '#27D665',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    maroon: {
      base: { background: '#B33771', text: '#FFFFFF' },
      hover: { background: '#9D255D', text: '#FFFFFF' },
      loader: '#B33771',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    blue: {
      base: { background: '#36BFFF', text: '#FFFFFF' },
      hover: { background: '#2B99CC', text: '#FFFFFF' },
      loader: '#36BFFF',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    orange: {
      base: { background: '#FA8231', text: '#FFFFFF' },
      hover: { background: '#E1752C', text: '#FFFFFF' },
      loader: '#FA8231',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    pink: {
      base: { background: '#FC3AC6', text: '#FFFFFF' },
      hover: { background: '#CA2E9E', text: '#FFFFFF' },
      loader: '#FC3AC6',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    purple: {
      base: { background: '#7D26CD', text: '#FFFFFF' },
      hover: { background: '#641EA4', text: '#FFFFFF' },
      loader: '#7D26CD',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    yellow: {
      base: { background: '#fcbe3a', text: '#FFFFFF' },
      hover: { background: '#ca982e', text: '#FFFFFF' },
      loader: '#fcbe3a',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
    gray: {
      base: { background: '#6A7184', text: '#FFFFFF' },
      hover: { background: '#4A5268', text: '#FFFFFF' },
      loader: '#6A7184',
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
    },
  },
  light: {
    brand: {
      base: { background: 'var(--color-brand-50)', text: 'var(--color-brand-600)' },
      hover: { background: 'var(--color-brand-100)', text: 'var(--color-brand-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-brand-600)',
    },
    red: {
      base: { background: 'var(--color-red-50)', text: 'var(--color-red-600)' },
      hover: { background: 'var(--color-red-100)', text: 'var(--color-red-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-red-600)',
    },
    green: {
      base: { background: 'var(--color-green-50)', text: 'var(--color-green-600)' },
      hover: { background: 'var(--color-green-100)', text: 'var(--color-green-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-green-600)',
    },
    maroon: {
      base: { background: 'var(--color-maroon-50)', text: 'var(--color-maroon-600)' },
      hover: { background: 'var(--color-maroon-100)', text: 'var(--color-maroon-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-maroon-600)',
    },
    blue: {
      base: { background: 'var(--color-blue-50)', text: 'var(--color-blue-600)' },
      hover: { background: 'var(--color-blue-100)', text: 'var(--color-blue-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-blue-600)',
    },
    orange: {
      base: { background: 'var(--color-orange-50)', text: 'var(--color-orange-600)' },
      hover: { background: 'var(--color-orange-100)', text: 'var(--color-orange-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-orange-600)',
    },
    pink: {
      base: { background: 'var(--color-pink-50)', text: 'var(--color-pink-600)' },
      hover: { background: 'var(--color-pink-100)', text: 'var(--color-pink-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-pink-600)',
    },
    purple: {
      base: { background: 'var(--color-purple-50)', text: 'var(--color-purple-600)' },
      hover: { background: 'var(--color-purple-100)', text: 'var(--color-purple-600)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--color-purple-600)',
    },
    yellow: {
      base: { background: '#fffbf2', text: '#ca982e' },
      hover: { background: '#fff0d1', text: '#ca982e' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#ca982e',
    },
    gray: {
      base: { background: 'var(--nc-bg-gray-extralight)', text: 'var(--nc-content-gray-subtle2)' },
      hover: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-subtle2)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--nc-content-gray-subtle2)',
    },
  },
  text: {
    brand: {
      base: { background: 'transparent', text: '#3366FF' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#3366FF' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#3366FF',
    },
    red: {
      base: { background: 'transparent', text: '#FF4A3F' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#FF4A3F' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#FF4A3F',
    },
    green: {
      base: { background: 'transparent', text: '#27D665' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#27D665' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#27D665',
    },
    maroon: {
      base: { background: 'transparent', text: '#B33771' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#B33771' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#B33771',
    },
    blue: {
      base: { background: 'transparent', text: '#36BFFF' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#36BFFF' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#36BFFF',
    },
    orange: {
      base: { background: 'transparent', text: '#FA8231' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#FA8231' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },

      loader: '#FA8231',
    },
    pink: {
      base: { background: 'transparent', text: '#FC3AC6' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#FC3AC6' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#FC3AC6',
    },
    purple: {
      base: { background: 'transparent', text: '#7D26CD' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#7D26CD' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#7D26CD',
    },
    yellow: {
      base: { background: 'transparent', text: '#fcbe3a' },
      hover: { background: 'var(--nc-bg-gray-light)', text: '#fcbe3a' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: '#fcbe3a',
    },
    gray: {
      base: { background: 'transparent', text: 'var(--nc-content-gray-muted)' },
      hover: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-muted)' },
      disabled: { background: 'var(--nc-bg-gray-light)', text: 'var(--nc-content-gray-disabled)' },
      loader: 'var(--nc-content-gray-muted)',
    },
  },
} as const

export const getButtonColors = (
  theme: 'solid' | 'light' | 'text',
  color: 'brand' | 'red' | 'green' | 'maroon' | 'blue' | 'orange' | 'pink' | 'purple' | 'yellow' | 'gray',
  isHovered: boolean,
  isDisabled: boolean,
  getColor: GetColorType,
) => {
  // Todo: dark mode colors
  const themeColors = buttonColorMap[theme]?.[color]
  if (!themeColors) {
    return isHovered && !isDisabled
      ? { background: '#2952CC', text: '#FFFFFF', loader: '#3366FF' }
      : { background: '#3366FF', text: '#FFFFFF', loader: '#3366FF' }
  }

  const state = isHovered && !isDisabled ? 'hover' : 'base'
  const colors = themeColors[state]

  return {
    background: getColor(colors.background),
    text: getColor(colors.text),
    loader: getColor(themeColors.loader),
  }
}
