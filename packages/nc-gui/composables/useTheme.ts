import { computed, onMounted, ref, watch } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'

export const useTheme = createSharedComposable(() => {
  const selectedTheme = ref<ThemeMode>('system')
  const systemPreference = ref<'light' | 'dark'>('light')

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const isThemeEnabled = computed(() => {
    return isFeatureEnabled(FEATURE_FLAG.DARK_MODE)
  })

  const isDark = computed(() => {
    if (!isThemeEnabled.value) {
      return false
    }
    if (selectedTheme.value === 'system') {
      return systemPreference.value === 'dark'
    }
    return selectedTheme.value === 'dark'
  })

  const applyTheme = (dark: boolean) => {
    if (typeof document !== 'undefined') {
      if (dark) {
        document.documentElement.setAttribute('theme', 'dark')
      } else {
        document.documentElement.removeAttribute('theme')
      }
    }
  }

  const setTheme = (theme: ThemeMode) => {
    selectedTheme.value = theme
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('nc-theme', theme)
    }
  }

  const toggleTheme = () => {
    setTheme(selectedTheme.value === 'dark' ? 'light' : 'dark')
  }

  let initialized = false

  const init = () => {
    if (initialized || typeof window === 'undefined') return
    initialized = true

    const saved = localStorage.getItem('nc-theme') as ThemeMode
    if (saved && ['system', 'light', 'dark'].includes(saved)) {
      selectedTheme.value = saved
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemPreference.value = mediaQuery.matches ? 'dark' : 'light'

    mediaQuery.addEventListener('change', (e) => {
      systemPreference.value = e.matches ? 'dark' : 'light'
    })
  }

  watch(isDark, applyTheme, { immediate: true })

  onMounted(init)

  return {
    selectedTheme,
    isDark,
    setTheme,
    toggleTheme,
    init,
    isThemeEnabled,
  }
})
