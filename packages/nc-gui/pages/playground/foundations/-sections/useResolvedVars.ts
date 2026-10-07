/**
 * Resolves CSS custom properties against probe elements so values follow the
 * token editor and theme toggle. `dark` resolves inside a `[theme='dark']` probe,
 * which only differs from `light` while the app itself is in light mode.
 */
export function useResolvedVars() {
  const { isDark, themeRepaintVersion } = useTheme()

  const lightProbe = ref<HTMLElement>()

  const darkProbe = ref<HTMLElement>()

  const version = ref(0)

  function read(el: HTMLElement | undefined, name: string) {
    // eslint-disable-next-line no-unused-expressions
    version.value
    if (!el) return ''
    return getComputedStyle(el).getPropertyValue(name).trim()
  }

  function resolveLight(name: string) {
    return read(lightProbe.value, name)
  }

  function resolveDark(name: string) {
    return read(darkProbe.value, name)
  }

  function bump() {
    // the token style is written in a watcher of its own — read after it lands
    requestAnimationFrame(() => version.value++)
  }

  watch([isDark, themeRepaintVersion], bump)

  onMounted(bump)

  return { isDark, version, lightProbe, darkProbe, resolveLight, resolveDark }
}

export function toHex(value: string) {
  const m = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i)
  if (!m) return value
  return `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`
}

export function copyText(text: string) {
  navigator.clipboard?.writeText(text).then(() => message.success(`Copied ${text}`))
}
