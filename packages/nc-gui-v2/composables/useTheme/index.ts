import { ConfigProvider } from 'ant-design-vue'
import type { Theme as AntTheme } from 'ant-design-vue/es/config-provider'
import { hexToRGB, themeV2Colors, useCssVar, useInjectionState, useProject } from '#imports'

interface ThemeConfig extends AntTheme {
  primaryColor: string
  accentColor: string
}

const [setup, use] = useInjectionState((config?: Partial<ThemeConfig>) => {
  const primaryColor = useCssVar('--color-primary', typeof document !== 'undefined' ? document.documentElement : null)
  const accentColor = useCssVar('--color-accent', typeof document !== 'undefined' ? document.documentElement : null)

  const { project, getProjectMeta, updateProject } = useProject()

  const route = useRoute()

  // set theme based on active project
  watch(project, () => {
    setTheme({
      primaryColor: themeV2Colors['royal-blue'].DEFAULT,
      accentColor: themeV2Colors.pink['500'],
      ...getProjectMeta()?.theme,
    })
  })

  // set default theme for routes out of project
  watch(
    () => route,
    (v) => {
      if (!v.params?.projectId) {
        setTheme({
          primaryColor: themeV2Colors['royal-blue'].DEFAULT,
          accentColor: themeV2Colors.pink['500'],
        })
      }
    },
    { deep: true },
  )

  /** current theme config */
  const currentTheme = ref({
    primaryColor: themeV2Colors['royal-blue'].DEFAULT,
    accentColor: themeV2Colors.pink['500'],
    ...getProjectMeta()?.theme,
  })

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

  async function saveTheme(theme: Partial<ThemeConfig>) {
    const meta = getProjectMeta()
    await updateProject({
      meta: JSON.stringify({
        ...meta,
        theme: {
          ...theme,
        },
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
