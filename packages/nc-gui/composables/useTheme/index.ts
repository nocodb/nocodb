import { ConfigProvider } from 'ant-design-vue'
import tinycolor from 'tinycolor2'

export const useTheme = createGlobalState((config?: Partial<ThemeConfig>) => {
  const primaryColor = useCssVar('--color-primary', typeof document !== 'undefined' ? document.documentElement : null)
  const accentColor = useCssVar('--color-accent', typeof document !== 'undefined' ? document.documentElement : null)
  const defaultTheme = {
    primaryColor: themeV2Colors['royal-blue'].DEFAULT,
    accentColor: themeV2Colors.pink['500'],
  }

  /** current theme config */
  const currentTheme = ref(defaultTheme)

  /** set initial config */
  setTheme(config ?? currentTheme.value)

  /** set theme */
  function setTheme(theme?: Partial<ThemeConfig>) {
    const themePrimary = theme?.primaryColor ? tinycolor(theme.primaryColor) : tinycolor(themeV2Colors['royal-blue'].DEFAULT)
    const themeAccent = theme?.accentColor ? tinycolor(theme.accentColor) : tinycolor(themeV2Colors.pink['500'])

    // convert hex colors to rgb values
    primaryColor.value = themePrimary.isValid()
      ? hexToRGB(themePrimary.toHex8String())
      : hexToRGB(themeV2Colors['royal-blue'].DEFAULT)
    accentColor.value = themeAccent.isValid() ? hexToRGB(themeAccent.toHex8String()) : hexToRGB(themeV2Colors.pink['500'])

    currentTheme.value = {
      primaryColor: themePrimary.toHex8String().toUpperCase().slice(0, -2),
      accentColor: themeAccent.toHex8String().toUpperCase().slice(0, -2),
    }

    ConfigProvider.config({
      theme: currentTheme.value,
    })
  }

  return {
    theme: currentTheme,
    setTheme,
    defaultTheme,
  }
})
