import { ConfigProvider } from 'ant-design-vue'
import type { Theme as AntTheme } from 'ant-design-vue/es/config-provider'
import tinycolor from 'tinycolor2'
import { hexToRGB, themeV2Colors, useCssVar, useInjectionState } from '#imports'

export interface ThemeConfig extends AntTheme {
  primaryColor: string
  accentColor: string
}

const [setup, use] = useInjectionState((config?: Partial<ThemeConfig>) => {
  const primaryColor = useCssVar('--color-primary', typeof document !== 'undefined' ? document.documentElement : null)
  const accentColor = useCssVar('--color-accent', typeof document !== 'undefined' ? document.documentElement : null)

  /** current theme config */
  const currentTheme = ref({
    primaryColor: themeV2Colors['royal-blue'].DEFAULT,
    accentColor: themeV2Colors.pink['500'],
  })

  /** set initial config */
  setTheme(config ?? currentTheme.value)

  /** set theme (persists in localstorage) */
  function setTheme(theme: Partial<ThemeConfig>) {
    const themePrimary = theme?.primaryColor ? tinycolor(theme.primaryColor) : tinycolor(themeV2Colors['royal-blue'].DEFAULT)
    const themeAccent = theme?.accentColor ? tinycolor(theme.accentColor) : tinycolor(themeV2Colors.pink['500'])

    // convert hex colors to rgb values
    primaryColor.value = themePrimary.isValid()
      ? hexToRGB(themePrimary.toHex8String())
      : hexToRGB(themeV2Colors['royal-blue'].DEFAULT)
    accentColor.value = themeAccent.isValid() ? hexToRGB(themeAccent.toHex8String()) : hexToRGB(themeV2Colors.pink['500'])

    currentTheme.value = {
      primaryColor: themePrimary.toHex8String().toUpperCase(),
      accentColor: themeAccent.toHex8String().toUpperCase(),
    }

    ConfigProvider.config({
      theme: currentTheme.value,
    })
  }

  return {
    theme: currentTheme,
    setTheme,
  }
}, 'theme')

export const provideTheme = setup

export function useTheme(config?: Partial<ThemeConfig>) {
  const theme = use()

  if (!theme) {
    return setup(config)
  } else {
    if (config) theme.setTheme(config)
  }

  return theme
}
