import { ConfigProvider } from 'ant-design-vue'
import type { Theme as AntTheme } from 'ant-design-vue/es/config-provider'
import tinycolor from 'tinycolor2'
import { hexToRGB, themeV2Colors, useCssVar, useInjectionState, useProject } from '#imports'

interface ThemeConfig extends AntTheme {
  primaryColor: string
  accentColor: string
}

const [setup, use] = useInjectionState((config?: Partial<ThemeConfig>) => {
  const primaryColor = useCssVar('--color-primary', typeof document !== 'undefined' ? document.documentElement : null)
  const accentColor = useCssVar('--color-accent', typeof document !== 'undefined' ? document.documentElement : null)

  const { project, projectMeta, updateProject } = useProject()

  // set theme based on active project
  watch(project, () => {
    setTheme({
      primaryColor: themeV2Colors['royal-blue'].DEFAULT,
      accentColor: themeV2Colors.pink['500'],
      ...projectMeta.value?.theme,
    })
  })

  /** current theme config */
  const currentTheme = ref({
    primaryColor: themeV2Colors['royal-blue'].DEFAULT,
    accentColor: themeV2Colors.pink['500'],
    ...projectMeta.value?.theme,
  })

  /** set initial config */
  setTheme(config ?? currentTheme.value)

  /** set theme (persists in localstorage) */
  function setTheme(theme: Partial<ThemeConfig>) {
    const themePrimary = tinycolor(theme.primaryColor)
    const themeAccent = tinycolor(theme.accentColor)

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

  async function saveTheme(theme: Partial<ThemeConfig>) {
    await updateProject({
      meta: JSON.stringify({
        ...projectMeta.value,
        theme,
      }),
    })
    setTheme(theme)
  }

  return {
    theme: currentTheme,
    setTheme,
    saveTheme,
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
