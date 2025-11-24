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
      document.documentElement.classList.add('theme-transition-off')

      if (dark) {
        document.documentElement.setAttribute('theme', 'dark')

        /**
         * WindiCSS config uses `darkMode: 'class'`, so we add the `dark` class
         * to `<html>` to enable `dark:` prefix-based utilities.
         *
         * We support dark mode globally using CSS variables defined for both
         * `:root` (light theme) and `[theme='dark']` (dark theme).
         *
         * The `dark:` prefixed classes are used to selectively override the
         * globally applied styles in dark mode, making it possible to combine
         * global theme variables (`var(...)`) with per-component dark overrides.
         */

        if (!document.documentElement.classList.contains('dark')) {
          document.documentElement.classList.add('dark')
        }
      } else {
        document.documentElement.removeAttribute('theme')
        document.documentElement.classList.remove('dark')
      }

      forcedNextTick(() => {
        document.documentElement.classList.remove('theme-transition-off')
      })
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
  /**
   * Cached version for better performance in canvas rendering
   */
  const colorCache = new Map<string, string>()

  /**
   * Converts any color format to rgba with specified opacity
   * @param color - Color in hex, rgb, or rgba format
   * @param opacity - Opacity value between 0 and 1
   * @returns Color in rgba format
   */
  const convertToRgba = (color: string, opacity: number): string => {
    // If already rgba, extract rgb values and apply new opacity
    if (color.startsWith('rgba')) {
      const rgbaMatch = color.match(/rgba?\(([^)]+)\)/)
      if (rgbaMatch) {
        const values = rgbaMatch[1].split(',').map((v) => v.trim())
        const r = values[0]
        const g = values[1]
        const b = values[2]
        return `rgba(${r}, ${g}, ${b}, ${opacity})`
      }
    }

    // If rgb, extract values and add opacity
    if (color.startsWith('rgb')) {
      const rgbMatch = color.match(/rgb\(([^)]+)\)/)
      if (rgbMatch) {
        const values = rgbMatch[1].split(',').map((v) => v.trim())
        const r = values[0]
        const g = values[1]
        const b = values[2]
        return `rgba(${r}, ${g}, ${b}, ${opacity})`
      }
    }

    // If hex, convert to rgba
    if (color.startsWith('#')) {
      const hex = color.replace('#', '')
      let r: number, g: number, b: number

      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16)
        g = parseInt(hex[1] + hex[1], 16)
        b = parseInt(hex[2] + hex[2], 16)
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16)
        g = parseInt(hex.slice(2, 4), 16)
        b = parseInt(hex.slice(4, 6), 16)
      } else {
        console.warn(`Invalid hex color format: ${color}`)
        return `rgba(0, 0, 0, ${opacity})`
      }

      return `rgba(${r}, ${g}, ${b}, ${opacity})`
    }

    // Fallback for unrecognized formats
    console.warn(`Unrecognized color format: ${color}`)
    return `rgba(0, 0, 0, ${opacity})`
  }

  /**
   * Gets the computed color value from a CSS variable string with optional opacity
   * @param cssVariableValue - The CSS variable string like 'var(--color-brand-50)'
   * @param opacity - Optional opacity value between 0 and 1
   * @returns The actual color value (hex, rgb, or rgba)
   */
  const getColor: GetColorType = (cssVariableValue, darkCssVariableValue, opacity) => {
    // In some case we want different dark mode color which does not have mapping in css variable.
    if (isDark.value) {
      cssVariableValue = darkCssVariableValue ?? cssVariableValue
    }

    const cacheKey = opacity !== undefined ? `${cssVariableValue}:${opacity}` : cssVariableValue

    if (colorCache.has(cacheKey)) {
      return colorCache.get(cacheKey)!
    }

    let baseColor = cssVariableValue

    // Handle CSS variables
    if (cssVariableValue.startsWith('var(')) {
      const variableName = cssVariableValue.match(/var\((--[^)]+)\)/)?.[1]

      if (!variableName) {
        console.warn(`Invalid CSS variable format: ${cssVariableValue}`)
        baseColor = cssVariableValue
      } else {
        // Get the computed value from the document root
        const computedValue = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim()

        if (!computedValue) {
          console.warn(`CSS variable ${variableName} not found or has no value`)
          baseColor = '#000000' // Fallback color
        } else {
          baseColor = computedValue
        }
      }
    }

    // If no opacity specified, return the base color
    if (opacity === undefined) {
      colorCache.set(cacheKey, baseColor)
      return baseColor
    }

    // Clamp opacity between 0 and 1
    const clampedOpacity = Math.max(0, Math.min(1, opacity))

    // Convert color to rgba format with opacity
    const colorWithOpacity = convertToRgba(baseColor, clampedOpacity)

    colorCache.set(cacheKey, colorWithOpacity)
    return colorWithOpacity
  }
  const clearColorCache = () => {
    colorCache.clear()
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

  watch(isDark, () => {
    clearColorCache()
  })

  init()

  onMounted(init)

  return {
    selectedTheme,
    isDark,
    setTheme,
    toggleTheme,
    init,
    isThemeEnabled,
    getColor,
    clearColorCache,
  }
})
