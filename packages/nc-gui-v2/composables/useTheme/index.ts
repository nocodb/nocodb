import { ConfigProvider } from 'ant-design-vue'
import type { Theme as AntTheme } from 'ant-design-vue/es/config-provider'
import { useStorage } from '@vueuse/core'
import { NOCO, hexToRGB, themeV2Colors, useCssVar, useInjectionState } from '#imports'

interface ThemeConfig extends AntTheme {
  primaryColor: string
  accentColor: string
}

const [setup, use] = useInjectionState((config?: Partial<ThemeConfig>) => {
  const primaryColor = useCssVar('--color-primary', typeof document !== 'undefined' ? document.documentElement : null)
  const accentColor = useCssVar('--color-accent', typeof document !== 'undefined' ? document.documentElement : null)

  /** current theme config */
  const currentTheme = useStorage<ThemeConfig>(
    `${NOCO}db-theme`,
    {
      primaryColor: themeV2Colors['royal-blue'].DEFAULT,
      accentColor: themeV2Colors.pink['500'],
    },
    localStorage,
    { mergeDefaults: true },
  )

  /** set initial config */
  setTheme(config ?? currentTheme.value)

  /** set theme (persists in localstorage) */
  function setTheme(theme: Partial<ThemeConfig>) {
    // convert hex colors to rgb values
    if (theme.primaryColor) primaryColor.value = hexToRGB(theme.primaryColor)
    if (theme.accentColor) accentColor.value = hexToRGB(theme.accentColor)

    currentTheme.value = theme as ThemeConfig

    ConfigProvider.config({
      theme,
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
