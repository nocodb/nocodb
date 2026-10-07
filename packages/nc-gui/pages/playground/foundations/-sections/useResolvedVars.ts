import { getI18n } from '~/plugins/a.i18n'

/** `dark` resolves in a [theme='dark'] probe, so it only differs from `light` while the app is light */
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
    // the token style is written in its own watcher; read after it lands
    requestAnimationFrame(() => version.value++)
  }

  watch([isDark, themeRepaintVersion], bump)

  onMounted(bump)

  return { isDark, version, lightProbe, darkProbe, resolveLight, resolveDark }
}

export function toHex(value: string) {
  const short = value.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i)
  if (short)
    return `#${short
      .slice(1)
      .map((v) => (v ?? '').repeat(2))
      .join('')}`.toLowerCase()
  const m = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i)
  if (!m) return value
  return `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`
}

export function isLightColor(value: string) {
  const m = toHex(value).match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i)
  if (!m) return true
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
    const c = parseInt(v, 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  // above ~0.18 black text out-contrasts white
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18
}

export function copyText(text: string) {
  const { t } = getI18n().global
  navigator.clipboard?.writeText(text).then(() => message.success(t('msg.success.copiedValue', { value: text })))
}
