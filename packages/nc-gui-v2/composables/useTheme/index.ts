import { ConfigProvider } from 'ant-design-vue'
import type { Theme as AntTheme } from 'ant-design-vue/es/config-provider'
import { hexToRGB, ref, useCssVar, useInjectionState } from '#imports'

interface ThemeConfig extends AntTheme {
  accentColor: string
}

const [setup, use] = useInjectionState((config?: Partial<ThemeConfig>) => {
  const primaryColor = useCssVar('--color-primary', typeof document !== 'undefined' ? document.documentElement : null)
  const accentColor = useCssVar('--color-accent', typeof document !== 'undefined' ? document.documentElement : null)

  /** current theme config */
  const currentTheme = ref<Partial<ThemeConfig>>()

  /** set initial config if exists */
  if (config) setTheme(config)

  function setTheme(theme: Partial<ThemeConfig>) {
    // convert hex colors to rgb values
    if (theme.primaryColor) primaryColor.value = hexToRGB(theme.primaryColor)
    if (theme.accentColor) accentColor.value = hexToRGB(theme.accentColor)

    currentTheme.value = theme

    ConfigProvider.config({
      theme,
    })
  }

  return {
    theme: currentTheme,
    setTheme,
    cssVars: { primaryColor, accentColor },
  }
})

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
